FROM node:20-slim
WORKDIR /app

# Install dependencies first (better build caching)
COPY package*.json ./
RUN npm install --omit=dev

# Copy the rest of the backend, including transactions.xlsx
COPY . .

# Cloud Run provides PORT (usually 8080); the app reads it.
EXPOSE 8080

CMD ["node", "data-server.js"]
