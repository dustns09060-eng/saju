# 오늘의 사주 — AI 사주 풀이 (건별 결제)

생년월일시를 스텝별로 입력 → 만세력으로 사주팔자 계산 → **무료 미리보기(사주표)** →
**건별 결제** → **AI 상세 풀이**(6개 섹션 스트리밍) → 링크로 다시 보기.

- AI 호출: `AI_PROVIDER` 로 전환
  - `api` : Anthropic API + `ANTHROPIC_API_KEY` (쓴 만큼 후불). **유료 서비스는 이 방식.**
  - `cli` : 로컬 `claude` CLI + 구독요금제. 개인 개발/데모 전용 (배포 금지 — 약관 위반).
- 결제: `PAYMENT_PROVIDER` 로 전환
  - `mock` : 실제 청구 없는 모의 결제 (개발/데모)
  - `portone` : 포트원(아임포트) V2 실결제. 사업자등록 + 상점 secret 필요.

지원 연도 1800~2300 (음력 입력 1391~2100). 사주 계산은 `manseryeok` v2.

---

## 실행 (현재 = 데모 모드: cli + mock)

```bash
npm install
copy .env.example .env      # 값은 아래 참고
npm run preflight
npm start                   # http://localhost:3000
```

`.env` 현재 기본값은 `AI_PROVIDER=cli`(구독 토큰)· `PAYMENT_PROVIDER=mock`(모의 결제)라 바로 돌려볼 수 있습니다.

---

## 수익형(운영) 전환 체크리스트

### 1. AI → API 키

```
# .env
AI_PROVIDER=api
ANTHROPIC_API_KEY=sk-ant-...     # console.anthropic.com 발급
CLAUDE_MODEL=claude-sonnet-5     # haiku-4-5(저렴) / opus-5(고품질)
```

- 풀이 1건 원가(대략): Haiku ~25~35원 · Sonnet ~40~60원 · Opus ~120~180원
- Anthropic 콘솔에서 **월 사용 한도(budget)** 를 꼭 설정 (악용 시 요금 폭탄 방지)

### 2. 결제 → 포트원 실연동 (사업자등록 후)

```
# .env
PAYMENT_PROVIDER=portone
PORTONE_STORE_ID=store-...
PORTONE_API_SECRET=...
SAJU_PRICE_KRW=2900
```

- `src/lib/payments.js` 의 `verifyPayment()` portone 분기 TODO 구현
  (결제 단건 조회 → `status==='PAID'` && 금액 일치 && orderId 일치 확인)
- `public/app.js` 의 `payNow()` 에서 `mock_...` 대신 포트원 결제창 호출 → 반환된 `paymentId` 전송

### 3. 배포 · 운영

- 호스팅 (Vercel/Railway/Fly.io 등). `data/` 는 파일 저장이라, 다중 인스턴스면 DB(예: SQLite/Postgres)로 교체 필요
- 남용 방지: IP·계정당 rate limit, reCAPTCHA
- 약관/개인정보처리방침(생년월일=개인정보), 환불 규정, "재미·참고용" 면책 문구
- 과장·단정 광고 금지 (표시광고법)

---

## API 요약

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET  | `/api/config` | 가격·프로바이더 |
| POST | `/api/saju/compute` | **무료** 사주표 계산 (미리보기) |
| POST | `/api/order` | 주문 생성 → `orderId` |
| POST | `/api/order/pay` | 결제 검증 (`verifyPayment`) → 주문 `paid` |
| POST | `/api/saju/reading` | **유료** AI 풀이 스트리밍 (NDJSON). `paid` 주문 필요, 1회 소비 후 `consumed` |
| GET  | `/api/order/:id` | 주문·저장된 풀이 조회 (다시 보기) |

주문 상태: `pending → paid → consumed`. 실패 시 `paid` 유지 → 같은 링크로 재시도.

---

## 구조

```
src/
  server.js            Express: /api + 정적
  preflight.js         점검 (만세력 샘플 + AI 헬스체크 + 결제 설정)
  lib/
    claude.js          AI 래퍼 — AI_PROVIDER=api(@anthropic-ai/sdk) | cli(claude -p). askStream 공통
    payments.js        결제 프로바이더 — mock | portone(TODO)
    orders.js          주문 JSON 저장 (data/orders/)
    logger.js
  saju/
    compute.js  jijanggan.js  seun.js  format.js
  prompts/reading.md   AI 풀이 지시문
  routes/saju.js       위 API 전부
public/
  index.html app.js styles.css   랜딩 → 스텝 위저드 → 미리보기/결제 → 결과 (Pretendard, 파스텔 트렌디)
data/
  orders/  history/    (git 제외)
```
