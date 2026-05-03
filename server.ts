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
const ACCOUNTS_FILE = path.join(DATA_DIR, "accounts.json");
const LOGS_FILE = path.join(DATA_DIR, "logs.json");

async function initStorage() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const files = [
      { path: EMAILS_FILE, default: [] },
      { path: ACCOUNTS_FILE, default: [] },
      { path: LOGS_FILE, default: [] }
    ];
    for (const file of files) {
      try {
        await fs.access(file.path);
      } catch {
        await fs.writeFile(file.path, JSON.stringify(file.default));
      }
    }
  } catch (err) {
    console.error("Erro ao inicializar pasta de dados:", err);
  }
}

async function addLog(message: string, type: "info" | "error" | "smtp" = "info") {
  try {
    const content = await fs.readFile(LOGS_FILE, "utf-8");
    const logs = JSON.parse(content);
    logs.unshift({
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      message,
      type
    });
    await fs.writeFile(LOGS_FILE, JSON.stringify(logs.slice(0, 100), null, 2));
  } catch (e) {
    console.error("Falha ao salvar log:", e);
  }
}

// --- Configuração do Supabase (Opcional) ---
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
let supabase: any = null;

if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log("[STORAGE] Supabase conectado (Opcional).");
  } catch (e) {
    console.error("[STORAGE] Erro ao conectar no Supabase:", e);
  }
}

async function startServer() {
  await initStorage();
  await addLog("Servidor iniciado", "info");
  
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
          await addLog(`Erro no processamento de email: ${err.message}`, "error");
          return callback(err);
        }

        const from = parsed.from?.text || "Desconhecido";
        await addLog(`Email recebido de ${from}`, "smtp");

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

          emails.unshift(newEmail);
          await fs.writeFile(EMAILS_FILE, JSON.stringify(emails, null, 2));
        } catch (e) {
          await addLog(`Falha ao salvar email: ${e instanceof Error ? e.message : String(e)}`, "error");
        }

        callback();
      });
    }
  });

  smtpServer.on("error", async (err) => {
    await addLog(`Erro crítico no motor SMTP: ${err.message}`, "error");
    console.error("[SMTP ERROR]", err);
  });

  smtpServer.listen(SMTP_PORT, "0.0.0.0", () => {
    console.log(`[SMTP ENGINE] Rodando na porta ${SMTP_PORT}`);
  });

  // --- API Routes ---
  app.get("/api/health", (req, res) => {
    res.json({ status: "online", version: "3.1.0", engine: "ZimaMail Native" });
  });

  app.get("/api/logs", async (req, res) => {
    try {
      const content = await fs.readFile(LOGS_FILE, "utf-8");
      res.json(JSON.parse(content));
    } catch (e: any) { 
      await addLog(`Erro ao carregar logs: ${e.message}`, "error");
      res.json([]); 
    }
  });

  app.get("/api/accounts", async (req, res) => {
    try {
      const content = await fs.readFile(ACCOUNTS_FILE, "utf-8");
      res.json(JSON.parse(content));
    } catch (e: any) { 
      await addLog(`Erro ao carregar contas: ${e.message}`, "error");
      res.json([]); 
    }
  });

  app.post("/api/accounts", async (req, res) => {
    const { email, password, name } = req.body;
    try {
      const content = await fs.readFile(ACCOUNTS_FILE, "utf-8");
      const accounts = JSON.parse(content);
      const newAccount = { id: Date.now().toString(), email, password, name, created_at: new Date().toISOString() };
      accounts.push(newAccount);
      await fs.writeFile(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
      await addLog(`Nova conta criada: ${email}`, "info");
      res.json({ success: true, account: newAccount });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/mail/inbox", async (req, res) => {
    try {
      const content = await fs.readFile(EMAILS_FILE, "utf-8");
      res.json(JSON.parse(content));
    } catch (e: any) { 
      await addLog(`Erro ao carregar inbox: ${e.message}`, "error");
      res.json([]); 
    }
  });

  app.post("/api/mail/send", async (req, res) => {
    const { to, subject, body } = req.body;
    try {
      const transporter = nodemailer.createTransport({
        host: "localhost",
        port: SMTP_PORT,
        secure: false
      });
      await transporter.sendMail({
        from: '"ZimaMail" <system@zimamail.local>',
        to, subject, html: body
      });
      await addLog(`Email enviado para ${to}`, "smtp");
      res.json({ success: true });
    } catch (error: any) {
      await addLog(`Falha no envio para ${to}: ${error.message}`, "error");
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/stats", async (req, res) => {
    try {
      const emails = JSON.parse(await fs.readFile(EMAILS_FILE, "utf-8"));
      const accounts = JSON.parse(await fs.readFile(ACCOUNTS_FILE, "utf-8"));
      res.json({
        activeAccounts: accounts.length,
        emailsReceived: emails.length,
        storageUsed: "Local",
        status: "Online"
      });
    } catch (e: any) { 
      await addLog(`Erro ao carregar estatísticas: ${e.message}`, "error");
      res.json({}); 
    }
  });

  app.get("/env.js", (req, res) => {
    const config = {
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "",
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ""
    };
    res.type("application/javascript");
    res.send(`window.ZIMA_ENV = ${JSON.stringify(config)};`);
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  // Global Error Handler
  app.use(async (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    await addLog(`Erro na API (${req.method} ${req.path}): ${err.message}`, "error");
    console.error("[API ERROR]", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[DASHBOARD] Rodando em http://localhost:${PORT}`);
  });
}

startServer();
