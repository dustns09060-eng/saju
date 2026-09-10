'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');

const log = require('../lib/logger');
const claude = require('../lib/claude');
const orders = require('../lib/orders');
const { PROVIDER: PAY_PROVIDER, PRICE_KRW, publicConfig: payPublicConfig, verifyPayment } = require('../lib/payments');
const { computeChart, InputError } = require('../saju/compute');
const { formatChartForPrompt } = require('../saju/format');
const topics = require('../saju/topics');
const branding = require('../branding');
const tarot = require('../tarot');
const { publicReviews, hasRealReviews } = require('../reviews');
const reviewsStore = require('../lib/reviewsStore');
const coupons = require('../coupons');

const ADMIN_KEY = process.env.ADMIN_KEY || '';

const router = express.Router();

const PROMPT_PATH = path.join(__dirname, '..', 'prompts', 'reading.md');
const TEASER_PATH = path.join(__dirname, '..', 'prompts', 'teaser.md');
const HISTORY_DIR = path.join(__dirname, '..', '..', 'data', 'history');
// 맛보기는 결제 전 첫인상이라 품질이 중요 → 기본 sonnet. 비용 줄이려면 env 로 haiku 지정.
const TEASER_MODEL = process.env.CLAUDE_TEASER_MODEL || 'claude-sonnet-5';
// 통계 노출 최소 기준 (너무 적을 때 "지금까지 3회" 는 역효과)
const STATS_MIN = Number(process.env.STATS_MIN_SHOW || 30);

const INPUT_KEYS = [
  'calendar', 'isLeapMonth', 'year', 'month', 'day',
  'hourKnown', 'hour', 'minute', 'gender',
  'longitude', 'place', 'trueSolarTime', 'dayBoundary', 'question', 'name',
];
function pickInput(body = {}) {
  const o = {};
  for (const k of INPUT_KEYS) if (body[k] !== undefined) o[k] = body[k];
  if (typeof o.question === 'string') o.question = o.question.slice(0, 500);
  if (typeof o.name === 'string') o.name = o.name.slice(0, 8);
  return o;
}

function buildPrompt(chart, opts = {}) {
  const { question, topicIds, name, crises } = opts;
  const tpl = fs.readFileSync(PROMPT_PATH, 'utf8');

  const chosen = topics.resolve(topicIds);
  const list = (chosen.length ? chosen : topics.resolve(['overall']))
    .map((t) => `- 소제목 \`### ${t.emoji} ${t.label}\` 아래에: ${t.focus}`)
    .join('\n');
  const topicBlock =
    '## 이번 답변에 반드시 포함할 주제 소제목 (아래 순서대로, 사용자에게 되묻지 말고 지금 바로 모두 작성)\n' +
    list +
    '\n(이 목록은 "선택지"가 아니라 이번에 당신이 직접 써야 할 섹션 목록입니다.)';

  const q = (question || '').toString().trim().slice(0, 500);
  const qBlock = q
    ? `## 사용자가 특히 궁금해하는 것\n"${q}"\n이 질문은 "### 📜 맺음" 바로 앞에 "### 💬 물어보신 것" 소제목으로 따로 다룬다.`
    : '';

  const crisesHint = Array.isArray(crises) && crises.length
    ? `이미 예고한 국면(이어서 구체화): ${crises.map((c) => `"${c}"`).join(', ')}`
    : '';

  return tpl
    .replace(/\{\{NARRATOR\}\}/g, branding.narrator)
    .replace(/\{\{NAME\}\}/g, (name || '').toString().trim() || '그대')
    .replace('{{TOPIC_BLOCKS}}', topicBlock)
    .replace('{{QUESTION_BLOCK}}', qBlock)
    .replace('{{CRISES_HINT}}', crisesHint)
    .replace('{{CHART}}', formatChartForPrompt(chart));
}

function saveHistory(record) {
  try {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
    const name = new Date().toISOString().replace(/[:.]/g, '-') + '.json';
    fs.writeFileSync(path.join(HISTORY_DIR, name), JSON.stringify(record, null, 2), 'utf8');
    return name;
  } catch (e) {
    log.warn('history 저장 실패:', e.message);
    return null;
  }
}

/* ── 공개 설정 ─────────────────────────────────────── */
router.get('/config', async (req, res) => {
  let real = [];
  try {
    real = (await reviewsStore.listApproved(12)).map((r) => ({
      name: r.name || '익명', topic: r.topic || '', text: r.text, rating: r.rating, sample: false,
    }));
  } catch { /* 후기 저장소 오류는 무시 */ }
  const samples = publicReviews();
  // 실제 후기가 있으면 그것만, 없으면 예시로 자리 채움
  const list = real.length ? real : samples;
  res.json({
    currency: 'KRW',
    payProvider: PAY_PROVIDER,
    pay: payPublicConfig(),
    aiProvider: claude.PROVIDER,
    topics: topics.publicList(),
    tarot: { price: tarot.PRICE_KRW },
    reviews: list,
    reviewsReal: real.length > 0 || hasRealReviews(),
    couponsOn: coupons.enabled(),
    branding,
  });
});

/* ── 후기 남기기 (풀이를 받은 주문만) ──────────────── */
router.post('/review', async (req, res) => {
  const { orderId, rating, name, text } = req.body || {};
  const order = await orders.get(orderId);
  if (!order) return res.status(404).json({ ok: false, error: '주문을 찾을 수 없습니다.' });
  if (order.status !== 'consumed') return res.status(403).json({ ok: false, error: '풀이를 받은 뒤에 후기를 남길 수 있어요.' });
  const body = String(text || '').trim();
  if (body.length < 10) return res.status(400).json({ ok: false, error: '후기를 10자 이상 적어주세요.' });
  const topic = order.input && order.input.kind === 'tarot'
    ? '타로 3장'
    : (topics.resolve(order.topics || (order.input && order.input.topics))[0] || {}).label || '사주 풀이';
  try {
    await reviewsStore.add({ orderId, rating, name, text: body, topic });
    log.info(`후기 접수 (order ${orderId})`);
    res.json({ ok: true });
  } catch (e) {
    log.error('후기 저장 오류:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* ── 관리자: 후기 승인/삭제 (ADMIN_KEY 필요) ───────── */
function admin(req, res, next) {
  if (!ADMIN_KEY || (req.query.key || req.get('x-admin-key')) !== ADMIN_KEY) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  next();
}
router.get('/admin/reviews', admin, async (req, res) => {
  res.json({ ok: true, reviews: await reviewsStore.all() });
});
router.post('/admin/reviews/:id', admin, async (req, res) => {
  const act = req.query.action || req.body.action;
  try {
    if (act === 'approve') await reviewsStore.setApproved(req.params.id, true);
    else if (act === 'hide') await reviewsStore.setApproved(req.params.id, false);
    else if (act === 'delete') await reviewsStore.remove(req.params.id);
    else return res.status(400).json({ ok: false, error: 'action: approve|hide|delete' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* ── 누적 풀이 수 (실데이터, 일정 수준 이상일 때만 노출) ── */
router.get('/stats', async (req, res) => {
  try {
    const n = await orders.countConsumed();
    res.json({ ok: true, readings: n, show: n >= STATS_MIN });
  } catch (e) {
    res.json({ ok: false, readings: 0, show: false });
  }
});

/* ── 무료: 사주표만 계산 (결제 전 미리보기) ────────── */
router.post('/saju/compute', (req, res) => {
  try {
    const chart = computeChart(req.body || {});
    res.json({ ok: true, chart });
  } catch (e) {
    if (e instanceof InputError) return res.status(400).json({ ok: false, error: e.message });
    log.error('compute 오류:', e.stack || e.message);
    res.status(500).json({ ok: false, error: '사주 계산 중 오류: ' + e.message });
  }
});

/* ── 무료: 맛보기 위젯 (AI, 저렴한 모델) ───────────── */
router.post('/saju/teaser', async (req, res) => {
  let chart;
  try {
    chart = computeChart(req.body || {});
  } catch (e) {
    const code = e instanceof InputError ? 400 : 500;
    return res.status(code).json({ ok: false, error: e.message });
  }
  try {
    const tpl = fs.readFileSync(TEASER_PATH, 'utf8');
    const name = (req.body && req.body.name ? String(req.body.name) : '').slice(0, 8).trim();
    const prompt = tpl
      .replace(/\{\{NARRATOR\}\}/g, branding.narrator)
      .replace(/\{\{NAME\}\}/g, name || '그대')
      .replace('{{CHART}}', formatChartForPrompt(chart));
    const data = await claude.askJson(prompt, { maxTokens: 1100, model: TEASER_MODEL });
    const crises = Array.isArray(data.crises) ? data.crises.map((s) => String(s).slice(0, 40)).slice(0, 5) : [];
    res.json({
      ok: true,
      teaser: {
        intro: String(data.intro || '').slice(0, 600),
        soulmate: data.soulmate || null,
        crisesFree: crises.slice(0, 2),
        crisesLocked: Math.max(0, crises.length - 2),
        crisesAll: crises, // 결제 후 상세화에 사용
      },
    });
  } catch (e) {
    log.error('teaser 오류:', e.message);
    res.status(502).json({ ok: false, error: '맛보기 생성 중 오류: ' + e.message });
  }
});

/* ── 주문 생성 ────────────────────────────────────── */
router.post('/order', async (req, res) => {
  try {
    computeChart(req.body || {}); // 입력 유효성 검사 (throw 시 아래 catch)

    const chosen = topics.resolve((req.body || {}).topics);
    if (!chosen.length) return res.status(400).json({ ok: false, error: '풀이 주제를 하나 이상 선택해 주세요.' });
    const amount = chosen.reduce((s, t) => s + t.price, 0);

    const input = pickInput(req.body);
    input.topics = chosen.map((t) => t.id);
    if (Array.isArray(req.body.crises)) input.crises = req.body.crises.map((s) => String(s).slice(0, 40)).slice(0, 5);
    if (req.body.teaser && typeof req.body.teaser === 'object') {
      const t = req.body.teaser;
      input.teaserSnapshot = {
        intro: String(t.intro || '').slice(0, 600),
        soulmate: t.soulmate || null,
        crisesFree: Array.isArray(t.crisesFree) ? t.crisesFree.slice(0, 3) : [],
        crisesLocked: Number(t.crisesLocked) || 0,
        crisesAll: Array.isArray(t.crisesAll) ? t.crisesAll.slice(0, 5) : [],
      };
    }
    const order = await orders.create(input, amount);
    order.topics = input.topics;
    await orders.save(order);

    log.info(`주문 생성 ${order.id} — ${order.topics.join(',')} (${amount}원)`);
    res.json({ ok: true, orderId: order.id, amount, payProvider: PAY_PROVIDER });
  } catch (e) {
    if (e instanceof InputError) return res.status(400).json({ ok: false, error: e.message });
    log.error('order 생성 오류:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* ── 결제 검증 ────────────────────────────────────── */
router.post('/order/pay', async (req, res) => {
  const { orderId, coupon } = req.body || {};
  const order = await orders.get(orderId);
  if (!order) return res.status(404).json({ ok: false, error: '주문을 찾을 수 없습니다.' });
  if (order.status === 'paid' || order.status === 'consumed') return res.json({ ok: true, already: true });
  if (order.status !== 'pending') return res.status(409).json({ ok: false, error: '결제할 수 없는 주문 상태입니다.' });

  // 쿠폰: 결제 건너뛰고 바로 paid
  if (coupon) {
    if (!coupons.isValid(coupon)) return res.status(400).json({ ok: false, error: '쿠폰 코드가 올바르지 않아요.' });
    if ((await orders.countCoupon()) >= coupons.maxTotal()) {
      return res.status(409).json({ ok: false, error: '쿠폰이 모두 소진됐어요.' });
    }
    order.status = 'paid';
    order.payment = { provider: 'coupon', code: coupons.normalize(coupon), amount: 0, at: new Date().toISOString() };
    await orders.save(order);
    log.info(`쿠폰 사용 ${order.id} (${order.payment.code})`);
    return res.json({ ok: true, coupon: true });
  }

  // 포트원/모의 모두 결제 식별자로 주문 ID 를 그대로 쓴다 (프론트도 paymentId: orderId 로 결제창 호출)
  const paymentId = order.id;

  try {
    const v = await verifyPayment({ paymentId, orderId, expectedAmount: order.amount });
    if (!v.ok || v.paidAmount !== order.amount) {
      log.warn(`결제 검증 실패 ${order.id} status=${v.status} paid=${v.paidAmount} expected=${order.amount}`);
      return res.status(402).json({ ok: false, error: '결제가 확인되지 않았습니다. 결제가 완료되었는데도 이 화면이 보이면 고객센터로 문의해 주세요.' });
    }
    order.status = 'paid';
    order.payment = { provider: v.provider, paymentId, amount: v.paidAmount, status: v.status, at: new Date().toISOString() };
    await orders.save(order);
    log.info(`결제 확인 ${order.id} (${v.provider})`);
    res.json({ ok: true });
  } catch (e) {
    log.error('결제 검증 오류:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* ── 주문 조회 (다시 보기) ────────────────────────── */
router.get('/order/:id', async (req, res) => {
  const o = await orders.get(req.params.id);
  if (!o) return res.status(404).json({ ok: false, error: '주문을 찾을 수 없습니다.' });
  res.json({
    ok: true,
    status: o.status,
    amount: o.amount,
    topics: o.topics || (o.input && o.input.topics) || [],
    teaser: (o.input && o.input.teaserSnapshot) || null,
    chart: o.chart,
    reading: o.reading,
  });
});

/* ── 유료: AI 풀이 스트리밍 (orderId 필요) ─────────── */
router.post('/saju/reading', async (req, res) => {
  const order = await orders.get((req.body || {}).orderId);
  if (!order) return res.status(404).json({ ok: false, error: '주문을 찾을 수 없습니다. 먼저 결제해 주세요.' });

  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');
  const send = (o) => res.write(JSON.stringify(o) + '\n');

  // 이미 발급된 주문 → 저장된 결과 재전송
  if (order.status === 'consumed') {
    send({ type: 'chart', chart: order.chart });
    if (order.reading) send({ type: 'delta', text: order.reading });
    send({ type: 'done', ms: 0, cached: true });
    return res.end();
  }
  if (order.status !== 'paid') {
    res.removeHeader('Content-Type');
    return res.status(402).json({ ok: false, error: '결제가 확인되지 않았습니다.' });
  }

  let chart;
  try {
    chart = computeChart(order.input);
  } catch (e) {
    res.removeHeader('Content-Type');
    return res.status(500).json({ ok: false, error: e.message });
  }
  send({ type: 'chart', chart });

  const ac = new AbortController();
  // 첫 토큰까지 수십 초 걸릴 수 있어, 중간 프록시가 유휴 연결을 끊지 않도록 5초마다 ping.
  const hb = setInterval(() => {
    if (!res.writableEnded) { try { send({ type: 'ping', t: Date.now() }); } catch {} }
  }, 5000);
  res.on('close', () => {
    clearInterval(hb);
    if (!res.writableEnded) ac.abort();
  });

  const prompt = buildPrompt(chart, {
    question: order.input && order.input.question,
    topicIds: order.topics || (order.input && order.input.topics),
    name: order.input && order.input.name,
    crises: order.input && order.input.crises,
  });
  const started = Date.now();
  try {
    const full = await claude.askStream(prompt, {
      signal: ac.signal,
      onDelta: (t) => send({ type: 'delta', text: t }),
    });
    clearInterval(hb);
    order.status = 'consumed';
    order.consumedAt = new Date().toISOString();
    order.chart = chart;
    order.reading = full;
    await orders.save(order);
    saveHistory({
      at: order.consumedAt,
      orderId: order.id,
      topics: order.topics,
      amount: order.amount,
      input: order.input,
      pillars: chart.pillarsText,
      reading: full,
      ms: Date.now() - started,
    });
    send({ type: 'done', ms: Date.now() - started });
    res.end();
  } catch (e) {
    clearInterval(hb);
    if (ac.signal.aborted) {
      log.info('풀이 요청 취소됨 (주문은 paid 유지)');
      return res.end();
    }
    log.error('reading 오류:', e.message);
    send({ type: 'error', error: e.message }); // 주문은 paid 로 남아 재시도 가능
    res.end();
  }
});

module.exports = router;
