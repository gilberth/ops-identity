# ==========================================
# Stage 1: Build Client (Frontend)
# ==========================================
FROM node:18-alpine AS client-build
WORKDIR /app/client

# Copy client package files
COPY client/package.json client/package-lock.json ./
RUN npm ci

# Copy client source code
COPY client/ ./

# Build client
# Note: VITE_VPS_ENDPOINT is NOT needed here as we use runtime config
RUN npm run build

# ==========================================
# Stage 2: Setup Server (Backend)
# ==========================================
FROM node:18-alpine AS server-build
WORKDIR /app/server

# Copy server package files
COPY server/package.json ./
# If package-lock exists, copy it (it might not if we just moved files)
COPY server/package-lock.json* ./

RUN npm install --production

# ==========================================
# Stage 3: Final Image
# ==========================================
FROM node:18-alpine
WORKDIR /app

# Install runtime dependencies if needed (e.g. for healthchecks)
RUN apk add --no-cache curl

# Copy server dependencies and code from Stage 2
COPY --from=server-build /app/server/node_modules ./node_modules
COPY server/ ./

# Copy built client assets from Stage 1 to 'public' folder in server
# The server is configured to serve static files from ./public
COPY --from=client-build /app/client/dist ./public

# Copy entrypoint script
COPY scripts/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose port
EXPOSE 3000

# Set environment variables defaults
ENV PORT=3000
ENV NODE_ENV=production

ENTRYPOINT ["/entrypoint.sh"]
