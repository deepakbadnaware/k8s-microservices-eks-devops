# Build stage
FROM node:22 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --ignore-scripts
COPY . .
ARG VITE_API_PATH=http://wanderlust.local
ENV VITE_API_PATH=$VITE_API_PATH
RUN npm run build

# Serve stage
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80