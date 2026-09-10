'use strict';

/**
 * 주문 저장소.
 *  - DATABASE_URL 이 있으면 Postgres (운영), 없으면 로컬 파일 (개발).
 *  - 상태 흐름: pending → paid → consumed
 *
 * 인터페이스(모두 Promise 반환):
 *   init()                → 테이블 준비
 *   create(input, amount) → 새 주문
 *   get(id)               → 주문 | null
 *   save(order)           → 저장(갱신)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const USE_PG = !!process.env.DATABASE_URL;
const DIR = path.join(__dirname, '..', '..', 'data', 'orders');

function newId() {
  return 'ord_' + Date.now().toString(36) + crypto.randomBytes(5).toString('hex');
}
function jn(v) {
  return v == null ? null : JSON.stringify(v);
}

/* ── 파일 저장소 (개발) ─────────────────────────────── */
function fileOf(id) {
  const safe = String(id).replace(/[^a-z0-9_]/gi, '');
  if (!safe) throw new Error('잘못된 주문 ID');
  return path.join(DIR, safe + '.json');
}
const fileStore = {
  async init() {
    fs.mkdirSync(DIR, { recursive: true });
  },
  async countConsumed() {
    return fileStore._count((o) => o.status === 'consumed');
  },
  async countCoupon() {
    return fileStore._count((o) => o.payment && o.payment.provider === 'coupon');
  },
  async _count(pred) {
    try {
      let n = 0;
      for (const f of fs.readdirSync(DIR)) {
        if (!f.endsWith('.json')) continue;
        try { if (pred(JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')))) n++; } catch {}
      }
      return n;
    } catch { return 0; }
  },
  async create(order) {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(fileOf(order.id), JSON.stringify(order, null, 2), 'utf8');
    return order;
  },
  async get(id) {
    try {
      return JSON.parse(fs.readFileSync(fileOf(id), 'utf8'));
    } catch {
      return null;
    }
  },
  async save(order) {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(fileOf(order.id), JSON.stringify(order, null, 2), 'utf8');
    return order;
  },
};

/* ── Postgres 저장소 (운영) ─────────────────────────── */
let pool = null;
function pgSsl() {
  const u = process.env.DATABASE_URL || '';
  if (/sslmode=disable/i.test(u) || /@(localhost|127\.0\.0\.1|.*\.railway\.internal)/i.test(u)) return false;
  return { rejectUnauthorized: false };
}
function rowToOrder(r) {
  const iso = (d) => (d instanceof Date ? d.toISOString() : d || null);
  return {
    id: r.id,
    createdAt: iso(r.created_at),
    amount: r.amount,
    status: r.status,
    topics: r.topics || null,
    input: r.input || null,
    payment: r.payment || null,
    chart: r.chart || null,
    reading: r.reading || null,
    consumedAt: iso(r.consumed_at),
  };
}
const pgStore = {
  async init() {
    const { Pool } = require('pg');
    pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: pgSsl(), max: 5 });
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id          text PRIMARY KEY,
        created_at  timestamptz NOT NULL DEFAULT now(),
        updated_at  timestamptz NOT NULL DEFAULT now(),
        amount      integer NOT NULL,
        status      text NOT NULL,
        topics      jsonb,
        input       jsonb,
        payment     jsonb,
        chart       jsonb,
        reading     text,
        consumed_at timestamptz
      )`);
  },
  async create(order) {
    await pool.query(
      `INSERT INTO orders (id, amount, status, topics, input, payment, chart, reading, consumed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [order.id, order.amount, order.status, jn(order.topics), jn(order.input), jn(order.payment), jn(order.chart), order.reading || null, order.consumedAt || null]
    );
    return order;
  },
  async get(id) {
    const { rows } = await pool.query('SELECT * FROM orders WHERE id = $1', [String(id)]);
    return rows[0] ? rowToOrder(rows[0]) : null;
  },
  async save(order) {
    await pool.query(
      `UPDATE orders SET updated_at = now(), amount=$2, status=$3, topics=$4, input=$5, payment=$6, chart=$7, reading=$8, consumed_at=$9
       WHERE id = $1`,
      [order.id, order.amount, order.status, jn(order.topics), jn(order.input), jn(order.payment), jn(order.chart), order.reading || null, order.consumedAt || null]
    );
    return order;
  },
  async countConsumed() {
    try {
      const { rows } = await pool.query(`SELECT count(*)::int AS n FROM orders WHERE status = 'consumed'`);
      return rows[0] ? rows[0].n : 0;
    } catch { return 0; }
  },
  async countCoupon() {
    try {
      const { rows } = await pool.query(`SELECT count(*)::int AS n FROM orders WHERE payment->>'provider' = 'coupon'`);
      return rows[0] ? rows[0].n : 0;
    } catch { return 0; }
  },
};

/* ── 공개 API ───────────────────────────────────────── */
const store = USE_PG ? pgStore : fileStore;

async function create(input, amount) {
  const order = {
    id: newId(),
    createdAt: new Date().toISOString(),
    amount,
    status: 'pending',
    topics: (input && input.topics) || null,
    input,
    payment: null,
    chart: null,
    reading: null,
    consumedAt: null,
  };
  return store.create(order);
}

module.exports = {
  backend: USE_PG ? 'postgres' : 'file',
  init: () => store.init(),
  create,
  get: (id) => store.get(id),
  save: (order) => store.save(order),
  countConsumed: () => store.countConsumed(),
  countCoupon: () => store.countCoupon(),
};
