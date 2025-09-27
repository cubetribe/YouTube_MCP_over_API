# YouTube MCP Extended - Multi-stage Docker Build
# Optimized for production deployment with security best practices

# Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Add build metadata
LABEL stage=builder
LABEL description="YouTube MCP Extended - Build Stage"

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production --ignore-scripts && \
    npm ci --only=development --ignore-scripts

# Copy source code
COPY src/ ./src/
COPY agents/ ./agents/

# Build the application
RUN npm run build:prod

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Production stage
FROM node:20-alpine AS production

# Set working directory
WORKDIR /app

# Add production metadata
LABEL maintainer="Dennis Westermann (aiEX Academy)"
LABEL description="YouTube MCP Extended - Production"
LABEL version="0.0.2"

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcp -u 1001 -G nodejs

# Install production runtime dependencies
RUN apk add --no-cache \
    tini \
    ca-certificates && \
    apk upgrade

# Copy built application from builder stage
COPY --from=builder --chown=mcp:nodejs /app/dist ./dist
COPY --from=builder --chown=mcp:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=mcp:nodejs /app/package*.json ./

# Create necessary directories with proper permissions
RUN mkdir -p /app/tokens /app/backups /app/storage /app/logs && \
    chown -R mcp:nodejs /app

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV LOG_LEVEL=info

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "const { spawn } = require('child_process'); \
    const proc = spawn('node', ['-e', 'setTimeout(() => process.exit(0), 1000)']); \
    proc.on('exit', (code) => process.exit(code));"

# Expose port
EXPOSE 3000

# Switch to non-root user
USER mcp

# Use tini as entrypoint for proper signal handling
ENTRYPOINT ["tini", "--"]

# Start the application
CMD ["node", "dist/index.js"]

# Development stage (for docker-compose)
FROM node:20-alpine AS development

# Set working directory
WORKDIR /app

# Add development metadata
LABEL stage=development
LABEL description="YouTube MCP Extended - Development"

# Install all dependencies including dev tools
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    bash

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcp -u 1001 -G nodejs

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies
RUN npm ci

# Create necessary directories
RUN mkdir -p /app/tokens /app/backups /app/storage /app/logs && \
    chown -R mcp:nodejs /app

# Set environment variables
ENV NODE_ENV=development
ENV PORT=3000
ENV LOG_LEVEL=debug

# Expose port and debug port
EXPOSE 3000 9229

# Switch to non-root user
USER mcp

# Start development server with hot reload
CMD ["npm", "run", "dev:basic"]