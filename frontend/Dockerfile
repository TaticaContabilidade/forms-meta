# Stage 1: builda o React (Vite) — VITE_API_URL precisa ser passado como
# build arg, não env var comum, porque o Vite "assa" essa variável dentro
# do JS no momento do `npm run build`, não em runtime.
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Stage 2: só os arquivos estáticos gerados, servidos pelo Nginx — a
# imagem final não carrega Node/node_modules, só o build de produção.
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
