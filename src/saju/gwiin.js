'use strict';

/**
 * 귀인(貴人) / 길신 — 일간(또는 월지) 기준으로 사주 지지에 붙는 도움이 되는 별.
 * 참고용. 유파에 따라 산출이 다를 수 있다.
 */

// 일간 → 해당 지지들
const CHEONEUL = { // 천을귀인
  갑: ['축', '미'], 무: ['축', '미'], 경: ['축', '미'],
  을: ['자', '신'], 기: ['자', '신'],
  병: ['해', '유'], 정: ['해', '유'],
  신: ['인', '오'],
  임: ['사', '묘'], 계: ['사', '묘'],
};
const TAEGEUK = { // 태극귀인
  갑: ['자', '오'], 을: ['자', '오'],
  병: ['묘', '유'], 정: ['묘', '유'],
  무: ['진', '술', '축', '미'], 기: ['진', '술', '축', '미'],
  경: ['인', '해'], 신: ['인', '해'],
  임: ['사', '신'], 계: ['사', '신'],
};
const MUNCHANG = { 갑: '사', 을: '오', 병: '신', 무: '신', 정: '유', 기: '유', 경: '해', 신: '자', 임: '인', 계: '묘' };
const HAKDANG = { 갑: '해', 병: '인', 무: '인', 경: '사', 임: '신', 을: '오', 정: '유', 기: '유', 신: '자', 계: '묘' }; // 학당귀인 = 일간 장생지
const GEUMYEO = { 갑: '진', 을: '사', 병: '미', 정: '신', 무: '미', 기: '신', 경: '술', 신: '해', 임: '축', 계: '인' }; // 금여록
// 천덕/월덕: 월지 → 지지(또는 천간). 여기선 지지형만.
const CHEONDEOK = { 인: '정', 묘: '신', 진: '임', 사: '신', 오: '해', 미: '갑', 신: '계', 유: '인', 술: '병', 해: '을', 자: '사', 축: '경' };
const WOLDEOK = { 인: '병', 오: '병', 술: '병', 신: '임', 자: '임', 진: '임', 사: '경', 유: '경', 축: '경', 해: '갑', 묘: '갑', 미: '갑' };

function has(map, key, val) {
  const v = map[key];
  if (!v) return false;
  return Array.isArray(v) ? v.includes(val) : v === val;
}

/**
 * @param {string} dayStem
 * @param {string} monthBranch
 * @param {object} pillars { k: { stem, branch } }
 */
function gwiinChart(dayStem, monthBranch, pillars) {
  const perPillar = {};
  const names = new Set();

  for (const k of Object.keys(pillars)) {
    const b = pillars[k].branch;
    const s = pillars[k].stem;
    const hit = [];
    if (has(CHEONEUL, dayStem, b)) hit.push('천을귀인');
    if (has(TAEGEUK, dayStem, b)) hit.push('태극귀인');
    if (MUNCHANG[dayStem] === b) hit.push('문창귀인');
    if (HAKDANG[dayStem] === b) hit.push('학당귀인');
    if (GEUMYEO[dayStem] === b) hit.push('금여록');
    if (CHEONDEOK[monthBranch] === s) hit.push('천덕귀인');
    if (WOLDEOK[monthBranch] === s) hit.push('월덕귀인');
    if (hit.length) {
      perPillar[k] = hit;
      hit.forEach((n) => names.add(n));
    }
  }
  return { perPillar, summary: [...names] };
}

module.exports = { gwiinChart };
