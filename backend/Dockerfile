# backend/Dockerfile

FROM node:18-slim
WORKDIR /app

# Herramientas por si alguna lib nativa necesita compilar
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=5000

# 1) deps de npm
COPY package*.json ./
RUN npm ci

# 2) código
COPY . .

# 3) build (debe crear /app/dist)
RUN npm run build

# 4) quitar dev deps para runtime
RUN npm ci --omit=dev

# 5) carpeta persistente para PDFs
RUN mkdir -p /app/uploads

EXPOSE 5000
CMD ["node", "dist/main.js"]
