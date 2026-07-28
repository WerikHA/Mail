<div align="center">
  <h1>✉️ Mail — Servidor de Email Marketing</h1>
  <p><b>Plataforma Completa de Email Marketing com SMTP Próprio, Campanhas e Rastreamento</b></p>
  <p>
    <img src="https://img.shields.io/badge/status-active-success.svg" alt="Status Active" />
    <img src="https://img.shields.io/badge/version-0.4.4-blue" alt="Version" />
    <img src="https://img.shields.io/badge/tech-React%2019%20%7C%20Express%20%7C%20Supabase-purple" alt="Tech Stack" />
    <img src="https://img.shields.io/badge/database-LowDB%20%7C%20Supabase-orange" alt="Database" />
    <img src="https://img.shields.io/badge/protocol-SMTP%20%7C%20Nodemailer-brightgreen" alt="Protocols" />
    <img src="https://img.shields.io/badge/license-MIT-green" alt="License" />
  </p>
</div>

---

## 📋 Visão Geral

**Mail** é um servidor de email marketing completo, com motor SMTP próprio, sistema de campanhas, rastreamento de abertura e cliques (tracking pixel), relays SMTP e painel web de gestão. Projetado para operar como infraestrutura central de comunicação por email da Amplifica Group, suportando disparo de campanhas, recebimento e relay de mensagens.

---

## ✨ Funcionalidades

| Funcionalidade | Descrição |
|---------------|-----------|
| 📨 **Motor SMTP Próprio** | Servidor SMTP na porta 2525 para recebimento e relay de emails |
| 📬 **Campanhas de Email Marketing** | Criação, agendamento e disparo de campanhas |
| 👁️ **Rastreamento** | Tracking pixel GIF para abertura e links rastreados para cliques |
| 🔄 **Relays SMTP** | Integração com Brevo, SendGrid e outros provedores com sincronização de quota |
| 🌐 **Painel Web** | Interface React com gestão de contas, domínios e listas de email |
| 🔒 **Integração Cloudflare** | Configuração automatizada de SPF, DKIM e DNS |
| 🗄️ **Supabase** | Banco de dados PostgreSQL para persistência de campanhas |
| 💾 **Persistência Local** | LowDB como fallback de armazenamento local |

---

## 🛠️ Stack Tecnológica

| Categoria | Tecnologia |
|-----------|-----------|
| **Frontend** | React 19, Vite, TypeScript |
| **Build** | Vite 6.x |
| **Backend** | Express, Node.js |
| **Email (entrada)** | SMTP Server (smtp-server) na porta 2525 |
| **Email (saída)** | Nodemailer |
| **Parsing** | mailparser |
| **Banco Primário** | Supabase (PostgreSQL) |
| **Fallback Local** | LowDB (JSON) |
| **DNS** | Cloudflare API |
| **UI** | Tailwind CSS, Motion, Lucide |
| **Gráficos** | Recharts |
| **IA** | Google GenAI (Gemini) |
| **Container** | Docker |

---

## 🗂️ Estrutura do Projeto

```
Mail/
├── src/                    # Código-fonte do frontend React
│   ├── components/         # Componentes reutilizáveis
│   ├── pages/              # Páginas (dashboard, campanhas, relatórios)
│   └── lib/                # Utilitários e helpers
├── server.ts               # Servidor Express + SMTP + API
├── .env.example            # Template de variáveis de ambiente
├── supabase_migration.sql  # Schema do banco Supabase
├── Dockerfile              # Imagem Docker
├── docker-compose.yml      # Orquestração
├── index.html              # Entry point HTML
├── vite.config.ts          # Configuração Vite
└── tsconfig.json           # Configuração TypeScript
```

---

## 🚀 Instalação e Configuração

### Pré-requisitos

- **Node.js** 20+
- **npm** ou pnpm
- **Conta Supabase** (PostgreSQL gerenciado)
- **Conta Cloudflare** (para automação DNS — opcional)
- **Docker** (para deploy containerizado)

### Desenvolvimento Local

```bash
# Clone o repositório
git clone https://github.com/WerikoEntusiasta/Mail.git
cd Mail

# Instale as dependências
npm install

# Configure o ambiente
cp .env.example .env
# Edite o .env com suas credenciais Supabase e configurações SMTP

# Execute a migration Supabase
# Copie o conteúdo de supabase_migration.sql e execute no SQL Editor do Supabase

# Inicie o servidor
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

### Docker

```bash
docker build -t mail-server .
docker run -p 3000:3000 -p 2525:2525 mail-server
```

---

## ⚙️ Variáveis de Ambiente

### Configuração Principal

| Variável | Descrição | Obrigatório |
|----------|-----------|:-----------:|
| `DEFAULT_DOMAIN` | Domínio padrão para envio de emails | ✅ |
| `DELIVERY_MODE` | Modo de entrega (`external` ou `internal`) | ✅ |
| `DATA_DIR` | Diretório para persistência local | ❌ |

### Cloudflare (Automação DNS)

| Variável | Descrição | Obrigatório |
|----------|-----------|:-----------:|
| `CF_TOKEN` | Token de API Cloudflare | ❌ |
| `CF_ZONE` | Zone ID do domínio no Cloudflare | ❌ |

### Relay SMTP

| Variável | Descrição | Obrigatório |
|----------|-----------|:-----------:|
| `SMTP_HOST` | Host do relay SMTP externo | ❌ |
| `SMTP_PORT` | Porta do relay SMTP (padrão: 587) | ❌ |
| `SMTP_USER` | Usuário de autenticação SMTP | ❌ |
| `SMTP_PASS` | Senha de autenticação SMTP | ❌ |

### Supabase

| Variável | Descrição | Obrigatório |
|----------|-----------|:-----------:|
| `SUPABASE_URL` | URL do projeto Supabase | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de serviço Supabase | ✅ |
| `SUPABASE_ANON_KEY` | Chave anônima Supabase | ✅ |
| `VITE_SUPABASE_URL` | URL Supabase para o frontend | ✅ |
| `VITE_SUPABASE_ANON_KEY` | Chave anônima para o frontend | ✅ |

---

## 🔌 Arquitetura SMTP

O servidor opera em **duas camadas**:

1. **Camada de Recebimento (Porta 2525)**: Servidor SMTP próprio que aceita emails recebidos, processa com `mailparser` e armazena no banco
2. **Camada de Envio**: Utiliza Nodemailer para enviar campanhas, podendo usar relay SMTP externo (Brevo, SendGrid) ou servidor próprio

### Tracking

- **Abertura**: Imagem pixel GIF de 1x1 incorporada no HTML do email. Quando carregada, registra abertura
- **Cliques**: Links são reescritos com redirect tracking antes do destino final

---

## 🚢 Deploy

### Docker Compose

```yaml
services:
  mail:
    build: .
    ports:
      - "3000:3000"   # Web UI + API
      - "2525:2525"   # SMTP Server
    volumes:
      - ./data:/app/data
    environment:
      - DEFAULT_DOMAIN=seudominio.com.br
      - SUPABASE_URL=sua_url_supabase
      - SUPABASE_SERVICE_ROLE_KEY=sua_chave
    restart: unless-stopped
```

---

## 📄 Licença

**MIT** © Amplifica Group

---

<div align="center">
  <p>Desenvolvido por <a href="https://github.com/WerikoEntusiasta">WerikOliveira</a> — Amplifica Group</p>
</div>
