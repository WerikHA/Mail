import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "online", 
      version: "1.0.0",
      system: "ZimaMail Provider"
    });
  });

  // Mock endpoint for email stats
  app.get("/api/stats", (req, res) => {
    res.json({
      activeAccounts: 12,
      emailsSent: 450,
      emailsReceived: 890,
      storageUsed: "1.2GB",
      storageAvailable: "50GB"
    });
  });

  // Endpoint para enviar email
  app.post("/api/mail/send", (req, res) => {
    const { to, subject, body } = req.body;
    // Aqui conectaria via SMTP ao container 'zimamail-server' na porta 25/587
    console.log(`Simulando envio de email para: ${to}`);
    res.json({ success: true, message: "Email enviado para fila de saída." });
  });

  // Proxy para o Stalwart Management API
  app.get("/api/mail/inbox", (req, res) => {
    // Mock de dados que viriam do Stalwart JMAP/IMAP
    res.json([
      { id: '1', from: 'Suporte ZimaOS', subject: 'Boas-vindas', date: new Date().toISOString() }
    ]);
  });

  // Endpoint dinâmico para variáveis de ambiente (ZimaOS Runtime)
  app.get("/env.js", (req, res) => {
    const config = {
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "",
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ""
    };
    res.type("application/javascript");
    res.send(`window.ZIMA_ENV = ${JSON.stringify(config)};`);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ZimaMail Dashboard running at http://localhost:${PORT}`);
  });
}

startServer();
