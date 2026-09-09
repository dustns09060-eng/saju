'use strict';

/**
 * 결제 프로바이더 추상화.
 *
 *  - PAYMENT_PROVIDER=mock    (기본): 실제 결제 없이 성공 처리. 개발/데모용.
 *  - PAYMENT_PROVIDER=portone : 포트원(아임포트) V2 실결제.
 *
 * 포트원 실연동 준비물:
 *   1) 사업자등록 + 통신판매업 신고
 *   2) 포트원 가입 → 상점 개설 → PG 계약/심사 → 결제채널 등록
 *   3) 콘솔에서 값 3개 확인:
 *      - Store ID       → PORTONE_STORE_ID   (프론트에 노출됨, 공개값)
 *      - 채널 키        → PORTONE_CHANNEL_KEY (프론트에 노출됨, 공개값)
 *      - API Secret     → PORTONE_API_SECRET  (서버 전용, 절대 노출 금지)
 *   4) Railway(또는 .env)에 위 3개 + PAYMENT_PROVIDER=portone 설정
 *
 * 결제 흐름:
 *   프론트 payNow() → PortOne.requestPayment({ paymentId: orderId, ... })
 *   → 결제창 완료 → 프론트가 POST /api/order/pay { orderId }
 *   → 서버가 아래 verifyPayment() 로 포트원 API 에 조회해 status·금액 검증 (프론트 응답은 신뢰하지 않음)
 */

const PROVIDER = (process.env.PAYMENT_PROVIDER || 'mock').toLowerCase();
const PRICE_KRW = Math.max(0, Number(process.env.SAJU_PRICE_KRW || 2900));

/** 프론트(/api/config)로 내려도 되는 공개 결제 설정 */
function publicConfig() {
  if (PROVIDER === 'portone') {
    return {
      provider: 'portone',
      storeId: process.env.PORTONE_STORE_ID || '',
      channelKey: process.env.PORTONE_CHANNEL_KEY || '',
    };
  }
  return { provider: 'mock' };
}

/**
 * 결제가 실제로 완료됐는지 서버에서 검증한다.
 * @param {{ paymentId: string, orderId: string, expectedAmount: number }} p
 * @returns {Promise<{ ok: boolean, provider: string, paidAmount: number, status?: string, raw: any }>}
 */
async function verifyPayment({ paymentId, orderId, expectedAmount }) {
  if (PROVIDER === 'mock') {
    return { ok: true, provider: 'mock', paidAmount: expectedAmount, status: 'PAID', raw: { mock: true, paymentId, orderId } };
  }

  if (PROVIDER === 'portone') {
    const secret = process.env.PORTONE_API_SECRET;
    if (!secret) throw new Error('PORTONE_API_SECRET 가 설정되지 않았습니다.');

    const url = `https://api.portone.io/payments/${encodeURIComponent(paymentId)}`;
    const r = await fetch(url, { headers: { Authorization: `PortOne ${secret}` } });
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      return { ok: false, provider: 'portone', paidAmount: 0, status: `HTTP_${r.status}`, raw: body.slice(0, 500) };
    }
    const pay = await r.json();
    const paidAmount = (pay.amount && Number(pay.amount.total)) || 0;
    const ok = pay.status === 'PAID' && paidAmount === Number(expectedAmount);
    return { ok, provider: 'portone', paidAmount, status: pay.status, raw: pay };
  }

  throw new Error('알 수 없는 PAYMENT_PROVIDER: ' + PROVIDER);
}

module.exports = { PROVIDER, PRICE_KRW, publicConfig, verifyPayment };
