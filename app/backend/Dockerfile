FROM node:22 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --ignore-scripts
COPY . .

FROM  node:22-slim
WORKDIR /app
COPY --from=builder /app /app
EXPOSE 3000
CMD ["npm", "start"]