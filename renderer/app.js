(function () {
  var Engine = window.GreenEngine;
  var Data = window.GreenData;

  var state = null;
  var els = {
    coins: document.getElementById('coins'),
    income: document.getElementById('income'),
    water: document.getElementById('water-btn'),
    plants: document.getElementById('plants'),
    upgrades: document.getElementById('upgrades'),
    status: document.getElementById('status')
  };
  var plantRows = {};
  var upgradeRows = {};

  function fmt(n) {
    n = Number(n) || 0;
    if (n >= 1e6) return n.toExponential(2).replace('e+', 'e');
    if (n >= 1000) return Math.floor(n).toLocaleString('ko-KR');
    return (Math.round(n * 10) / 10).toString();
  }

  function makeRow(list, name, onBuy) {
    var li = document.createElement('li');
    li.className = 'item';
    var info = document.createElement('div');
    info.className = 'info';
    var nameEl = document.createElement('span');
    nameEl.className = 'name';
    nameEl.textContent = name;
    var meta = document.createElement('span');
    meta.className = 'meta';
    info.appendChild(nameEl);
    info.appendChild(meta);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'buy-btn';
    btn.addEventListener('click', function () {
      onBuy();
      render();
    });
    li.appendChild(info);
    li.appendChild(btn);
    list.appendChild(li);
    return { meta: meta, btn: btn };
  }

  function buildLists() {
    Data.plants.forEach(function (p) {
      plantRows[p.id] = makeRow(els.plants, p.name, function () {
        Engine.buy(state, p.id);
      });
    });
    Data.upgrades.forEach(function (u) {
      upgradeRows[u.id] = makeRow(els.upgrades, u.name, function () {
        Engine.buyUpgrade(state, u.id);
      });
    });
  }

  function render() {
    els.coins.textContent = fmt(state.coins);
    els.income.textContent = fmt(Engine.incomePerSec(state)) + ' /초';

    Data.plants.forEach(function (p) {
      var row = plantRows[p.id];
      var cost = Engine.costOf(state, p.id);
      var owned = (state.plants && state.plants[p.id]) || 0;
      row.meta.textContent = '보유 ' + owned + '개 · 초당 +' + fmt(p.incomePerSec);
      row.btn.textContent = '🪙 ' + fmt(cost);
      row.btn.disabled = state.coins < cost;
    });

    Data.upgrades.forEach(function (u) {
      var row = upgradeRows[u.id];
      var done = !!(state.upgrades && state.upgrades[u.id]);
      row.meta.textContent = '수입 ×' + u.multiplier;
      row.btn.textContent = done ? '구매 완료' : '🪙 ' + fmt(u.cost);
      row.btn.disabled = done || state.coins < u.cost;
    });
  }

  function save() {
    if (!window.api || !window.api.writeSave) return;
    try {
      var r = window.api.writeSave(state);
      if (r && typeof r.catch === 'function') {
        r.catch(function () { els.status.textContent = '저장에 실패했어요'; });
      }
    } catch (e) {
      els.status.textContent = '저장에 실패했어요';
    }
  }

  function start(loaded) {
    state = null;
    if (loaded) {
      try {
        state = Engine.load(typeof loaded === 'string' ? loaded : JSON.stringify(loaded));
      } catch (e) {
        state = null;
      }
    }
    if (!state) state = Engine.createState();

    buildLists();
    render();

    els.water.addEventListener('click', function () {
      Engine.water(state);
      render();
    });

    setInterval(function () {
      Engine.tick(state, 1);
      render();
    }, 1000);

    setInterval(function () {
      save();
      els.status.textContent = '자동 저장됨';
    }, 10000);
  }

  var loading = null;
  try {
    loading = window.api && window.api.loadSave ? window.api.loadSave() : null;
  } catch (e) {
    loading = null;
  }
  Promise.resolve(loading)
    .catch(function () { return null; })
    .then(start);
})();
