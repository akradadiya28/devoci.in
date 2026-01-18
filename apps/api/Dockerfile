# Build Stage
FROM node:18-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./
# If using monorepo, copy workspace config
COPY pnpm-workspace.yaml ./

# Install dependencies (frozen lockfile for reproducibility)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build code (transpile TS to JS)
RUN pnpm build:backend

# Production Stage
FROM node:18-alpine AS runner

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy built artifacts and dependencies from builder
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend/dist ./dist
# Copy other necessary files
COPY --from=builder /app/apps/backend/package.json ./

# Environment setup
ENV NODE_ENV=production
ENV PORT=4000

# Expose port
EXPOSE 4000

# Start application
CMD ["node", "dist/index.js"]
