# 배포 + 별헤는밤.com 연결

> 이 작업은 **본인 계정 + 결제 수단 + 대시보드 접근**이 필요해서 코드로 대신 못 합니다.
> 아래 순서대로 하시면 됩니다. 코드는 배포 준비가 끝나 있습니다(`Dockerfile`, `process.env.PORT` 사용).

---

## 0. 한글 도메인 참고

`별헤는밤.com` 은 내부적으로 **`xn--sh1bj5pxna671f.com`** (퓨니코드)로 저장됩니다.

- HTTPS 인증서·호스팅 커스텀 도메인 입력칸에는 **퓨니코드(`xn--sh1bj5pxna671f.com`)** 를 넣어야 하는 경우가 많습니다.
- 이메일(`@별헤는밤.com`)·일부 광고 플랫폼·SNS 링크 미리보기가 한글 도메인을 깨거나 퓨니코드로 표시할 수 있습니다.
- **권장**: 기술용 기본 도메인은 영문(예: `byeolbam.com`, `starrynight.kr`)으로 두고, `별헤는밤.com` 은 그쪽으로 **301 리다이렉트**만. 마케팅엔 한글, 시스템엔 영문.

---

## 1. 도메인 구입

- 한글 `.com`: 가비아 / 후이즈 / 아사달 등 국내 등록대행
- 영문 `.com` / `.kr`: 위 + Cloudflare Registrar(마진 없음, 추천) / Namecheap
- 비용: `.com` 연 1.5~2만원, `.kr` 연 2만원 안팎

---

## 2. 코드 GitHub 에 올리기

```bash
cd "C:\Users\SEUNGHO\새 폴더\saju"
git init
git add .
git commit -m "별헤는밤 사주 초기 배포본"
```

GitHub 에 새 저장소 만들고:

```bash
git remote add origin https://github.com/<본인계정>/byeolbam.git
git branch -M main
git push -u origin main
```

> `.gitignore` 에 `.env`, `data/`, `node_modules/` 가 이미 제외돼 있습니다. **`.env` 는 절대 커밋 금지.**

---

## 3. 호스팅 배포 (Railway 예시 — Render/Fly 도 비슷)

1. https://railway.app → GitHub 로그인 → **New Project → Deploy from GitHub repo** → 방금 저장소 선택
2. Railway 가 `Dockerfile` 을 감지해 자동 빌드·실행. `PORT` 는 자동 주입됨
3. **Variables** 탭에서 환경변수 입력:

   | 변수 | 값 |
   |---|---|
   | `AI_PROVIDER` | `api` |
   | `ANTHROPIC_API_KEY` | `sk-ant-...` (console.anthropic.com 발급) |
   | `CLAUDE_MODEL` | `claude-sonnet-5` |
   | `CLAUDE_TEASER_MODEL` | `claude-haiku-4-5` |
   | `PAYMENT_PROVIDER` | `mock` (사업자 등록 전) / 이후 `portone` |
   | `SAJU_PRICE_KRW` | `2900` |

4. 배포되면 `https://xxxx.up.railway.app` 주소가 생김 → 접속해서 동작 확인

> ⚠️ **주의: `data/` 는 재배포 때 초기화됩니다.** 주문·풀이 기록이 날아가면 안 되므로,
> 실서비스 전에 `src/lib/orders.js` 를 DB(Railway Postgres 등)로 교체해야 합니다.
> `create / get / save` 3개 함수만 DB 버전으로 바꾸면 나머지는 그대로 동작합니다. (원하면 작업해 드림)

---

## 4. 도메인 연결 (DNS)

1. 호스팅 대시보드 → **Settings → Domains → Add Custom Domain**
   - 영문 도메인이면 그대로 입력
   - 한글 도메인이면 `xn--sh1bj5pxna671f.com` (퓨니코드) 입력
2. 호스팅이 알려주는 **CNAME 레코드**(예: `cname.railway.app`)를 도메인 산 곳의 DNS 관리에 추가
   - `@` (루트) 는 CNAME 이 안 되는 등록대행이 많음 → 그때는 `www` 만 CNAME 하고 루트는 등록대행의 "포워딩/URL 전송" 기능으로 `www` 로 보냄
3. 몇 분~몇 시간 뒤 HTTPS 인증서 자동 발급 → `https://별헤는밤.com` 접속 가능

이후 링크 복사 시 주소가 자동으로 `https://별헤는밤.com/#order=...` 로 바뀝니다(상대경로 기반이라 코드 수정 불필요).

---

## 5. 배포 후 체크리스트

- [ ] `AI_PROVIDER=api` + `ANTHROPIC_API_KEY` 설정, 콘솔에 **월 사용 한도(budget)** 걸기
- [ ] `data/` → DB 교체 (재배포 시 데이터 유실 방지)
- [ ] GA4 결제 이벤트 추적 삽입
- [ ] 하단 사업자정보·이용약관·개인정보처리방침·환불규정 (전자상거래법 / PG 심사)
- [ ] 결제 실연동: `PAYMENT_PROVIDER=portone` + `src/lib/payments.js` 의 `verifyPayment` 구현 + 프론트 `payNow()` 를 포트원 결제창 호출로 교체
