# syntax=docker/dockerfile:1

# --- Dependencias de producción (más liviano en runtime) ---
# Install only production dependencies to keep the final image small
FROM node:20-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci 

# --- Build (con devDeps y variables de build) ---
# Use a separate stage for building with all dependencies and build-time env vars
FROM node:20-slim AS build
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Set build-time arguments for API URLs (important for correct API endpoints)
ARG NEXT_PUBLIC_API_BASE
ARG NEXT_API_PROXY_ORIGIN

# Set environment variables for client and server code (used during build)
ENV NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_BASE}
ENV NEXT_API_PROXY_ORIGIN=${NEXT_API_PROXY_ORIGIN}
ENV API_PROXY_ORIGIN=${NEXT_API_PROXY_ORIGIN}

# Copy package files and install all dependencies (including devDeps)
COPY package*.json ./
RUN npm ci

# Copy the rest of the application code
COPY . .

# Set correct permissions for the node user (security best practice)
RUN mkdir -p .next/cache/images && chmod -R 777 .next/cache
RUN chown -R node:node /app

# Build the Next.js app (creates the .next directory)
RUN npm run build

# --- Runtime ---
# Use a fresh slim Node.js image for running the app (smaller, safer)
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOST=0.0.0.0

# Set runtime environment variables for server-side code (not for client)
ENV NEXT_API_PROXY_ORIGIN=""
ENV API_PROXY_ORIGIN=""

# Copy only production dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy build artifacts and static files from build stage
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package*.json ./

# Run as non-root user for security
USER node

# Expose the port the app will run on
EXPOSE 3000

# Start the Next.js server
CMD ["node","node_modules/next/dist/bin/next","start","-p","3000","-H","0.0.0.0"]