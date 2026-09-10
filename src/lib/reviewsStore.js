'use strict';

/**
 * 사용자 후기 저장소. orders 와 같은 이중 백엔드(Postgres 운영 / 파일 개발).
 *  - 후기는 approved=false 로 들어오고, 관리자가 승인해야 공개된다.
 *  - 실제로 풀이를 받은 주문(consumed)만 후기를 남길 수 있다(라우트에서 검증).
 *
 * ⚠️ 파일 백엔드는 재배포 시 사라진다. 운영(Railway)은 DATABASE_URL 이 있으므로 Postgres 사용.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const USE_PG = !!process.env.DATABASE_URL;
const DIR = path.join(__dirname, '..', '..', 'data', 'reviews');
const newId = () => 'rv_' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex');

/* ── 파일 ── */
const fileStore = {
  async init() { fs.mkdirSync(DIR, { recursive: true }); },
  async add(r) {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(path.join(DIR, r.id + '.json'), JSON.stringify(r, null, 2), 'utf8');
    return r;
  },
  async all() {
    try {
      return fs.readdirSync(DIR).filter((f) => f.endsWith('.json'))
        .map((f) => { try { return JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch { return null; } })
        .filter(Boolean)
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    } catch { return []; }
  },
  async setApproved(id, v) {
    const p = path.join(DIR, String(id).replace(/[^\w-]/g, '') + '.json');
    const r = JSON.parse(fs.readFileSync(p, 'utf8'));
    r.approved = !!v;
    fs.writeFileSync(p, JSON.stringify(r, null, 2), 'utf8');
    return r;
  },
  async remove(id) {
    try { fs.unlinkSync(path.join(DIR, String(id).replace(/[^\w-]/g, '') + '.json')); return true; } catch { return false; }
  },
};

/* ── Postgres ── */
let pool = null;
function pgSsl() {
  const u = process.env.DATABASE_URL || '';
  if (/sslmode=disable/i.test(u) || /@(localhost|127\.0\.0\.1|.*\.railway\.internal)/i.test(u)) return false;
  return { rejectUnauthorized: false };
}
const pgStore = {
  async init() {
    const { Pool } = require('pg');
    pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: pgSsl(), max: 3 });
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id         text PRIMARY KEY,
        created_at timestamptz NOT NULL DEFAULT now(),
        order_id   text,
        rating     integer NOT NULL,
        name       text,
        text       text NOT NULL,
        topic      text,
        approved   boolean NOT NULL DEFAULT false
      )`);
  },
  async add(r) {
    await pool.query(
      `INSERT INTO reviews (id, order_id, rating, name, text, topic, approved) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [r.id, r.orderId || null, r.rating, r.name || null, r.text, r.topic || null, false]
    );
    return r;
  },
  async all() {
    const { rows } = await pool.query('SELECT * FROM reviews ORDER BY created_at DESC');
    return rows.map((x) => ({
      id: x.id, createdAt: x.created_at instanceof Date ? x.created_at.toISOString() : x.created_at,
      orderId: x.order_id, rating: x.rating, name: x.name, text: x.text, topic: x.topic, approved: x.approved,
    }));
  },
  async setApproved(id, v) {
    await pool.query('UPDATE reviews SET approved = $2 WHERE id = $1', [String(id), !!v]);
    return { id, approved: !!v };
  },
  async remove(id) {
    const { rowCount } = await pool.query('DELETE FROM reviews WHERE id = $1', [String(id)]);
    return rowCount > 0;
  },
};

const store = USE_PG ? pgStore : fileStore;

async function add({ orderId, rating, name, text, topic }) {
  const r = {
    id: newId(),
    createdAt: new Date().toISOString(),
    orderId: orderId || null,
    rating: Math.min(5, Math.max(1, Number(rating) || 5)),
    name: (name || '').toString().slice(0, 12) || null,
    text: (text || '').toString().slice(0, 300),
    topic: (topic || '').toString().slice(0, 20) || null,
    approved: false,
  };
  return store.add(r);
}

async function listApproved(limit = 12) {
  return (await store.all()).filter((r) => r.approved).slice(0, limit);
}

module.exports = {
  backend: USE_PG ? 'postgres' : 'file',
  init: () => store.init(),
  add,
  listApproved,
  all: () => store.all(),
  setApproved: (id, v) => store.setApproved(id, v),
  remove: (id) => store.remove(id),
};
