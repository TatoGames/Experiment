'use strict';
/* Typing Speed Racer — 게임 로직 (spec.md v1.0). 외부 의존성 없음.
   위쪽은 DOM과 무관한 순수 로직(테스트 가능), 아래쪽은 화면 연결. */

/* ---------- 데이터 ---------- */
var STORAGE_KEY = 'typingRacer.best.v1';
var DIFFS = ['easy', 'normal', 'hard'];
var DIFF_LABEL = { easy: '쉬움', normal: '보통', hard: '어려움' };

var SENTENCES = {
  easy: [
    'the cat sleeps on the sofa.',
    'we walk to school today.',
    'i like warm apple pie.',
    'the sun is very bright.',
    'she reads a book at night.',
    'my dog runs in the park.',
    'birds sing in the morning.',
    'please open the red door.',
    'rain falls on the green hill.',
    'he drinks cold milk daily.',
    'we play games after lunch.',
    'a small boat crosses the lake.'
  ],
  normal: [
    'The quick brown fox jumps over the lazy dog.',
    'Practice makes perfect, so keep typing every day.',
    'Even small steps, taken daily, lead to big results.',
    'Our train leaves at noon, and we should not be late.',
    'Good coffee, a quiet room, and a clear mind help a lot.',
    'The library opens early, but it closes before dinner.',
    'When the wind blows, the old windmill starts to spin.',
    'Speed is nice, but accuracy always comes first.',
    'Winter was long, yet the garden bloomed in spring.',
    'A steady rhythm will carry you farther than a rush.',
    'Mountains, rivers, and forests make this place special.',
    'Please bring your notebook, a pencil, and some water.'
  ],
  hard: [
    'On July 4th, 1976, the "Declaration" was signed; its words still echo today!',
    'Wait - did you say 3 cats, 12 birds, and 7 fish? That\'s a very busy house (really)!',
    'Pack these items: 2 maps, 5 flashlights, 10 batteries; then lock the door at 9:30 p.m.',
    'He asked, "Is the meeting at 4:15?" She replied, "No - it moved to 6:45 (sharp)!"',
    'Version 2.0 fixes 14 bugs; however, it adds 3 new options (see page 27 for details).',
    'The recipe needs 3 eggs, 250 grams of flour, and 1 cup of milk - mix well; bake for 45 minutes.',
    'Warning: the bridge closes at 11 p.m.; cross before then, or take Route 66 instead!',
    'Why did the robot cross the road? Because its program said "go" 100 times - amazing!',
    'Her password was "Blue-Sky_42!" - which, honestly, isn\'t that safe (change it today)!',
    'Rule #1: never panic; Rule #2: read the manual (all 300 pages); Rule #3: ask for help!',
    'At 6:00 a.m. the train left; by 8:15 we had passed 4 towns, 2 rivers, and 1 long tunnel.',
    'Remember: "Slow is smooth, and smooth is fast" - that\'s what the coach said in 2019!'
  ]
};

/* ---------- 순수 로직 ---------- */

/** 직전 문장과 다른 문장을 무작위로 고른다 (F-02). */
function pickSentence(diff, lastText, rng) {
  var pool = SENTENCES[diff];
  var candidates = pool.filter(function (s) { return s !== lastText; });
  var r = (rng || Math.random)();
  return candidates[Math.floor(r * candidates.length) % candidates.length];
}

/** 글자별 상태 계산: 'correct' | 'wrong' | 'cursor' | ''  (F-03) */
function charStates(text, typed) {
  var out = [];
  for (var i = 0; i < text.length; i++) {
    if (i < typed.length) out.push(typed[i] === text[i] ? 'correct' : 'wrong');
    else out.push(i === typed.length ? 'cursor' : '');
  }
  return out;
}

/** 완료 조건: 길이가 같고 전부 일치 (4.2절). */
function isComplete(text, typed) {
  return typed.length === text.length && typed === text;
}

/** WPM (Raw): keys / 5 / minutes. 시간이 0 이하면 0 (4.3절). */
function calcWpm(keys, ms) {
  if (!(ms > 0) || keys <= 0) return 0;
  return (keys / 5) / (ms / 60000);
}

/** 정확도: (keys - mistakes) / keys * 100, 0~100로 제한 (4.3절). */
function calcAccuracy(keys, mistakes) {
  if (keys <= 0) return 0;
  var acc = (keys - mistakes) / keys * 100;
  return Math.max(0, Math.min(100, acc));
}

function round1(n) { return Math.round(n * 10) / 10; }

function emptyBest() { return { easy: null, normal: null, hard: null }; }

function validRecord(r) {
  return r === null || (r !== null && typeof r === 'object' && !Array.isArray(r) &&
    typeof r.wpm === 'number' && isFinite(r.wpm) && r.wpm >= 0 &&
    typeof r.accuracy === 'number' && isFinite(r.accuracy) && r.accuracy >= 0 && r.accuracy <= 100);
}

/** 저장 문자열을 안전하게 해석. 이상하면 전부 null (5장). */
function parseBest(raw) {
  try {
    if (raw == null) return emptyBest();
    var obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return emptyBest();
    var out = emptyBest();
    for (var i = 0; i < DIFFS.length; i++) {
      if (!Object.prototype.hasOwnProperty.call(obj, DIFFS[i])) return emptyBest();
      var rec = obj[DIFFS[i]];
      if (!validRecord(rec)) return emptyBest();
      out[DIFFS[i]] = rec ? { wpm: rec.wpm, accuracy: rec.accuracy } : null;
    }
    return out;
  } catch (e) {
    return emptyBest();
  }
}

/** 새 기록이 기존 최고보다 클 때만 갱신 (같으면 갱신 안 함). */
function updateBest(best, diff, wpm, accuracy) {
  var cur = best[diff];
  if (cur && !(wpm > cur.wpm)) return { best: best, isNew: false };
  var next = {};
  DIFFS.forEach(function (d) { next[d] = best[d]; });
  next[diff] = { wpm: wpm, accuracy: accuracy };
  return { best: next, isNew: true };
}

function loadBest() {
  try { return parseBest(window.localStorage.getItem(STORAGE_KEY)); }
  catch (e) { return emptyBest(); }
}

function saveBest(best) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(best)); return true; }
  catch (e) { console.warn('최고 기록을 저장하지 못했습니다:', e); return false; }
}

/** 이 키 입력이 글자로 인정되는지 (Enter/Tab/방향키/단축키 제외). */
function isTypableKey(e) {
  return typeof e.key === 'string' && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
}

var Core = {
  SENTENCES: SENTENCES, STORAGE_KEY: STORAGE_KEY,
  pickSentence: pickSentence, charStates: charStates, isComplete: isComplete,
  calcWpm: calcWpm, calcAccuracy: calcAccuracy, parseBest: parseBest,
  updateBest: updateBest, emptyBest: emptyBest, round1: round1
};

/* ---------- 화면 연결 ---------- */
(function () {
  if (typeof document === 'undefined') return;

  function $(id) { return document.getElementById(id); }
  var screens = { start: $('screen-start'), game: $('screen-game'), result: $('screen-result') };
  var els = {
    sentence: $('sentence'), car: $('car'), progress: $('progress-text'),
    hudDiff: $('hud-diff'), hudTime: $('hud-time'), hudWpm: $('hud-wpm'),
    countdown: $('countdown'), countNum: $('countdown-number'),
    resWpm: $('result-wpm'), resAcc: $('result-acc'), resTime: $('result-time'),
    badge: $('record-badge'), bestPanel: $('best-panel'),
    input: $('typing-input'), readable: $('sentence-readable'), status: $('status'), sound: $('btn-sound')
  };

  // 외부 음원 없이 합성. 사용자가 켜기 전에는 AudioContext도 만들지 않는다.
  var audio = null;
  var master = null;
  var soundOn = false;

  function announce(message) { els.status.textContent = message; }

  function disableSound() {
    soundOn = false;
    if (master) master.gain.value = 0;
    els.sound.textContent = '효과음 사용 불가';
    els.sound.setAttribute('aria-pressed', 'false');
    els.sound.disabled = true;
    announce('이 브라우저에서는 효과음을 사용할 수 없습니다. 게임은 계속할 수 있습니다.');
  }

  function playSound(kind) {
    if (!soundOn || !audio || audio.state !== 'running') return;
    try {
      var notes = kind === 'finish' ? [523.25, 659.25, 783.99] : [kind === 'wrong' ? 180 : kind === 'count' ? 440 : 740];
      notes.forEach(function (frequency, index) {
        var start = audio.currentTime + index * 0.09;
        var duration = kind === 'finish' ? 0.18 : 0.045;
        var oscillator = audio.createOscillator();
        var envelope = audio.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        envelope.gain.setValueAtTime(0, start);
        envelope.gain.linearRampToValueAtTime(1, start + 0.006);
        envelope.gain.exponentialRampToValueAtTime(0.001, start + duration);
        oscillator.connect(envelope);
        envelope.connect(master);
        oscillator.onended = function () { oscillator.disconnect(); envelope.disconnect(); };
        oscillator.start(start);
        oscillator.stop(start + duration + 0.01);
      });
    } catch (e) { disableSound(); }
  }

  els.sound.addEventListener('click', function () {
    try {
      if (!audio) {
        var AudioEngine = window.AudioContext || window.webkitAudioContext;
        if (!AudioEngine) { disableSound(); return; }
        audio = new AudioEngine();
        master = audio.createGain();
        master.connect(audio.destination);
      }
      soundOn = !soundOn;
      master.gain.value = soundOn ? 0.035 : 0;
      els.sound.setAttribute('aria-pressed', String(soundOn));
      els.sound.textContent = soundOn ? '효과음 켜짐' : '효과음 꺼짐';
      if (soundOn) {
        audio.resume().then(function () { playSound('key'); }).catch(disableSound);
      }
    } catch (e) { disableSound(); }
  });

  var best = loadBest();
  var selected = 'normal';
  var current = 'start';
  var lastText = null;

  var g = null;         // 진행 중인 판 상태
  var countTimer = null;
  var hudTimer = null;
  var resultTimer = null;
  var spans = [];

  function show(name) {
    current = name;
    Object.keys(screens).forEach(function (k) { screens[k].hidden = (k !== name); });
    if (name === 'start') document.querySelector('[data-diff="' + selected + '"]').focus();
    else if (name === 'game') els.input.focus();
    else $('result-title').focus();
  }

  function renderBest() {
    DIFFS.forEach(function (d) {
      var el = document.querySelector('[data-best="' + d + '"]');
      el.textContent = best[d] ? round1(best[d].wpm).toFixed(1) + ' WPM' : '기록 없음';
    });
  }

  function select(d) {
    selected = d;
    Array.prototype.forEach.call(document.querySelectorAll('.difficulty-btn'), function (b) {
      var isSelected = b.getAttribute('data-diff') === d;
      b.classList.toggle('selected', isSelected);
      b.setAttribute('aria-pressed', String(isSelected));
    });
  }

  function stopTimers() {
    clearTimeout(countTimer); countTimer = null;
    clearInterval(hudTimer); hudTimer = null;
    clearTimeout(resultTimer); resultTimer = null;
  }

  function leaveGame() {
    stopTimers();
    g = null;
    show('start');
    announce('레이스를 중단했습니다. 난이도를 선택하세요.');
  }

  /* S-2 */
  function startGame(diff) {
    stopTimers();
    var text = pickSentence(diff, lastText);
    lastText = text;
    g = { diff: diff, text: text, typed: '', keys: 0, mistakes: 0, t0: null, active: false };
    els.input.value = '';
    els.input.readOnly = true;
    els.readable.textContent = text;

    els.sentence.textContent = '';
    spans = [];
    for (var i = 0; i < text.length; i++) {
      var s = document.createElement('span');
      s.className = 'char';
      s.textContent = text[i];
      els.sentence.appendChild(s);
      spans.push(s);
    }
    els.hudDiff.textContent = DIFF_LABEL[diff];
    els.hudTime.textContent = '0.0';
    els.hudWpm.textContent = '0.0';
    els.car.classList.remove('finished');
    renderProgress();
    renderChars();
    show('game');
    runCountdown(3);
  }

  function runCountdown(n) {
    if (n === 0) {
      els.countdown.hidden = true;
      g.active = true;
      els.input.readOnly = false;
      announce('출발! 문장을 입력하세요. 첫 글자부터 시간을 측정합니다.');
      return;
    }
    els.countdown.hidden = false;
    els.countNum.textContent = String(n);
    // 애니메이션 재시작
    els.countNum.hidden = true;
    void els.countNum.offsetWidth;
    els.countNum.hidden = false;
    announce(DIFF_LABEL[g.diff] + ' 레이스, ' + n);
    playSound('count');
    countTimer = setTimeout(function () { runCountdown(n - 1); }, 900);
  }

  function renderChars() {
    var st = charStates(g.text, g.typed);
    for (var i = 0; i < spans.length; i++) {
      spans[i].className = st[i] ? 'char ' + st[i] : 'char';
    }
  }

  function renderProgress() {
    var pct = Math.round(g.typed.length / g.text.length * 100);
    els.car.style.left = pct + '%';
    els.progress.textContent = pct + '%';
    els.progress.setAttribute('aria-valuenow', String(pct));
  }

  function renderHud() {
    if (g.t0 === null) return;
    var ms = performance.now() - g.t0;
    els.hudTime.textContent = (ms / 1000).toFixed(1);
    els.hudWpm.textContent = round1(calcWpm(g.keys, ms)).toFixed(1);
  }

  function onGameKey(e) {
    if (e.key === 'Escape') {
      leaveGame();
      return;
    }
    if (!g.active) return;               // 카운트다운 중 입력 무시
    if (e.key === 'Backspace') {
      if (g.typed.length > 0) {
        g.typed = g.typed.slice(0, -1);
        els.input.value = g.typed;
        renderChars(); renderProgress();
      }
      return;
    }
    if (!isTypableKey(e)) return;
    if (g.typed.length >= g.text.length) return;  // 틀린 채로 끝까지 쳤다면 Backspace 필요

    if (g.t0 === null) {
      g.t0 = performance.now();
      hudTimer = setInterval(renderHud, 100);
    }
    var pos = g.typed.length;
    g.keys++;
    var wrong = e.key !== g.text[pos];
    if (wrong) {
      g.mistakes++;
      announce((pos + 1) + '번째 글자가 틀렸습니다. Backspace로 지울 수 있습니다.');
    } else if (els.status.textContent.indexOf('번째 글자') !== -1) {
      announce('입력 중입니다.');
    }
    playSound(wrong ? 'wrong' : 'key');
    g.typed += e.key;
    els.input.value = g.typed;
    renderChars(); renderProgress(); renderHud();

    if (isComplete(g.text, g.typed)) finish();
  }

  /* S-3 */
  function finish() {
    var ms = performance.now() - g.t0;
    stopTimers();
    g.active = false;
    els.input.readOnly = true;
    var wpm = round1(calcWpm(g.keys, ms));
    var acc = round1(calcAccuracy(g.keys, g.mistakes));
    var diff = g.diff;

    els.car.classList.add('finished');

    var upd = updateBest(best, diff, wpm, acc);
    if (upd.isNew) { best = upd.best; saveBest(best); }
    renderBest();

    els.resWpm.textContent = wpm.toFixed(1);
    els.resWpm.classList.toggle('new-record', upd.isNew);
    els.resAcc.textContent = acc.toFixed(1);
    els.resTime.textContent = (ms / 1000).toFixed(1);
    els.badge.hidden = !upd.isNew;
    var b = best[diff];
    els.bestPanel.textContent = DIFF_LABEL[diff] + ' 최고 기록: ' + round1(b.wpm).toFixed(1) +
      ' WPM (정확도 ' + round1(b.accuracy).toFixed(1) + '%)';
    playSound('finish');
    announce('완주! ' + wpm.toFixed(1) + ' WPM, 정확도 ' + acc.toFixed(1) + '퍼센트.');
    // 결승선 도달을 잠깐 보여준다. 동작 줄이기 환경에서는 바로 결과로 이동한다.
    resultTimer = setTimeout(function () { show('result'); },
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450);
  }

  /* 입력 */
  document.addEventListener('keydown', function (e) {
    if (e.isComposing || e.key === 'Process' || e.key === 'Dead') {
      if (current === 'game') announce('한/영 키로 영문 입력 모드로 바꿔주세요.');
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (current === 'game') {
      if (e.key === 'Escape') { e.preventDefault(); onGameKey(e); return; }
      if (e.target === els.input) {
        if (isTypableKey(e) || e.key === 'Backspace' || e.key === 'Enter') e.preventDefault();
        onGameKey(e);
      }
      return;
    }
    // 버튼의 Enter/Space는 브라우저의 기본 클릭 처리를 유지한다.
    if (e.target.closest('button') && (e.key === 'Enter' || e.key === ' ')) return;
    if (current === 'start') {
      if (e.key === '1') select('easy');
      else if (e.key === '2') select('normal');
      else if (e.key === '3') select('hard');
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startGame(selected); }
      if (/^[123]$/.test(e.key)) document.querySelector('[data-diff="' + selected + '"]').focus();
    } else if (current === 'result') {
      if (e.key === 'Enter') { e.preventDefault(); startGame(g.diff); }
      else if (e.key === 'Escape') { show('start'); }
    }
  });

  els.input.addEventListener('paste', function (e) { e.preventDefault(); announce('붙여넣기는 사용할 수 없습니다. 키보드로 입력하세요.'); });
  els.input.addEventListener('drop', function (e) { e.preventDefault(); });
  // IME, 자동 완성, 음성 입력은 영문 키 입력 집계에서 제외한다.
  els.input.addEventListener('beforeinput', function (e) { e.preventDefault(); });
  els.input.addEventListener('input', function () { els.input.value = g ? g.typed : ''; });

  Array.prototype.forEach.call(document.querySelectorAll('.difficulty-btn'), function (b) {
    b.addEventListener('click', function () {
      var d = b.getAttribute('data-diff');
      select(d);
      startGame(d);
    });
  });
  $('btn-retry').addEventListener('click', function () { startGame(g.diff); });
  $('btn-change').addEventListener('click', function () { show('start'); });
  $('btn-exit').addEventListener('click', leaveGame);
  $('btn-reset').addEventListener('click', function () {
    if (window.confirm('모든 난이도의 최고 기록을 지울까요?')) {
      best = emptyBest();
      saveBest(best);
      renderBest();
    }
  });

  renderBest();
  select(selected);
  show('start');
  window.TypingRacer = Core;
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Core;
