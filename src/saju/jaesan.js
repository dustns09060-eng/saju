'use strict';

/**
 * 시기별 재산 흐름 — 대운(大運)마다 재물운 강도를 점수화해 그래프용 배열을 만든다.
 * 재성(정재·편재) 관련 오행/십성이 대운에서 얼마나 힘을 받는지의 간이 지표. (참고용)
 */

const {
  getHeavenlyStemElement, getEarthlyBranchElement,
  CONTROLS, GENERATES, tenGodCategoryByElement,
} = require('./myeongni');

/**
 * @param {string} dayStem 일간
 * @param {object[]} luckPillars  chart.luck.pillars: [{ age, stem, branch, ganjiKorean }]
 * @param {object} ys  analyzeYongsin 결과 ({ score, yongsin, gisin, dayElement })
 * @param {number} currentIndex 현재 대운 인덱스
 */
function wealthTimeline(dayStem, luckPillars, ys, currentIndex) {
  const dayEl = ys.dayElement;
  const jaeEl = CONTROLS[dayEl];      // 재성 오행
  const siksangEl = GENERATES[dayEl]; // 식상 오행 (재를 생함)
  const weak = ys.score < 45;

  const points = (luckPillars || []).map((lp, i) => {
    let s = 42;
    const se = getHeavenlyStemElement(lp.stem);
    const be = getEarthlyBranchElement(lp.branch);
    const catS = tenGodCategoryByElement(dayEl, se);
    const catB = tenGodCategoryByElement(dayEl, be);

    if (catS === '재성') s += 20;
    if (catB === '재성') s += 16;
    if (catS === '식상') s += 8;
    if (catB === '식상') s += 6;

    // 신약이면 재성 과다는 오히려 부담(감당 못함), 신강이면 재성이 곧 결실
    if (weak && (catS === '재성' || catB === '재성')) s -= 14;
    if (weak && (catS === '비겁' || catB === '비겁')) s += 10; // 신약에 비겁운 = 재물 지킴
    if (!weak && (catS === '비겁' || catB === '비겁')) s -= 8; // 신강에 비겁운 = 경쟁·지출

    if (se === ys.yongsin || be === ys.yongsin) s += 12;
    if (se === ys.gisin || be === ys.gisin) s -= 12;

    s = Math.max(8, Math.min(95, Math.round(s)));
    const label = s >= 72 ? '재물 확장기' : s >= 58 ? '순조로운 흐름' : s >= 44 ? '보통' : s >= 30 ? '지출·변동 주의' : '재물 관리 필요';
    return {
      age: lp.age,
      endAge: lp.age + 9,
      ganji: lp.ganjiKorean,
      score: s,
      label,
      current: i === currentIndex,
    };
  });

  const peak = points.reduce((a, b) => (b.score > (a ? a.score : -1) ? b : a), null);
  return { points, peak };
}

module.exports = { wealthTimeline };
