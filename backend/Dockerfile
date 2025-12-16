# ---------- Build stage ----------
FROM node:20-slim AS builder
WORKDIR /app/backend

RUN apt-get update && apt-get install -y --no-install-recommends \
  python3 make g++ && rm -rf /var/lib/apt/lists/*

# El contexto YA es /backend → sin prefijo "backend/"
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Dejar solo deps de producción y comprobar que existe dist/main.js
# RUN npm prune --omit=dev && test -f dist/main.js

# ---------- Runtime stage ----------
FROM node:20-slim AS runner
WORKDIR /app/backend
ENV NODE_ENV=production
ENV PORT=5000

COPY --from=builder /app/backend/node_modules ./node_modules
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/package*.json ./

RUN mkdir -p /app/backend/uploads

EXPOSE 5000
CMD ["node", "dist/main.js"]
