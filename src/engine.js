(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(function () { return require('./data'); });
  } else {
    root.GreenEngine = factory(function () { return root.GreenData; });
  }
}(typeof window !== 'undefined' ? window : globalThis, function (getData) {
  'use strict';

  // Every API accepts an optional final data argument for isolated tests.
  function dataOf(data) { return data || getData(); }
  function validNumber(value) { return Number.isFinite(value) && value >= 0; }
  function countOf(state, id) { return state.plants[id] || 0; }

  function createState(data) {
    data = dataOf(data);
    var plants = {};
    data.plants.forEach(function (plant) { plants[plant.id] = 0; });
    return { coins: 0, total: 0, plants: plants, upgrades: {} };
  }

  function incomePerSec(state, data) {
    data = dataOf(data);
    var income = data.plants.reduce(function (sum, plant) {
      return sum + countOf(state, plant.id) * plant.incomePerSec;
    }, 0);
    return data.upgrades.reduce(function (sum, upgrade) {
      return state.upgrades[upgrade.id] === true ? sum * upgrade.multiplier : sum;
    }, income);
  }

  function earn(state, amount) {
    if (!validNumber(amount) || !Number.isFinite(state.coins + amount) ||
        !Number.isFinite(state.total + amount)) return 0;
    state.coins += amount;
    state.total += amount;
    return amount;
  }

  function tick(state, dtSec, data) {
    if (validNumber(dtSec) && dtSec > 0) {
      earn(state, incomePerSec(state, data) * dtSec);
    }
    return state;
  }

  function water(state, data) {
    var count = dataOf(data).plants.reduce(function (sum, plant) {
      return sum + countOf(state, plant.id);
    }, 0);
    return earn(state, 1 + Math.floor(count / 10));
  }

  function costOf(state, plantId, data) {
    var plant = dataOf(data).plants.find(function (item) { return item.id === plantId; });
    return plant ? Math.floor(plant.baseCost * Math.pow(plant.costGrowth, countOf(state, plantId))) : Infinity;
  }

  function buy(state, plantId, data) {
    data = dataOf(data);
    var cost = costOf(state, plantId, data);
    var count = countOf(state, plantId);
    if (!Number.isFinite(cost) || cost < 0 || state.coins < cost ||
        !Number.isSafeInteger(count + 1)) return false;
    state.coins -= cost;
    state.plants[plantId] = count + 1;
    return true;
  }

  function buyUpgrade(state, upgradeId, data) {
    var upgrade = dataOf(data).upgrades.find(function (item) { return item.id === upgradeId; });
    if (!upgrade || state.upgrades[upgradeId] === true ||
        !validNumber(upgrade.cost) || state.coins < upgrade.cost) return false;
    state.coins -= upgrade.cost;
    state.upgrades[upgradeId] = true;
    return true;
  }

  function serialize(state) { return JSON.stringify(state); }

  function load(text, data) {
    data = dataOf(data);
    var fresh = createState(data);
    try {
      if (typeof text !== 'string') return fresh;
      var saved = JSON.parse(text);
      if (!saved || !validNumber(saved.coins) || !validNumber(saved.total) ||
          !saved.plants || typeof saved.plants !== 'object' || Array.isArray(saved.plants) ||
          !saved.upgrades || typeof saved.upgrades !== 'object' || Array.isArray(saved.upgrades)) return fresh;
      for (var plant of data.plants) {
        var count = saved.plants[plant.id];
        if (count === undefined) continue;
        if (!Number.isSafeInteger(count) || count < 0) return createState(data);
        fresh.plants[plant.id] = count;
      }
      for (var upgrade of data.upgrades) {
        var owned = saved.upgrades[upgrade.id];
        if (owned === undefined) continue;
        if (typeof owned !== 'boolean') return createState(data);
        if (owned) fresh.upgrades[upgrade.id] = true;
      }
      fresh.coins = saved.coins;
      fresh.total = saved.total;
      return fresh;
    } catch (_) {
      return createState(data);
    }
  }

  return { createState: createState, tick: tick, water: water, buy: buy,
    costOf: costOf, buyUpgrade: buyUpgrade, incomePerSec: incomePerSec,
    serialize: serialize, load: load };
}));
