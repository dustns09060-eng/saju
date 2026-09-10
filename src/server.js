'use strict';

require('dotenv').config();

const express = require('express');
const path = require('path');
const log = require('./lib/logger');
const orders = require('./lib/orders');
const reviews = require('./lib/reviewsStore');

const app = express();
app.use(express.json({ limit: '1mb' }));

app.use('/api', require('./routes/saju'));
app.use('/api/tarot', require('./routes/tarot'));

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));
app.get('/api/logs', (req, res) => res.json(log.recent(Number(req.query.n) || 100)));

app.use(express.static(path.join(__dirname, '..', 'public')));

const PORT = Number(process.env.PORT || 3000);

(async () => {
  try {
    await orders.init();
    await reviews.init();
    log.info(`주문 저장소: ${orders.backend} / 후기 저장소: ${reviews.backend}`);
  } catch (e) {
    log.error('주문 저장소 초기화 실패:', e.message);
    process.exit(1);
  }
  app.listen(PORT, () => {
    log.info(`사주 풀이 웹앱: http://localhost:${PORT}`);
    log.info(`모델: ${process.env.CLAUDE_MODEL || '(CLI 기본값)'} / 타임아웃: ${process.env.CLAUDE_TIMEOUT_MS || 180000}ms`);
  });
})();
