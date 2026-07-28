<div align="center">
  <h1>✉️ Mail — Servidor de Email Marketing</h1>
  <p><b>Plataforma completa de email marketing com SMTP próprio, campanhas e rastreamento</b></p>
  <p>
    <img src="https://img.shields.io/badge/status-active-success.svg" alt="Status: Active" />
    <img src="https://img.shields.io/badge/tech-React%20%7C%20Express%20%7C%20Supabase-blue" alt="Tech Stack" />
    <img src="https://img.shields.io/badge/license-MIT-green" alt="License" />
  </p>
</div>

---

## 📋 Visão Geral

**Mail** é um servidor de email marketing completo, com motor SMTP próprio, sistema de campanhas, rastreamento de abertura e cliques (tracking pixel), relays SMTP e painel web de gestão.

## ✨ Funcionalidades

- 📨 **Motor SMTP Próprio**: Servidor SMTP na porta 2525 para recebimento e relay de emails
- 📬 **Campanhas de Email Marketing**: Criação, agendamento e disparo de campanhas
- 👁️ **Rastreamento**: Tracking pixel GIF para abertura e links rastreados para cliques
- 🔄 **Relays SMTP**: Integração com Brevo, SendGrid e outros provedores com sincronização de quota
- 🌐 **Painel Web**: Interface React com gestão de contas, domínios, listas de email
- 🔒 **Integração Cloudflare**: Configuração automatizada de SPF, DKIM e DNS
- 🗄️ **Supabase**: Banco de dados PostgreSQL gerenciado

## 🛠️ Stack Tecnológica

| Categoria | Tecnologia |
|-----------|------------|
| Frontend | React, Vite, TypeScript |
| Backend | Express, Node.js |
| Email | SMTP (porta 2525), Nodemailer |
| Banco | Supabase (PostgreSQL) |
| DNS | Cloudflare API |
| Container | Docker |

## 🚀 Instalação

### Pré-requisitos

- Node.js 20+
- Docker (opcional)
- Conta Supabase
- Conta Cloudflare (para DNS)

### Local

```bash
npm install
cp .env.example .env
# Configure suas variáveis de ambiente
npm run dev
```

### Docker

```bash
docker build -t mail-server .
docker run -p 3000:3000 -p 2525:2525 mail-server
```

## 📄 Licença

MIT © Amplifica Group
