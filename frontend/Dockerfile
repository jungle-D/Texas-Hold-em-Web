FROM node:22-alpine
WORKDIR /app
COPY package.json tsconfig.base.json ./
COPY shared ./shared
COPY frontend ./frontend
RUN npm install
RUN npm run build -w shared && npm run build -w frontend
EXPOSE 5173
CMD ["npm", "run", "dev", "-w", "frontend"]
