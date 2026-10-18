const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
const context = vm.createContext({ console });
vm.runInContext(source, context);
const { CONFIG, createGame, createEnemy, runEnemyTurn, nextStepToPlayer } = vm.runInContext(
  '({ CONFIG, createGame, createEnemy, runEnemyTurn, nextStepToPlayer })', context);
const key = ({ x, y }) => `${x},${y}`;
function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}
function reachable(map, start) {
  const visited = new Set([key(start)]);
  const queue = [start];
  for (let i = 0; i < queue.length; i += 1) {
    const { x, y } = queue[i];
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const next = { x: x + dx, y: y + dy };
      if (!map.tiles[next.y] || !map.tiles[next.y][next.x] || map.tiles[next.y][next.x] === '#' || visited.has(key(next))) continue;
      visited.add(key(next));
      queue.push(next);
    }
  }
  return visited;
}
function arena() {
  const game = createGame(seededRandom(7));
  const state = game.state;
  state.map.tiles = Array.from({ length: CONFIG.HEIGHT }, (_, y) =>
    Array.from({ length: CONFIG.WIDTH }, (_, x) => x === 0 || y === 0 || x === CONFIG.WIDTH - 1 || y === CONFIG.HEIGHT - 1 ? '#' : '.'));
  Object.assign(state.player, { x: 5, y: 5 });
  state.enemies = [];
  state.items = [];
  return game;
}
function enemy(state, type, x, y) {
  const result = createEnemy(type, { x, y }, state.enemies.length);
  state.enemies.push(result);
  return result;
}
function enterStairs(game) {
  const state = game.state;
  state.enemies = [];
  const stair = state.map.stairs[0];
  for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    const x = stair.x + dx;
    const y = stair.y + dy;
    if (state.map.tiles[y]?.[x] && state.map.tiles[y][x] !== '#') {
      Object.assign(state.player, { x, y });
      game.act('move', -dx, -dy);
      return;
    }
  }
  assert.fail('계단에 인접한 통행 타일이 필요함');
}

test('1,000 seeds × 3 floors: room count, connectivity, boundaries, stairs and spawn separation', () => {
  const roomCounts = new Set();
  for (let seed = 0; seed < 1000; seed += 1) {
    const game = createGame(seededRandom(seed));
    for (let floor = 1; floor <= 3; floor += 1) {
      const { map, player, enemies, items } = game.state;
      assert.equal(game.state.floor, floor);
      assert.equal(map.tiles.length, 15);
      assert.ok(map.tiles.every((row) => row.length === 20));
      assert.ok(map.rooms.length >= 4 && map.rooms.length <= 6);
      roomCounts.add(map.rooms.length);
      assert.ok(map.tiles[0].every((tile) => tile === '#'));
      assert.ok(map.tiles[14].every((tile) => tile === '#'));
      assert.ok(map.tiles.every((row) => row[0] === '#' && row[19] === '#'));
      const reached = reachable(map, player);
      for (let y = 0; y < 15; y += 1) {
        for (let x = 0; x < 20; x += 1) {
          if (map.tiles[y][x] !== '#') assert.ok(reached.has(key({ x, y })), `seed=${seed}, floor=${floor}`);
        }
      }
      assert.equal(map.tiles.flat().filter((tile) => tile === '>').length, 2);
      const objects = [player, ...map.stairs, ...enemies, ...items];
      assert.equal(new Set(objects.map(key)).size, objects.length);
      assert.ok(objects.every((position) => reached.has(key(position))));
      assert.equal(items.filter((item) => item.type === 'potion').length, 3);
      assert.equal(items.filter((item) => item.type === 'gold').length, 5);
      assert.equal(enemies.filter((entry) => entry.type === 'troll').length, floor === 3 ? 1 : 0);
      assert.equal(enemies.filter((entry) => entry.type === 'goblin').length, CONFIG.GOBLINS_PER_FLOOR[floor - 1]);
      assert.equal(enemies.filter((entry) => entry.type === 'bat').length, CONFIG.BATS_PER_FLOOR[floor - 1]);
      if (floor < 3) enterStairs(game);
    }
  }
  assert.deepEqual([...roomCounts].sort(), [4, 5, 6]);
});

test('invalid actions do not spend turns or move enemies; successful movement does', () => {
  const game = arena();
  const state = game.state;
  const goblin = enemy(state, 'goblin', 10, 5);
  state.map.tiles[5][4] = '#';
  for (const action of [() => game.act('move', -1, 0), () => game.act('move', 1, 1),
    () => game.act('pickup'), () => game.act('potion'), () => game.act('wait')]) {
    assert.equal(action(), false);
    assert.equal(state.turn, 0);
    assert.equal(key(goblin), '10,5');
  }
  assert.equal(game.act('move', 1, 0), true);
  assert.equal(state.turn, 1);
  assert.equal(key(goblin), '9,5');
  assert.equal(key(state.player), '6,5');
});

test('contact attacks keep player in place; a killed enemy cannot retaliate', () => {
  const game = arena();
  const state = game.state;
  const goblin = enemy(state, 'goblin', 6, 5);
  game.act('move', 1, 0);
  assert.equal(goblin.hp, 3);
  assert.equal(state.player.hp, 18);
  assert.equal(key(state.player), '5,5');
  game.act('move', 1, 0);
  assert.equal(state.enemies.length, 0);
  assert.equal(state.player.hp, 18);
  assert.equal(state.turn, 2);
});

test('G collects only the item underfoot; inventory, healing cap and score follow the contract', () => {
  const game = arena();
  const state = game.state;
  state.items = [{ x: 6, y: 5, type: 'potion' }, { x: 7, y: 5, type: 'gold' }];
  game.act('move', 1, 0);
  assert.equal(state.player.potions, 0);
  assert.equal(state.items.length, 2);
  game.act('pickup');
  assert.equal(state.player.potions, 1);
  assert.equal(game.act('potion'), false);
  assert.equal(state.player.potions, 1);
  state.player.hp = 10;
  game.act('potion');
  assert.equal(state.player.hp, 15);
  assert.equal(state.player.potions, 0);
  state.player.hp = 18;
  state.player.potions = 1;
  game.act('potion');
  assert.equal(state.player.hp, 20);
  assert.equal(state.player.potions, 0);
  game.act('move', 1, 0);
  game.act('pickup');
  assert.equal(state.player.gold, 1);
  assert.equal(state.items.length, 0);
});

test('successful pickups and potion use never spend turns or let enemies move or attack', () => {
  for (const type of ['goblin', 'bat', 'troll']) {
    for (const x of [6, 10]) {
      const game = arena();
      const state = game.state;
      const foe = enemy(state, type, x, 5);
      state.player.hp = 10;
      for (const itemType of ['potion', 'gold']) {
        state.items = [{ x: 5, y: 5, type: itemType }];
        assert.equal(game.act('pickup'), false); // Return value indicates turn consumption.
        assert.equal(state.items.length, 0);
        assert.equal(state.player.hp, 10);
        assert.equal(key(foe), `${x},5`);
        assert.equal(state.turn, 0);
      }
      assert.equal(state.player.potions, 1);
      assert.equal(state.player.gold, 1);
      assert.equal(game.act('potion'), false);
      assert.equal(state.player.hp, 15);
      assert.equal(state.player.potions, 0);
      assert.equal(key(foe), `${x},5`);
      assert.equal(state.turn, 0);
    }
  }
});

test('bats move up to two cells and attack once when reaching adjacency', () => {
  const game = arena();
  const state = game.state;
  const bat = enemy(state, 'bat', 9, 5);
  runEnemyTurn(state);
  assert.equal(key(bat), '7,5');
  assert.equal(state.player.hp, 20);
  runEnemyTurn(state);
  assert.equal(key(bat), '6,5');
  assert.equal(state.player.hp, 19);
  runEnemyTurn(state);
  assert.equal(key(bat), '6,5');
  assert.equal(state.player.hp, 18);
  // Reaching adjacency on the second movement cell also attacks exactly once.
  Object.assign(bat, { x: 8, y: 5 });
  runEnemyTurn(state);
  assert.equal(key(bat), '6,5');
  assert.equal(state.player.hp, 17);
});

test('goblins and trolls move once, then use a later turn to attack', () => {
  for (const type of ['goblin', 'troll']) {
    const game = arena();
    const state = game.state;
    const foe = enemy(state, type, 7, 5);
    runEnemyTurn(state);
    assert.equal(key(foe), '6,5');
    assert.equal(state.player.hp, 20);
    runEnemyTurn(state);
    assert.equal(state.player.hp, 20 - CONFIG.ENEMIES[type].attack);
  }
});

test('pathfinding follows shortest routes and up/right/down/left ties; blockers cannot overlap', () => {
  const game = arena();
  const state = game.state;
  Object.assign(state.player, { x: 5, y: 3 });
  const goblin = enemy(state, 'goblin', 3, 5);
  assert.equal(key(nextStepToPlayer(state, goblin)), '3,4');
  state.map.tiles[4][3] = '#';
  assert.equal(key(nextStepToPlayer(state, goblin)), '4,5');
  enemy(state, 'goblin', 4, 5);
  assert.equal(key(nextStepToPlayer(state, goblin)), '3,6');
  for (let turn = 0; turn < 4; turn += 1) {
    runEnemyTurn(state);
    assert.equal(new Set(state.enemies.map(key)).size, state.enemies.length);
    assert.ok(state.enemies.every((entry) => key(entry) !== key(state.player)));
  }
});

test('unreachable enemies wait and cannot cross walls', () => {
  const game = arena();
  const state = game.state;
  const bat = enemy(state, 'bat', 8, 5);
  for (const [x, y] of [[8, 4], [9, 5], [8, 6], [7, 5]]) state.map.tiles[y][x] = '#';
  assert.equal(nextStepToPlayer(state, bat), null);
  runEnemyTurn(state);
  assert.equal(key(bat), '8,5');
});

test('both stairs descend immediately, preserve stats and skip old and new enemy turns', () => {
  for (const stairIndex of [0, 1]) {
    const game = arena();
    const state = game.state;
    Object.assign(state.player, { hp: 12, gold: 4, potions: 2 });
    state.map.tiles[5][6] = '>';
    state.map.stairs[stairIndex] = { x: 6, y: 5 };
    enemy(state, 'goblin', 5, 4);
    game.act('move', 1, 0);
    assert.equal(state.floor, 2);
    assert.equal(state.player.hp, 12);
    assert.equal(state.player.gold, 4);
    assert.equal(state.player.potions, 2);
    assert.equal(key(state.player), key(state.map.start));
    assert.equal(state.turn, 1);
    enterStairs(game);
    assert.equal(state.floor, 3);
    assert.equal(state.enemies.filter((entry) => entry.type === 'troll').length, 1);
  }
});

test('third-floor stairs remain blocked and skip enemy actions', () => {
  const game = arena();
  const state = game.state;
  state.floor = 3;
  state.map.tiles[5][6] = '>';
  enemy(state, 'goblin', 5, 4);
  game.act('move', 1, 0);
  assert.equal(state.floor, 3);
  assert.equal(state.player.hp, 20);
  assert.equal(state.messages[0], '더 내려갈 길이 없다.');
  assert.equal(state.turn, 1);
});

test('boss death wins immediately and suppresses retaliation and later inputs', () => {
  const game = arena();
  const state = game.state;
  state.floor = 3;
  state.player.gold = 7;
  enemy(state, 'goblin', 5, 4);
  enemy(state, 'troll', 6, 5).hp = 3;
  game.act('move', 1, 0);
  assert.equal(state.phase, 'won');
  assert.equal(state.player.hp, 20);
  assert.equal(state.player.gold, 7);
  assert.equal(game.act('move', 0, 1), false);
  assert.equal(key(state.player), '5,5');
});

test('death interrupts the enemy list; R replaces every game state field', () => {
  const game = arena();
  const state = game.state;
  Object.assign(state.player, { hp: 1, gold: 9, potions: 3 });
  state.floor = 3;
  enemy(state, 'goblin', 5, 4);
  const laterBat = enemy(state, 'bat', 9, 5);
  game.act('move', -1, 0);
  assert.equal(state.phase, 'playing'); // Goblin moves closer without attacking yet.
  const batBeforeDeath = key(laterBat);
  game.act('move', 1, 0); // The player attacks the goblin now at (5,5).
  assert.equal(state.phase, 'dead');
  assert.equal(state.player.hp, 0);
  assert.equal(key(laterBat), batBeforeDeath); // No action after the lethal enemy attack.
  game.act('restart');
  const fresh = game.state;
  assert.notEqual(fresh, state);
  assert.equal(fresh.phase, 'playing');
  assert.equal(fresh.floor, 1);
  assert.equal(fresh.turn, 0);
  assert.equal(fresh.player.hp, 20);
  assert.equal(fresh.player.gold, 0);
  assert.equal(fresh.player.potions, 0);
  assert.equal(fresh.player.attack, 3);
  assert.notEqual(fresh.map, state.map);
  assert.notEqual(fresh.items, state.items);
  assert.notEqual(fresh.enemies, state.enemies);
  assert.ok(fresh.messages.length <= 3);
});

function fakeDocument({ missing = [], readyState = 'complete', list = true } = {}) {
  const listeners = {};
  const calls = [];
  const context2d = { fillRect() {}, fillText() { calls.push('glyph'); } };
  const makeElement = (tagName = 'DIV') => ({
    tagName, style: {}, attributes: {}, hidden: false, textContent: '', children: [],
    setAttribute(name, value) { this.attributes[name] = value; },
    replaceChildren(...children) { this.children = children; }
  });
  const ids = ['gameCanvas', 'status-hp', 'status-floor', 'status-gold', 'messages',
    'end-screen', 'end-title', 'end-score', 'restart-hint', 'status-potions', 'status-phase'];
  const nodes = Object.fromEntries(ids.filter((id) => !missing.includes(id)).map((id) => [id, makeElement()]));
  if (nodes.gameCanvas) nodes.gameCanvas.getContext = () => context2d;
  nodes.messages.tagName = list ? 'UL' : 'DIV';
  const document = {
    readyState,
    getElementById(id) { return nodes[id] || null; },
    createElement(tagName) { return makeElement(tagName.toUpperCase()); },
    addEventListener(name, listener) { (listeners[name] ||= []).push(listener); }
  };
  const errors = [];
  const sandbox = vm.createContext({ document, console: { error(message) { errors.push(message); } } });
  vm.runInContext(source, sandbox);
  function press(key, extra = {}) {
    const event = { key, repeat: false, preventDefault() { this.prevented = true; }, ...extra };
    for (const listener of listeners.keydown || []) listener(event);
    return event;
  }
  return { nodes, sandbox, listeners, errors, calls, press };
}

test('DOM contract initializes Canvas/HUD/messages; repeated and modified keys are ignored', () => {
  const dom = fakeDocument();
  assert.equal(dom.errors.length, 0);
  assert.equal(dom.nodes.gameCanvas.width, 640);
  assert.equal(dom.nodes.gameCanvas.height, 480);
  assert.equal(dom.nodes['status-hp'].textContent, '20/20');
  assert.equal(dom.nodes['status-floor'].textContent, '1/3층');
  assert.equal(dom.nodes['status-gold'].textContent, '0');
  assert.equal(dom.nodes['status-potions'].textContent, '0');
  assert.equal(dom.nodes['status-phase'].textContent, '탐험 중');
  assert.equal(dom.nodes['end-screen'].hidden, true);
  assert.equal(dom.nodes.messages.children.length, 2);
  assert.ok(dom.nodes.messages.children.every((entry) => entry.tagName === 'LI'));
  assert.equal(dom.listeners.keydown.length, 1);
  const before = dom.calls.length;
  assert.equal(dom.press('ArrowUp', { repeat: true }).prevented, true);
  dom.press('g', { metaKey: true });
  dom.press('g', { target: { tagName: 'INPUT' } });
  assert.equal(dom.calls.length, before);
  assert.equal(dom.press('ArrowLeft').prevented, true);
  dom.press('G');
  assert.ok(dom.nodes.messages.children.length <= 3);
  dom.press('ㅎ', { code: 'KeyG', isComposing: true });
  assert.equal(dom.nodes.messages.children[0].textContent, '여기에는 주울 아이템이 없다.');
});

test('missing DOM IDs report a clear error; DOMContentLoaded defers startup', () => {
  const missing = fakeDocument({ missing: ['status-hp'] });
  assert.equal(missing.errors.length, 1);
  assert.match(missing.errors[0], /status-hp/);
  assert.equal(missing.listeners.keydown, undefined);
  const waiting = fakeDocument({ readyState: 'loading' });
  assert.equal(waiting.listeners.keydown, undefined);
  assert.equal(waiting.listeners.DOMContentLoaded.length, 1);
  waiting.listeners.DOMContentLoaded[0]();
  assert.equal(waiting.listeners.keydown.length, 1);
});

test('end overlays show score and uppercase R restarts from the keyboard', () => {
  // Override the constructor only in this isolated VM to exercise actual DOM handlers.
  const fixtureGame = arena();
  fixtureGame.state.phase = 'won';
  fixtureGame.state.player.gold = 6;
  const endDom = fakeDocument({ readyState: 'loading' });
  endDom.sandbox.fixtureGame = fixtureGame;
  vm.runInContext('createGame = () => fixtureGame;', endDom.sandbox);
  endDom.listeners.DOMContentLoaded[0]();
  assert.equal(endDom.nodes['end-title'].textContent, '승리');
  assert.equal(endDom.nodes['status-phase'].textContent, '던전 정복');
  assert.equal(endDom.nodes['end-score'].textContent, '점수: 6');
  assert.equal(endDom.nodes['end-screen'].hidden, false);
  endDom.press('g');
  assert.equal(endDom.nodes['end-title'].textContent, '승리');
  endDom.press('R');
  assert.equal(endDom.nodes['end-screen'].hidden, true);
  assert.equal(endDom.nodes['status-gold'].textContent, '0');
  assert.equal(endDom.nodes['status-floor'].textContent, '1/3층');
  assert.equal(endDom.nodes['status-phase'].textContent, '탐험 중');
  fixtureGame.state.phase = 'dead';
  const deathDom = fakeDocument({ readyState: 'loading' });
  deathDom.sandbox.fixtureGame = fixtureGame;
  vm.runInContext('createGame = () => fixtureGame;', deathDom.sandbox);
  deathDom.listeners.DOMContentLoaded[0]();
  assert.equal(deathDom.nodes['end-title'].textContent, '사망');
  assert.equal(deathDom.nodes['status-phase'].textContent, '탐험 종료');
});
