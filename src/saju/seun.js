'use strict';

/**
 * 세운(歲運) — 특정 해의 간지.
 *
 * 60갑자는 해마다 하나씩 순환한다. 기준: 서기 1984년 = 갑자(甲子).
 * 명리에서 한 해의 세운은 양력 1월 1일이 아니라 입춘(立春, 대략 2월 4일)에 바뀌므로,
 * "지금 어느 세운인지"를 볼 때는 입춘 이전이면 전년도 간지를 쓴다.
 */

const { HEAVENLY_STEMS, EARTHLY_BRANCHES, getSolarTerm } = require('manseryeok');

const 입춘_INDEX = 2; // manseryeok 절기 인덱스: 0=소한, 2=입춘 ...

/** 양력 연도 → 그 해(입춘~다음 입춘)를 지배하는 간지 */
function ganjiOfYear(year) {
  const s = ((year - 4) % 10 + 10) % 10;
  const b = ((year - 4) % 12 + 12) % 12;
  const stem = HEAVENLY_STEMS[s];
  const branch = EARTHLY_BRANCHES[b];
  return { year, stem, branch, korean: stem + branch };
}

/**
 * 기준 시각(기본: 지금)에 실제로 적용되는 세운.
 * 해당 양력 연도의 입춘 절입 시각과 비교해, 입춘 전이면 전년도 간지를 돌려준다.
 */
function currentSeun(at = new Date()) {
  const y = at.getFullYear();
  let governingYear = y;
  try {
    const ipchun = getSolarTerm(y, 입춘_INDEX); // { date: Date(UTC) }
    if (ipchun && ipchun.date && at.getTime() < ipchun.date.getTime()) {
      governingYear = y - 1;
    }
  } catch {
    /* 절기 조회 실패 시 양력 연도 그대로 사용 */
  }
  return ganjiOfYear(governingYear);
}

/** 올해부터 count년치 세운 목록 (기본 10년) */
function seunList(fromYear, count = 10) {
  const out = [];
  for (let i = 0; i < count; i++) out.push(ganjiOfYear(fromYear + i));
  return out;
}

module.exports = { ganjiOfYear, currentSeun, seunList };
