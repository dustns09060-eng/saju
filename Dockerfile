# 별헤는밤 사주 — 배포용 이미지
FROM node:20-alpine

WORKDIR /app

# 의존성 먼저 (캐시 활용)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 앱 소스
COPY src ./src
COPY public ./public

ENV NODE_ENV=production
# 호스팅이 PORT 를 주입한다. 코드가 process.env.PORT 를 읽음.
EXPOSE 3000

CMD ["node", "src/server.js"]
