'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const engine = require('../src/engine');

const data = {
  plants: [
    { id: 'sprout', name: '새싹', baseCost: 10, incomePerSec: 0.5, costGrowth: 1.15 },
    { id: 'fern', name: '고사리', baseCost: 50, incomePerSec: 3, costGrowth: 1.2 }
  ],
  upgrades: [
    { id: 'soil', name: '흙', cost: 20, multiplier: 2 },
    { id: 'light', name: '빛', cost: 40, multiplier: 3 }
  ]
};
const fresh = () => engine.createState(data);

test('초기 상태는 식물 수가 0이며 호출 사이에 공유되지 않는다', () => {
  const a = fresh();
  assert.deepEqual(a, { coins: 0, total: 0, plants: { sprout: 0, fern: 0 }, upgrades: {} });
  a.plants.sprout = 5;
  a.upgrades.soil = true;
  assert.deepEqual(fresh().plants, { sprout: 0, fern: 0 });
  assert.deepEqual(fresh().upgrades, {});
});

test('물주기는 기본 1코인, 식물 10개마다 1코인을 추가한다', () => {
  const state = fresh();
  assert.equal(engine.water(state, data), 1);
  state.plants.sprout = 9;
  assert.equal(engine.water(state, data), 1);
  state.plants.fern = 1;
  assert.equal(engine.water(state, data), 2);
  assert.equal(state.coins, 4);
  assert.equal(state.total, 4);
});

test('가격은 보유 수에 따라 증가하고 소수점은 버린다', () => {
  const state = fresh();
  assert.equal(engine.costOf(state, 'sprout', data), 10);
  state.plants.sprout = 3;
  assert.equal(engine.costOf(state, 'sprout', data), Math.floor(10 * 1.15 ** 3));
  assert.equal(engine.costOf(state, 'unknown', data), Infinity);
});

test('구매는 정확한 잔액에서 성공하고 누적 수입을 차감하지 않는다', () => {
  const state = fresh();
  state.coins = state.total = 10;
  assert.equal(engine.buy(state, 'sprout', data), true);
  assert.equal(state.coins, 0);
  assert.equal(state.total, 10);
  assert.equal(state.plants.sprout, 1);
  const before = engine.serialize(state);
  assert.equal(engine.buy(state, 'sprout', data), false);
  assert.equal(engine.buy(state, 'unknown', data), false);
  assert.equal(engine.serialize(state), before);
});

test('업그레이드는 한 번만 구매되며 부족한 잔액과 잘못된 ID는 거절한다', () => {
  const state = fresh();
  assert.equal(engine.buyUpgrade(state, 'soil', data), false);
  state.coins = state.total = 60;
  assert.equal(engine.buyUpgrade(state, 'soil', data), true);
  assert.equal(state.coins, 40);
  const before = engine.serialize(state);
  assert.equal(engine.buyUpgrade(state, 'soil', data), false);
  assert.equal(engine.buyUpgrade(state, 'unknown', data), false);
  assert.equal(engine.serialize(state), before);
  assert.equal(state.total, 60);
});

test('초당 수입에 구매한 업그레이드 배율을 모두 곱하고 경과 시간을 적용한다', () => {
  const state = fresh();
  assert.equal(engine.incomePerSec(state, data), 0);
  state.plants.sprout = 2;
  state.plants.fern = 1;
  assert.equal(engine.incomePerSec(state, data), 4);
  state.upgrades = { soil: true, light: true };
  assert.equal(engine.incomePerSec(state, data), 24);
  engine.tick(state, 0.25, data);
  assert.equal(state.coins, 6);
  assert.equal(state.total, 6);
});

test('유효하지 않은 경과 시간과 오버플로는 상태를 오염시키지 않는다', () => {
  const state = fresh();
  state.plants.fern = 1;
  const before = engine.serialize(state);
  for (const dt of [-1, 0, NaN, Infinity, '1', undefined, Number.MAX_VALUE]) {
    engine.tick(state, dt, data);
    assert.equal(engine.serialize(state), before);
  }
});

test('직렬화와 불러오기는 소수 잔액 및 구매 정보를 보존한다', () => {
  const state = fresh();
  state.coins = 12.5;
  state.total = 100;
  state.plants.fern = 3;
  state.upgrades.soil = true;
  assert.deepEqual(engine.load(engine.serialize(state), data), state);
});

test('잘못된 저장 입력은 초기 상태로 돌아간다', () => {
  const invalid = [undefined, {}, '', '{', 'null', '[]', '{}'];
  for (const patch of [
    { coins: -1 }, { coins: '3' }, { total: -5 }, { total: null },
    { plants: [] }, { plants: { sprout: -1 } }, { plants: { sprout: 1.5 } },
    { plants: { sprout: Number.MAX_SAFE_INTEGER + 1 } },
    { upgrades: [] }, { upgrades: { soil: 'true' } }
  ]) invalid.push(JSON.stringify({ ...fresh(), ...patch }));
  invalid.push('{"coins":1e999,"total":0,"plants":{},"upgrades":{}}');
  for (const input of invalid) assert.deepEqual(engine.load(input, data), fresh());
});

test('저장 데이터의 미등록 항목은 버리고 누락된 식물은 0으로 채운다', () => {
  const state = engine.load(JSON.stringify({ coins: 2, total: 3,
    plants: { fern: 1, unknown: 999 }, upgrades: { soil: true, light: false, unknown: true }
  }), data);
  assert.deepEqual(state, { coins: 2, total: 3,
    plants: { sprout: 0, fern: 1 }, upgrades: { soil: true } });
});

test('UMD는 브라우저 전역과 Node require(./data)를 통해 기본 데이터를 읽는다', () => {
  const source = fs.readFileSync(require.resolve('../src/engine'), 'utf8');
  const browser = { window: { GreenData: data } };
  vm.runInNewContext(source, browser);
  assert.equal(browser.window.GreenEngine.water(browser.window.GreenEngine.createState()), 1);
  const node = { module: { exports: {} }, require(id) {
    assert.equal(id, './data');
    return data;
  } };
  vm.runInNewContext(source, node);
  const api = node.module.exports;
  const state = api.createState();
  state.coins = state.total = 100;
  assert.equal(api.buy(state, 'sprout'), true);
  assert.equal(api.buyUpgrade(state, 'soil'), true);
  api.tick(state, 2);
  assert.equal(api.incomePerSec(state), 1);
  assert.equal(api.costOf(state, 'sprout'), 11);
  assert.equal(api.serialize(api.load(api.serialize(state))), api.serialize(state));
});
