'use strict';

/**
 * 폼 입력 → manseryeok 계산 → 화면·프롬프트에서 함께 쓰는 통합 사주(chart) 객체.
 */

const {
  calculateFourPillars,
  isValidSolarDate,
  lunarToSolar,
  LUNAR_MIN_YEAR,
  LUNAR_MAX_YEAR,
  DEFAULT_LONGITUDE,
  FIVE_ELEMENTS,
  HEAVENLY_STEMS,
  HEAVENLY_STEMS_HANJA,
  EARTHLY_BRANCHES,
  EARTHLY_BRANCHES_HANJA,
  getHeavenlyStemElement,
  getHeavenlyStemYinYang,
  getEarthlyBranchElement,
} = require('manseryeok');

const { hiddenStemsOf } = require('./jijanggan');
const { currentSeun, seunList, ganjiOfYear } = require('./seun');
const { sibiunseongChart } = require('./sibiunseong');
const { sinsalChart } = require('./sinsal');
const { gwiinChart } = require('./gwiin');
const { analyzeYongsin } = require('./yongsin');
const { wealthTimeline } = require('./jaesan');

const MIN_YEAR = 1800;
const MAX_YEAR = 2300;

class InputError extends Error {}

function toInt(v, name) {
  const n = Number(v);
  if (!Number.isInteger(n)) throw new InputError(`${name} 값이 올바르지 않습니다: ${v}`);
  return n;
}

function stemHanja(stem) {
  const i = HEAVENLY_STEMS.indexOf(stem);
  return i >= 0 ? HEAVENLY_STEMS_HANJA[i] : '';
}
function branchHanja(branch) {
  const i = EARTHLY_BRANCHES.indexOf(branch);
  return i >= 0 ? EARTHLY_BRANCHES_HANJA[i] : '';
}

/** 십신 → 육친(六親) 카테고리 */
function tenGodCategory(tg) {
  if (tg === '비견' || tg === '겁재') return '비겁';
  if (tg === '식신' || tg === '상관') return '식상';
  if (tg === '편재' || tg === '정재') return '재성';
  if (tg === '편관' || tg === '정관') return '관성';
  if (tg === '편인' || tg === '정인') return '인성';
  return null; // 일간
}

function pillarView(pillar, elementPair) {
  return {
    stem: pillar.heavenlyStem,
    branch: pillar.earthlyBranch,
    stemHanja: stemHanja(pillar.heavenlyStem),
    branchHanja: branchHanja(pillar.earthlyBranch),
    ganjiKorean: pillar.heavenlyStem + pillar.earthlyBranch,
    ganjiHanja: stemHanja(pillar.heavenlyStem) + branchHanja(pillar.earthlyBranch),
    element: { stem: elementPair.stem, branch: elementPair.branch },
    hidden: hiddenStemsOf(pillar.earthlyBranch),
  };
}

/**
 * @param {object} body 프론트 폼 입력
 * @returns {object} chart
 */
function computeChart(body = {}) {
  const warnings = [];

  const calendar = body.calendar === 'lunar' ? 'lunar' : 'solar';
  const isLeapMonth = calendar === 'lunar' && !!body.isLeapMonth;

  const year = toInt(body.year, '연도(year)');
  const month = toInt(body.month, '월(month)');
  const day = toInt(body.day, '일(day)');

  if (year < MIN_YEAR || year > MAX_YEAR) {
    throw new InputError(`연도는 ${MIN_YEAR}~${MAX_YEAR} 사이만 지원합니다 (입력: ${year}).`);
  }
  if (month < 1 || month > 12) throw new InputError(`월은 1~12 사이여야 합니다 (입력: ${month}).`);
  if (day < 1 || day > 31) throw new InputError(`일은 1~31 사이여야 합니다 (입력: ${day}).`);

  if (calendar === 'solar' && !isValidSolarDate(year, month, day)) {
    throw new InputError(`존재하지 않는 양력 날짜입니다: ${year}-${month}-${day}`);
  }
  if (calendar === 'lunar' && (year < LUNAR_MIN_YEAR || year > LUNAR_MAX_YEAR)) {
    throw new InputError(`음력 입력은 ${LUNAR_MIN_YEAR}~${LUNAR_MAX_YEAR}년만 지원합니다 (입력: ${year}).`);
  }

  const hourKnown = body.hourKnown !== false && body.hourKnown !== 'false';
  let hour = 12;
  let minute = 0;
  if (hourKnown) {
    hour = toInt(body.hour ?? 0, '시(hour)');
    minute = toInt(body.minute ?? 0, '분(minute)');
    if (hour < 0 || hour > 23) throw new InputError(`시는 0~23 사이여야 합니다 (입력: ${hour}).`);
    if (minute < 0 || minute > 59) throw new InputError(`분은 0~59 사이여야 합니다 (입력: ${minute}).`);
  } else {
    warnings.push('태어난 시각을 모름으로 처리했습니다. 시주(時柱)와 시주 기반 해석은 제외됩니다.');
  }

  const gender = body.gender === 'male' || body.gender === 'female' ? body.gender : null;
  if (!gender) warnings.push('성별이 없어 대운(大運)을 계산하지 않았습니다.');

  const applyTrueSolar = body.trueSolarTime !== false && body.trueSolarTime !== 'false';
  let longitude = Number(body.longitude);
  if (!Number.isFinite(longitude) || longitude < 100 || longitude > 150) {
    if (applyTrueSolar) warnings.push(`경도 값이 이상해 기본값(${DEFAULT_LONGITUDE})을 사용했습니다.`);
    longitude = DEFAULT_LONGITUDE;
  }

  const dayBoundary = ['midnight', 'jasi', 'splitJasi'].includes(body.dayBoundary) ? body.dayBoundary : 'midnight';

  /** @type {import('manseryeok').BirthInfo} */
  const birthInfo = {
    year,
    month,
    day,
    hour,
    minute,
    isLunar: calendar === 'lunar',
    isLeapMonth,
    dayBoundary,
  };
  if (gender) birthInfo.gender = gender;
  if (applyTrueSolar) {
    birthInfo.trueSolarTime = { longitude, applyEquationOfTime: true, applyHistoricalDst: true };
  }

  const r = calculateFourPillars(birthInfo);

  // ── 기둥 ─────────────────────────────────────────────
  const pillars = {
    year: pillarView(r.year, r.yearElement),
    month: pillarView(r.month, r.monthElement),
    day: pillarView(r.day, r.dayElement),
  };
  if (hourKnown) pillars.hour = pillarView(r.hour, r.hourElement);

  const keptKeys = Object.keys(pillars); // year, month, day, [hour]

  // ── 일간 ─────────────────────────────────────────────
  const dayMaster = {
    stem: r.day.heavenlyStem,
    element: getHeavenlyStemElement(r.day.heavenlyStem),
    yinYang: getHeavenlyStemYinYang(r.day.heavenlyStem),
  };

  // ── 오행 분포 ────────────────────────────────────────
  const visible = Object.fromEntries(FIVE_ELEMENTS.map((e) => [e, 0]));
  const withHidden = Object.fromEntries(FIVE_ELEMENTS.map((e) => [e, 0]));
  for (const k of keptKeys) {
    const p = pillars[k];
    visible[p.element.stem]++;
    visible[p.element.branch]++;
    withHidden[p.element.stem]++;
    withHidden[p.element.branch]++;
    for (const h of p.hidden) withHidden[getHeavenlyStemElement(h.stem)]++;
  }
  const maxCount = Math.max(...FIVE_ELEMENTS.map((e) => visible[e]));
  const minCount = Math.min(...FIVE_ELEMENTS.map((e) => visible[e]));
  const elements = {
    visible,
    withHidden,
    strongest: FIVE_ELEMENTS.filter((e) => visible[e] === maxCount),
    weakest: FIVE_ELEMENTS.filter((e) => visible[e] === minCount),
    absent: FIVE_ELEMENTS.filter((e) => visible[e] === 0),
  };

  // ── 십신 ─────────────────────────────────────────────
  const tenGods = {};
  for (const k of keptKeys) tenGods[k] = r.tenGods[k];

  // 육친 카테고리 집계 + 일간 강약 근사
  const category = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };
  for (const k of keptKeys) {
    for (const pos of ['stem', 'branch']) {
      const c = tenGodCategory(tenGods[k][pos]);
      if (c) category[c]++;
    }
  }
  const support = category.비겁 + category.인성;
  const oppose = category.식상 + category.재성 + category.관성;
  let strengthLabel = '중화(근사)';
  if (support - oppose >= 3) strengthLabel = '신강(근사)';
  else if (oppose - support >= 3) strengthLabel = '신약(근사)';
  const dayMasterStrength = { category, support, oppose, label: strengthLabel };

  // ── 대운 ─────────────────────────────────────────────
  let luck = null;
  if (r.luckPillars) {
    const age = koreanAge(calendar, year, month, day);
    const pillarsArr = r.luckPillars.pillars.map((lp) => ({
      age: lp.age,
      ganjiKorean: lp.korean,
      ganjiHanja: stemHanja(lp.pillar.heavenlyStem) + branchHanja(lp.pillar.earthlyBranch),
      stem: lp.pillar.heavenlyStem,
      branch: lp.pillar.earthlyBranch,
    }));
    let currentIndex = -1;
    for (let i = 0; i < pillarsArr.length; i++) {
      if (age >= pillarsArr[i].age) currentIndex = i;
    }
    luck = {
      forward: r.luckPillars.forward,
      startAge: r.luckPillars.startAge,
      currentAge: age,
      currentIndex,
      current: currentIndex >= 0 ? pillarsArr[currentIndex] : null,
      pillars: pillarsArr,
    };
  }

  // ── 세운 ─────────────────────────────────────────────
  const now = new Date();
  const cur = currentSeun(now);
  const annualLuck = {
    current: { ...cur, isBeforeIpchun: cur.year !== now.getFullYear() },
    list: seunList(now.getFullYear(), 10).map((s) => ({ ...s, isCurrent: s.year === cur.year })),
  };

  // ── 명리 상세 (십이운성·신살·귀인·용신·재산흐름) ──────
  const dayStem = r.day.heavenlyStem;
  const sibiunseong = sibiunseongChart(dayStem, pillars);
  const sinsal = sinsalChart(dayStem, pillars, r.year.earthlyBranch);
  const gwiin = gwiinChart(dayStem, r.month.earthlyBranch, pillars);
  const yongsin = analyzeYongsin(dayStem, pillars);
  const wealth = luck ? wealthTimeline(dayStem, luck.pillars, yongsin, luck.currentIndex) : null;

  return {
    input: {
      calendar,
      isLeapMonth,
      year,
      month,
      day,
      hourKnown,
      hour: hourKnown ? hour : null,
      minute: hourKnown ? minute : null,
      gender,
      trueSolarTime: applyTrueSolar ? { longitude } : null,
      place: typeof body.place === 'string' ? body.place.slice(0, 40) : '',
      dayBoundary,
    },
    solarDate: calendar === 'lunar' ? safeLunarToSolar(year, month, day, isLeapMonth) : { year, month, day },
    pillars,
    pillarsText: hourKnown ? r.toString() : r.toString().replace(/,\s*\S+시주/, ''),
    pillarsHanjaText: r.toHanjaString ? r.toHanjaString() : '',
    dayMaster,
    dayMasterStrength,
    elements,
    tenGods,
    voidBranches: r.voidBranches || [],
    luck,
    annualLuck,
    sibiunseong,
    sinsal,
    gwiin,
    yongsin,
    wealth,
    warnings,
  };
}

function safeLunarToSolar(y, m, d, leap) {
  try {
    return lunarToSolar(y, m, d, leap);
  } catch {
    return null;
  }
}

/** 만 나이(근사) — 대운 현재 구간 판정용 */
function koreanAge(calendar, y, m, d) {
  let sy = y;
  let sm = m;
  let sd = d;
  if (calendar === 'lunar') {
    const s = safeLunarToSolar(y, m, d, false);
    if (s) {
      sy = s.year;
      sm = s.month;
      sd = s.day;
    }
  }
  const now = new Date();
  let age = now.getFullYear() - sy;
  const beforeBirthday = now.getMonth() + 1 < sm || (now.getMonth() + 1 === sm && now.getDate() < sd);
  if (beforeBirthday) age--;
  return Math.max(0, age);
}

module.exports = { computeChart, InputError, ganjiOfYear };
