# --- Build ---
FROM node:20-slim AS build
WORKDIR /app/frontend
COPY package*.json ./
RUN npm ci
COPY . .
# Variables expuestas durante el build para conectar con el backend
ARG NEXT_PUBLIC_API_BASE
ARG NEXT_API_PROXY_ORIGIN
ENV NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_BASE}
ENV NEXT_API_PROXY_ORIGIN=${NEXT_API_PROXY_ORIGIN}
ENV API_PROXY_ORIGIN=${NEXT_API_PROXY_ORIGIN}
RUN npm run build

# --- Runtime ---
FROM node:20-slim AS runner
WORKDIR /app/frontend
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

COPY --from=build /app/frontend/package*.json ./
COPY --from=build /app/frontend/node_modules ./node_modules
COPY --from=build /app/frontend/.next ./.next
COPY --from=build /app/frontend/public ./public
# No copies next.config.ts: la build ya trae la configuraci�n necesaria

EXPOSE 3000
CMD ["node","node_modules/next/dist/bin/next","start","-p","3000","-H","0.0.0.0"]
