'use strict';

require('dotenv').config();

const express = require('express');
const path = require('path');
const log = require('./lib/logger');

const app = express();
app.use(express.json({ limit: '1mb' }));

app.use('/api', require('./routes/saju'));

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));
app.get('/api/logs', (req, res) => res.json(log.recent(Number(req.query.n) || 100)));

app.use(express.static(path.join(__dirname, '..', 'public')));

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  log.info(`사주 풀이 웹앱: http://localhost:${PORT}`);
  log.info(`모델: ${process.env.CLAUDE_MODEL || '(CLI 기본값)'} / 타임아웃: ${process.env.CLAUDE_TIMEOUT_MS || 180000}ms`);
});
