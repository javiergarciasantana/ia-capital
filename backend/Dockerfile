# ---------- Build stage ----------
# Use a slim Node.js image for smaller size and security
FROM node:20-slim AS builder
WORKDIR /app/backend

# Install build dependencies (needed for native modules)
RUN apt-get update && apt-get install -y --no-install-recommends \
  python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy only package files first to leverage Docker cache for dependencies
COPY package*.json ./
# Install all dependencies (including devDeps) for building the app
RUN npm ci

# Copy the rest of the application code and environment variables
COPY . .
# COPY .env .env

# Build the project and ensure the main entrypoint exists (fail early if not)
RUN npm run build && test -f dist/src/main.js

# (Optional) Remove dev dependencies and check for main.js (uncomment if needed)
# RUN npm prune --omit=dev && test -f dist/main.js

# ---------- Runtime stage ----------
  # Use a fresh slim Node.js image for running the app (smaller, safer)
  FROM node:20-slim AS runner
  WORKDIR /app/backend
  ENV NODE_ENV=production
  ENV PORT=5000
  
  # Copy only production dependencies and built code from builder stage
  COPY --from=builder /app/backend/node_modules ./node_modules
  COPY --from=builder /app/backend/dist ./dist
  COPY --from=builder /app/backend/package*.json ./
  COPY --from=builder /app/backend/src/common/*.png ./dist/src/common/

# Create uploads directory for file storage (important for file uploads)
RUN mkdir -p /app/backend/uploads

# (Debug) List xlsx module files to verify install (can be removed in prod)
RUN ls -l node_modules/xlsx

# Expose the port the app will run on
EXPOSE 5000

# Start the application
CMD ["node", "dist/src/main.js"]