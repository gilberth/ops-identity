FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json ./
# Copy bun.lockb if it exists
COPY bun.lockb* ./
RUN bun install --production

COPY server.js ./

CMD ["bun", "start"]
