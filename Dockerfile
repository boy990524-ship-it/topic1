FROM node:18-slim
WORKDIR /usr/src/app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Copy app
COPY . ./

EXPOSE 3000

ENV PORT=3000

CMD ["node", "server.js"]
