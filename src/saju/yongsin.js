'use strict';

/**
 * 신강신약 점수 + 오행 가중비율 + 억부/조후 용신 (간이 산출, 참고용).
 * 유파에 따라 결과가 다를 수 있으며 정밀 격국·용신 판단은 하지 않는다.
 */

const {
  FIVE_ELEMENTS, getHeavenlyStemElement, getEarthlyBranchElement,
  GENERATES, CONTROLS, GENERATED_BY, CONTROLLED_BY,
  tenGodCategoryByElement, hiddenStemsOf, seasonElement,
} = require('./myeongni');

const LEVELS = [
  { max: 15, name: '극약', hanja: '極弱' },
  { max: 30, name: '태약', hanja: '太弱' },
  { max: 45, name: '신약', hanja: '身弱' },
  { max: 55, name: '중화', hanja: '中和' },
  { max: 70, name: '신강', hanja: '身强' },
  { max: 85, name: '태강', hanja: '太强' },
  { max: 101, name: '극왕', hanja: '極旺' },
];
function bandOf(score) {
  return LEVELS.find((l) => score < l.max) || LEVELS[LEVELS.length - 1];
}

// 조후: 계절 → 시급히 필요한 오행
function johuNeed(monthBranch, dayEl) {
  const winter = ['해', '자', '축'].includes(monthBranch);
  const summer = ['사', '오', '미'].includes(monthBranch);
  const spring = ['인', '묘', '진'].includes(monthBranch);
  const autumn = ['신', '유', '술'].includes(monthBranch);
  if (winter && dayEl !== '화') return '화';
  if (summer && dayEl !== '수') return '수';
  if (spring) return dayEl === '목' ? '화' : '목';
  if (autumn) return '화';
  return null;
}

/**
 * @param {string} dayStem 일간
 * @param {object} pillars { year, month, day, hour? : { stem, branch } }
 * @returns 신강약/오행비율/용신 정보
 */
function analyzeYongsin(dayStem, pillars) {
  const dayEl = getHeavenlyStemElement(dayStem);

  // ── 오행 가중치 합 ───────────────────────
  const elw = Object.fromEntries(FIVE_ELEMENTS.map((e) => [e, 0]));
  const add = (el, w) => { if (el) elw[el] += w; };

  for (const k of Object.keys(pillars)) {
    const p = pillars[k];
    const isMonth = k === 'month';
    const isDay = k === 'day';
    add(getHeavenlyStemElement(p.stem), k === 'day' ? 0 : 1.0); // 일간 자신은 제외
    add(getEarthlyBranchElement(p.branch), 1.2 * (isMonth ? 2.2 : isDay ? 1.5 : 1));
    // 지장간
    hiddenStemsOf(p.branch).forEach((h) => {
      const w = (h.role === '정기' ? 0.5 : h.role === '중기' ? 0.3 : 0.2) * (isMonth ? 1.8 : 1);
      add(getHeavenlyStemElement(h.stem), w);
    });
  }
  const totalW = FIVE_ELEMENTS.reduce((s, e) => s + elw[e], 0) || 1;
  const ratio = {};
  FIVE_ELEMENTS.forEach((e) => (ratio[e] = Math.round((elw[e] / totalW) * 1000) / 10));
  const ratioLabel = {};
  FIVE_ELEMENTS.forEach((e) => {
    ratioLabel[e] = ratio[e] < 8 ? '고갈' : ratio[e] < 16 ? '부족' : ratio[e] <= 38 ? '적정' : '과다';
  });

  // ── 신강약 점수 ──────────────────────────
  let support = 0; // 비겁 + 인성
  let drain = 0; // 식상 + 재성 + 관성
  FIVE_ELEMENTS.forEach((e) => {
    const cat = tenGodCategoryByElement(dayEl, e);
    if (cat === '비겁' || cat === '인성') support += elw[e];
    else if (cat) drain += elw[e];
  });
  // 일간 자신 기본 뿌리 보정 (약하게)
  support += 0.5;
  let score = Math.max(1, Math.min(99, Math.round((support / (support + drain)) * 100)));
  // 실령(월지가 비겁·인성이 아님)이면 소폭 감점 — 월령을 얻지 못하면 뿌리가 약하다
  const monthCatEarly = tenGodCategoryByElement(dayEl, getEarthlyBranchElement(pillars.month.branch));
  if (monthCatEarly && monthCatEarly !== '비겁' && monthCatEarly !== '인성') score = Math.max(1, score - 6);
  const band = bandOf(score);

  const monthBranch = pillars.month.branch;
  const deukryeong = ['비겁', '인성'].includes(tenGodCategoryByElement(dayEl, getEarthlyBranchElement(monthBranch)));
  const deukji = ['비겁', '인성'].includes(tenGodCategoryByElement(dayEl, getEarthlyBranchElement(pillars.day.branch)));

  // ── 억부용신 ─────────────────────────────
  const inseong = GENERATED_BY[dayEl];   // 나를 생 (인성)
  const bigyeop = dayEl;                  // 비겁
  const siksang = GENERATES[dayEl];       // 내가 생 (식상)
  const jaeseong = CONTROLS[dayEl];       // 내가 극 (재성)
  const gwanseong = CONTROLLED_BY[dayEl]; // 나를 극 (관성)

  // 가장 과다한 오행이 '돕는' 쪽이면 신강 성향, '빼는' 쪽이면 신약 성향
  const heaviest = FIVE_ELEMENTS.reduce((a, b) => (elw[a] >= elw[b] ? a : b));
  const heaviestCat = tenGodCategoryByElement(dayEl, heaviest);
  const leanWeak = score < 48 || (score < 55 && ['식상', '재성', '관성'].includes(heaviestCat));

  let yongsin, huisin, gisin;
  if (leanWeak) {
    // 신약 → 일간을 돕는 오행
    yongsin = elw[inseong] <= elw[bigyeop] ? inseong : bigyeop;
    huisin = yongsin === inseong ? bigyeop : inseong;
    gisin = elw[jaeseong] >= elw[gwanseong] ? jaeseong : gwanseong;
  } else {
    // 신강/태강 → 일간을 덜어내는 오행
    yongsin = elw[jaeseong] < elw[gwanseong] ? jaeseong : gwanseong;
    huisin = yongsin === jaeseong ? siksang : jaeseong;
    gisin = elw[inseong] >= elw[bigyeop] ? inseong : bigyeop;
  }
  if (huisin === yongsin) huisin = yongsin === bigyeop ? inseong : bigyeop;
  if (gisin === yongsin || gisin === huisin) {
    gisin = FIVE_ELEMENTS.find((e) => e !== yongsin && e !== huisin && e === heaviest) ||
      FIVE_ELEMENTS.find((e) => e !== yongsin && e !== huisin);
  }

  const johu = johuNeed(monthBranch, dayEl);
  let johuOverride = false;
  if (johu && johu !== yongsin && (ratio[johu] < 10)) {
    // 조후 오행이 극도로 부족하면 조후 우선
    johuOverride = true;
  }

  return {
    dayElement: dayEl,
    elementWeight: elw,
    ratio,
    ratioLabel,
    score,
    level: band.name,
    levelHanja: band.hanja,
    support: Math.round(support * 10) / 10,
    drain: Math.round(drain * 10) / 10,
    deukryeong,
    deukji,
    yongsin: johuOverride ? johu : yongsin,
    huisin,
    gisin,
    johuNeed: johu,
    johuApplied: johuOverride,
    method: `억부(${band.name})${johu ? ' + 조후 참고' : ''}`,
    note: '억부·조후를 고려한 간이 산출 (참고용)',
  };
}

module.exports = { analyzeYongsin, LEVELS };
