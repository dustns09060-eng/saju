'use strict';

/**
 * 후기 섹션 데이터.
 *
 * ⚠️ 지금 들어 있는 항목은 전부 "예시(자리표시자)"입니다.
 *    실제 사용자에게서 받은 후기로 반드시 교체하세요.
 *    지어낸 후기를 진짜처럼 노출하는 것은 전자상거래법상 기만적 표시이고, 신뢰도 오히려 떨어집니다.
 *
 * 교체 방법: 아래 배열의 각 항목을 실제 후기로 바꾸고 `sample: false` 로.
 *   { name: '표시할 이름(익명/이니셜 권장)', topic: '본 주제', text: '후기 내용', rating: 1~5, sample: false }
 *
 * `sample: true` 항목은 화면에 "예시" 뱃지가 붙고, 하나도 실제 후기가 없으면 섹션 자체가 숨겨집니다.
 */

const REVIEWS = [
  { name: 'ㅇㅈ님', topic: '전체 사주 풀이', rating: 5, sample: true,
    text: '(예시) 원국표 값 하나하나 짚어가며 풀어줘서, 그냥 좋은 말 늘어놓는 다른 곳이랑 확실히 달랐어요.' },
  { name: 'ㄱ님', topic: '올해 신년운세', rating: 4, sample: true,
    text: '(예시) 상·하반기 흐름이 구체적이라 캘린더에 메모해뒀습니다. 값이 화면에 다 보이니 믿음이 감.' },
  { name: 'ㅅㅇ님', topic: '타로 3장', rating: 5, sample: true,
    text: '(예시) 질문에 딱 붙여서 세 장을 하나로 엮어줘서, 애매하게 끝나지 않고 답이 나왔어요.' },
];

/** 화면에 내려줄 후기 (실제 후기가 하나도 없으면 예시만이라도 내려주되, sample 플래그로 구분) */
function publicReviews() {
  return REVIEWS.map((r) => ({
    name: String(r.name || '').slice(0, 12),
    topic: String(r.topic || '').slice(0, 20),
    text: String(r.text || '').slice(0, 300),
    rating: Math.min(5, Math.max(1, Number(r.rating) || 5)),
    sample: !!r.sample,
  }));
}

/** 실제 후기가 하나라도 있는가 (없으면 프론트가 섹션을 숨김) */
function hasRealReviews() {
  return REVIEWS.some((r) => !r.sample);
}

module.exports = { REVIEWS, publicReviews, hasRealReviews };
