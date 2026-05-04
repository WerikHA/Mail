FROM node:22-slim

WORKDIR /app

# Instala as dependências primeiro para aproveitar o cache do Docker
COPY package*.json ./
RUN npm install

# Copia o restante do código
COPY . .

# Faz o build do painel frontend
RUN npm run build

# O servidor Express vai rodar na porta 3000, o SMTP na porta 2525
EXPOSE 3000
EXPOSE 2525
EXPOSE 587
EXPOSE 465

# Define variáveis de ambiente padrão (podem ser sobrescritas no ZimaOS)
ENV NODE_ENV=production

# Comando para iniciar o servidor usando tsx para suportar TypeScript
CMD ["npx", "tsx", "server.ts"]
