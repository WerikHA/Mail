import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import { SMTPServer } from "smtp-server";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";
import fs from "fs/promises";
import dns from "dns/promises";
import "dotenv/config";

// --- Configuração de Armazenamento Local ---
const DATA_DIR = path.join(process.cwd(), "data");
const EMAILS_FILE = path.join(DATA_DIR, "emails.json");
const ACCOUNTS_FILE = path.join(DATA_DIR, "accounts.json");
const LOGS_FILE = path.join(DATA_DIR, "logs.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const DOMAINS_FILE = path.join(DATA_DIR, "domains.json");
const RELAYS_FILE = path.join(DATA_DIR, "relays.json");
const CAMPAIGNS_FILE = path.join(DATA_DIR, "campaigns.json");

async function initStorage() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const files = [
      { path: EMAILS_FILE, default: [] },
      { path: ACCOUNTS_FILE, default: [] },
      { path: LOGS_FILE, default: [] },
      { path: SETTINGS_FILE, default: { 
        smtp_host: process.env.SMTP_HOST || "", 
        smtp_port: parseInt(process.env.SMTP_PORT || "587"), 
        smtp_user: process.env.SMTP_USER || "", 
        smtp_pass: process.env.SMTP_PASS || "", 
        domain: process.env.DEFAULT_DOMAIN || "amplifamarketing.com.br",
        delivery_mode: process.env.DELIVERY_MODE || "internal",
        cf_token: process.env.CF_TOKEN || "",
        cf_zone: process.env.CF_ZONE || ""
      } },
      { path: DOMAINS_FILE, default: [process.env.DEFAULT_DOMAIN || "amplifamarketing.com.br"] },
      { path: RELAYS_FILE, default: process.env.SMTP_HOST ? [{
        id: "default",
        name: "Relay de Ambiente",
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || "587",
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
        quota: 1500,
        sent: 0
      }] : [] },
      { path: CAMPAIGNS_FILE, default: [] }
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

async function addLog(message: string, type: "info" | "error" | "smtp" | "track" = "info", metadata: any = {}) {
  try {
    const content = await fs.readFile(LOGS_FILE, "utf-8");
    const logs = JSON.parse(content);
    logs.unshift({
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      message,
      type,
      ...metadata
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

async function relayEmail(to: string, subject: string, body: string, from?: string, campaignId?: string, trackInfo: any = {}, personalization: any = {}) {
  const settings = JSON.parse(await fs.readFile(SETTINGS_FILE, "utf-8"));
  const relays = JSON.parse(await fs.readFile(RELAYS_FILE, "utf-8"));
  
  let success = false;
  let lastError = null;
  let usedRelayName = "Nenhum";

  const fromAddr = from || `system@${settings.domain}`;

  // Process personalization in subject and body
  let personalizedSubject = subject;
  let personalizedBody = body;
  
  const vars = {
    email: to,
    name: personalization.name || to.split('@')[0],
    date: new Date().toLocaleDateString(),
    ...personalization
  };

  Object.entries(vars).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    personalizedSubject = personalizedSubject.replace(regex, String(value));
    personalizedBody = personalizedBody.replace(regex, String(value));
  });

  if (settings.delivery_mode === "external") {
    const availableRelays = [...relays];
    if (availableRelays.length === 0 && settings.smtp_host) {
      availableRelays.push({
        name: "Relay Padrão",
        host: settings.smtp_host,
        port: settings.smtp_port,
        user: settings.smtp_user,
        pass: settings.smtp_pass
      });
    }

    if (availableRelays.length === 0) {
      throw new Error("Nenhum Relay SMTP configurado no modo Externo.");
    }

    for (let i = 0; i < availableRelays.length; i++) {
      const relay = availableRelays[i];
      
      // Check quota
      if (relay.quota && relay.sent >= relay.quota) {
        await addLog(`Relay ${relay.name || relay.host} ignorado: Quota excedida (${relay.sent}/${relay.quota})`, "info");
        continue;
      }

      const sanitizedHost = (relay.host || "").replace(/[^a-zA-Z0-9.-]/g, "").toLowerCase();
      
      try {
        const transporterOptions: any = {
          host: sanitizedHost,
          port: parseInt(relay.port),
          secure: relay.port == 465,
          auth: { user: (relay.user || "").trim(), pass: (relay.pass || "").trim() },
          timeout: 15000,
          connectionTimeout: 10000,
          lookup: (hostname: any, options: any, callback: any) => {
            dns.lookup(hostname, options)
              .then((res: any) => callback(null, res.address, res.family))
              .catch((err: any) => {
                dns.resolve4(hostname).then((ips: any) => callback(null, ips[0], 4)).catch(() => callback(err));
              });
          }
        };

        const transporter = nodemailer.createTransport(transporterOptions);
        
        // Tracking ID com individualização (recipient em base64 safe)
        const recipientB64 = Buffer.from(to).toString('base64').replace(/=/g, '');
        const trackingId = campaignId ? `c_${campaignId}_${recipientB64}_${Date.now()}` : `out_${recipientB64}_${Date.now()}`;
        
        // Usar baseUrl dos metadados se fornecido (via HTTP request), senão fallback
        const protocol = trackInfo.protocol || "https";
        const host = trackInfo.host || settings.domain;
        const baseUrl = `${protocol}://${host}`;
        
        const trackingPixel = `<img src="${baseUrl}/api/track/${trackingId}" width="1" height="1" style="display:none !important;visibility:hidden;opacity:0;" />`;
        
        let trackedBody = body;
        if (body && typeof body === 'string') {
          const linkRegex = /<a\s+(?:[^>]*?\s+)?href="([^"]*)"([^>]*)>/gi;
          trackedBody = body.replace(linkRegex, (match, url, attributes) => {
            if (!url || url.startsWith('mailto:') || url.startsWith('#') || url.startsWith('tel:')) return match;
            const trackingLink = `${baseUrl}/api/click?id=${trackingId}&url=${encodeURIComponent(url)}`;
            return `<a href="${trackingLink}"${attributes}>`;
          });
        }
        
        if (trackedBody.includes('</body>')) {
          trackedBody = trackedBody.replace('</body>', `${trackingPixel}</body>`);
        } else {
          trackedBody = trackedBody + trackingPixel;
        }

        const info = await transporter.sendMail({
          from: `"ZimaMail" <${fromAddr}>`,
          to, 
          subject: personalizedSubject, 
          html: trackedBody
        });

        usedRelayName = relay.name || relay.host;
        success = true;
        
        // Update quota usage
        try {
          const currentRelays = JSON.parse(await fs.readFile(RELAYS_FILE, "utf-8"));
          const relayIdx = currentRelays.findIndex((r: any) => r.id === relay.id);
          if (relayIdx !== -1) {
            currentRelays[relayIdx].sent = (currentRelays[relayIdx].sent || 0) + 1;
            await fs.writeFile(RELAYS_FILE, JSON.stringify(currentRelays, null, 2));
          }
        } catch (err) {
          console.error("Erro ao atualizar quota do relay:", err);
        }

        await addLog(`Email ENVIADO: ${to} (via ${usedRelayName}) | De: ${fromAddr} | MsgID: ${info.messageId}`, "smtp");
        break; 
      } catch (relayErr: any) {
        lastError = relayErr.message;
        await addLog(`Relay ${relay.name || relay.host} FALHOU: ${relayErr.message}`, "error");
      }
    }
  } else {
    // Modo Direto
    const transporter = nodemailer.createTransport({ sendmail: true, newline: 'unix', path: '/usr/sbin/sendmail' });
    const info = await transporter.sendMail({ from: `"ZimaMail" <${fromAddr}>`, to, subject: personalizedSubject, html: personalizedBody });
    success = true;
    usedRelayName = "Motor Interno";
    await addLog(`Email ENVIADO (Direto): ${to} | MsgID: ${info.messageId}`, "smtp");
  }

  if (!success) throw new Error(`Falha no envio. Último erro: ${lastError}`);
  return { success: true, relay: usedRelayName };
}

async function startServer() {
  await initStorage();
  await addLog("Servidor iniciado", "info");
  
  const app = express();
  const PORT = 3000;
  const SMTP_PORT = 2525; 

  app.use(cors());
  app.use(express.json());

  // --- Motor SMTP Próprio (Recebimento & Relay) ---
  const smtpServer = new SMTPServer({
    authOptional: true,
    async onAuth(auth, session, callback) {
      try {
        const content = await fs.readFile(ACCOUNTS_FILE, "utf-8");
        const accounts = JSON.parse(content);
        const account = accounts.find((a: any) => a.email === auth.username && a.password === auth.password);
        if (account) {
          return callback(null, { user: account });
        }
        return callback(new Error("Usuário ou senha SMPT inválidos"));
      } catch (e) {
        return callback(new Error("Erro interno de autenticação"));
      }
    },
    onData(stream, session, callback) {
      simpleParser(stream, async (err, parsed) => {
        if (err) return callback(err);

        // Se autenticado, atua como RELAY GATEWAY
        if (session.user) {
          try {
            const to = parsed.to instanceof Array ? parsed.to.map(t => t.text).join(",") : (parsed.to?.text || "");
            const from = parsed.from?.text;
            await relayEmail(to, parsed.subject || "(Sem Assunto)", parsed.html || parsed.text || "", from);
            await addLog(`Gateway Relay: Email encaminhado por ${(session.user as any).email} para ${to}`, "smtp");
            return callback();
          } catch (relayErr: any) {
            await addLog(`Gateway Relay Erro: ${relayErr.message}`, "error");
            return callback(new Error(`Falha no encaminhamento: ${relayErr.message}`));
          }
        }

        // Se não autenticado, salva no INBOX (Recebimento padrão)
        const from = parsed.from?.text || "Desconhecido";
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
          await addLog(`Entrada: Email recebido de ${from}`, "smtp");
        } catch (e) {
          await addLog(`Erro ao salvar entrada: ${e instanceof Error ? e.message : String(e)}`, "error");
        }
        callback();
      });
    }
  });

  smtpServer.on("error", (err) => console.error("[SMTP ERROR]", err));
  smtpServer.listen(SMTP_PORT, "0.0.0.0", () => console.log(`[SMTP GATEWAY] Rodando na porta ${SMTP_PORT}`));

  // --- API Routes ---
  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    try {
      // Admin Mestre (Hardcoded para emergência/configuração inicial)
      if (email === "admin@zimamail.com" && password === "admin123") {
        return res.json({ success: true, user: { name: "Administrador Mestre", email: "admin@zimamail.com", role: "admin" } });
      }

      const content = await fs.readFile(ACCOUNTS_FILE, "utf-8");
      const accounts = JSON.parse(content);
      const account = accounts.find((a: any) => a.email === email && a.password === password);
      
      if (account) {
        res.json({ success: true, user: account });
      } else {
        res.status(401).json({ success: false, message: "Email ou senha inválidos" });
      }
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

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

  app.put("/api/accounts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { email, password, name } = req.body;
      const content = await fs.readFile(ACCOUNTS_FILE, "utf-8");
      let accounts = JSON.parse(content);
      const idx = accounts.findIndex((a: any) => a.id === id);
      
      if (idx !== -1) {
        accounts[idx] = { ...accounts[idx], email, password, name };
        await fs.writeFile(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
        await addLog(`Conta atualizada: ${email}`, "info");
        res.json({ success: true, account: accounts[idx] });
      } else {
        res.status(404).json({ success: false, message: "Conta não encontrada" });
      }
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.delete("/api/accounts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const content = await fs.readFile(ACCOUNTS_FILE, "utf-8");
      let accounts = JSON.parse(content);
      accounts = accounts.filter((a: any) => a.id !== id);
      await fs.writeFile(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/settings", async (req, res) => {
    try {
      const content = await fs.readFile(SETTINGS_FILE, "utf-8");
      res.json(JSON.parse(content));
    } catch (e) { res.json({}); }
  });

  app.post("/api/settings", async (req, res) => {
    try {
      await fs.writeFile(SETTINGS_FILE, JSON.stringify(req.body, null, 2));
      await addLog("Configurações atualizadas", "info");
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/domains", async (req, res) => {
    try {
      const content = await fs.readFile(DOMAINS_FILE, "utf-8");
      res.json(JSON.parse(content));
    } catch (e) { res.json([]); }
  });

  app.get("/api/relays", async (req, res) => {
    try {
      const content = await fs.readFile(RELAYS_FILE, "utf-8");
      res.json(JSON.parse(content));
    } catch (e) { res.json([]); }
  });

  app.get("/api/campaigns", async (req, res) => {
    try {
      const content = await fs.readFile(CAMPAIGNS_FILE, "utf-8");
      res.json(JSON.parse(content));
    } catch (e) { res.json([]); }
  });

  app.post("/api/campaigns", async (req, res) => {
    try {
      const { name, subject, body, from, recipients, delay } = req.body; // recipients: Array<{email, name}>, delay: ms
      
      const campaign = { 
        id: Date.now().toString(), 
        name,
        subject,
        body,
        from,
        delay: delay || 500,
        createdAt: new Date().toISOString(),
        status: 'sending',
        stats: {
          total: recipients.length,
          sent: 0,
          failed: 0,
          opens: 0,
          clicks: 0
        },
        recipients: recipients.map((r: any) => ({ ...r, status: 'pending' }))
      };

      const content = await fs.readFile(CAMPAIGNS_FILE, "utf-8");
      const campaigns = JSON.parse(content);
      campaigns.unshift(campaign);
      await fs.writeFile(CAMPAIGNS_FILE, JSON.stringify(campaigns, null, 2));
      
      // Envio em Background
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.headers['x-forwarded-host'] || req.get('host');

      (async () => {
        for (let i = 0; i < campaign.recipients.length; i++) {
          const recipient = campaign.recipients[i];
          try {
            await relayEmail(
              recipient.email, 
              subject, 
              body, 
              from, 
              campaign.id, 
              { protocol, host }, 
              { name: recipient.name }
            );
            recipient.status = 'sent';
            campaign.stats.sent++;
          } catch (err: any) {
            recipient.status = 'failed';
            recipient.error = err.message;
            campaign.stats.failed++;
          }
          
          // Atualiza arquivo a cada 5 envios ou no final
          if (i % 5 === 0 || i === campaign.recipients.length - 1) {
            const currentContent = await fs.readFile(CAMPAIGNS_FILE, "utf-8");
            const currentCampaigns = JSON.parse(currentContent);
            const idx = currentCampaigns.findIndex((c: any) => c.id === campaign.id);
            if (idx !== -1) {
              currentCampaigns[idx] = { ...campaign, status: i === campaign.recipients.length - 1 ? 'completed' : 'sending' };
              await fs.writeFile(CAMPAIGNS_FILE, JSON.stringify(currentCampaigns, null, 2));
            }
          }
          await new Promise(r => setTimeout(r, campaign.delay));
        }
      })();

      res.json({ success: true, campaign });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.delete("/api/campaigns/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const content = await fs.readFile(CAMPAIGNS_FILE, "utf-8");
      let campaigns = JSON.parse(content);
      campaigns = campaigns.filter((c: any) => c.id !== id);
      await fs.writeFile(CAMPAIGNS_FILE, JSON.stringify(campaigns, null, 2));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/relays", async (req, res) => {
    try {
      const relay = { 
        id: Date.now().toString(), 
        quota: 1000,
        sent: 0,
        apiKey: req.body.apiKey || '',
        ...req.body 
      };
      const content = await fs.readFile(RELAYS_FILE, "utf-8");
      const relays = JSON.parse(content);
      relays.push(relay);
      await fs.writeFile(RELAYS_FILE, JSON.stringify(relays, null, 2));
      await addLog(`Novo Relay configurado: ${relay.name}`, "info");
      res.json({ success: true, relays });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/relays/:id/sync", async (req, res) => {
    const { id } = req.params;
    try {
      const content = await fs.readFile(RELAYS_FILE, "utf-8");
      const relays = JSON.parse(content);
      const idx = relays.findIndex((r: any) => r.id === id);
      
      if (idx === -1) return res.status(404).json({ error: "Relay não encontrado" });
      const relay = relays[idx];

      if (!relay.apiKey) return res.status(400).json({ error: "API Key não configurada para este relay." });

      const name = (relay.name || "").toLowerCase();
      const host = (relay.host || "").toLowerCase();

      // BREVO
      if (host.includes('brevo') || name.includes('brevo') || host.includes('sendinblue')) {
        const response = await fetch('https://api.brevo.com/v3/account', {
          headers: { 'api-key': relay.apiKey }
        });
        
        if (response.ok) {
          const data: any = await response.json();
          const emailPlan = data.plan?.find((p: any) => p.type === 'email');
          if (emailPlan) {
            relays[idx].quota = emailPlan.credits;
            await fs.writeFile(RELAYS_FILE, JSON.stringify(relays, null, 2));
            await addLog(`Quota sync (Brevo) completa: ${emailPlan.credits} créditos`, "info");
            return res.json({ success: true, quota: emailPlan.credits, relays });
          }
        }
      }

      // SENDGRID
      if (host.includes('sendgrid') || name.includes('sendgrid')) {
        const response = await fetch('https://api.sendgrid.com/v3/user/credits', {
          headers: { 'Authorization': `Bearer ${relay.apiKey}` }
        });

        if (response.ok) {
          const data: any = await response.json();
          // SendGrid retorna { remain: 100, total: 1000, overage: 0, next_reset: ... }
          const total = data.total || 0;
          relays[idx].quota = total;
          // Opcional: ajustar o 'sent' baseado no que já foi usado (total - remain)
          // relays[idx].sent = (data.total - data.remain) || 0; 
          await fs.writeFile(RELAYS_FILE, JSON.stringify(relays, null, 2));
          await addLog(`Quota sync (SendGrid) completa: ${total} créditos`, "info");
          return res.json({ success: true, quota: total, relays });
        }
      }

      res.status(400).json({ error: "Provedor não reconhecido ou cota não disponível via API padrão." });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.put("/api/relays/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updatedRelay = req.body;
      const content = await fs.readFile(RELAYS_FILE, "utf-8");
      let relays = JSON.parse(content);
      relays = relays.map((r: any) => r.id === id ? { ...r, ...updatedRelay, id } : r);
      await fs.writeFile(RELAYS_FILE, JSON.stringify(relays, null, 2));
      await addLog(`Relay atualizado: ${updatedRelay.name || id}`, "info");
      res.json({ success: true, relays });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/relays/reorder", async (req, res) => {
    try {
      const { relays } = req.body;
      await fs.writeFile(RELAYS_FILE, JSON.stringify(relays, null, 2));
      await addLog(`Ordem dos relays atualizada`, "info");
      res.json({ success: true, relays });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.delete("/api/relays/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const content = await fs.readFile(RELAYS_FILE, "utf-8");
      let relays = JSON.parse(content);
      relays = relays.filter((r: any) => r.id !== id);
      await fs.writeFile(RELAYS_FILE, JSON.stringify(relays, null, 2));
      res.json({ success: true, relays });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/cloudflare/sync", async (req, res) => {
    try {
      const settings = JSON.parse(await fs.readFile(SETTINGS_FILE, "utf-8"));
      const relays = JSON.parse(await fs.readFile(RELAYS_FILE, "utf-8"));
      
      if (!settings.cf_token || !settings.cf_zone) {
        return res.status(400).json({ success: false, message: "API Token ou Zone ID ausentes." });
      }

      // Tentar obter o IP público automaticamente se não estiver no ENV
      let publicIp = process.env.SERVER_IP;
      if (!publicIp || publicIp === '127.0.0.1') {
        try {
          const ipRes = await fetch('https://api.ipify.org?format=json');
          const ipData: any = await ipRes.json();
          publicIp = ipData.ip;
          await addLog(`IP Público detectado automaticamente: ${publicIp}`, "info");
        } catch (e) {
          publicIp = '127.0.0.1';
          await addLog("Não foi possível detectar IP público, usando fallback.", "error");
        }
      }

      const headers = {
        'Authorization': `Bearer ${settings.cf_token}`,
        'Content-Type': 'application/json'
      };

      // 1. Gerar SPF Combinado
      const spfContent = `v=spf1 ip4:${publicIp} ${relays.map((r:any) => `include:${r.host.split('.').slice(-2).join('.')}`).join(' ')} ~all`;
      
      // 2. Buscar registros existentes
      const getRecords = await fetch(`https://api.cloudflare.com/client/v4/zones/${settings.cf_zone}/dns_records`, { headers });
      const recordsData: any = await getRecords.json();
      
      if (!recordsData.success) throw new Error("Erro ao acessar API do Cloudflare.");

      const results = [];

      const upsertRecord = async (type: string, name: string, content: string, proxied = false) => {
        const existing = recordsData.result.find((r: any) => r.type === type && (r.name === name || r.name === `${name}.${settings.domain}`));
        const url = existing 
          ? `https://api.cloudflare.com/client/v4/zones/${settings.cf_zone}/dns_records/${existing.id}`
          : `https://api.cloudflare.com/client/v4/zones/${settings.cf_zone}/dns_records`;
        
        const res = await fetch(url, {
          method: existing ? 'PUT' : 'POST',
          headers,
          body: JSON.stringify({
            type,
            name,
            content,
            ttl: 1,
            proxied
          })
        });
        const data:any = await res.json();
        if (!data.success) {
          await addLog(`Erro ao sincronizar ${type} ${name}: ${JSON.stringify(data.errors)}`, "error");
        }
        return { type, name, status: existing ? 'updated' : 'created', success: data.success };
      };

      // Sync A Record (Apontamento principal)
      if (publicIp !== '127.0.0.1') {
        results.push(await upsertRecord('A', '@', publicIp));
      }

      // Sync SPF
      results.push(await upsertRecord('TXT', '@', spfContent));

      // Sync DKIMs dos Relays
      for (const relay of relays) {
        const selector = relay.name.toLowerCase().replace(/\s/g, '');
        results.push(await upsertRecord('TXT', `${selector}._domainkey`, 'v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADC...'));
      }

      await addLog(`DNS Sincronizado via Cloudflare: ${results.length} registros processados (IP: ${publicIp}).`, "info");
      res.json({ success: true, results, publicIp });
    } catch (error: any) {
      await addLog(`Erro na sincronização Cloudflare: ${error.message}`, "error");
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/relays/test", async (req, res) => {
    const relay = req.body;
    try {
      await addLog(`Testando conexão com relay: ${relay.name || relay.host}`, "info");
      const transporterOptions: any = {
        host: relay.host,
        port: parseInt(relay.port),
        secure: relay.port == 465,
        auth: { user: relay.user, pass: relay.pass },
        connectionTimeout: 5000,
        lookup: (hostname: any, options: any, callback: any) => {
          dns.lookup(hostname, options)
            .then((res: any) => callback(null, res.address, res.family))
            .catch((err: any) => {
              dns.resolve4(hostname)
                .then((ips: any) => callback(null, ips[0], 4))
                .catch(() => callback(err));
            });
        }
      };
      const transporter = nodemailer.createTransport(transporterOptions);
      await transporter.verify();
      res.json({ success: true });
    } catch (error: any) {
      res.json({ success: false, message: error.message });
    }
  });

  app.post("/api/domains", async (req, res) => {
    try {
      const { domain } = req.body;
      const content = await fs.readFile(DOMAINS_FILE, "utf-8");
      const domains = JSON.parse(content);
      if (!domains.includes(domain)) {
        domains.push(domain);
        await fs.writeFile(DOMAINS_FILE, JSON.stringify(domains, null, 2));
        await addLog(`Novo domínio gerenciado: ${domain}`, "info");
      }
      res.json({ success: true, domains });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.delete("/api/domains/:domain", async (req, res) => {
    try {
      const { domain } = req.params;
      const content = await fs.readFile(DOMAINS_FILE, "utf-8");
      let domains = JSON.parse(content);
      domains = domains.filter((d: string) => d !== domain);
      await fs.writeFile(DOMAINS_FILE, JSON.stringify(domains, null, 2));
      await addLog(`Domínio removido: ${domain}`, "info");
      res.json({ success: true, domains });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/track/:emailId", async (req, res) => {
    const { emailId } = req.params;
    const userAgent = req.headers['user-agent'] || 'Desconhecido';
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '0.0.0.0';

    try {
      const parts = emailId.split('_');
      let recipient = "Desconhecido";
      
      if (parts.length >= 3) {
        try {
          const b64 = parts[parts.length - 2];
          recipient = Buffer.from(b64, 'base64').toString('utf-8');
        } catch (e) {}
      }

      await addLog(`EMAIL ABERTO: ${recipient} (Rastreio: ${emailId})`, "track", { opened: true, trackerId: emailId, recipient, ip, ua: userAgent });
      
      if (emailId.startsWith('c_')) {
        const campaignId = parts[1];
        
        const content = await fs.readFile(CAMPAIGNS_FILE, "utf-8");
        let campaigns = JSON.parse(content);
        const campaign = campaigns.find((c: any) => c.id === campaignId);
        
        if (campaign) {
          if (!campaign.stats) campaign.stats = { total: 0, sent: 0, failed: 0, opens: 0, clicks: 0 };
          campaign.stats.opens = (campaign.stats.opens || 0) + 1;
          
          if (!campaign.events) campaign.events = [];
          campaign.events.unshift({
            type: 'open',
            recipient,
            at: new Date().toISOString(),
            ip,
            ua: userAgent
          });

          await fs.writeFile(CAMPAIGNS_FILE, JSON.stringify(campaigns, null, 2));
        }
      }

      // Retornar um GIF transparente de 1x1 pixel
      const pixel = Buffer.from(
        "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
        "base64"
      );
      res.writeHead(200, {
        "Content-Type": "image/gif",
        "Content-Length": pixel.length,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      });
      res.end(pixel);
    } catch (e) {
      res.status(500).end();
    }
  });

  app.get("/api/click", async (req, res) => {
    const { url, id } = req.query;
    const userAgent = req.headers['user-agent'] || 'Desconhecido';
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '0.0.0.0';

    if (!url) return res.redirect('/');

    try {
      const idStr = id ? id.toString() : '';
      const parts = idStr.split('_');
      let recipient = "Desconhecido";
      
      if (parts.length >= 3) {
        try {
          const b64 = parts[parts.length - 2];
          recipient = Buffer.from(b64, 'base64').toString('utf-8');
        } catch (e) {}
      }

      if (idStr.startsWith('c_')) {
        const campaignId = parts[1];
        
        const content = await fs.readFile(CAMPAIGNS_FILE, "utf-8");
        let campaigns = JSON.parse(content);
        const campaign = campaigns.find((c: any) => c.id === campaignId);
        
        if (campaign) {
          if (!campaign.stats) campaign.stats = { total: 0, sent: 0, failed: 0, opens: 0, clicks: 0 };
          campaign.stats.clicks = (campaign.stats.clicks || 0) + 1;

          if (!campaign.events) campaign.events = [];
          campaign.events.unshift({
            type: 'click',
            recipient,
            url,
            at: new Date().toISOString(),
            ip,
            ua: userAgent
          });

          await fs.writeFile(CAMPAIGNS_FILE, JSON.stringify(campaigns, null, 2));
        }
      }
      await addLog(`CLIQUE: ${recipient} clicou em ${url}`, "track", { clicked: true, url, trackerId: id, recipient, ip, ua: userAgent });
    } catch (e) {
      console.error('Erro no rastreio de clique:', e);
    }

    res.redirect(url as string);
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
    const { to, subject, body, from, campaignId } = req.body;
    try {
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.headers['x-forwarded-host'] || req.get('host');
      
      const result = await relayEmail(to, subject, body, from, campaignId, { protocol, host });
      res.json(result);
    } catch (error: any) {
      await addLog(`FALHA na entrega via API para ${to}: ${error.message}`, "error");
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
