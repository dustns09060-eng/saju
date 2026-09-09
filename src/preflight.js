'use strict';

/**
 * 환경 점검. `npm run preflight` 로 실행.
 *  1) manseryeok 로드 + 고정 입력으로 사주 계산 → 기대값과 비교
 *  2) claude CLI 로그인/구독 인증 헬스체크 (`claude -p`)
 */

require('dotenv').config();

const { computeChart } = require('./saju/compute');
const { formatChartForPrompt } = require('./saju/format');
const claude = require('./lib/claude');

// 알려진 스냅샷: 1990-05-15 12:00 (양력, 남, 서울 경도 126.978, 진태양시 보정 ON)
const SAMPLE_INPUT = {
  calendar: 'solar',
  year: 1990,
  month: 5,
  day: 15,
  hourKnown: true,
  hour: 12,
  minute: 0,
  gender: 'male',
  longitude: 126.978,
  trueSolarTime: true,
  place: '서울',
};
const EXPECTED = { year: '경오', month: '신사', day: '경진', hour: '임오' };

async function main() {
  let failed = 0;

  // 1) 만세력 계산
  try {
    const chart = computeChart(SAMPLE_INPUT);
    const got = {
      year: chart.pillars.year.ganjiKorean,
      month: chart.pillars.month.ganjiKorean,
      day: chart.pillars.day.ganjiKorean,
      hour: chart.pillars.hour.ganjiKorean,
    };
    const ok = ['year', 'month', 'day', 'hour'].every((k) => got[k] === EXPECTED[k]);
    console.log(`[만세력] 샘플 사주: ${JSON.stringify(got)}  기대: ${JSON.stringify(EXPECTED)}  → ${ok ? 'OK' : '불일치'}`);
    if (!ok) failed++;
    console.log('\n----- 프롬프트에 들어갈 사주 텍스트 미리보기 -----');
    console.log(formatChartForPrompt(chart));
    console.log('------------------------------------------------\n');
  } catch (e) {
    console.error('[만세력] 실패:', e.message);
    failed++;
  }

  // 2) claude 헬스체크
  try {
    const h = await claude.healthCheck();
    console.log(`[claude] provider=${h.provider} model=${h.model} → 응답: "${h.sample}" (${h.ms}ms) → ${h.ok ? 'OK' : '이상'}`);
    if (!h.ok) failed++;
  } catch (e) {
    console.error(`[claude] 실패 (AI_PROVIDER=${claude.PROVIDER}):`, e.message);
    failed++;
  }

  // 3) 결제 설정 안내
  const { PROVIDER: payProvider, PRICE_KRW } = require('./lib/payments');
  console.log(`[결제] PAYMENT_PROVIDER=${payProvider}, 가격=${PRICE_KRW}원` + (payProvider === 'mock' ? ' (모의 결제 — 실제 청구 없음)' : ''));

  if (failed) {
    console.error(`\n점검 실패 ${failed}건. 위 메시지를 확인하세요.`);
    process.exit(1);
  }
  console.log('\n모든 점검 통과. `npm start` 로 실행하세요.');
}

main();
