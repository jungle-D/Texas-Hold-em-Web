FROM node:22-alpine
WORKDIR /app
COPY package.json tsconfig.base.json ./
COPY shared ./shared
COPY server ./server
RUN npm install
RUN npm run build -w shared && npm run build -w server
EXPOSE 3001
CMD ["node", "server/dist/index.js"]
