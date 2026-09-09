'use strict';

/**
 * 명리 공용 상수/헬퍼: 오행 생극, 십성 분류, 밴드 판정 등.
 * (십이운성·신살·귀인·용신·신강약 모듈이 공유)
 */

const {
  HEAVENLY_STEMS, EARTHLY_BRANCHES, FIVE_ELEMENTS,
  getHeavenlyStemElement, getEarthlyBranchElement,
  getHeavenlyStemYinYang, getEarthlyBranchYinYang,
} = require('manseryeok');

const { principalHiddenStem, hiddenStemsOf } = require('./jijanggan');

// 오행 상생: A 가 B 를 생한다
const GENERATES = { 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' };
// 오행 상극: A 가 B 를 극한다
const CONTROLS = { 목: '토', 토: '수', 수: '화', 화: '금', 금: '목' };
const GENERATED_BY = Object.fromEntries(Object.entries(GENERATES).map(([a, b]) => [b, a]));
const CONTROLLED_BY = Object.fromEntries(Object.entries(CONTROLS).map(([a, b]) => [b, a]));

/** 일간 오행 기준, 대상 오행이 어느 십성 카테고리인가 */
function tenGodCategoryByElement(dayEl, targetEl) {
  if (targetEl === dayEl) return '비겁';
  if (GENERATED_BY[dayEl] === targetEl) return '인성'; // 나를 생함
  if (GENERATES[dayEl] === targetEl) return '식상'; // 내가 생함
  if (CONTROLS[dayEl] === targetEl) return '재성'; // 내가 극함
  if (CONTROLLED_BY[dayEl] === targetEl) return '관성'; // 나를 극함
  return null;
}

/** 십성(십신) 세부 명칭: 일간 천간 vs 대상 천간 */
function tenGod(dayStem, targetStem) {
  const de = getHeavenlyStemElement(dayStem);
  const te = getHeavenlyStemElement(targetStem);
  const cat = tenGodCategoryByElement(de, te);
  const sameYY = getHeavenlyStemYinYang(dayStem) === getHeavenlyStemYinYang(targetStem);
  switch (cat) {
    case '비겁': return sameYY ? '비견' : '겁재';
    case '식상': return sameYY ? '식신' : '상관';
    case '재성': return sameYY ? '편재' : '정재';
    case '관성': return sameYY ? '편관' : '정관';
    case '인성': return sameYY ? '편인' : '정인';
    default: return '일간';
  }
}

/** 지지의 십성 (지장간 정기 기준) */
function branchTenGod(dayStem, branch) {
  const main = principalHiddenStem(branch);
  return main ? tenGod(dayStem, main) : null;
}

const STEM_IDX = Object.fromEntries(HEAVENLY_STEMS.map((s, i) => [s, i]));
const BRANCH_IDX = Object.fromEntries(EARTHLY_BRANCHES.map((s, i) => [s, i]));

/** 삼합국: 지지 → '수'|'화'|'금'|'목' (신자진 수, 인오술 화, 사유축 금, 해묘미 목) */
const SAMHAP = {
  신: '수', 자: '수', 진: '수',
  인: '화', 오: '화', 술: '화',
  사: '금', 유: '금', 축: '금',
  해: '목', 묘: '목', 미: '목',
};

/** 계절(월지) → 대략 오행 기운 */
function seasonElement(monthBranch) {
  const m = { 인: '목', 묘: '목', 진: '토', 사: '화', 오: '화', 미: '토', 신: '금', 유: '금', 술: '토', 해: '수', 자: '수', 축: '토' };
  return m[monthBranch] || '토';
}

module.exports = {
  HEAVENLY_STEMS, EARTHLY_BRANCHES, FIVE_ELEMENTS,
  getHeavenlyStemElement, getEarthlyBranchElement, getHeavenlyStemYinYang, getEarthlyBranchYinYang,
  hiddenStemsOf, principalHiddenStem,
  GENERATES, CONTROLS, GENERATED_BY, CONTROLLED_BY,
  tenGodCategoryByElement, tenGod, branchTenGod,
  STEM_IDX, BRANCH_IDX, SAMHAP, seasonElement,
};
