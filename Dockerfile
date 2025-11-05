# ---------------------
# 1️⃣ Base builder image
# ---------------------
FROM node:18-alpine AS builder

WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy everything else
COPY . .

# ---------------------
# 2️⃣ Runtime image
# ---------------------
FROM node:18-alpine AS runner

WORKDIR /usr/src/app

# Copy only necessary files from builder
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app ./

# Expose the application port
EXPOSE 3000

# Set environment variable
ENV NODE_ENV=production

# Command to start the app
CMD ["node", "server.js"]