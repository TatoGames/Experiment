const CONFIG = Object.freeze({
  WIDTH: 20,
  HEIGHT: 15,
  TILE_SIZE: 32,
  FLOORS: 3,
  ROOMS_MIN: 4,
  ROOMS_MAX: 6,
  MIN_PARTITION_SIZE: 5,
  MIN_ROOM_SIZE: 3,
  STAIRS_PER_FLOOR: 2,
  PLAYER_HP: 20,
  PLAYER_ATTACK: 3,
  POTION_HEAL: 5,
  POTIONS_PER_FLOOR: 3,
  GOLD_PER_FLOOR: 5,
  GOLD_VALUE: 1,
  MESSAGE_LIMIT: 3,
  GOBLINS_PER_FLOOR: [2, 3, 2],
  BATS_PER_FLOOR: [1, 2, 1],
  ENEMIES: Object.freeze({
    goblin: Object.freeze({ name: '고블린', glyph: 'g', hp: 6, attack: 2, speed: 1 }),
    bat: Object.freeze({ name: '박쥐', glyph: 'b', hp: 4, attack: 1, speed: 2 }),
    troll: Object.freeze({ name: '트롤', glyph: 'T', hp: 20, attack: 4, speed: 1 })
  }),
  COLORS: Object.freeze({
    background: '#0c111a', wall: '#334155', wallGlyph: '#617188',
    floor: '#141e2c', floorGlyph: '#36465e', stair: '#b5a4ff',
    player: '#f8eab4', goblin: '#9cda82', bat: '#b8a2ee', troll: '#f38c72',
    potion: '#ef8caa', gold: '#f0cb69', grid: '#1a2637'
  })
});

// ===== map: rooms, connected corridors, stairs and pathfinding =====
const DIRECTIONS = Object.freeze([
  Object.freeze({ x: 0, y: -1 }),
  Object.freeze({ x: 1, y: 0 }),
  Object.freeze({ x: 0, y: 1 }),
  Object.freeze({ x: -1, y: 0 })
]);

function randomInt(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

function shuffle(list, random) {
  const result = list.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randomInt(random, 0, i);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function positionKey(x, y) { return `${x},${y}`; }
function samePosition(a, b) { return a.x === b.x && a.y === b.y; }
function distance(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
function isWalkable(map, x, y) {
  return x >= 0 && y >= 0 && x < CONFIG.WIDTH && y < CONFIG.HEIGHT && map.tiles[y][x] !== '#';
}

function generateDungeon(random = Math.random) {
  const tiles = Array.from({ length: CONFIG.HEIGHT }, () => Array(CONFIG.WIDTH).fill('#'));
  const target = randomInt(random, CONFIG.ROOMS_MIN, CONFIG.ROOMS_MAX);
  const partitions = [{ x: 1, y: 1, w: CONFIG.WIDTH - 2, h: CONFIG.HEIGHT - 2 }];
  const min = CONFIG.MIN_PARTITION_SIZE;
  const capacity = (part) => Math.floor(part.w / min) * Math.floor(part.h / min);

  // Only choose splits that still leave room for the requested number of rooms.
  // This bounds generation time and guarantees 4–6 rooms without retry fallbacks.
  while (partitions.length < target) {
    const totalCapacity = partitions.reduce((sum, part) => sum + capacity(part), 0);
    const options = [];
    partitions.forEach((part, index) => {
      for (const axis of ['w', 'h']) {
        for (let cut = min; cut <= part[axis] - min; cut += 1) {
          const first = { ...part, [axis]: cut };
          const second = { ...part, [axis]: part[axis] - cut };
          second[axis === 'w' ? 'x' : 'y'] += cut;
          if (totalCapacity - capacity(part) + capacity(first) + capacity(second) >= target) {
            options.push({ index, first, second });
          }
        }
      }
    });
    if (!options.length) throw new Error('던전 방 분할에 실패했습니다. CONFIG 크기를 확인하세요.');
    const split = options[randomInt(random, 0, options.length - 1)];
    partitions.splice(split.index, 1, split.first, split.second);
  }

  const rooms = partitions.map((part) => {
    const w = randomInt(random, CONFIG.MIN_ROOM_SIZE, part.w - 2);
    const h = randomInt(random, CONFIG.MIN_ROOM_SIZE, part.h - 2);
    const x = randomInt(random, part.x + 1, part.x + part.w - w - 1);
    const y = randomInt(random, part.y + 1, part.y + part.h - h - 1);
    for (let row = y; row < y + h; row += 1) {
      for (let col = x; col < x + w; col += 1) tiles[row][col] = '.';
    }
    return { x, y, w, h, center: { x: x + Math.floor(w / 2), y: y + Math.floor(h / 2) } };
  });

  const orderedRooms = shuffle(rooms, random);
  function carveCorridor(from, to) {
    let { x, y } = from;
    const horizontalFirst = random() < 0.5;
    for (const axis of horizontalFirst ? ['x', 'y'] : ['y', 'x']) {
      while ((axis === 'x' ? x : y) !== to[axis]) {
        if (axis === 'x') x += Math.sign(to.x - x);
        else y += Math.sign(to.y - y);
        tiles[y][x] = '.';
      }
    }
  }
  for (let i = 1; i < orderedRooms.length; i += 1) {
    carveCorridor(orderedRooms[i - 1].center, orderedRooms[i].center);
  }
  // A second route reduces dead ends while preserving the connected room chain.
  carveCorridor(orderedRooms[0].center, orderedRooms[orderedRooms.length - 1].center);

  const start = { ...orderedRooms[0].center };
  const bossRoom = orderedRooms.slice(1).reduce((best, room) =>
    distance(start, room.center) > distance(start, best.center) ? room : best);
  const bossPosition = { ...bossRoom.center };
  const reserved = new Set([positionKey(start.x, start.y), positionKey(bossPosition.x, bossPosition.y)]);
  const roomTiles = rooms.flatMap((room) => {
    const cells = [];
    for (let y = room.y; y < room.y + room.h; y += 1) {
      for (let x = room.x; x < room.x + room.w; x += 1) {
        if (!reserved.has(positionKey(x, y))) cells.push({ x, y });
      }
    }
    return cells;
  });
  const available = shuffle(roomTiles, random);
  const stairs = available.splice(0, CONFIG.STAIRS_PER_FLOOR);
  stairs.forEach(({ x, y }) => { tiles[y][x] = '>'; });
  return { tiles, rooms, start, bossPosition, stairs, available };
}

function nextStepToPlayer(state, enemy) {
  const occupied = new Set(state.enemies.filter((other) => other !== enemy)
    .map((other) => positionKey(other.x, other.y)));
  const queue = [{ x: enemy.x, y: enemy.y, first: null }];
  const visited = new Set([positionKey(enemy.x, enemy.y)]);
  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head];
    for (const direction of DIRECTIONS) {
      const next = { x: current.x + direction.x, y: current.y + direction.y };
      const key = positionKey(next.x, next.y);
      if (!isWalkable(state.map, next.x, next.y) || occupied.has(key) || visited.has(key)) continue;
      const first = current.first || next;
      if (samePosition(next, state.player)) return first;
      visited.add(key);
      queue.push({ ...next, first });
    }
  }
  return null;
}

// ===== entities: player, floor population, inventory and progression =====
function createPlayer() {
  return { x: 0, y: 0, hp: CONFIG.PLAYER_HP, maxHp: CONFIG.PLAYER_HP,
    attack: CONFIG.PLAYER_ATTACK, gold: 0, potions: 0 };
}

function createEnemy(type, position, id) {
  return { ...CONFIG.ENEMIES[type], ...position, type, id };
}

function addMessage(state, message) {
  state.messages.unshift(message);
  state.messages.length = Math.min(state.messages.length, CONFIG.MESSAGE_LIMIT);
}

function populateFloor(state, random) {
  state.map = generateDungeon(random);
  Object.assign(state.player, state.map.start);
  state.enemies = [];
  state.items = [];
  const available = state.map.available.slice();
  // Keep enemies away from the entrance when space permits.
  available.sort((a, b) => distance(a, state.player) - distance(b, state.player));
  let nextId = 0;
  const spawnEnemy = (type) => {
    const position = available.pop();
    if (!position) throw new Error('적을 배치할 공간이 부족합니다.');
    state.enemies.push(createEnemy(type, position, nextId++));
  };
  for (let i = 0; i < CONFIG.GOBLINS_PER_FLOOR[state.floor - 1]; i += 1) spawnEnemy('goblin');
  for (let i = 0; i < CONFIG.BATS_PER_FLOOR[state.floor - 1]; i += 1) spawnEnemy('bat');
  if (state.floor === CONFIG.FLOORS) {
    state.enemies.push(createEnemy('troll', state.map.bossPosition, nextId++));
  }
  const itemTiles = shuffle(available, random);
  for (const [type, count] of [['potion', CONFIG.POTIONS_PER_FLOOR], ['gold', CONFIG.GOLD_PER_FLOOR]]) {
    for (let i = 0; i < count; i += 1) {
      const position = itemTiles.pop();
      if (!position) throw new Error('아이템을 배치할 공간이 부족합니다.');
      state.items.push({ ...position, type });
    }
  }
  addMessage(state, `${state.floor}층에 도착했다.${state.floor === CONFIG.FLOORS ? ' 트롤을 찾아 처치하자!' : ' > 계단을 찾아 내려가자.'}`);
}

function createGame(random = Math.random) {
  let state;
  function restart() {
    state = { floor: 1, phase: 'playing', turn: 0, player: createPlayer(),
      map: null, enemies: [], items: [], messages: [] };
    addMessage(state, '방향키/WASD 이동 · G 줍기 · 1 포션');
    populateFloor(state, random);
    return state;
  }
  function act(action, dx = 0, dy = 0) {
    if (state.phase !== 'playing') {
      if (action === 'restart') restart();
      return false;
    }
    let consumesTurn = false;
    let skipEnemies = false;
    if (action === 'move') {
      if (Math.abs(dx) + Math.abs(dy) !== 1) return false;
      const destination = { x: state.player.x + dx, y: state.player.y + dy };
      if (!isWalkable(state.map, destination.x, destination.y)) return false;
      const enemy = state.enemies.find((entry) => samePosition(entry, destination));
      if (enemy) attackEnemy(state, enemy);
      else {
        Object.assign(state.player, destination);
        const item = state.items.find((entry) => samePosition(entry, state.player));
        if (state.map.tiles[destination.y][destination.x] === '>') {
          skipEnemies = true;
          if (state.floor < CONFIG.FLOORS) {
            state.floor += 1;
            populateFloor(state, random);
          } else addMessage(state, '더 내려갈 길이 없다.');
        } else if (item) addMessage(state, `${item.type === 'potion' ? '포션 !' : '금화 $'} 발견. G로 줍자.`);
        else addMessage(state, '한 칸 이동했다.');
      }
      consumesTurn = true;
    } else if (action === 'pickup') {
      const index = state.items.findIndex((entry) => samePosition(entry, state.player));
      if (index === -1) addMessage(state, '여기에는 주울 아이템이 없다.');
      else {
        const [item] = state.items.splice(index, 1);
        if (item.type === 'potion') {
          state.player.potions += 1;
          addMessage(state, '포션을 주웠다. 1로 사용한다.');
        } else {
          state.player.gold += CONFIG.GOLD_VALUE;
          addMessage(state, `금화 +${CONFIG.GOLD_VALUE}!`);
        }
      }
    } else if (action === 'potion') {
      if (!state.player.potions) addMessage(state, '사용할 포션이 없다.');
      else if (state.player.hp === state.player.maxHp) addMessage(state, '체력이 이미 가득하다.');
      else {
        const healed = Math.min(CONFIG.POTION_HEAL, state.player.maxHp - state.player.hp);
        state.player.hp += healed;
        state.player.potions -= 1;
        addMessage(state, `포션으로 체력 ${healed} 회복!`);
      }
    }
    if (consumesTurn) {
      state.turn += 1;
      if (!skipEnemies && state.phase === 'playing') runEnemyTurn(state);
    }
    return consumesTurn;
  }
  restart();
  return { get state() { return state; }, act, restart };
}

// ===== combat: contact attacks, enemy turns, immediate death/victory =====
function attackEnemy(state, enemy) {
  enemy.hp -= state.player.attack;
  addMessage(state, `${enemy.name}에게 ${state.player.attack} 피해!`);
  if (enemy.hp <= 0) {
    state.enemies.splice(state.enemies.indexOf(enemy), 1);
    addMessage(state, `${enemy.name}을 처치했다!`);
    if (enemy.type === 'troll') {
      state.phase = 'won';
      addMessage(state, '트롤을 쓰러뜨렸다. 던전 정복!');
    }
  }
}

function attackPlayer(state, enemy) {
  state.player.hp = Math.max(0, state.player.hp - enemy.attack);
  addMessage(state, `${enemy.name}의 공격! 체력 -${enemy.attack}`);
  if (state.player.hp === 0) {
    state.phase = 'dead';
    addMessage(state, '쓰러졌다. R로 다시 도전하자.');
  }
}

function runEnemyTurn(state) {
  for (const enemy of state.enemies) {
    if (state.phase !== 'playing') break;
    if (distance(enemy, state.player) === 1) {
      attackPlayer(state, enemy);
      continue;
    }
    for (let step = 0; step < enemy.speed; step += 1) {
      const next = nextStepToPlayer(state, enemy);
      if (!next || samePosition(next, state.player)) break;
      Object.assign(enemy, next);
      if (distance(enemy, state.player) === 1) {
        // Bats can close the gap and strike; ordinary enemies use their move.
        if (enemy.type === 'bat') attackPlayer(state, enemy);
        break;
      }
    }
  }
}

// ===== ui: Canvas, HUD, three recent messages and keyboard input =====
function initializeUI() {
  const ids = ['gameCanvas', 'status-hp', 'status-floor', 'status-gold', 'messages',
    'end-screen', 'end-title', 'end-score', 'restart-hint'];
  const elements = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
  const missing = ids.filter((id) => !elements[id]);
  if (missing.length) {
    console.error(`미니 로그라이크 초기화 오류: 필수 HTML 요소 누락 (${missing.join(', ')})`);
    return;
  }
  const canvas = elements.gameCanvas;
  const context = canvas.getContext('2d');
  if (!context) {
    console.error('미니 로그라이크 초기화 오류: Canvas 2D를 사용할 수 없습니다.');
    return;
  }
  canvas.width = CONFIG.WIDTH * CONFIG.TILE_SIZE;
  canvas.height = CONFIG.HEIGHT * CONFIG.TILE_SIZE;
  const game = createGame();
  const colors = CONFIG.COLORS;
  const size = CONFIG.TILE_SIZE;
  const potionStatus = document.getElementById('status-potions');
  const phaseStatus = document.getElementById('status-phase');
  elements['restart-hint'].textContent = '[R] 다시 시작';

  function drawGlyph(glyph, x, y, color) {
    context.fillStyle = color;
    context.fillText(glyph, (x + 0.5) * size, (y + 0.5) * size + 1);
  }
  function render() {
    const state = game.state;
    context.fillStyle = colors.background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.font = `bold ${Math.floor(size * 0.72)}px ui-monospace, SFMono-Regular, Consolas, monospace`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    for (let y = 0; y < CONFIG.HEIGHT; y += 1) {
      for (let x = 0; x < CONFIG.WIDTH; x += 1) {
        const tile = state.map.tiles[y][x];
        context.fillStyle = tile === '#' ? colors.wall : colors.floor;
        context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
        drawGlyph(tile, x, y, tile === '#' ? colors.wallGlyph : tile === '>' ? colors.stair : colors.floorGlyph);
      }
    }
    for (const item of state.items) drawGlyph(item.type === 'potion' ? '!' : '$', item.x, item.y,
      item.type === 'potion' ? colors.potion : colors.gold);
    for (const enemy of state.enemies) drawGlyph(enemy.glyph, enemy.x, enemy.y, colors[enemy.type]);
    drawGlyph('@', state.player.x, state.player.y, colors.player);
    canvas.setAttribute('aria-label', `던전 ${state.floor}층, 체력 ${state.player.hp}/${state.player.maxHp}, 금화 ${state.player.gold}, 포션 ${state.player.potions}개`);
    elements['status-hp'].textContent = `${state.player.hp}/${state.player.maxHp}`;
    elements['status-floor'].textContent = `${state.floor}/${CONFIG.FLOORS}층`;
    elements['status-gold'].textContent = String(state.player.gold);
    // An optional HUD slot lets the page show inventory without changing the required IDs.
    if (potionStatus) potionStatus.textContent = String(state.player.potions);
    else elements['status-hp'].textContent += ` · 포션 ${state.player.potions}`;
    const messageNodes = state.messages.map((message) => {
      const line = document.createElement(['UL', 'OL'].includes(elements.messages.tagName) ? 'li' : 'div');
      line.textContent = message;
      return line;
    });
    elements.messages.replaceChildren(...messageNodes);
    const ended = state.phase !== 'playing';
    if (phaseStatus) phaseStatus.textContent = state.phase === 'won' ? '던전 정복' : state.phase === 'dead' ? '탐험 종료' : '탐험 중';
    elements['end-screen'].hidden = !ended;
    elements['end-screen'].setAttribute('aria-hidden', String(!ended));
    // Also support layouts that initially hide the overlay with display:none.
    elements['end-screen'].style.display = ended ? 'flex' : 'none';
    elements['end-title'].textContent = state.phase === 'won' ? '승리' : state.phase === 'dead' ? '사망' : '';
    elements['end-score'].textContent = `점수: ${state.player.gold}`;
  }
  const movement = {
    ArrowUp: [0, -1], ArrowRight: [1, 0], ArrowDown: [0, 1], ArrowLeft: [-1, 0],
    w: [0, -1], d: [1, 0], s: [0, 1], a: [-1, 0]
  };
  const physicalKeys = {
    KeyW: 'w', KeyD: 'd', KeyS: 's', KeyA: 'a', KeyG: 'g', KeyR: 'r', Digit1: '1', Numpad1: '1'
  };
  document.addEventListener('keydown', (event) => {
    const key = physicalKeys[event.code] || (event.key.length === 1 ? event.key.toLowerCase() : event.key);
    if (!movement[key] && !['g', '1', 'r'].includes(key)) return;
    // Preserve browser shortcuts and typing in any surrounding app controls.
    if (event.ctrlKey || event.metaKey || event.altKey || (event.isComposing && !physicalKeys[event.code])) return;
    const target = event.target;
    if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
    event.preventDefault();
    if (event.repeat) return;
    if (game.state.phase !== 'playing') {
      if (key !== 'r') return;
      game.act('restart');
    } else if (movement[key]) game.act('move', ...movement[key]);
    else if (key === 'g') game.act('pickup');
    else if (key === '1') game.act('potion');
    else return;
    render();
  });
  render();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeUI, { once: true });
  } else initializeUI();
}
