# --- Build ---
FROM node:20-slim AS build
WORKDIR /app/frontend
COPY package*.json ./
RUN npm ci
COPY . .
# variable pública para el front (ajustamos más abajo)
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

# --- Runtime ---
FROM node:20-slim AS runner
WORKDIR /app/frontend
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# copiamos lo mínimo para "next start"
COPY --from=build /app/frontend/package*.json ./
COPY --from=build /app/frontend/node_modules ./node_modules
COPY --from=build /app/frontend/.next ./.next
COPY --from=build /app/frontend/public ./public
COPY --from=build /app/frontend/next.config.js ./next.config.js

EXPOSE 3000
# forzamos host/puerto explícitamente
CMD ["node","node_modules/next/dist/bin/next","start","-p","3000","-H","0.0.0.0"]
