# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Ensure CA certificates are present so Node can make HTTPS requests (OSRM)
RUN apk add --no-cache ca-certificates && update-ca-certificates || true

COPY --from=builder /app/dist ./dist
COPY server ./server

ENV NODE_ENV=production
ENV PORT=3050

EXPOSE 3050

CMD ["node", "server/index.js"]
