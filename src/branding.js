'use strict';

/**
 * 브랜드 + 사업자 정보 한곳에서 관리.
 * /api/config 로 내려가 프론트(title·랜딩·공유카드·푸터·약관/개인정보/환불 페이지)에 반영된다.
 * 프롬프트의 {{NARRATOR}} 도 여기 값으로 치환된다.
 */
module.exports = {
  siteName: '별헤는밤',
  siteNameSub: '별빛 아래 정통 사주',
  tagline: '그대의 별을 하나씩 헤아려',
  narrator: '별하', // 사주를 봐 주는 역술가 화자 이름

  /* ── 사업자 정보 (전자상거래법·PG 심사용) ──────────────
     실제 값으로 채우세요. 빈 값은 화면에 "미정"으로 표시됩니다. */
  business: {
    name: '별헤는밤',                 // 상호
    owner: '',                        // 대표자 성명
    bizNo: '',                        // 사업자등록번호 (000-00-00000)
    mailOrderNo: '',                  // 통신판매업 신고번호
    address: '',                      // 사업장 주소
    tel: '',                          // 연락처
    email: 'dustns09060@gmail.com',   // 고객문의 이메일
    domain: 'www.별헤는밤.com',
    lastUpdated: '2026-09-09',        // 약관/방침 개정일
  },
};
