'use strict';

/**
 * 타로 뽑기 + 가격/설정.
 *  - 카드는 항상 서버에서 뽑는다(프론트가 조작 못 하게).
 *  - 3장 스프레드: 과거 / 현재 / 조언(가까운 흐름).
 *  - '오늘의 카드'는 seed 문자열(날짜+방문자 id)로 결정론적 → 같은 날 새로고침해도 같은 카드.
 */

const crypto = require('crypto');
const { DECK, BY_ID, publicDeck } = require('./deck');

const PRICE_KRW = Number(process.env.TAROT_PRICE_KRW || 2900);
const REVERSE_RATE = 0.32;

const POSITIONS = [
  { key: 'past', label: '흘러온 자리', hint: '지금 상황을 만든 배경' },
  { key: 'present', label: '지금 이 자리', hint: '현재의 마음과 처지' },
  { key: 'advice', label: '나아갈 자리', hint: '가까운 흐름과 조언' },
];

/** 암호학적 난수로 0..max-1 정수 (모듈러 편향 제거) */
function randInt(max) {
  const limit = Math.floor(0xffffffff / max) * max;
  let x;
  do {
    x = crypto.randomBytes(4).readUInt32BE(0);
  } while (x >= limit);
  return x % max;
}

/** n장 서로 다른 카드 무작위 추출 (+정/역방향) */
function drawSpread(n = 3) {
  const pool = DECK.slice();
  const out = [];
  for (let i = 0; i < n && pool.length; i++) {
    const card = pool.splice(randInt(pool.length), 1)[0];
    out.push({ id: card.id, reversed: crypto.randomBytes(1)[0] / 255 < REVERSE_RATE });
  }
  return out.map((d, i) => ({ ...d, position: POSITIONS[i] ? POSITIONS[i].key : `pos${i + 1}` }));
}

/** seed 문자열 → 결정론적 카드 1장 */
function dailyDraw(seed) {
  const h = crypto.createHash('sha256').update(String(seed || 'x')).digest();
  const idx = h.readUInt32BE(0) % DECK.length;
  const reversed = h[4] / 255 < REVERSE_RATE;
  return { id: DECK[idx].id, reversed };
}

/** 뽑힌 결과 → 프롬프트에 넣을 텍스트 */
function describeDraw(draw) {
  return draw
    .map((d, i) => {
      const c = BY_ID[d.id];
      const pos = POSITIONS[i];
      const dir = d.reversed ? '역방향' : '정방향';
      const kw = (d.reversed ? c.rev : c.up).join(', ');
      return `${i + 1}. [${pos ? pos.label : '카드'}] ${c.ko} (${c.en}) · ${dir}\n   핵심어: ${kw}`;
    })
    .join('\n');
}

function describeCard(id, reversed) {
  const c = BY_ID[id];
  if (!c) return '알 수 없는 카드';
  const dir = reversed ? '역방향' : '정방향';
  const kw = (reversed ? c.rev : c.up).join(', ');
  return `${c.ko} (${c.en}) · ${dir}\n핵심어: ${kw}`;
}

module.exports = {
  PRICE_KRW,
  POSITIONS,
  publicDeck,
  BY_ID,
  drawSpread,
  dailyDraw,
  describeDraw,
  describeCard,
};
