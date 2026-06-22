FROM node:22-alpine

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/ .

RUN mkdir -p data/backups uploads

EXPOSE 3001

ENV NODE_ENV=production

CMD ["node", "index.js"]
