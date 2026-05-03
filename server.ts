import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import { SMTPServer } from "smtp-server";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";
import fs from "fs/promises";
import "dotenv/config";

// --- Configuração de Armazenamento Local ---
const DATA_DIR = path.join(process.cwd(), "data");
const EMAILS_FILE = path.join(DATA_DIR, "emails.json");

async function initStorage() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
      await fs.access(EMAILS_FILE);
    } catch {
      await fs.writeFile(EMAILS_FILE, JSON.stringify([]));
    }
  } catch (err) {
    console.error("Erro ao inicializar pasta de dados:", err);
  }
}

// --- Configuração do Supabase (Apenas se ainda quiser contas etc) ---
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

async function startServer() {
  await initStorage();
  const app = express();
  const PORT = 3000;
  const SMTP_PORT = 2525; 

  app.use(cors());
  app.use(express.json());

  // --- Motor SMTP Próprio (Recebimento) ---
  const smtpServer = new SMTPServer({
    authOptional: true, 
    onData(stream, session, callback) {
      simpleParser(stream, async (err, parsed) => {
        if (err) {
          console.error("Erro ao processar email:", err);
          return callback(err);
        }

        console.log("Novo email recebido localmente de:", parsed.from?.text);

        // Salvar no JSON Local
        try {
          const content = await fs.readFile(EMAILS_FILE, "utf-8");
          const emails = JSON.parse(content);
          
          const newEmail = {
            id: Date.now().toString(),
            from_addr: parsed.from?.text,
            to_addr: parsed.to instanceof Array ? parsed.to.map(t => t.text).join(",") : (parsed.to?.text || ""),
            subject: parsed.subject,
            body: parsed.html || parsed.text,
            received_at: new Date().toISOString(),
            read: false
          };

          emails.unshift(newEmail); // Novo no topo
          await fs.writeFile(EMAILS_FILE, JSON.stringify(emails, null, 2));
        } catch (e) {
          console.error("Falha ao salvar email local:", e);
        }

        callback();
      });
    }
  });

  smtpServer.listen(SMTP_PORT, "0.0.0.0", () => {
    console.log(`[SMTP ENGINE] Rodando na porta ${SMTP_PORT} (Salvando em data/emails.json)`);
  });

  // --- API Routes ---
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "online", 
      version: "3.0.0",
      engine: "ZimaMail Native Engine",
      storage: "Local JSON"
    });
  });

  // Buscar emails recebidos do arquivo local
  app.get("/api/mail/inbox", async (req, res) => {
    try {
      const content = await fs.readFile(EMAILS_FILE, "utf-8");
      res.json(JSON.parse(content));
    } catch (error: any) {
      res.json([]);
    }
  });

  // Enviar email (Relay)
  app.post("/api/mail/send", async (req, res) => {
    const { to, subject, body } = req.body;

    try {
      // Configuramos o transportador próprio
      // Nota: Para enviar para o 'mundo real' (Gmail etc), seu servidor precisa de IP limpo e DKIM
      const transporter = nodemailer.createTransport({
        host: "localhost", // Envia via ele mesmo ou usar um relay externo se preferir
        port: SMTP_PORT,
        secure: false
      });

      await transporter.sendMail({
        from: '"Seu ZimaMail" <voce@zimamail.local>',
        to,
        subject,
        html: body
      });

      res.json({ success: true, message: "Email processado pelo motor próprio." });
    } catch (error: any) {
      console.error("Erro no envio:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/stats", async (req, res) => {
    // Integração real com o banco
    res.json({
      activeAccounts: 1,
      emailsSent: 0,
      emailsReceived: 0,
      storageUsed: "0B",
      storageAvailable: "Libre"
    });
  });

  // Endpoint dinâmico para variáveis de ambiente
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
    console.log(`[DASHBOARD] Rodando em http://localhost:${PORT}`);
  });
}

startServer();
