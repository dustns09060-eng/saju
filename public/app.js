'use strict';

if (location.protocol !== 'http:' && location.protocol !== 'https:') {
  document.body.innerHTML =
    '<div style="max-width:560px;margin:60px auto;padding:24px;font-family:system-ui;line-height:1.7;color:#eee">' +
    '<h1 style="font-size:1.2rem">서버로 열어주세요</h1>' +
    '<p>HTML 파일을 직접 연 상태(<code>' + location.protocol + '</code>)라 결제·풀이 요청이 동작하지 않습니다.</p>' +
    '<pre style="background:#222;padding:12px;border-radius:8px">cd "C:\\Users\\SEUNGHO\\새 폴더\\saju"\nnpm start</pre>' +
    '<p>그다음 <code>http://localhost:3000</code> 으로 접속하세요.</p></div>';
  throw new Error('opened as file');
}

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const EL = ['목', '화', '토', '금', '수'];
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const won = (n) => Number(n).toLocaleString();

const state = {
  topicList: [], picked: new Set(),
  payProvider: 'mock',
  brand: { siteName: '별헤는밤', siteNameSub: '별빛 아래 정통 사주', tagline: '그대의 별을 하나씩 헤아려', narrator: '별하' },
  form: {
    name: '', calendar: 'solar', isLeapMonth: false,
    year: '', month: '', day: '', hour: '', minute: '', hourUnknown: false,
    gender: '', place: '126.978', rel: '', question: '',
  },
  chart: null, teaser: null,
  orderId: null, amount: 0, reading: '', topicsUsed: [],
};

const PLACES = [
  ['126.978', '서울'], ['126.705', '인천'], ['127.010', '수원'], ['127.729', '춘천'],
  ['128.896', '강릉'], ['127.385', '대전'], ['127.489', '청주'], ['127.148', '전주'],
  ['126.853', '광주'], ['126.392', '목포'], ['128.601', '대구'], ['129.075', '부산'],
  ['129.311', '울산'], ['128.681', '창원'], ['126.531', '제주'],
];
const placeName = (v) => (PLACES.find((p) => p[0] === v) || [, ''])[1];

function show(name) {
  $$('[data-screen]').forEach((s) => (s.hidden = s.dataset.screen !== name));
  window.scrollTo(0, 0);
}
function applyBrand() {
  const b = state.brand;
  document.title = b.siteName + ' 사주';
  const set = (sel, v) => { const el = $(sel); if (el) el.textContent = v; };
  set('[data-b-name]', b.siteName);
  set('[data-b-sub]', b.siteNameSub);
  set('[data-b-tag]', '“ ' + b.tagline + ' ”');
  set('[data-b-narrator]', b.narrator);
}

let toastT;
function toast(msg) {
  const el = $('[data-toast]');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => (el.hidden = true), 2400);
}

/* ── init ──────────────────────────────── */
(async function init() {
  try {
    const cfg = await (await fetch('/api/config')).json();
    state.payProvider = cfg.payProvider || 'mock';
    state.topicList = cfg.topics || [];
    if (cfg.branding) state.brand = { ...state.brand, ...cfg.branding };
  } catch {}
  applyBrand();
  if (state.topicList.length) {
    $('[data-price-min]').textContent = won(Math.min(...state.topicList.map((t) => t.price)));
    state.picked.add(state.topicList[0].id);
  }
  if (state.payProvider !== 'mock') {
    $('[data-modal-title]').textContent = '복채';
    $('[data-modal-desc]').textContent = '아래 금액을 결제합니다.';
  }

  $('[data-action="start"]').addEventListener('click', startChat);
  $('[data-action="chat-back"]').addEventListener('click', () => location.reload());
  bindResultActions();
  bindModal();
  bindShareModal();

  // 링크(#order=...)를 이미 열린 탭에서 클릭/붙여넣기 해도 반응하도록
  window.addEventListener('hashchange', () => {
    const mm = location.hash.match(/order=([a-z0-9_]+)/i);
    if (mm) restoreOrder(mm[1]);
    else if (![...$$('[data-screen]')].some((s) => s.dataset.screen === 'chat' && !s.hidden)) show('landing');
  });

  const m = location.hash.match(/order=([a-z0-9_]+)/i);
  if (m) return restoreOrder(m[1]);
  show('landing');
})();

/* ══════════════════════════════════════════
 *  대화형 입력
 * ══════════════════════════════════════════ */
const BEATS = [
  { say: ['별이 참 좋은 밤이에요.', '그대의 사주를 펼쳐 보려 합니다.'], input: 'advance' },
  { say: ['먼저, 제가 어떻게 불러드리면 될까요?'], input: 'name' },
  { say: (s) => [`${s.form.name || '그대'}님, 반가워요.`, '태어나신 날과 시각을 알려주세요.'], input: 'birth' },
  { say: ['성별도 여쭐게요. 대운의 방향을 잡는 데 쓰여요.'], input: 'gender' },
  { say: ['혹시 지금 곁에 마음 나누는 이가 있으신가요?'], input: 'rel' },
  { say: ['더 듣고 싶은 것이 있다면 짧게 적어주세요. 없으면 그냥 넘기셔도 됩니다.'], input: 'question' },
  { say: ['잠시만요… 붓을 들어 그대의 자리를 살펴볼게요.'], input: 'go' },
];
let beatIdx = 0;

function startChat() {
  beatIdx = 0;
  $('[data-chat-log]').innerHTML = '';
  show('chat');
  runBeat();
}

function bubble(text, me) {
  const b = document.createElement('div');
  b.className = 'bubble' + (me ? ' bubble--me' : '');
  b.textContent = text;
  $('[data-chat-log]').appendChild(b);
  b.scrollIntoView({ block: 'end', behavior: 'smooth' });
}

async function runBeat() {
  const beat = BEATS[beatIdx];
  if (!beat) return;
  const lines = typeof beat.say === 'function' ? beat.say(state) : beat.say;
  for (const ln of lines) {
    bubble(ln, false);
    await sleep(360);
  }
  renderDock(beat.input);
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function nextBeat() { beatIdx++; runBeat(); }

function renderDock(kind) {
  const dock = $('[data-chat-dock]');
  dock.innerHTML = '';
  const f = state.form;

  if (kind === 'advance') {
    dock.innerHTML = '<div class="tap-hint">화면을 눌러 계속 ›</div>';
    dock.querySelector('.tap-hint').onclick = nextBeat;
    return;
  }

  if (kind === 'name') {
    dock.innerHTML =
      '<div class="field"><input maxlength="6" placeholder="이름 또는 별명 (최대 6자)" data-in="name" /></div>' +
      '<button class="btn btn--gold" data-go>이렇게 불러주세요</button>';
    const inp = dock.querySelector('[data-in]');
    inp.value = f.name;
    inp.oninput = () => (f.name = inp.value.trim());
    dock.querySelector('[data-go]').onclick = () => {
      if (!f.name) return toast('이름을 적어주세요');
      bubble(f.name, true);
      nextBeat();
    };
    return;
  }

  if (kind === 'birth') {
    dock.innerHTML = `
      <div class="seg" data-seg="calendar" style="margin-bottom:10px">
        <button data-v="solar" class="on">양력</button><button data-v="lunar">음력</button>
      </div>
      <label class="chk" data-leap hidden><input type="checkbox" data-in="isLeapMonth"/> 윤달이에요</label>
      <div class="row3" style="margin-bottom:8px">
        <div class="field"><span>연</span><input inputmode="numeric" data-in="year" placeholder="1996"/></div>
        <div class="field"><span>월</span><input inputmode="numeric" data-in="month" placeholder="5"/></div>
        <div class="field"><span>일</span><input inputmode="numeric" data-in="day" placeholder="15"/></div>
      </div>
      <div class="row2" style="margin-bottom:6px">
        <div class="field"><span>시 (0~23)</span><input inputmode="numeric" data-in="hour" placeholder="13"/></div>
        <div class="field"><span>분</span><input inputmode="numeric" data-in="minute" placeholder="20"/></div>
      </div>
      <label class="chk"><input type="checkbox" data-in="hourUnknown"/> 태어난 시각을 몰라요</label>
      <button class="btn btn--gold" data-go>다음</button>`;
    bindSeg(dock, 'calendar', (v) => {
      f.calendar = v;
      dock.querySelector('[data-leap]').hidden = v !== 'lunar';
    });
    dock.querySelectorAll('[data-in]').forEach((el) => {
      const k = el.dataset.in;
      if (el.type === 'checkbox') { el.checked = !!f[k]; el.onchange = () => (f[k] = el.checked); }
      else { el.value = f[k]; el.oninput = () => (f[k] = el.value.trim()); }
    });
    dock.querySelector('[data-go]').onclick = () => {
      const y = +f.year, mo = +f.month, d = +f.day;
      if (!y || !mo || !d) return toast('생년월일을 모두 입력해 주세요');
      if (y < 1800 || y > 2300) return toast('연도는 1800~2300 사이여야 해요');
      if (!f.hourUnknown && (f.hour === '' || +f.hour < 0 || +f.hour > 23)) return toast('시는 0~23, 모르면 아래 체크');
      const cal = f.calendar === 'lunar' ? `음력${f.isLeapMonth ? ' 윤달' : ''}` : '양력';
      const t = f.hourUnknown ? '시각 모름' : `${f.hour || 0}시 ${f.minute || 0}분`;
      bubble(`${cal} ${y}년 ${mo}월 ${d}일 · ${t}`, true);
      nextBeat();
    };
    return;
  }

  if (kind === 'gender') {
    dock.innerHTML = `<div class="seg" data-seg="gender"><button data-v="male">남성</button><button data-v="female">여성</button></div>`;
    bindSeg(dock, 'gender', (v) => {
      f.gender = v;
      bubble(v === 'male' ? '남성' : '여성', true);
      setTimeout(nextBeat, 150);
    });
    return;
  }

  if (kind === 'rel') {
    const opts = [['couple', '만나는 사람이 있어요'], ['single', '지금은 혼자예요'], ['secret', '말하고 싶지 않아요']];
    dock.innerHTML = opts.map(([v, t]) => `<button class="reply" data-v="${v}">${t}</button>`).join('');
    dock.querySelectorAll('.reply').forEach((b) => (b.onclick = () => {
      f.rel = b.dataset.v;
      bubble(b.textContent, true);
      setTimeout(nextBeat, 150);
    }));
    return;
  }

  if (kind === 'question') {
    dock.innerHTML =
      '<div class="field"><textarea class="reply" rows="3" maxlength="200" data-in="question" placeholder="예) 올해 이직을 고민 중이에요."></textarea></div>' +
      '<button class="btn btn--gold" data-go>이대로 볼게요</button>';
    const ta = dock.querySelector('[data-in]');
    ta.value = f.question;
    ta.oninput = () => (f.question = ta.value);
    dock.querySelector('[data-go]').onclick = () => {
      if (f.question.trim()) bubble(f.question.trim(), true);
      nextBeat();
    };
    return;
  }

  if (kind === 'go') {
    dock.innerHTML = '<div class="tap-hint">사주를 펼치는 중…</div>';
    goCompute();
    return;
  }
}

function bindSeg(root, name, onPick) {
  const seg = root.querySelector(`[data-seg="${name}"]`);
  const cur = state.form[name];
  seg.querySelectorAll('button').forEach((b) => {
    if (b.dataset.v === cur) b.classList.add('on');
    b.onclick = () => {
      seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      onPick(b.dataset.v);
    };
  });
}

function payload() {
  const f = state.form;
  return {
    name: f.name,
    calendar: f.calendar, isLeapMonth: !!f.isLeapMonth,
    year: +f.year, month: +f.month, day: +f.day,
    hourKnown: !f.hourUnknown, hour: +f.hour || 0, minute: +f.minute || 0,
    gender: f.gender || 'male',
    longitude: +f.place, place: placeName(f.place),
    trueSolarTime: true, dayBoundary: 'midnight',
    question: f.question.trim(),
  };
}

async function goCompute() {
  const body = JSON.stringify(payload());
  try {
    const c = await fetch('/api/saju/compute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }).then((r) => r.json());
    if (!c.ok) throw new Error(c.error || '사주 계산 실패');
    state.chart = c.chart;
    state.teaser = null;
    renderResult();          // 계산 위젯 먼저 표시
    show('result');
    loadTeaser(body);        // 인사·운명의 짝·위기 는 뒤에서 채움 (AI)
  } catch (e) {
    toast(e.message);
    renderDock('go');
    $('[data-chat-dock] .tap-hint').textContent = '다시 시도하려면 누르세요';
    $('[data-chat-dock] .tap-hint').onclick = goCompute;
  }
}

async function loadTeaser(body) {
  try {
    const t = await fetch('/api/saju/teaser', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }).then((r) => r.json());
    if (!t.ok) throw new Error(t.error || 'teaser');
    state.teaser = t.teaser;
  } catch {
    state.teaser = null;
  }
  // 해당 패널만 다시 그림
  const t = state.teaser;
  $('[data-intro]').textContent = (t && t.intro) || `${state.form.name || '그대'}님의 사주를 펼쳤어요. 아래에서 원국과 흐름을 함께 보세요.`;
  renderSoulmate(t && t.soulmate);
  renderCrisis(t || { crisesFree: [], crisesLocked: 2 });
}

/* ══════════════════════════════════════════
 *  결과 렌더
 * ══════════════════════════════════════════ */
function renderResult() {
  const c = state.chart, t = state.teaser;
  $('[data-intro]').textContent = (t && t.intro) || `${state.form.name || '그대'}님, 별을 헤아리는 중이에요… 잠시만요.`;
  renderWongook(c);
  renderDaeun(c);
  renderOhaeng(c);
  renderSoulmate(t && t.soulmate);
  renderWealth(c.wealth);
  renderCrisis(t);
  renderTopics();
  $('[data-paywall]').hidden = false;
  $('[data-reading-wrap]').hidden = true;
}

function renderWongook(c) {
  const ks = ['year', 'month', 'day', 'hour'].filter((k) => c.pillars[k]);
  const head = ks.map((k) => `<th>${({ year: '年 년주', month: '月 월주', day: '日 일주', hour: '時 시주' })[k]}</th>`).join('');
  const rows = [
    ['십성', (k) => c.tenGods[k].stem],
    ['천간', (k) => {
      const p = c.pillars[k];
      return `<span class="gz el-${p.element.stem}">${esc(p.stem)}<small>${esc(p.stemHanja)}</small></span>`;
    }, true],
    ['지지', (k) => {
      const p = c.pillars[k];
      return `<span class="gz el-${p.element.branch}">${esc(p.branch)}<small>${esc(p.branchHanja)}</small></span>`;
    }, true],
    ['십성', (k) => c.tenGods[k].branch],
    ['십이운성', (k) => (c.sibiunseong && c.sibiunseong[k] ? c.sibiunseong[k].name : '-')],
    ['신살', (k) => {
      const s = c.sinsal;
      if (!s) return '-';
      const base = s.perPillar[k] ? s.perPillar[k].name : '';
      const ex = s.specialByPillar[k] ? '·' + s.specialByPillar[k].join('·') : '';
      return base + ex || '-';
    }],
    ['귀인', (k) => (c.gwiin && c.gwiin.perPillar[k] ? c.gwiin.perPillar[k].join('·') : '-')],
  ];
  const body = rows.map(([label, fn, raw]) =>
    `<tr><td class="rowh">${label}</td>${ks.map((k) => `<td>${raw ? fn(k) : esc(fn(k))}</td>`).join('')}</tr>`
  ).join('');
  $('[data-wongook]').innerHTML =
    `<div class="panel__h">사주 원국 <small>${esc(c.pillarsText)}</small></div>` +
    `<table class="wg"><thead><tr><th class="rowh"></th>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function renderDaeun(c) {
  if (!c.luck) { $('[data-daeun]').hidden = true; return; }
  $('[data-daeun]').hidden = false;
  const items = c.luck.pillars.map((lp, i) =>
    `<i class="${i === c.luck.currentIndex ? 'on' : ''}">${lp.age}세<b>${esc(lp.ganjiKorean)}</b></i>`
  ).join('');
  $('[data-daeun]').innerHTML =
    `<div class="panel__h">대운 <small>${c.luck.forward ? '순행' : '역행'} · 현재 만 ${c.luck.currentAge}세</small></div>` +
    `<div class="tl">${items}</div>`;
}

function renderOhaeng(c) {
  const y = c.yongsin;
  const max = Math.max(...EL.map((e) => y.ratio[e]), 1);
  const bars = EL.map((e) => `
    <div class="oh-bar">
      <span class="val">${y.ratio[e]}%</span>
      <div class="fill bg-${e}" style="height:${Math.max(4, (y.ratio[e] / max) * 100)}%"></div>
      <span class="lab">${e} ${y.ratioLabel[e]}</span>
    </div>`).join('');
  const bands = ['극약', '태약', '신약', '중화', '신강', '태강', '극왕'];
  $('[data-ohaeng]').innerHTML =
    `<div class="panel__h">오행 균형 · 용신 <small>참고용 간이 산출</small></div>` +
    `<div class="oh-row">${bars}</div>` +
    `<div class="ys">
      <span>용신<b>${esc(y.yongsin)}</b></span>
      <span>희신<b>${esc(y.huisin)}</b></span>
      <span class="gi">기신<b>${esc(y.gisin)}</b></span>
    </div>` +
    `<div class="gauge"><div class="mark" style="left:${Math.min(98, Math.max(1, y.score))}%"></div></div>` +
    `<div class="gauge-labels">${bands.map((b) => `<span>${b}</span>`).join('')}</div>` +
    `<div class="gauge-now">${esc(y.level)} · ${y.score}점 (득령 ${y.deukryeong ? 'O' : 'X'} / 득지 ${y.deukji ? 'O' : 'X'})</div>`;
}

function renderSoulmate(sm) {
  const el = $('[data-soulmate]');
  if (!sm) { el.hidden = true; return; }
  el.hidden = false;
  const per = sm.personality || [], tr = sm.traits || [];
  el.innerHTML =
    `<div class="panel__h">앞으로의 인연</div>` +
    `<dl class="sm-grid">
      ${sm.job ? `<dt>일</dt><dd>${esc(sm.job)}</dd>` : ''}
      ${sm.age ? `<dt>나이</dt><dd>${esc(sm.age)}</dd>` : ''}
      ${sm.look ? `<dt>인상</dt><dd>${esc(sm.look)}</dd>` : ''}
    </dl>` +
    ((per.length || tr.length) ? `<div class="sm-tags">${[...per, ...tr].map((x) => `<span>${esc(x)}</span>`).join('')}</div>` : '');
}

function renderWealth(w) {
  const el = $('[data-wealth]');
  if (!w || !w.points || !w.points.length) { el.hidden = true; return; }
  el.hidden = false;
  const pts = w.points;
  const W = 400, H = 120, pad = 8;
  const step = (W - pad * 2) / (pts.length - 1);
  const y = (s) => H - pad - (s / 100) * (H - pad * 2);
  const line = pts.map((p, i) => `${pad + i * step},${y(p.score).toFixed(1)}`).join(' ');
  const area = `${pad},${H - pad} ${line} ${pad + (pts.length - 1) * step},${H - pad}`;
  const dots = pts.map((p, i) =>
    `<circle cx="${(pad + i * step).toFixed(1)}" cy="${y(p.score).toFixed(1)}" r="${p.current ? 4.5 : 2.5}" fill="${p.current ? '#e8cd8b' : '#8a8fb5'}"/>`
  ).join('');
  const labels = pts.map((p, i) =>
    (i % 2 === 0 || p.current) ? `<text x="${(pad + i * step).toFixed(1)}" y="${H - 1}" font-size="8" fill="#6b7099" text-anchor="middle">${p.age}</text>` : ''
  ).join('');
  el.innerHTML =
    `<div class="panel__h">시기별 재물 흐름 <small>대운 기준 · 0~100</small></div>` +
    `<svg class="wealth-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <polygon points="${area}" fill="rgba(216,180,90,0.12)"/>
      <polyline points="${line}" fill="none" stroke="#d8b45a" stroke-width="2"/>
      ${dots}${labels}
    </svg>` +
    (w.peak ? `<p class="wealth-peak">가장 높은 시기: <b>${w.peak.age}~${w.peak.endAge}세 (${esc(w.peak.ganji)})</b> · ${esc(w.peak.label)}</p>` : '');
}

function renderCrisis(t, unlocked) {
  const free = (t && t.crisesFree) || [];
  const all = (t && t.crisesAll) || [];
  const locked = (t && t.crisesLocked) || 2;
  if (!free.length && !all.length && !locked) { $('[data-crisis]').hidden = true; return; }

  let items, note = '';
  if (unlocked && all.length) {
    items = all.map((c, i) => `<div class="crisis-item"><span class="no">0${i + 1}</span><span class="txt">${esc(c)}</span></div>`).join('');
    note = '<p class="reading__meta" style="margin-top:8px">아래 상세 풀이에서 각 시기를 자세히 다룹니다.</p>';
  } else {
    items = free.map((c, i) => `<div class="crisis-item"><span class="no">0${i + 1}</span><span class="txt">${esc(c)}</span></div>`).join('') +
      Array.from({ length: locked }, (_, i) => `<div class="crisis-item lock"><span class="no">0${free.length + i + 1}</span><span class="txt">복채를 내면 보여요 복채를</span></div>`).join('');
  }
  $('[data-crisis]').innerHTML = `<div class="panel__h">살펴볼 시기</div>${items}${note}`;
}

/* ── 주제 선택 + 결제 ─────────────────── */
function renderTopics() {
  const box = $('[data-topics]');
  box.innerHTML = state.topicList.map((t) => `
    <button class="topic ${state.picked.has(t.id) ? 'on' : ''}" data-topic="${t.id}">
      <div class="em">${t.emoji}</div><div class="lb">${esc(t.label)}</div>
      <div class="ds">${esc(t.desc)}</div><div class="pr">${won(t.price)}원</div>
    </button>`).join('');
  box.onclick = (e) => {
    const b = e.target.closest('[data-topic]');
    if (!b) return;
    const id = b.dataset.topic;
    state.picked.has(id) ? state.picked.delete(id) : state.picked.add(id);
    b.classList.toggle('on', state.picked.has(id));
    updateTotal();
  };
  updateTotal();
}
function updateTotal() {
  const ch = state.topicList.filter((t) => state.picked.has(t.id));
  state.amount = ch.reduce((s, t) => s + t.price, 0);
  $('[data-total-count]').textContent = ch.length;
  $('[data-total-amount]').textContent = won(state.amount);
  $('[data-action="checkout"]').disabled = ch.length === 0;
}

function bindResultActions() {
  $('[data-action="checkout"]').addEventListener('click', checkout);
  $('[data-action="restart"]').addEventListener('click', () => { location.hash = ''; location.reload(); });
  $('[data-action="copy-link"]').addEventListener('click', async () => {
    const url = location.origin + location.pathname + '#order=' + (state.orderId || '');
    try { await navigator.clipboard.writeText(url); toast('링크를 복사했어요'); } catch { toast(url); }
  });
  $('[data-action="share-card"]').addEventListener('click', openShareCard);
}

async function checkout() {
  if (!state.picked.size) return toast('주제를 하나 이상 골라주세요');
  const btn = $('[data-action="checkout"]');
  btn.disabled = true;
  try {
    const body = {
      ...payload(),
      topics: [...state.picked],
      crises: state.teaser && state.teaser.crisesAll ? state.teaser.crisesAll : undefined,
      teaser: state.teaser || undefined,
    };
    const r = await fetch('/api/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json();
    if (!d.ok) throw new Error(d.error || '주문 생성 실패');
    state.orderId = d.orderId;
    state.amount = d.amount;
    openModal();
  } catch (e) {
    toast(e.message);
  } finally {
    btn.disabled = false;
  }
}

function bindModal() {
  $('[data-action="pay-cancel"]').addEventListener('click', closeModal);
  $('[data-modal]').addEventListener('click', (e) => { if (e.target === $('[data-modal]')) closeModal(); });
  $('[data-action="pay-now"]').addEventListener('click', payNow);
}
function openModal() {
  $('[data-modal-amount]').textContent = won(state.amount);
  $('[data-modal-items]').textContent = state.topicList.filter((t) => state.picked.has(t.id)).map((t) => t.emoji + ' ' + t.label).join('  ·  ');
  $('[data-modal]').hidden = false;
}
function closeModal() { $('[data-modal]').hidden = true; }

async function payNow() {
  const btn = $('[data-action="pay-now"]');
  btn.disabled = true; btn.textContent = '확인 중…';
  try {
    const r = await fetch('/api/order/pay', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: state.orderId, paymentId: 'mock_' + Date.now() }),
    });
    const d = await r.json();
    if (!d.ok) throw new Error(d.error || '결제 검증 실패');
    closeModal();
    state.topicsUsed = [...state.picked];
    location.hash = 'order=' + state.orderId;
    renderCrisis(state.teaser, true); // 잠금 해제
    $('[data-paywall]').hidden = true;
    $('[data-reading-wrap]').hidden = false;
    $('[data-reading]').innerHTML = '<div class="skeleton"></div>';
    $('[data-reading-wrap]').scrollIntoView({ behavior: 'smooth', block: 'start' });
    startReading(state.orderId);
  } catch (e) {
    toast(e.message);
  } finally {
    btn.disabled = false; btn.textContent = '복채 내기';
  }
}

async function startReading(orderId) {
  let acc = '', first = true;
  const body = $('[data-reading]');
  try {
    const res = await fetch('/api/saju/reading', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || `요청 실패 (${res.status})`);
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }
        if (msg.type === 'chart') {
          state.chart = msg.chart;
          if (!$('[data-wongook]').innerHTML.trim()) renderResult(); // 링크 복원 시 위젯 채우기
          $('[data-paywall]').hidden = true;
          $('[data-reading-wrap]').hidden = false;
        }
        else if (msg.type === 'delta') {
          if (first) { body.innerHTML = ''; first = false; }
          acc += msg.text;
          body.innerHTML = mdToHtml(acc) + '<span class="cursor"></span>';
        } else if (msg.type === 'done') {
          body.innerHTML = mdToHtml(acc);
          state.reading = acc;
          $('[data-read-meta]').textContent = msg.cached ? '· 저장된 결과' : `· ${(msg.ms / 1000).toFixed(0)}초`;
        } else if (msg.type === 'error') {
          acc = '';
          body.innerHTML = `<p style="color:#e88a8a">${esc(msg.error)}</p><p class="reading__meta">복채는 완료되었습니다. 이 링크를 저장하면 다시 시도할 수 있어요.</p>`;
          throw new Error(msg.error);
        }
      }
    }
    if (first) body.innerHTML = '<p>응답이 비어 있어요. 잠시 후 링크로 다시 시도해 주세요.</p>';
  } catch (e) {
    if (!body.innerHTML || body.querySelector('.skeleton')) {
      body.innerHTML = `<p style="color:#e88a8a">${esc(e.message)}</p>`;
    }
  }
}

async function restoreOrder(oid) {
  try {
    const o = await (await fetch('/api/order/' + oid)).json();
    if (!o.ok || !['paid', 'consumed'].includes(o.status)) return show('landing');
    state.orderId = oid;
    state.chart = o.chart || null;
    state.teaser = o.teaser || null;
    state.topicsUsed = o.topics || [];
    if (o.topics) { state.picked = new Set(o.topics); }
    show('result');
    if (state.chart) renderResult();
    renderCrisis(state.teaser, true); // 결제 완료 주문 → 잠금 해제
    $('[data-paywall]').hidden = true;
    $('[data-reading-wrap]').hidden = false;
    if (o.status === 'consumed' && o.reading) {
      state.reading = o.reading;
      $('[data-reading]').innerHTML = mdToHtml(o.reading);
      $('[data-read-meta]').textContent = '· 저장된 결과';
    } else {
      $('[data-reading]').innerHTML = '<div class="skeleton"></div>';
      startReading(oid);
    }
  } catch {
    show('landing');
  }
}

/* ── 공유 카드 ────────────────────────── */
let _card = null;
function bindShareModal() {
  $('[data-action="share-close"]').addEventListener('click', () => ($('[data-share-modal]').hidden = true));
  $('[data-share-modal]').addEventListener('click', (e) => { if (e.target === $('[data-share-modal]')) $('[data-share-modal]').hidden = true; });
}
async function openShareCard() {
  if (!state.chart) return toast('결과를 불러온 뒤 다시 시도해 주세요');
  const modal = $('[data-share-modal]'), img = $('[data-share-img]'), loading = $('[data-share-loading]');
  img.removeAttribute('src'); loading.hidden = false; modal.hidden = false; _card = null;
  try {
    const topics = (state.topicsUsed || [...state.picked]).map((id) => state.topicList.find((t) => t.id === id)).filter(Boolean);
    _card = await window.makeSajuCard({ chart: state.chart, reading: state.reading || (state.teaser && state.teaser.intro) || '', topics, url: location.origin, siteName: state.brand.siteName });
    img.src = _card.dataUrl; loading.hidden = true;
  } catch (e) {
    loading.textContent = '카드 생성 실패: ' + e.message;
    return;
  }
  const file = new File([_card.blob], 'saju-card.png', { type: 'image/png' });
  const canShare = navigator.canShare && navigator.canShare({ files: [file] });
  const sb = $('[data-action="share-do"]');
  sb.hidden = !canShare;
  sb.onclick = async () => { try { await navigator.share({ files: [file], text: '내 사주 카드 🌙', url: location.origin }); } catch {} };
  $('[data-share-hint]').textContent = canShare ? '공유하기를 누르거나 이미지를 길게 눌러 저장하세요.' : '「이미지 저장」을 누르거나 이미지를 우클릭해 저장하세요.';
  $('[data-action="share-save"]').onclick = () => {
    const a = document.createElement('a');
    a.href = _card.dataUrl; a.download = 'saju-card.png';
    document.body.appendChild(a); a.click(); a.remove();
    toast('이미지를 저장했어요');
  };
}

/* ── markdown ─────────────────────────── */
function mdToHtml(md) {
  const lines = md.replace(/\r/g, '').split('\n');
  let html = '', inList = false;
  const inline = (t) => esc(t).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^###\s+/.test(line)) { if (inList) { html += '</ul>'; inList = false; } html += `<h3>${inline(line.replace(/^###\s+/, ''))}</h3>`; }
    else if (/^##\s+/.test(line)) { if (inList) { html += '</ul>'; inList = false; } html += `<h2>${inline(line.replace(/^##\s+/, ''))}</h2>`; }
    else if (/^(-{3,}|\*{3,})$/.test(line)) { if (inList) { html += '</ul>'; inList = false; } html += '<hr>'; }
    else if (/^[-*]\s+/.test(line)) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`; }
    else if (line === '') { if (inList) { html += '</ul>'; inList = false; } }
    else { if (inList) { html += '</ul>'; inList = false; } html += `<p>${inline(line)}</p>`; }
  }
  if (inList) html += '</ul>';
  return html;
}
