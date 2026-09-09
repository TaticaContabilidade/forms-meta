FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

# --watch (nativo do Node, sem depender de nodemon) reinicia o processo
# sozinho quando um arquivo importado muda — pensado pra rodar com o
# código montado por bind mount (ver docker-compose.yml), não pra imagem
# de produção (o Render não usa este Dockerfile, roda `npm start` direto).
CMD ["node", "--watch", "src/server.js"]
