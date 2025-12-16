# syntax=docker/dockerfile:1

# --- Dependencias de producción (más liviano en runtime) ---
FROM node:20-slim AS deps
WORKDIR /app
COPY package*.json ./
# Sólo deps de producción para la imagen final
RUN npm ci --omit=dev

# --- Build (con devDeps y variables de build) ---
FROM node:20-slim AS build
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Vars disponibles en el proceso de build
ARG NEXT_PUBLIC_API_BASE
ARG NEXT_API_PROXY_ORIGIN

# Inyectadas en el bundle del cliente (compile-time)
ENV NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_BASE}

# Usadas por el código del servidor / proxy durante el build si aplica
ENV NEXT_API_PROXY_ORIGIN=${NEXT_API_PROXY_ORIGIN}
ENV API_PROXY_ORIGIN=${NEXT_API_PROXY_ORIGIN}

COPY package*.json ./
RUN npm ci
COPY . .
RUN chown -R node:node /app
RUN npm run build

# --- Runtime ---
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOST=0.0.0.0

# Reexpón (opcionales) para el código del servidor en runtime
# OJO: las NEXT_PUBLIC_* no se reevalúan en runtime; sólo el servidor lee estas.
ENV NEXT_API_PROXY_ORIGIN=""
ENV API_PROXY_ORIGIN=""

# Sólo deps de producción
COPY --from=deps /app/node_modules ./node_modules

# Artefactos de build
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package*.json ./

# Corre como usuario no root
USER node

EXPOSE 3000
CMD ["node","node_modules/next/dist/bin/next","start","-p","3000","-H","0.0.0.0"]
