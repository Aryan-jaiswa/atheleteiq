FROM node:20-slim AS builder
WORKDIR /workspace

COPY package*.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
COPY shared/package.json ./shared/
COPY package-lock.json ./package-lock.json

RUN npm ci

COPY . .
RUN npm run build --workspace shared
RUN npm run build --workspace frontend

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /workspace/frontend/.next/standalone ./
COPY --from=builder /workspace/frontend/.next/static ./.next/static
COPY --from=builder /workspace/frontend/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
