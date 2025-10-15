# ---------- Build stage (con dev deps) ----------
FROM node:20-slim AS builder
WORKDIR /app

# Herramientas por si hay módulos nativos
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
# Instala TODAS las deps (incluye dev), necesario para nest build
RUN npm ci

COPY . .
# Compila -> genera /app/dist
RUN npm run build

# Quita dev deps y deja solo prod para el runtime
RUN npm prune --omit=dev

# ---------- Runtime stage (ligero) ----------
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000

# Copia solo lo necesario del builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Carpeta para PDFs (monta volumen aquí en Easypanel)
RUN mkdir -p /app/uploads

EXPOSE 5000
CMD ["node", "dist/main.js"]
