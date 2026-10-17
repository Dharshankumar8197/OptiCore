# ============================================================
# OPTICORE WEB DOCKERFILE
# Node.js 22 Alpine for Next.js 16 Web Application
# ============================================================

FROM node:22-alpine

WORKDIR /app

# Enable modern npm caching
COPY package.json package-lock.json* ./

RUN npm ci || npm install

# Copy application source code
COPY . .

# Environment variables for build & runtime
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ARG NEXT_PUBLIC_WS_URL=ws://localhost:8000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL} \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

# Build production bundle
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
