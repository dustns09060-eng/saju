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
  flow: 'saju',            // 'saju' | 'tarot' — 결제/풀이 분기
  couponsOn: false, coupon: null, reviewRating: 5,
  tarotPrice: 2900,
  tarot: { orderId: null, draw: [], question: '', reading: '' },
  deck: null,              // id -> {ko, roman, glyph}
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
  requestAnimationFrame(() => armReveal());
}
function applyBrand() {
  const b = state.brand;
  document.title = b.siteName + ' 사주';
  const set = (sel, v) => { const el = $(sel); if (el) el.textContent = v; };
  set('[data-b-name]', b.siteName);
  set('[data-b-sub]', b.siteNameSub);
  set('[data-b-tag]', '“ ' + b.tagline + ' ”');
  $$('[data-b-narrator]').forEach((el) => (el.textContent = b.narrator));

  const biz = b.business || {};
  const v = (k) => (biz[k] && String(biz[k]).trim()) || '미정';
  const rows = [['상호', v('name')], ['대표자', v('owner')], ['사업자등록번호', v('bizNo')],
    ['통신판매업 신고번호', v('mailOrderNo')], ['사업장 주소', v('address')], ['연락처', v('tel')], ['이메일', v('email')]];
  $$('[data-bizinfo]').forEach((el) => {
    el.innerHTML = '<div class="bizinfo__t">사업자 정보</div>' +
      rows.map(([k, val]) => `<div><span>${esc(k)}</span>${esc(val)}</div>`).join('');
  });
}

/* ── 스트리밍 중 자동 스크롤 ─────────────
 * 풀이가 채워지는 동안 화면을 따라 내려간다.
 * 사용자가 위로 스크롤해 읽기 시작하면(하단에서 140px 이상) 멈춘다. */
let _stick = false;
function initAutoScroll() {
  window.addEventListener('scroll', () => {
    if (!_autoOn) return;
    const gap = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
    _stick = gap < 140;
  }, { passive: true });
}
let _autoOn = false;
function autoScrollStart() { _autoOn = true; _stick = true; }
function autoScrollStop() { _autoOn = false; }
function stickScroll() {
  if (_autoOn && _stick) window.scrollTo(0, document.documentElement.scrollHeight);
}
initAutoScroll();

/* ── 스크롤 등장 연출 (웹툰식) ────────── */
let _io;
function revealIO() {
  if (_io) return _io;
  _io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); _io.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
  return _io;
}
function armReveal(root) {
  if (!('IntersectionObserver' in window)) {
    $$('.reveal:not(.in)', root || document).forEach((el) => el.classList.add('in'));
    return;
  }
  const io = revealIO();
  $$('.reveal:not(.in)', root || document).forEach((el) => {
    if (el.closest('[hidden]')) return;
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.92 && r.bottom > 0) el.classList.add('in');
    else io.observe(el);
  });
}
/* 마크다운 결과를 소제목 단위 '컷'으로 재조립 */
function webtoonify(container) {
  const kids = [...container.children];
  if (kids.length < 2) return;
  const frag = document.createDocumentFragment();
  let cut = null;
  const open = () => { cut = document.createElement('section'); cut.className = 'cut reveal'; frag.appendChild(cut); };
  for (const el of kids) {
    if (el.tagName === 'H2' || el.tagName === 'H3' || !cut) open();
    cut.appendChild(el);
  }
  container.innerHTML = '';
  container.appendChild(frag);
  requestAnimationFrame(() => armReveal(container));
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
    state.pay = cfg.pay || { provider: 'mock' };
    state.topicList = cfg.topics || [];
    if (cfg.tarot && cfg.tarot.price) state.tarotPrice = cfg.tarot.price;
    state.reviews = cfg.reviews || [];
    state.reviewsReal = !!cfg.reviewsReal;
    state.couponsOn = !!cfg.couponsOn;
    if (cfg.branding) state.brand = { ...state.brand, ...cfg.branding };
  } catch {}
  applyBrand();
  renderReviews();
  loadStats();
  if (state.topicList.length) {
    $('[data-price-min]').textContent = won(Math.min(...state.topicList.map((t) => t.price)));
    state.picked.add(state.topicList[0].id);
  }
  $$('[data-tarot-price]').forEach((el) => (el.textContent = won(state.tarotPrice)));
  $('[data-tarot-amount]').textContent = won(state.tarotPrice);
  if (state.payProvider !== 'mock') {
    $('[data-modal-title]').textContent = '복채';
    $('[data-modal-desc]').textContent = '아래 금액을 결제합니다.';
  }

  $('[data-action="start"]').addEventListener('click', startChat);
  $('[data-action="chat-back"]').addEventListener('click', () => location.reload());
  $('[data-action="start-tarot"]').addEventListener('click', startTarot);
  bindIntro();
  bindResultActions();
  bindModal();
  bindShareModal();
  bindTarot();
  initReviewForms();
  loadDaily();

  // 링크(#order=... / #tarot=...)를 이미 열린 탭에서 클릭/붙여넣기 해도 반응하도록
  window.addEventListener('hashchange', routeHash);

  if (routeHash()) return;
  show('landing');
})();

function routeHash() {
  const t = location.hash.match(/tarot=([a-z0-9_]+)/i);
  if (t) { restoreTarot(t[1]); return true; }
  const o = location.hash.match(/order=([a-z0-9_]+)/i);
  if (o) { restoreOrder(o[1]); return true; }
  const onChat = [...$$('[data-screen]')].some((s) => s.dataset.screen === 'chat' && !s.hidden);
  const onTarot = [...$$('[data-screen]')].some((s) => s.dataset.screen === 'tarot' && !s.hidden);
  if (!onChat && !onTarot) show('landing');
  return false;
}

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

/* ── 도입 컷 (웹툰식) ─────────────────── */
const INTRO_CUTS = [
  { cam: 1, lines: ['별이 유난히 낮게 뜬 밤이었어요.', '그대는 좁은 골목을 걷고 있었죠.'] },
  { cam: 2, lines: ['골목 끝, 불 켜진 창 하나.', '문 옆 등불이 조용히 흔들립니다.'] },
  { cam: 3, lines: ['그대는 문을 밀고 들어섭니다.', '먹 냄새, 낡은 책상… 그리고 저.'] },
  { cam: 4, lines: ['제가 붓을 들어요.', '그대의 자리를 펼쳐 보이겠습니다. 이름부터 여쭐게요.'] },
];
let introIdx = 0;

function bindIntro() {
  $('[data-action="intro-next"]').addEventListener('click', (e) => { e.stopPropagation(); introNext(); });
  $('[data-action="intro-skip"]').addEventListener('click', (e) => { e.stopPropagation(); enterChat(); });
  $('[data-intro-seq]').addEventListener('click', (e) => {
    if (e.target.closest('.intro__ui')) return;
    introNext();
  });
}
function startChat() {
  let seen = false;
  try { seen = localStorage.getItem('sb_introSeen') === '1'; } catch {}
  if (seen) return enterChat();
  introIdx = 0;
  show('intro');
  runIntroCut();
}
function runIntroCut() {
  const cut = INTRO_CUTS[introIdx];
  $('[data-intro-cam]').className = 'intro__bg cam-' + cut.cam;
  const box = $('[data-intro-lines]');
  box.innerHTML = '';
  cut.lines.forEach((ln, i) => {
    const p = document.createElement('p');
    p.className = 'intro__line';
    p.textContent = ln;
    p.style.animationDelay = (i * 0.9 + 0.15) + 's';
    box.appendChild(p);
  });
  const last = introIdx === INTRO_CUTS.length - 1;
  $('[data-action="intro-next"]').textContent = last ? '들어가기 ▷' : '계속 ▽';
}
function introNext() {
  introIdx++;
  if (introIdx >= INTRO_CUTS.length) return enterChat();
  runIntroCut();
}
function enterChat() {
  try { localStorage.setItem('sb_introSeen', '1'); } catch {}
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
  // 입력 영역이 화면 밖으로 밀렸을 때만 살짝 맞춰준다(평소엔 움직이지 않음).
  const dock = $('[data-chat-dock]');
  const r = dock.getBoundingClientRect();
  if (r.bottom > window.innerHeight - 8) dock.scrollIntoView({ block: 'end' });
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
    armReveal();
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
  window.glossary && glossary.attach($('[data-intro]'));
  renderSoulmate(t && t.soulmate);
  renderCrisis(t || { crisesFree: [], crisesLocked: 2 });
  fillPeek(t);
  armReveal();
}

/* 페이월 미리보기: 맛보기 인사의 마지막 문장을 '떡밥'으로 노출 */
function fillPeek(t) {
  const peek = $('[data-peek]');
  if (!peek) return;
  if (!t || !t.intro) { peek.hidden = true; return; }
  const parts = String(t.intro).split(/(?<=[.?!…])\s+/).map((s) => s.trim()).filter(Boolean);
  $('[data-peek-lead]').textContent = parts[parts.length - 1] || String(t.intro);
  peek.hidden = false;
}

/* ══════════════════════════════════════════
 *  결과 렌더
 * ══════════════════════════════════════════ */
function renderResult() {
  const c = state.chart, t = state.teaser;
  $('[data-intro]').textContent = (t && t.intro) || `${state.form.name || '그대'}님, 별을 헤아리는 중이에요… 잠시만요.`;
  renderSimple(c);
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

/* 결제 전 '한 눈에' — 계산값을 한자·숫자 없이 쉬운 말로. AI 없이 즉시 표시. */
const STEM_NICK = {
  갑: '큰 나무', 을: '화초·덩굴', 병: '한낮의 해', 정: '촛불·등불', 무: '큰 산·대지',
  기: '텃밭 흙', 경: '무쇠·바위', 신: '보석·낫', 임: '큰 바다', 계: '이슬·시냇물',
};
function levelPlain(lv) {
  if (/극왕|태강|신강/.test(lv || '')) return '타고난 힘이 강한 편';
  if (/중화/.test(lv || '')) return '큰 치우침 없이 균형 잡힌 편';
  return '타고난 힘이 여린 편';
}
/* 받침 유무로 조사 선택 (예: J('화','이','가')→'화가', J('목','이','가')→'목이') */
function J(w, withJong, withoutJong) {
  const code = w.charCodeAt(w.length - 1);
  const jong = code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
  return w + (jong ? withJong : withoutJong);
}
function renderSimple(c) {
  const el = $('[data-simple]');
  if (!c || !c.yongsin || !c.pillars || !c.pillars.day) { el.hidden = true; return; }
  const y = c.yongsin;
  const day = c.pillars.day.stem;
  const nick = STEM_NICK[day] || '';
  const high = EL.slice().sort((a, b) => y.ratio[b] - y.ratio[a])[0];
  const low = EL.slice().sort((a, b) => y.ratio[a] - y.ratio[b])[0];
  const nm = state.form.name || '그대';
  const strong = /강한/.test(levelPlain(y.level));
  el.hidden = false;
  el.innerHTML =
    `<div class="panel__h">한 눈에</div>` +
    `<p class="rd-simple__p">${esc(nm)}님은 <b>${esc(day)} 일간</b>${nick ? ` — ${esc(nick)} 같은 기운` : ''}이에요. ` +
    `${levelPlain(y.level)}이라, ${strong ? '넘치는 힘을 알맞게 흘려보내는' : '도와주는 기운을 채우는'} 게 중요합니다.</p>` +
    `<p class="rd-simple__p">기운은 <b>${esc(J(high, '이', '가'))}</b> 많고 <b>${esc(J(low, '이', '가'))}</b> 부족해요. ` +
    `도움이 되는 건 <b>${esc(y.huisin && y.huisin !== y.yongsin ? y.yongsin + '·' + y.huisin : y.yongsin)}</b> 기운, 부담이 되는 건 <b>${esc(y.gisin)}</b> 기운이에요.</p>` +
    `<p class="rd-simple__hint">아래 “명리 데이터”가 이 요약의 근거예요. 뜻은 결제 후 하나씩 풀어드려요.</p>`;
  window.glossary && glossary.attach(el);
}
function openAdv() { const a = document.querySelector('.adv'); if (a) a.open = true; }

/* 후기 (랜딩) — 실제 후기 없으면 예시 뱃지 + 안내 */
function renderReviews() {
  const box = $('[data-reviews]');
  if (!box) return;
  const list = state.reviews || [];
  if (!list.length) { box.hidden = true; return; }
  box.hidden = false;
  $('[data-reviews-note]').hidden = !!state.reviewsReal;
  $('[data-reviews-list]').innerHTML = list.map((r) => {
    const stars = '★'.repeat(r.rating || 5) + '☆'.repeat(5 - (r.rating || 5));
    return `<figure class="review">
      <div class="review__top"><span class="review__stars">${stars}</span>${r.sample ? '<span class="review__badge">예시</span>' : ''}</div>
      <blockquote>${esc(r.text)}</blockquote>
      <figcaption>${esc(r.name)} · ${esc(r.topic)}</figcaption>
    </figure>`;
  }).join('');
}

async function loadStats() {
  try {
    const s = await (await fetch('/api/stats')).json();
    if (s && s.show && s.readings) {
      $('[data-stat]').textContent = `지금까지 ${won(s.readings)}번의 풀이가 오갔어요`;
      $('[data-stat]').hidden = false;
    }
  } catch {}
}

/* ── 후기 남기기 폼 ───────────────────── */
function currentOrderId() { return state.flow === 'tarot' ? (state.tarot && state.tarot.orderId) : state.orderId; }
function reviewedSet() { try { return new Set(JSON.parse(localStorage.getItem('sb_reviewed') || '[]')); } catch { return new Set(); } }
function initReviewForms() {
  $$('[data-review-form]').forEach((form) => {
    const box = form.querySelector('[data-rv-stars]');
    box.innerHTML = [1, 2, 3, 4, 5].map((n) => `<button type="button" data-star="${n}">★</button>`).join('');
    const paint = (v) => box.querySelectorAll('button').forEach((b) => b.classList.toggle('on', +b.dataset.star <= v));
    paint(state.reviewRating);
    box.onclick = (e) => { const b = e.target.closest('[data-star]'); if (!b) return; state.reviewRating = +b.dataset.star; paint(state.reviewRating); };
    form.querySelector('[data-action="review-submit"]').onclick = () => submitReview(form);
  });
}
function showReviewForm() {
  const oid = currentOrderId();
  const done = !!(oid && reviewedSet().has(oid));
  $$('[data-review-form]').forEach((form) => {
    form.hidden = false;
    form.classList.toggle('is-done', done);
    form.querySelector('[data-rv-done]').hidden = !done;
  });
}
async function submitReview(form) {
  const oid = currentOrderId();
  if (!oid) return toast('주문 정보를 찾을 수 없어요');
  const text = form.querySelector('[data-rv-text]').value.trim();
  if (text.length < 10) return toast('후기를 10자 이상 적어주세요');
  const name = form.querySelector('[data-rv-name]').value.trim();
  const btn = form.querySelector('[data-action="review-submit"]');
  btn.disabled = true;
  try {
    const d = await fetch('/api/review', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: oid, rating: state.reviewRating, name, text }),
    }).then((r) => r.json());
    if (!d.ok) throw new Error(d.error || '전송 실패');
    try { const s = reviewedSet(); s.add(oid); localStorage.setItem('sb_reviewed', JSON.stringify([...s])); } catch {}
    showReviewForm();
    toast('후기 고마워요! 🌙');
  } catch (e) { toast(e.message); btn.disabled = false; }
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

function renderSoulmate(sm, unlocked) {
  const el = $('[data-soulmate]');
  if (!sm) { el.hidden = true; return; }
  el.hidden = false;
  const per = sm.personality || [], tr = sm.traits || [];
  const rows =
    (sm.job ? `<dt>일</dt><dd>${esc(sm.job)}</dd>` : '') +
    (sm.age ? `<dt>나이</dt><dd>${esc(sm.age)}</dd>` : '');
  if (unlocked) {
    el.innerHTML =
      `<div class="panel__h">앞으로의 인연</div>` +
      `<dl class="sm-grid">${rows}${sm.look ? `<dt>인상</dt><dd>${esc(sm.look)}</dd>` : ''}</dl>` +
      ((per.length || tr.length) ? `<div class="sm-tags">${[...per, ...tr].map((x) => `<span>${esc(x)}</span>`).join('')}</div>` : '');
  } else {
    el.innerHTML =
      `<div class="panel__h">앞으로의 인연</div>` +
      `<dl class="sm-grid">${rows}<dt>인상</dt><dd class="sm-lock">결제 후 공개</dd></dl>` +
      `<div class="sm-tags">${['성격', '관계에서의 결', '만나는 시기'].map((x) => `<span class="lock">${esc(x)} 🔒</span>`).join('')}</div>`;
  }
  armReveal();
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
  armReveal();
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
  state.flow = 'saju';
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
  $('[data-action="coupon-toggle"]').addEventListener('click', () => {
    const row = $('[data-coupon-row]');
    row.hidden = !row.hidden;
    if (!row.hidden) $('[data-coupon-input]').focus();
  });
  $('[data-action="coupon-apply"]').addEventListener('click', () => {
    const code = $('[data-coupon-input]').value.trim();
    const msg = $('[data-coupon-msg]');
    if (!code) return;
    state.coupon = code;
    msg.hidden = false;
    msg.textContent = `쿠폰 “${code}” 적용됨 · 결제 없이 열려요`;
    msg.className = 'coupon__msg ok';
    $('[data-action="pay-now"]').textContent = '무료로 열기';
  });
}
function resetCoupon() {
  state.coupon = null;
  $('[data-coupon-wrap]').hidden = !state.couponsOn;
  $('[data-coupon-row]').hidden = true;
  $('[data-coupon-input]').value = '';
  $('[data-coupon-msg]').hidden = true;
}
function openModal() {
  $('[data-modal-amount]').textContent = won(state.amount);
  $('[data-modal-items]').textContent = state.flow === 'tarot'
    ? '타로 3장 · 흘러온 / 지금 / 나아갈 자리'
    : state.topicList.filter((t) => state.picked.has(t.id)).map((t) => t.emoji + ' ' + t.label).join('  ·  ');
  resetCoupon();
  $('[data-action="pay-now"]').textContent = state.payProvider === 'mock' ? '복채 내기' : '결제하기';
  $('[data-modal]').hidden = false;
}
function closeModal() { $('[data-modal]').hidden = true; }

async function payNow() {
  const btn = $('[data-action="pay-now"]');
  btn.disabled = true; btn.textContent = '결제 중…';
  try {
    // 포트원 실결제 (쿠폰이면 결제창을 띄우지 않음)
    if (state.payProvider === 'portone' && !state.coupon) {
      if (!window.PortOne) throw new Error('결제 모듈을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.');
      const p = state.pay || {};
      if (!p.storeId || !p.channelKey) throw new Error('결제 설정이 준비되지 않았습니다.');
      const names = state.topicList.filter((t) => state.picked.has(t.id)).map((t) => t.label);
      const res = await window.PortOne.requestPayment({
        storeId: p.storeId,
        channelKey: p.channelKey,
        paymentId: state.orderId,
        orderName: `${state.brand.siteName} 사주 · ${names[0] || '풀이'}${names.length > 1 ? ` 외 ${names.length - 1}건` : ''}`,
        totalAmount: state.amount,
        currency: 'CURRENCY_KRW',
        payMethod: 'CARD',
        customData: { orderId: state.orderId },
      });
      if (res && res.code != null) throw new Error(res.message || '결제가 취소되었습니다.');
    }

    // 서버 검증 (쿠폰=결제 생략 / 포트원=실조회 / mock=통과)
    const r = await fetch('/api/order/pay', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: state.orderId, coupon: state.coupon || undefined }),
    });
    const d = await r.json();
    if (!d.ok) throw new Error(d.error || '결제 확인 실패');
    closeModal();

    if (state.flow === 'tarot') {
      location.hash = 'tarot=' + state.orderId;
      $('[data-tarot-paywall]').hidden = true;
      $('[data-tarot-reading-wrap]').hidden = false;
      $('[data-tarot-reading]').innerHTML = '<div class="skeleton"></div>';
      $('[data-tarot-reading-wrap]').scrollIntoView({ behavior: 'smooth', block: 'start' });
      startTarotReading(state.orderId);
      return;
    }

    state.topicsUsed = [...state.picked];
    location.hash = 'order=' + state.orderId;
    renderCrisis(state.teaser, true); // 잠금 해제
    renderSoulmate(state.teaser && state.teaser.soulmate, true);
    $('[data-paywall]').hidden = true;
    $('[data-reading-wrap]').hidden = false;
    $('[data-reading]').innerHTML = '<div class="skeleton"></div>';
    $('[data-reading-wrap]').scrollIntoView({ behavior: 'smooth', block: 'start' });
    startReading(state.orderId);
  } catch (e) {
    toast(e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = state.coupon ? '무료로 열기' : (state.payProvider === 'mock' ? '복채 내기' : '결제하기');
  }
}

async function startReading(orderId) {
  await streamReading({
    url: '/api/saju/reading', orderId,
    body: $('[data-reading]'), meta: $('[data-read-meta]'),
    onChart: (chart) => {
      state.chart = chart;
      if (!$('[data-wongook]').innerHTML.trim()) renderResult();
      $('[data-paywall]').hidden = true;
      $('[data-reading-wrap]').hidden = false;
      openAdv();
    },
    onDone: (acc) => { state.reading = acc; },
  });
}

/* 사주·타로 공용 스트리밍 리더.
 * - ping(하트비트)은 무시하되 연결 유지 확인용.
 * - done 없이 스트림이 끊기면(네트워크 오류) 최대 2회 자동 재연결. 주문은 결제 상태로 남아 서버가 다시 생성한다. */
async function streamReading({ url, orderId, body, meta, onChart, onDone }) {
  let attempt = 0;
  const startedAt = Date.now();
  let waitTimer = setInterval(() => {
    if (body.querySelector('.skeleton')) {
      const s = Math.round((Date.now() - startedAt) / 1000);
      body.innerHTML = `<div class="skeleton"></div><p class="reading__meta">별하가 붓을 들고 있어요… ${s}초 (보통 1분 안팎)</p>`;
    }
  }, 3000);

  while (attempt < 3) {
    attempt++;
    let acc = '', first = true, sawDone = false, sawError = null;
    try {
      const res = await fetch(url, {
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
          let msg; try { msg = JSON.parse(line); } catch { continue; }
          if (msg.type === 'ping') continue;
          if (msg.type === 'chart' || msg.type === 'draw') { onChart && onChart(msg.chart || msg.draw); }
          else if (msg.type === 'delta') {
            if (first) { body.innerHTML = ''; first = false; autoScrollStart(); }
            acc += msg.text;
            body.innerHTML = mdToHtml(acc) + '<span class="cursor"></span>';
            stickScroll();
          } else if (msg.type === 'done') {
            sawDone = true;
            body.innerHTML = mdToHtml(acc);
            window.glossary && glossary.attach(body);
            webtoonify(body);
            autoScrollStop();
            if (meta) meta.textContent = msg.cached ? '· 저장된 결과' : `· ${(msg.ms / 1000).toFixed(0)}초`;
            onDone && onDone(acc);
            showReviewForm();
          } else if (msg.type === 'error') {
            sawError = msg.error;
          }
        }
      }
    } catch (e) {
      sawError = sawError || e.message;
    }

    if (sawDone) { clearInterval(waitTimer); return; }

    // 명시적 서버 오류: 1회까지만 재시도, 그 뒤엔 안내
    if (sawError && attempt >= 2) {
      clearInterval(waitTimer);
      autoScrollStop();
      body.innerHTML =
        `<p style="color:#e88a8a">${esc(sawError)}</p>` +
        `<p class="reading__meta">복채는 완료됐습니다. 잠시 후 아래 버튼으로 다시 시도해 주세요.</p>` +
        `<button class="btn btn--ghost" onclick="location.reload()">다시 불러오기</button>`;
      return;
    }
    // 끊김/오류 → 재연결 안내 후 루프 계속
    if (attempt < 3) {
      body.innerHTML = `<div class="skeleton"></div><p class="reading__meta">연결이 잠시 끊겨 다시 잇는 중… (${attempt}/2)</p>`;
      await sleep(1200);
    }
  }
  clearInterval(waitTimer);
  body.innerHTML =
    `<p style="color:#e88a8a">연결이 계속 끊겨 풀이를 받지 못했어요.</p>` +
    `<p class="reading__meta">복채는 완료됐습니다. 네트워크가 안정된 곳에서 이 링크를 다시 열면 이어집니다.</p>` +
    `<button class="btn btn--ghost" onclick="location.reload()">다시 불러오기</button>`;
}

async function restoreOrder(oid) {
  state.flow = 'saju';
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
    renderSoulmate(state.teaser && state.teaser.soulmate, true);
    $('[data-paywall]').hidden = true;
    $('[data-reading-wrap]').hidden = false;
    openAdv();
    if (o.status === 'consumed' && o.reading) {
      state.reading = o.reading;
      $('[data-reading]').innerHTML = mdToHtml(o.reading);
      window.glossary && glossary.attach($('[data-reading]'));
      webtoonify($('[data-reading]'));
      $('[data-read-meta]').textContent = '· 저장된 결과';
      showReviewForm();
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

/* ══════════════════════════════════════════
 *  타로
 * ══════════════════════════════════════════ */
const TAROT_POS = ['흘러온 자리', '지금 이 자리', '나아갈 자리'];
const GLYPH = {
  star: '✶', wand: '✦', moon: '☾', leaf: '❧', shield: '❖', key: '✜', heart: '❥',
  wheel: '✺', flame: '✹', lantern: '✧', scale: '⚖', drop: '❃', scythe: '⚑', chain: '⛓',
  bolt: '⚡', sun: '☀', horn: '✵', wands: '✦', cups: '❥', swords: '✧', pentacles: '✜',
};

function vid() {
  try {
    let v = localStorage.getItem('sb_vid');
    if (!v) { v = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('sb_vid', v); }
    return v;
  } catch { return 'anon'; }
}

async function getDeck() {
  if (state.deck) return state.deck;
  try {
    const d = await (await fetch('/api/tarot/deck')).json();
    state.deck = {};
    (d.cards || []).forEach((c) => (state.deck[c.id] = c));
  } catch { state.deck = {}; }
  return state.deck;
}

function tcardHTML(opt) {
  const d = (state.deck && state.deck[opt.id]) || null;
  const g = GLYPH[d && d.glyph] || '✦';
  return `<figure class="tcard ${opt.small ? 'tcard--sm' : ''} ${opt.faceDown ? 'is-down' : ''}" data-card="${esc(opt.id || '')}">
    <div class="tcard__inner ${opt.reversed ? 'is-rev' : ''}">
      <span class="tcard__roman">${esc(d ? d.roman : '·')}</span>
      <span class="tcard__glyph">${g}</span>
      <span class="tcard__name">${esc(d ? d.ko : '')}</span>
    </div>
    <div class="tcard__back">☾</div>
    ${opt.reversed ? '<span class="tcard__tag">역방향</span>' : ''}
    ${opt.label ? `<figcaption>${esc(opt.label)}</figcaption>` : ''}
  </figure>`;
}

async function loadDaily() {
  const box = $('[data-daily]');
  if (!box) return;
  await getDeck();
  const seed = new Date().toISOString().slice(0, 10) + ':' + vid();
  try {
    const d = await (await fetch('/api/tarot/daily', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seed }),
    })).json();
    if (!d.ok) return;
    const card = state.deck[d.card.id];
    $('[data-daily-card]').innerHTML = tcardHTML({ id: d.card.id, reversed: d.card.reversed, small: true });
    $('[data-daily-name]').textContent = (card ? card.ko : '오늘의 카드') + (d.card.reversed ? ' (역방향)' : '');
    $('[data-daily-blurb]').textContent = d.blurb || '';
    box.hidden = false;
  } catch {}
}

function bindTarot() {
  $('[data-action="tarot-back"]').addEventListener('click', () => { location.hash = ''; location.reload(); });
  $('[data-action="tarot-draw"]').addEventListener('click', tarotDraw);
  $('[data-action="tarot-checkout"]').addEventListener('click', () => {
    state.flow = 'tarot';
    state.amount = state.tarotPrice;
    state.orderId = state.tarot.orderId;
    if (!state.orderId) return toast('먼저 카드를 펼쳐주세요');
    openModal();
  });
  $('[data-action="tarot-restart"]').addEventListener('click', () => { location.hash = ''; location.reload(); });
  $('[data-action="tarot-copy"]').addEventListener('click', async () => {
    const url = location.origin + location.pathname + '#tarot=' + (state.tarot.orderId || '');
    try { await navigator.clipboard.writeText(url); toast('링크를 복사했어요'); } catch { toast(url); }
  });
}

async function startTarot() {
  state.flow = 'tarot';
  await getDeck();
  $('[data-tarot-q]').value = '';
  $('[data-tarot-ask]').hidden = false;
  $('[data-tarot-spread]').hidden = true;
  $('[data-tarot-paywall]').hidden = true;
  $('[data-tarot-reading-wrap]').hidden = true;
  $('[data-tarot-foot]').hidden = true;
  show('tarot');
}

async function tarotDraw() {
  const btn = $('[data-action="tarot-draw"]');
  btn.disabled = true;
  const q = $('[data-tarot-q]').value.trim();
  try {
    const d = await (await fetch('/api/tarot/order', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q, name: state.form.name || '' }),
    })).json();
    if (!d.ok) throw new Error(d.error || '카드를 펼치지 못했어요');
    state.tarot = { orderId: d.orderId, draw: d.draw, question: q, reading: '' };
    state.orderId = d.orderId;
    state.amount = d.amount;

    const wrap = $('[data-tspread]');
    wrap.innerHTML = d.draw.map((c, i) => tcardHTML({ id: c.id, reversed: c.reversed, faceDown: true, label: TAROT_POS[i] })).join('');
    $('[data-tarot-ask]').hidden = true;
    $('[data-tarot-spread]').hidden = false;
    // 한 장씩 뒤집기
    const cards = [...wrap.querySelectorAll('.tcard')];
    cards.forEach((el, i) => setTimeout(() => el.classList.remove('is-down'), 400 + i * 550));
    setTimeout(() => { $('[data-tarot-paywall]').hidden = false; $('[data-tarot-paywall]').scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 400 + cards.length * 550 + 300);
  } catch (e) {
    toast(e.message);
  } finally {
    btn.disabled = false;
  }
}

async function startTarotReading(orderId) {
  $('[data-tarot-foot]').hidden = false;
  await streamReading({
    url: '/api/tarot/reading', orderId,
    body: $('[data-tarot-reading]'), meta: $('[data-tarot-read-meta]'),
    onChart: (draw) => {
      const w = $('[data-tspread]');
      if (w && !w.innerHTML.trim()) {
        w.innerHTML = draw.map((c, i) => tcardHTML({ id: c.id, reversed: c.reversed, label: TAROT_POS[i] })).join('');
        $('[data-tarot-spread]').hidden = false;
      }
    },
    onDone: (acc) => { state.tarot.reading = acc; },
  });
}

async function restoreTarot(oid) {
  state.flow = 'tarot';
  await getDeck();
  try {
    const o = await (await fetch('/api/tarot/order/' + oid)).json();
    if (!o.ok || !['paid', 'consumed'].includes(o.status)) return show('landing');
    state.tarot = { orderId: oid, draw: o.draw || [], question: o.question || '', reading: o.reading || '' };
    show('tarot');
    $('[data-tarot-ask]').hidden = true;
    $('[data-tarot-paywall]').hidden = true;
    $('[data-tarot-spread]').hidden = false;
    $('[data-tspread]').innerHTML = (o.draw || []).map((c, i) => tcardHTML({ id: c.id, reversed: c.reversed, label: TAROT_POS[i] })).join('');
    $('[data-tarot-reading-wrap]').hidden = false;
    $('[data-tarot-foot]').hidden = false;
    if (o.status === 'consumed' && o.reading) {
      $('[data-tarot-reading]').innerHTML = mdToHtml(o.reading);
      window.glossary && glossary.attach($('[data-tarot-reading]'));
      webtoonify($('[data-tarot-reading]'));
      $('[data-tarot-read-meta]').textContent = '· 저장된 결과';
      showReviewForm();
    } else {
      $('[data-tarot-reading]').innerHTML = '<div class="skeleton"></div>';
      startTarotReading(oid);
    }
  } catch {
    show('landing');
  }
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
