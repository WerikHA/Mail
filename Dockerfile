FROM node:20-slim

WORKDIR /app

# Instala as dependências primeiro para aproveitar o cache do Docker
COPY package*.json ./
RUN npm install

# Copia o restante do código
COPY . .

# Faz o build do painel frontend
RUN npm run build

# O servidor Express/Vite vai rodar na porta 3000
EXPOSE 3000

# Define variáveis de ambiente padrão (podem ser sobrescritas no ZimaOS)
ENV NODE_ENV=production

# Comando para iniciar o servidor
CMD ["node", "server.ts"]
