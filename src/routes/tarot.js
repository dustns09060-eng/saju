'use strict';

/**
 * 타로 라우트 (/api/tarot).
 *  - 사주와 별개 상품. 결제 검증은 사주와 같은 /api/order/pay 를 그대로 쓴다(orderId만 필요).
 *  - 무료: /daily  (오늘의 카드 1장 + 짧은 해설, 저렴한 모델)
 *  - 유료: /order → /api/order/pay → /reading (3장 스프레드 스트리밍)
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const log = require('../lib/logger');
const claude = require('../lib/claude');
const orders = require('../lib/orders');
const branding = require('../branding');
const tarot = require('../tarot');

const router = express.Router();

const DAILY_PATH = path.join(__dirname, '..', 'prompts', 'tarot-daily.md');
const READING_PATH = path.join(__dirname, '..', 'prompts', 'tarot.md');
const TEASER_MODEL = process.env.CLAUDE_TEASER_MODEL || 'claude-haiku-4-5';

const clean = (s, n) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, n) : '');

/* ── 덱 (렌더용) ──────────────────────────────────── */
router.get('/deck', (req, res) => {
  res.json({ ok: true, cards: tarot.publicDeck(), positions: tarot.POSITIONS, price: tarot.PRICE_KRW });
});

/* ── 무료: 오늘의 카드 ────────────────────────────── */
router.post('/daily', async (req, res) => {
  const seed = clean((req.body || {}).seed, 80) || new Date().toISOString().slice(0, 10);
  const { id, reversed } = tarot.dailyDraw(seed);
  try {
    const tpl = fs.readFileSync(DAILY_PATH, 'utf8');
    const prompt = tpl
      .replace(/\{\{NARRATOR\}\}/g, branding.narrator)
      .replace('{{CARD}}', tarot.describeCard(id, reversed));
    let text = '';
    try {
      text = await claude.ask(prompt, { maxTokens: 320, model: TEASER_MODEL });
    } catch (e) {
      log.warn('daily 해설 생략:', e.message);
    }
    res.json({ ok: true, card: { id, reversed }, blurb: clean(text, 600) });
  } catch (e) {
    log.error('daily 오류:', e.message);
    res.status(500).json({ ok: false, error: '오늘의 카드를 여는 중 오류: ' + e.message });
  }
});

/* ── 유료: 주문 (서버가 3장 뽑아 저장) ────────────── */
router.post('/order', async (req, res) => {
  try {
    const body = req.body || {};
    const question = clean(body.question, 300);
    const name = clean(body.name, 8);
    const draw = tarot.drawSpread(3);

    const input = { kind: 'tarot', name, question, tarot: { question, draw } };
    const order = await orders.create(input, tarot.PRICE_KRW);
    await orders.save(order);

    log.info(`타로 주문 ${order.id} (${tarot.PRICE_KRW}원)`);
    res.json({
      ok: true,
      orderId: order.id,
      amount: tarot.PRICE_KRW,
      draw, // 프론트가 카드 뒷면→앞면 연출에 사용 (해설은 결제 후)
    });
  } catch (e) {
    log.error('타로 주문 오류:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* ── 주문 조회 (다시 보기) ────────────────────────── */
router.get('/order/:id', async (req, res) => {
  const o = await orders.get(req.params.id);
  if (!o || !(o.input && o.input.kind === 'tarot')) return res.status(404).json({ ok: false, error: '타로 주문을 찾을 수 없습니다.' });
  res.json({
    ok: true,
    status: o.status,
    amount: o.amount,
    question: (o.input && o.input.question) || '',
    draw: (o.input && o.input.tarot && o.input.tarot.draw) || [],
    reading: o.reading || null,
  });
});

/* ── 유료: 3장 풀이 스트리밍 ──────────────────────── */
router.post('/reading', async (req, res) => {
  const order = await orders.get((req.body || {}).orderId);
  if (!order || !(order.input && order.input.kind === 'tarot')) {
    return res.status(404).json({ ok: false, error: '타로 주문을 찾을 수 없습니다. 먼저 결제해 주세요.' });
  }

  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');
  const send = (o) => res.write(JSON.stringify(o) + '\n');

  const draw = (order.input.tarot && order.input.tarot.draw) || [];
  send({ type: 'draw', draw });

  if (order.status === 'consumed') {
    if (order.reading) send({ type: 'delta', text: order.reading });
    send({ type: 'done', ms: 0, cached: true });
    return res.end();
  }
  if (order.status !== 'paid') {
    res.removeHeader('Content-Type');
    return res.status(402).json({ ok: false, error: '결제가 확인되지 않았습니다.' });
  }

  const tpl = fs.readFileSync(READING_PATH, 'utf8');
  const q = order.input.question
    ? `"${order.input.question}"`
    : '특별히 지정한 질문은 없습니다. 요즘의 전반적인 흐름을 봐 주세요.';
  const prompt = tpl
    .replace(/\{\{NARRATOR\}\}/g, branding.narrator)
    .replace(/\{\{NAME\}\}/g, order.input.name || '그대')
    .replace('{{DRAW}}', tarot.describeDraw(draw))
    .replace('{{QUESTION}}', q);

  const ac = new AbortController();
  res.on('close', () => { if (!res.writableEnded) ac.abort(); });

  const started = Date.now();
  try {
    const full = await claude.askStream(prompt, {
      signal: ac.signal,
      onDelta: (t) => send({ type: 'delta', text: t }),
    });
    order.status = 'consumed';
    order.consumedAt = new Date().toISOString();
    order.reading = full;
    await orders.save(order);
    send({ type: 'done', ms: Date.now() - started });
    res.end();
  } catch (e) {
    if (ac.signal.aborted) return res.end();
    log.error('타로 reading 오류:', e.message);
    send({ type: 'error', error: e.message });
    res.end();
  }
});

module.exports = router;
