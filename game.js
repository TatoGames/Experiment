"use strict";

(() => {
  const SAVE_KEY = "taikun_cafe_save_v1";
  const UPGRADES = [
    { id: "bean", name: "고급 원두", base: 30, stage: 1, icon: "🫘", effect: "클릭당 수입 +1" },
    { id: "part", name: "아르바이트생", base: 50, stage: 1, icon: "🙋", effect: "초당 수입 +1" },
    { id: "machine", name: "에스프레소 머신", base: 300, stage: 2, icon: "☕", effect: "초당 수입 +8" },
    { id: "showcase", name: "디저트 쇼케이스", base: 1500, stage: 3, icon: "🍰", effect: "초당 수입 +40" },
    { id: "coupon", name: "단골 쿠폰", base: 5000, stage: 3, icon: "🎟️", effect: "모든 수입 배율 +5%p" }
  ];
  const STAGES = [null,
    { name: "노점", title: "골목의 작은 노점", description: "정성껏 내린 한 잔으로 첫 손님을 맞이하세요." },
    { name: "동네 카페", title: "이웃이 찾아오는 카페", description: "익숙한 커피 향이 골목을 채우기 시작했어요." },
    { name: "체인점", title: "더 많은 골목에, 한 잔", description: "우리 카페가 여러 동네의 일상이 되었어요." }
  ];
  const $ = id => document.getElementById(id);
  const freshState = () => ({ version: 1, coins: 0, totalEarned: 0, stage: 1,
    owned: { bean: 0, part: 0, machine: 0, showcase: 0, coupon: 0 }, lastSavedAt: Date.now() });
  let state = freshState();
  let lastTick = Date.now();
  const notices = [];
  let noticeOpen = false;
  const format = value => {
    if (value < 1000) return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
    const units = [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]];
    const [divisor, suffix] = units.find(([limit]) => value >= limit);
    return (value / divisor).toFixed(1) + suffix;
  };
  const exact = value => value.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
  const multiplier = () => 1 + 0.05 * state.owned.coupon;
  const perClick = () => (1 + state.owned.bean) * multiplier();
  const perSecond = () => (state.owned.part + state.owned.machine * 8 + state.owned.showcase * 40) * multiplier();
  const price = upgrade => Math.floor(upgrade.base * Math.pow(1.15, state.owned[upgrade.id]));

  function notify(message) {
    notices.push(message);
    showNextNotice();
  }
  function showNextNotice() {
    if (noticeOpen || !notices.length) return;
    $("notice-message").textContent = notices.shift();
    noticeOpen = true;
    $("notice-dialog").showModal();
  }
  $("notice-close").addEventListener("click", () => $("notice-dialog").close());
  $("notice-dialog").addEventListener("close", () => { noticeOpen = false; showNextNotice(); });

  function save() {
    const savedAt = Date.now();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, lastSavedAt: savedAt }));
      state.lastSavedAt = savedAt;
      $("save-status").textContent = `${new Date(savedAt).toLocaleTimeString("ko-KR")} 저장됨`;
      return true;
    } catch {
      $("save-status").textContent = "저장 불가 · 브라우저 저장 설정을 확인하세요";
      return false;
    }
  }
  function checkStages() {
    let changed = false;
    if (state.stage < 2 && state.totalEarned >= 500 && state.owned.part >= 3) {
      state.stage = 2;
      changed = true;
      notify("동네 카페 해금! 이제 커피 머신(machine)을 구매할 수 있어요.");
    }
    if (state.stage === 2 && state.totalEarned >= 10000 && state.owned.machine >= 3) {
      state.stage = 3;
      changed = true;
      notify("체인점 해금! 이제 쇼케이스(showcase)와 쿠폰(coupon)을 구매할 수 있어요.");
    }
    if (changed) save();
  }
  function earn(amount) {
    if (Number.isFinite(amount) && amount > 0 && Number.isFinite(state.coins + amount) && Number.isFinite(state.totalEarned + amount)) {
      state.coins += amount;
      state.totalEarned += amount;
    }
    checkStages();
  }
  function settleIncome() {
    const now = Date.now();
    const dt = Math.max(0, (now - lastTick) / 1000);
    lastTick = now;
    earn(perSecond() * dt);
  }
  function validSave(data) {
    const nonnegative = value => typeof value === "number" && Number.isFinite(value) && value >= 0;
    return data && data.version === 1 && nonnegative(data.coins) && nonnegative(data.totalEarned)
      && Number.isInteger(data.stage) && data.stage >= 1 && data.stage <= 3
      && nonnegative(data.lastSavedAt) && data.owned
      && UPGRADES.every(({ id }) => Number.isSafeInteger(data.owned[id]) && data.owned[id] >= 0)
      && Number.isFinite((data.owned.part + data.owned.machine * 8 + data.owned.showcase * 40) * (1 + .05 * data.owned.coupon));
  }
  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (validSave(data)) {
        state = { version: 1, coins: data.coins, totalEarned: data.totalEarned, stage: data.stage,
          owned: Object.fromEntries(UPGRADES.map(({ id }) => [id, data.owned[id]])), lastSavedAt: data.lastSavedAt };
        const seconds = Math.min(Math.max(0, (Date.now() - state.lastSavedAt) / 1000), 28800);
        if (seconds >= 1 && perSecond() > 0) {
          const income = perSecond() * seconds * .5;
          earn(income);
          notify(`자리를 비운 동안 ${format(income)}코인을 벌었어요`);
        }
      }
    } catch {
      // 읽을 수 없는 저장은 무시하고 새 게임을 진행한다.
    }
    checkStages();
    lastTick = Date.now();
    save();
  }

  const cards = new Map();
  for (const upgrade of UPGRADES) {
    const card = document.createElement("article");
    card.className = "upgrade";
    card.innerHTML = `<div class="upgrade-icon" aria-hidden="true">${upgrade.icon}</div><div><h3>${upgrade.name}<span class="owned"></span></h3><p class="effect">${upgrade.effect}</p><button class="buy"><span></span><span class="buy-label"></span></button><p class="lock-condition"></p></div>`;
    card.querySelector("button").addEventListener("click", () => {
      settleIncome();
      const cost = price(upgrade);
      if (state.stage < upgrade.stage || !Number.isFinite(cost) || state.coins < cost) { render(); return; }
      state.coins -= cost;
      state.owned[upgrade.id] += 1;
      checkStages();
      save();
      render();
    });
    $("upgrades").append(card);
    cards.set(upgrade.id, card);
  }
  function displayNumber(id, value, prefix = "₩") {
    $(id).textContent = prefix + format(value);
    $(id).title = prefix + exact(value);
  }
  function render() {
    displayNumber("coins", state.coins);
    displayNumber("per-click", perClick());
    displayNumber("per-second", perSecond());
    displayNumber("total-earned", state.totalEarned);
    $("multiplier").textContent = "×" + multiplier().toFixed(2);
    $("click-hint").textContent = `한 잔 팔고 ₩${format(perClick())} 받기`;
    $("stage-badge").textContent = `${state.stage}단계 · ${STAGES[state.stage].name}`;
    $("cafe-title").textContent = STAGES[state.stage].title;
    $("stage-description").textContent = STAGES[state.stage].description;
    let percent = 100;
    const conditions = $("growth-conditions");
    conditions.replaceChildren();
    if (state.stage < 3) {
      const target = state.stage === 1 ? 500 : 10000;
      const id = state.stage === 1 ? "part" : "machine";
      const name = state.stage === 1 ? "아르바이트생" : "에스프레소 머신";
      $("growth-title").textContent = `다음 목표 · ${STAGES[state.stage + 1].name}`;
      percent = Math.floor(Math.min(1, state.totalEarned / target, state.owned[id] / 3) * 100);
      for (const [label, current, needed] of [["누적 수입", state.totalEarned, target], [name + " 보유", state.owned[id], 3]]) {
        const row = document.createElement("div");
        row.className = "condition" + (current >= needed ? " done" : "");
        row.textContent = `${current >= needed ? "✓" : "○"} ${label}`;
        const count = document.createElement("span");
        count.textContent = `${format(current)} / ${format(needed)}`;
        row.append(count);
        conditions.append(row);
      }
    } else {
      $("growth-title").textContent = "체인점 · 모든 단계 해금 완료";
      conditions.textContent = "모든 업그레이드로 카페를 계속 키워보세요.";
      conditions.className = "muted";
    }
    $("growth-progress").value = percent;
    $("growth-percent").textContent = percent + "%";
    for (const upgrade of UPGRADES) {
      const card = cards.get(upgrade.id);
      const cost = price(upgrade);
      const locked = state.stage < upgrade.stage;
      card.classList.toggle("locked", locked);
      card.querySelector(".owned").textContent = `보유 ${format(state.owned[upgrade.id])}개`;
      const button = card.querySelector("button");
      button.disabled = locked || state.coins < cost || !Number.isFinite(cost);
      button.firstElementChild.textContent = Number.isFinite(cost) ? "₩" + format(cost) : "가격 한도 도달";
      button.title = Number.isFinite(cost) ? `구매 가격 ${exact(cost)} 코인` : "가격 한도 도달";
      button.setAttribute("aria-label", `${upgrade.name} 구매, ${button.title}${locked ? ", 잠김" : ""}`);
      card.querySelector(".buy-label").textContent = locked ? "잠김" : state.coins >= cost && Number.isFinite(cost) ? "구매하기 +" : "코인 부족";
      card.querySelector(".lock-condition").textContent = locked ? upgrade.stage === 2
        ? "동네 카페: 누적 500코인 + 아르바이트생 3명"
        : "체인점: 누적 10,000코인 + 에스프레소 머신 3대" : "";
    }
  }
  $("coffee-button").addEventListener("click", () => { settleIncome(); earn(perClick()); render(); });
  $("save-button").addEventListener("click", () => { settleIncome(); save(); render(); });
  $("reset-button").addEventListener("click", () => {
    if (!confirm("카페를 처음부터 시작할까요? 보유 코인과 모든 성장 기록이 초기화됩니다.")) return;
    try { localStorage.removeItem(SAVE_KEY); } catch { /* 저장 제한은 save()에서 안내한다. */ }
    state = freshState();
    lastTick = Date.now();
    notices.length = 0;
    $("growth-conditions").className = "";
    if (noticeOpen) $("notice-dialog").close();
    save();
    render();
  });
  document.addEventListener("visibilitychange", () => {
    settleIncome();
    if (document.hidden) save();
    render();
  });
  window.addEventListener("beforeunload", () => { settleIncome(); save(); });
  load();
  render();
  setInterval(() => { settleIncome(); render(); }, 100);
  setInterval(() => { settleIncome(); save(); }, 10000);
})();
