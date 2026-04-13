FROM node:22-alpine

WORKDIR /app

# Install server dependencies
COPY package.json ./
RUN npm install

# Install client dependencies and build
COPY client/package.json ./client/
RUN cd client && npm install

COPY client/ ./client/
RUN cd client && npm run build

# Copy server source
COPY server/ ./server/

EXPOSE 3001

CMD ["node", "server/index.js"]
