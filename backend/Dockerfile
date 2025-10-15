# backend/Dockerfile

# ---- Build ----
FROM node:18 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Runtime ----
FROM node:18-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# solo deps de runtime
COPY package*.json ./
RUN npm ci --omit=dev
# copiamos build
COPY --from=builder /app/dist ./dist
# carpeta uploads (se montará volumen, pero no molesta copiar)
RUN mkdir -p /app/uploads
EXPOSE 5000
ENV PORT=5000
CMD ["node","dist/main.js"]
