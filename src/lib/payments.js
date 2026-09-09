'use strict';

/**
 * 결제 프로바이더 추상화.
 *
 *  - PAYMENT_PROVIDER=mock    (기본): 실제 결제 없이 성공 처리. 개발/데모용.
 *  - PAYMENT_PROVIDER=portone : 포트원(아임포트) V2. 사업자등록 + 상점 API secret 필요.
 *
 * 사업자등록을 마치면:
 *   1) .env 에 PAYMENT_PROVIDER=portone, PORTONE_API_SECRET, PORTONE_STORE_ID 설정
 *   2) 아래 verifyPayment 의 portone 분기 TODO 구현 (결제 단건 조회 → 금액·상태 대조)
 *   3) 프론트(public/app.js)의 requestPay() 를 포트원 SDK 호출로 교체
 * 나머지 주문/풀이 로직은 그대로 재사용된다.
 */

const PROVIDER = (process.env.PAYMENT_PROVIDER || 'mock').toLowerCase();
const PRICE_KRW = Math.max(0, Number(process.env.SAJU_PRICE_KRW || 2900));

/**
 * 결제가 실제로 완료됐는지 서버에서 검증한다. (프론트 응답은 절대 신뢰하지 않는다)
 * @param {{ paymentId: string, orderId: string, expectedAmount: number }} p
 * @returns {Promise<{ ok: boolean, provider: string, paidAmount: number, raw: any }>}
 */
async function verifyPayment({ paymentId, orderId, expectedAmount }) {
  if (PROVIDER === 'mock') {
    // 모의 결제: 프론트가 "결제 완료" 버튼을 누르면 무조건 통과.
    return { ok: true, provider: 'mock', paidAmount: expectedAmount, raw: { mock: true, paymentId, orderId } };
  }

  if (PROVIDER === 'portone') {
    // TODO(사업자등록 후):
    //   const r = await fetch(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}`, {
    //     headers: { Authorization: `PortOne ${process.env.PORTONE_API_SECRET}` },
    //   });
    //   const pay = await r.json();
    //   const ok = pay.status === 'PAID'
    //     && pay.amount?.total === expectedAmount
    //     && pay.customData?.orderId === orderId;
    //   return { ok, provider: 'portone', paidAmount: pay.amount?.total ?? 0, raw: pay };
    throw new Error('PAYMENT_PROVIDER=portone: verifyPayment 미구현. src/lib/payments.js 의 TODO 참고.');
  }

  throw new Error('알 수 없는 PAYMENT_PROVIDER: ' + PROVIDER);
}

module.exports = { PROVIDER, PRICE_KRW, verifyPayment };
