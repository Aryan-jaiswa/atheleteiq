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
RUN npm run build --workspace backend

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /workspace/node_modules ./node_modules
COPY --from=builder /workspace/shared ./shared
COPY --from=builder /workspace/backend/package.json ./package.json
COPY --from=builder /workspace/backend/dist ./dist
COPY --from=builder /workspace/backend/prisma ./prisma

EXPOSE 4000
CMD ["node", "dist/index.js"]
