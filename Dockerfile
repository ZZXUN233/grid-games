# Multi-stage build — aligns with chigua/Poetica-6 pattern
FROM node:20-alpine AS builder
WORKDIR /app

# Install all dependencies (including devDependencies for build)
COPY package*.json ./
RUN npm ci

# Copy source and build frontend
COPY . .
RUN npm run build

# Transpile server TypeScript to JavaScript (no bundling — deps resolve from node_modules)
RUN npx esbuild server.ts --platform=node --format=esm --outfile=server.mjs

# Production stage
FROM node:20-alpine AS production
WORKDIR /app

# Only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built frontend and compiled server from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.mjs ./server.mjs

# Non-root user (security best practice, matching chigua/Poetica-6)
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3004

ENV NODE_ENV=production
ENV PORT=3004

CMD ["node", "server.mjs"]
