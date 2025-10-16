# ---- build stage ----
FROM node:18-alpine AS builder

WORKDIR /usr/src/app

# Install build deps
COPY package*.json ./
RUN npm ci --production=false

# Copy source (use .dockerignore to exclude dev files)
COPY . .

# If you have a build step (TypeScript / bundler), run it here.
# RUN npm run build

# ---- production stage ----
FROM node:18-alpine AS runner

# Create app directory
WORKDIR /usr/src/app

# Use non-root user (optional but recommended)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Copy only production dependencies and necessary files
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/backend ./backend
COPY --from=builder /usr/src/app/config ./config
# COPY --from=builder /usr/src/app/.env ./config/config.env 

# Set environment variables defaults (can be overridden at runtime)
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Start command — adjust to your actual start script
CMD ["node", "backend/server.js"]