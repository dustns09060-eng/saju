'use strict';

/**
 * 십이운성(十二運星) — 일간(천간)이 각 지지에서 갖는 기운의 단계.
 * 장생→목욕→관대→건록→제왕→쇠→병→사→묘→절→태→양 (12단계 순환)
 *
 * 규칙: 양간(갑병무경임)은 순행, 음간(을정기신계)은 역행.
 *       각 천간의 '장생' 지지에서 시작해 방향대로 전개한다.
 */

const { EARTHLY_BRANCHES, getHeavenlyStemYinYang } = require('manseryeok');

const STAGES = ['장생', '목욕', '관대', '건록', '제왕', '쇠', '병', '사', '묘', '절', '태', '양'];
const STAGE_HANJA = {
  장생: '長生', 목욕: '沐浴', 관대: '冠帶', 건록: '建祿', 제왕: '帝旺', 쇠: '衰',
  병: '病', 사: '死', 묘: '墓', 절: '絶', 태: '胎', 양: '養',
};

// 각 천간의 장생 지지
const JANGSAENG = {
  갑: '해', 병: '인', 무: '인', 경: '사', 임: '신',
  을: '오', 정: '유', 기: '유', 신: '자', 계: '묘',
};

const BIDX = Object.fromEntries(EARTHLY_BRANCHES.map((b, i) => [b, i]));

/** 일간 + 지지 → 십이운성 이름 */
function sibiunseongOf(dayStem, branch) {
  const start = BIDX[JANGSAENG[dayStem]];
  const dir = getHeavenlyStemYinYang(dayStem) === '양' ? 1 : -1;
  const off = ((BIDX[branch] - start) * dir % 12 + 12) % 12;
  return STAGES[off];
}

/** 사주 네 기둥의 십이운성 (일간 기준) */
function sibiunseongChart(dayStem, pillars) {
  const out = {};
  for (const k of Object.keys(pillars)) {
    const name = sibiunseongOf(dayStem, pillars[k].branch);
    out[k] = { name, hanja: STAGE_HANJA[name] };
  }
  return out;
}

module.exports = { sibiunseongOf, sibiunseongChart, STAGES, STAGE_HANJA };
