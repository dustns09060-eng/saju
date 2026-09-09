'use strict';

/**
 * 주문 저장소 (로컬 JSON 파일). data/orders/<id>.json
 * 상태 흐름: pending → paid → consumed
 *  - pending  : 주문 생성됨, 결제 전
 *  - paid     : 결제 검증 완료, 풀이 대기
 *  - consumed : 풀이 1회 제공 완료 (재요청 시 저장된 결과만 반환)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = path.join(__dirname, '..', '..', 'data', 'orders');

function newId() {
  return 'ord_' + Date.now().toString(36) + crypto.randomBytes(5).toString('hex');
}

function fileOf(id) {
  const safe = String(id).replace(/[^a-z0-9_]/gi, '');
  if (!safe) throw new Error('잘못된 주문 ID');
  return path.join(DIR, safe + '.json');
}

function create(input, amount) {
  fs.mkdirSync(DIR, { recursive: true });
  const order = {
    id: newId(),
    createdAt: new Date().toISOString(),
    amount,
    status: 'pending',
    input,
    payment: null,
    chart: null,
    reading: null,
    consumedAt: null,
  };
  save(order);
  return order;
}

function get(id) {
  try {
    return JSON.parse(fs.readFileSync(fileOf(id), 'utf8'));
  } catch {
    return null;
  }
}

function save(order) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(fileOf(order.id), JSON.stringify(order, null, 2), 'utf8');
  return order;
}

module.exports = { create, get, save };
