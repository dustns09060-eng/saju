'use strict';

/**
 * 무료 쿠폰. 결제를 건너뛰고 주문을 바로 paid 로 만든다 (베타 후기단·지인용).
 *
 * 설정(.env / Railway Variables):
 *   COUPON_CODES       쉼표로 구분한 유효 코드 목록. 예: BETA2026,FRIEND,REVIEW10
 *   COUPON_MAX_TOTAL   전체 쿠폰 사용 상한(정수). 미설정이면 무제한.
 *
 * 코드는 대소문자·앞뒤공백 무시. 저장소엔 커밋하지 않는다.
 */

const norm = (s) => String(s || '').trim().toUpperCase();

function codes() {
  return norm(process.env.COUPON_CODES)
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
}

function isValid(code) {
  const c = norm(code);
  return !!c && codes().includes(c);
}

function maxTotal() {
  const n = Number(process.env.COUPON_MAX_TOTAL);
  return Number.isFinite(n) && n > 0 ? n : Infinity;
}

module.exports = { isValid, maxTotal, normalize: norm, enabled: () => codes().length > 0 };
