FROM node:24-alpine AS base
WORKDIR /app

# Dependencies
FROM base AS deps
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Development
FROM base AS development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/project_db?schema=public"
RUN npx prisma generate
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/project_db?schema=public"
RUN npx prisma generate
RUN npm run build

# Production
FROM base AS production
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]