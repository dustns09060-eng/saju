'use strict';

/**
 * 신살(神殺) — 12신살(년지 삼합국 기준) + 주요 특수신살.
 * 참고용이며 유파에 따라 산출이 다를 수 있다.
 */

const { EARTHLY_BRANCHES } = require('manseryeok');
const { SAMHAP } = require('./myeongni');

const BIDX = Object.fromEntries(EARTHLY_BRANCHES.map((b, i) => [b, i]));

// 12신살: '겁살'부터 지지 순행 순서
const TWELVE = ['겁살', '재살', '천살', '지살', '년살', '월살', '망신살', '장성살', '반안살', '역마살', '육해살', '화개살'];
const TWELVE_HANJA = {
  겁살: '劫殺', 재살: '災殺', 천살: '天殺', 지살: '地殺', 년살: '年殺', 월살: '月殺',
  망신살: '亡身殺', 장성살: '將星殺', 반안살: '攀鞍殺', 역마살: '驛馬殺', 육해살: '六害殺', 화개살: '華蓋殺',
};
// 각 삼합국의 '겁살' 지지
const GEOKSAL = { 수: '사', 화: '해', 금: '인', 목: '신' };

/** 년지(삼합국) 기준으로 특정 지지가 어떤 12신살인지 */
function twelveSinsalFor(yearBranch, targetBranch) {
  const guk = SAMHAP[yearBranch];
  const base = BIDX[GEOKSAL[guk]];
  const off = ((BIDX[targetBranch] - base) % 12 + 12) % 12;
  const name = TWELVE[off];
  return { name, hanja: TWELVE_HANJA[name] };
}

// ── 특수신살 ────────────────────────────────
// 양인살: 일간의 왕지 (양간 위주)
const YANGIN = { 갑: '묘', 병: '오', 무: '오', 경: '유', 임: '자', 을: '진', 정: '미', 기: '미', 신: '술', 계: '축' };
// 백호살 간지 (일주 등)
const BAEKHO = new Set(['갑진', '을미', '병술', '정축', '무진', '임술', '계축']);
// 괴강살 간지
const GOEGANG = new Set(['경진', '경술', '임진', '무술', '임술', '무진']);
// 홍염살: 일간 → 지지
const HONGYEOM = { 갑: '오', 을: '오', 병: '인', 정: '미', 무: '진', 기: '진', 경: '술', 신: '유', 임: '자', 계: '신' };
// 원진 지지쌍
const WONJIN = [['자', '미'], ['축', '오'], ['인', '유'], ['묘', '신'], ['진', '해'], ['사', '술']];
// 귀문관살 지지쌍
const GWIMUN = [['자', '유'], ['축', '오'], ['인', '미'], ['묘', '신'], ['진', '해'], ['사', '술']];

function pairHits(branches, pairs) {
  const set = new Set(branches);
  return pairs.filter(([a, b]) => set.has(a) && set.has(b)).map(([a, b]) => `${a}${b}`);
}

/**
 * @param {string} dayStem 일간
 * @param {object} pillars { year, month, day, hour: { stem, branch, ganjiKorean } }
 * @param {string} yearBranch 년지
 */
function sinsalChart(dayStem, pillars, yearBranch) {
  const perPillar = {};
  const specialByPillar = {};
  const branches = [];

  for (const k of Object.keys(pillars)) {
    const p = pillars[k];
    branches.push(p.branch);
    perPillar[k] = twelveSinsalFor(yearBranch, p.branch);

    const sp = [];
    if (YANGIN[dayStem] === p.branch) sp.push('양인살');
    if (BAEKHO.has(p.ganjiKorean)) sp.push('백호살');
    if (GOEGANG.has(p.ganjiKorean)) sp.push('괴강살');
    if (HONGYEOM[dayStem] === p.branch) sp.push('홍염살');
    if (sp.length) specialByPillar[k] = sp;
  }

  const pairs = [];
  for (const w of pairHits(branches, WONJIN)) pairs.push({ type: '원진살', at: w });
  for (const g of pairHits(branches, GWIMUN)) pairs.push({ type: '귀문관살', at: g });

  // 요약: 중복 제거한 신살 이름 목록
  const names = new Set();
  Object.values(perPillar).forEach((s) => names.add(s.name));
  Object.values(specialByPillar).forEach((arr) => arr.forEach((n) => names.add(n)));
  pairs.forEach((p) => names.add(p.type));

  return { perPillar, specialByPillar, pairs, summary: [...names] };
}

module.exports = { sinsalChart, twelveSinsalFor, TWELVE, TWELVE_HANJA };
