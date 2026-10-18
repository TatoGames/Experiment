/* Local integration fixtures only. Production index.html never loads this file. */
const originalCreateGame = createGame;
let browserGame;
createGame = (...args) => (browserGame = originalCreateGame(...args));

document.addEventListener('DOMContentLoaded', async () => {
  const canvas = document.getElementById('gameCanvas');
  const results = [];
  const text = (id) => document.getElementById(id).textContent;
  const press = (key, code = '', extra = {}) => document.dispatchEvent(new KeyboardEvent('keydown', {
    key, code, bubbles: true, cancelable: true, ...extra
  }));
  const check = (label, condition) => {
    results.push({ label, passed: Boolean(condition) });
    if (!condition) throw new Error(label);
  };
  const position = (entity) => `${entity.x},${entity.y}`;
  function arena() {
    browserGame.restart();
    const state = browserGame.state;
    state.map.tiles = Array.from({ length: CONFIG.HEIGHT }, (_, y) =>
      Array.from({ length: CONFIG.WIDTH }, (_, x) =>
        x === 0 || y === 0 || x === CONFIG.WIDTH - 1 || y === CONFIG.HEIGHT - 1 ? '#' : '.'));
    Object.assign(state.player, { x: 5, y: 5 });
    state.enemies = [];
    state.items = [];
    press('g', 'KeyG'); // Render the fixture using the real input handler.
    return state;
  }
  function foe(state, type, x, y) {
    const enemy = createEnemy(type, { x, y }, state.enemies.length);
    state.enemies.push(enemy);
    return enemy;
  }
  const report = document.createElement('pre');
  report.id = 'qa-results';
  report.style.cssText = 'max-width:820px;white-space:pre-wrap;margin:20px auto;color:#cce8cc;';
  document.body.append(report);
  try {
    check('실제 HTML: Canvas 640×480, 초기 HUD, 로컬 자원만 사용',
      canvas.width === 640 && canvas.height === 480 && text('status-hp') === '20/20' &&
      performance.getEntriesByType('resource').every((entry) => entry.name.startsWith('file:')));
    const initial = JSON.stringify(browserGame.state);
    const pixels = canvas.toDataURL();
    await new Promise((resolve) => setTimeout(resolve, 1200));
    check('1.2초 무입력: 상태·적·Canvas 정지',
      JSON.stringify(browserGame.state) === initial && canvas.toDataURL() === pixels);

    let state = arena();
    const bat = foe(state, 'bat', 10, 5);
    press('ArrowRight');
    check('방향키 이동 및 박쥐 두 칸 이동', state.turn === 1 && position(state.player) === '6,5' && position(bat) === '8,5');
    press('ArrowRight', '', { repeat: true });
    press('a', 'KeyA', { metaKey: true });
    check('자동 반복·브라우저 단축키 무시', state.turn === 1 && position(bat) === '8,5');
    state.map.tiles[5][7] = '#';
    press('d', 'KeyD');
    check('벽 이동은 턴·적 행동 없음', state.turn === 1 && position(bat) === '8,5');
    state.items = [{ x: 6, y: 5, type: 'potion' }];
    state.player.hp = 10;
    press('ㅎ', 'KeyG', { isComposing: true });
    press('1', 'Digit1');
    check('한글 입력 G 줍기·포션 +5·비이동 행동 중 적 정지',
      state.player.hp === 15 && state.player.potions === 0 && state.turn === 1 && position(bat) === '8,5' && text('status-hp') === '15/20');
    state.items = [{ x: 6, y: 5, type: 'gold' }];
    press('G', 'KeyG');
    check('금화 점수 HUD', state.player.gold === 1 && text('status-gold') === '1');

    state = arena();
    const goblin = foe(state, 'goblin', 6, 5);
    press('d', 'KeyD');
    check('접촉 공격·반격·제자리 유지', goblin.hp === 3 && state.player.hp === 18 && position(state.player) === '5,5');
    press('d', 'KeyD');
    check('처치된 적 반격 없음', state.enemies.length === 0 && state.player.hp === 18);
    for (const key of ['w', 'a', 's', 'd']) press(key);
    check('WASD 네 방향 이동', position(state.player) === '5,5');

    state = arena();
    Object.assign(state.player, { hp: 12, gold: 4, potions: 2 });
    for (let floor = 2; floor <= 3; floor += 1) {
      state.map.tiles[5][6] = '>';
      Object.assign(state.player, { x: 5, y: 5 });
      state.enemies = [createEnemy('goblin', { x: 5, y: 4 }, 0)];
      press('ArrowRight');
      check(`${floor}층 전환·능력치 유지·계단 진입 반격 없음`,
        state.floor === floor && state.player.hp === 12 && state.player.gold === 4 && state.player.potions === 2 && text('status-floor') === `${floor}/3층`);
    }
    check('3층 보스 생성', state.enemies.filter((enemy) => enemy.type === 'troll').length === 1);
    state.map.tiles[5][6] = '>';
    Object.assign(state.player, { x: 5, y: 5 });
    state.enemies = [createEnemy('goblin', { x: 5, y: 4 }, 0)];
    press('ArrowRight');
    check('3층 계단 하강 차단', state.floor === 3 && state.player.hp === 12 && state.messages[0] === '더 내려갈 길이 없다.');

    state = arena();
    state.floor = 3;
    state.player.gold = 7;
    foe(state, 'troll', 6, 5).hp = 3;
    foe(state, 'goblin', 5, 4);
    press('d');
    check('보스 처치 즉시 승리·반격 없음·종료 화면과 배지', state.phase === 'won' && state.player.hp === 20 &&
      text('end-title') === '승리' && text('end-score') === '점수: 7' && text('status-phase') === '던전 정복' && !document.getElementById('end-screen').hidden);
    press('s');
    check('종료 후 이동 차단', position(state.player) === '5,5');
    press('R', 'KeyR');
    check('승리 후 R 초기화', browserGame.state !== state && browserGame.state.floor === 1 && browserGame.state.turn === 0 &&
      text('status-hp') === '20/20' && text('status-gold') === '0' && text('status-potions') === '0' && document.getElementById('end-screen').hidden && text('status-phase') === '탐험 중');

    state = arena();
    state.player.hp = 1;
    state.player.gold = 9;
    foe(state, 'goblin', 6, 5);
    const laterBat = foe(state, 'bat', 10, 5);
    press('d');
    check('사망 즉시 적 처리 중단·사망 점수·배지', state.phase === 'dead' && position(laterBat) === '10,5' &&
      text('status-hp') === '0/20' && text('end-title') === '사망' && text('end-score') === '점수: 9' && text('status-phase') === '탐험 종료');
    press('ㄱ', 'KeyR', { isComposing: true });
    check('사망 후 한글 키보드 R 초기화·새 맵·메시지 3줄 이내', browserGame.state !== state && browserGame.state.map !== state.map &&
      browserGame.state.player.hp === 20 && browserGame.state.player.gold === 0 && browserGame.state.player.potions === 0 &&
      document.getElementById('messages').children.length <= 3 && document.getElementById('end-screen').hidden);
    report.textContent = `PASS ${results.length}/${results.length}\n` + results.map((result) => `✓ ${result.label}`).join('\n');
    // Leave reviewable end screens available after the automatic checks finish.
    const controls = document.createElement('div');
    controls.style.cssText = 'max-width:820px;margin:16px auto;display:flex;gap:12px;';
    for (const [label, type] of [['승리 화면 확인', 'troll'], ['사망 화면 확인', 'goblin']]) {
      const button = document.createElement('button');
      button.textContent = label;
      button.addEventListener('click', () => {
        const preview = arena();
        preview.floor = 3;
        preview.player.gold = type === 'troll' ? 7 : 9;
        if (type === 'troll') foe(preview, type, 6, 5).hp = 3;
        else {
          preview.player.hp = 1;
          foe(preview, type, 6, 5);
        }
        press('d', 'KeyD');
        window.scrollTo(0, 0);
      });
      controls.append(button);
    }
    report.before(controls);
  } catch (error) {
    report.style.color = '#ff9999';
    report.textContent = `FAIL: ${error.message}\n` + results.map((result) => `${result.passed ? '✓' : '✗'} ${result.label}`).join('\n');
    console.error(error);
  }
  window.browserCheckResults = results;
});
