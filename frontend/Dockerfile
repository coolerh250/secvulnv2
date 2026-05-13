# Stage 1: Build React app
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Serve with nginx + self-signed SSL
FROM nginx:alpine
RUN apk add --no-cache openssl

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Generate self-signed certificate at build time (valid 10 years)
RUN mkdir -p /etc/nginx/ssl && \
    openssl req -x509 -nodes -days 3650 \
      -newkey rsa:2048 \
      -keyout /etc/nginx/ssl/server.key \
      -out    /etc/nginx/ssl/server.crt \
      -subj   "/C=TW/ST=Taiwan/L=Taipei/O=SecVuln/CN=secvuln.local" && \
    chmod 600 /etc/nginx/ssl/server.key

EXPOSE 443
