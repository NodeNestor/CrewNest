FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npx vite build

FROM node:22-alpine

WORKDIR /app

# Install all deps (tsx needed at runtime)
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Copy built frontend + server source
COPY --from=builder /app/dist/client ./dist/client
COPY src/server ./src/server

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["npx", "tsx", "src/server/index.ts"]
