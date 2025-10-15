# ---------- Build stage ----------
FROM node:20-slim AS builder
WORKDIR /app/backend

# deps nativos por si algo usa node-gyp
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copiamos SOLO el backend
COPY backend/package*.json ./
RUN npm ci

COPY backend/ ./
# Compila Nest -> genera /app/backend/dist
RUN npm run build

# Deja solo deps de producción
RUN npm prune --omit=dev \
 && test -f dist/main.js || (echo "❌ No se generó dist/main.js" && ls -la dist && exit 1)

# ---------- Runtime stage ----------
FROM node:20-slim AS runner
WORKDIR /app/backend
ENV NODE_ENV=production
ENV PORT=5000

# Copiamos lo mínimo
COPY --from=builder /app/backend/node_modules ./node_modules
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/package*.json ./

# Carpeta para PDFs (móntala como volumen en EasyPanel)
RUN mkdir -p /app/backend/uploads

EXPOSE 5000
CMD ["node", "dist/main.js"]
