'use strict';

/**
 * 지장간(支藏干) — 12지지 안에 숨어 있는 천간.
 *
 * manseryeok 라이브러리가 제공하지 않아 여기에 고정표로 둔다.
 * 각 지지는 여기(餘氣)·중기(中氣)·정기(正氣) 순서의 천간과, 그 지장간이
 * 그 달에서 힘을 쓰는 대략적인 일수(장간 분일)를 가진다. (중기 없는 지지도 있음)
 */

/** @type {Record<string, { stem: string, role: '여기'|'중기'|'정기', days: number }[]>} */
const JIJANGGAN = {
  자: [
    { stem: '임', role: '여기', days: 10 },
    { stem: '계', role: '정기', days: 20 },
  ],
  축: [
    { stem: '계', role: '여기', days: 9 },
    { stem: '신', role: '중기', days: 3 },
    { stem: '기', role: '정기', days: 18 },
  ],
  인: [
    { stem: '무', role: '여기', days: 7 },
    { stem: '병', role: '중기', days: 7 },
    { stem: '갑', role: '정기', days: 16 },
  ],
  묘: [
    { stem: '갑', role: '여기', days: 10 },
    { stem: '을', role: '정기', days: 20 },
  ],
  진: [
    { stem: '을', role: '여기', days: 9 },
    { stem: '계', role: '중기', days: 3 },
    { stem: '무', role: '정기', days: 18 },
  ],
  사: [
    { stem: '무', role: '여기', days: 7 },
    { stem: '경', role: '중기', days: 7 },
    { stem: '병', role: '정기', days: 16 },
  ],
  오: [
    { stem: '병', role: '여기', days: 10 },
    { stem: '기', role: '중기', days: 9 },
    { stem: '정', role: '정기', days: 11 },
  ],
  미: [
    { stem: '정', role: '여기', days: 9 },
    { stem: '을', role: '중기', days: 3 },
    { stem: '기', role: '정기', days: 18 },
  ],
  신: [
    { stem: '무', role: '여기', days: 7 },
    { stem: '임', role: '중기', days: 7 },
    { stem: '경', role: '정기', days: 16 },
  ],
  유: [
    { stem: '경', role: '여기', days: 10 },
    { stem: '신', role: '정기', days: 20 },
  ],
  술: [
    { stem: '신', role: '여기', days: 9 },
    { stem: '정', role: '중기', days: 3 },
    { stem: '무', role: '정기', days: 18 },
  ],
  해: [
    { stem: '무', role: '여기', days: 7 },
    { stem: '갑', role: '중기', days: 7 },
    { stem: '임', role: '정기', days: 16 },
  ],
};

/** 지지 하나의 지장간 목록 (여기→중기→정기 순) */
function hiddenStemsOf(branch) {
  return JIJANGGAN[branch] ? JIJANGGAN[branch].map((x) => ({ ...x })) : [];
}

/** 지지의 정기(대표 지장간) 천간 */
function principalHiddenStem(branch) {
  const list = JIJANGGAN[branch] || [];
  const main = list.find((x) => x.role === '정기');
  return main ? main.stem : null;
}

module.exports = { JIJANGGAN, hiddenStemsOf, principalHiddenStem };
