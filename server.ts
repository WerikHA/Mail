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
        pass: process.env.SMTP_PASS
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
      const campaign = { 
        id: Date.now().toString(), 
        createdAt: new Date().toISOString(),
        status: 'sending',
        opens: 0,
        clicks: 0,
        ...req.body 
      };
      const content = await fs.readFile(CAMPAIGNS_FILE, "utf-8");
      const campaigns = JSON.parse(content);
      campaigns.push(campaign);
      await fs.writeFile(CAMPAIGNS_FILE, JSON.stringify(campaigns, null, 2));
      await addLog(`Nova campanha iniciada: ${campaign.name}`, "info");
      res.json({ success: true, campaign });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/relays", async (req, res) => {
    try {
      const relay = { id: Date.now().toString(), ...req.body };
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
      const transporter = nodemailer.createTransport({
        host: relay.host,
        port: parseInt(relay.port),
        secure: relay.port == 465,
        auth: { user: relay.user, pass: relay.pass },
        connectionTimeout: 5000
      });
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
    try {
      await addLog(`EMAIL ABERTO: Rastreio #${emailId}`, "track");
      
      // Se for rastreio de campanha (começa com c_)
      if (emailId.startsWith('c_')) {
        const parts = emailId.split('_');
        const campaignId = parts[1];
        
        const content = await fs.readFile(CAMPAIGNS_FILE, "utf-8");
        const campaigns = JSON.parse(content);
        const campaign = campaigns.find((c: any) => c.id === campaignId);
        
        if (campaign) {
          campaign.opens = (campaign.opens || 0) + 1;
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
    if (!url) return res.redirect('/');

    try {
      if (id && typeof id === 'string' && id.startsWith('c_')) {
        const parts = id.split('_');
        const campaignId = parts[1];
        
        const content = await fs.readFile(CAMPAIGNS_FILE, "utf-8");
        const campaigns = JSON.parse(content);
        const campaign = campaigns.find((c: any) => c.id === campaignId);
        
        if (campaign) {
          campaign.clicks = (campaign.clicks || 0) + 1;
          await fs.writeFile(CAMPAIGNS_FILE, JSON.stringify(campaigns, null, 2));
        }
      }
      await addLog(`CLIQUE: ${url} (ID: ${id})`, "track");
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
      const settings = JSON.parse(await fs.readFile(SETTINGS_FILE, "utf-8"));
      const relays = JSON.parse(await fs.readFile(RELAYS_FILE, "utf-8"));
      
      let success = false;
      let lastError = null;
      let usedRelayName = "Nenhum";

      const fromAddr = from || `system@${settings.domain}`;

      if (settings.delivery_mode === "external") {
        const availableRelays = [...relays];
        // Adiciona relay legado se existir e não houver outros
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

        // Tentar cada relay até um funcionar (Failover)
        for (let i = 0; i < availableRelays.length; i++) {
          const relay = availableRelays[i];
          try {
            await addLog(`Tentando relay #${i + 1}: ${relay.name || relay.host}`, "smtp");
            
            // Debug DNS
            try {
              const { family } = await dns.lookup(relay.host);
              await addLog(`DNS OK para ${relay.host} (IPv${family})`, "info");
            } catch (dnsErr: any) {
              await addLog(`DNS FALHA para ${relay.host}: ${dnsErr.message}`, "error");
            }

            const transporter = nodemailer.createTransport({
              host: relay.host,
              port: parseInt(relay.port),
              secure: relay.port == 465,
              auth: { user: relay.user, pass: relay.pass },
              timeout: 10000 // 10 segundos de timeout por relay
            });

            // IDs de rastreio agora podem carregar o campaignId
            const trackingId = campaignId ? `c_${campaignId}_${Date.now()}` : `out_${Date.now()}`;
            const protocol = req.headers['x-forwarded-proto'] || 'http';
            const host = req.get('host');
            
            // Tracking de abertura
            const trackingPixel = `<img src="${protocol}://${host}/api/track/${trackingId}" width="1" height="1" style="display:none" />`;
            
            // Tracking de cliques: Substituir links no HTML
            let trackedBody = body + trackingPixel;
            
            if (body && typeof body === 'string') {
              const linkRegex = /<a\s+(?:[^>]*?\s+)?href="([^"]*)"([^>]*)>/gi;
              trackedBody = body.replace(linkRegex, (match, url, attributes) => {
                if (url.startsWith('mailto:') || url.startsWith('#')) return match;
                const trackingLink = `${protocol}://${host}/api/click?id=${trackingId}&url=${encodeURIComponent(url)}`;
                return `<a href="${trackingLink}"${attributes}>`;
              }) + trackingPixel;
            }

            await transporter.sendMail({
              from: `"ZimaMail" <${fromAddr}>`,
              to, subject, html: trackedBody
            });

            usedRelayName = relay.name || relay.host;
            success = true;
            await addLog(`Email enviado: ${to} (via ${usedRelayName})`, "smtp");
            break; 
          } catch (relayErr: any) {
            lastError = relayErr.message;
            await addLog(`Relay ${relay.name || relay.host} FALHOU: ${relayErr.message}`, "error");
          }
        }
      } else {
        // Modo Entrega Direta (Interno Real) 
        await addLog(`Entrega direta para ${to}`, "info");
        const transporter = nodemailer.createTransport({
          sendmail: true,
          newline: 'unix',
          path: '/usr/sbin/sendmail'
        });

        // IDs de rastreio agora podem carregar o campaignId
        const trackingId = campaignId ? `c_${campaignId}_${Date.now()}` : `out_${Date.now()}`;
        const protocol = req.headers['x-forwarded-proto'] || 'http';
        const host = req.get('host');
        
        // Tracking de abertura
        const trackingPixel = `<img src="${protocol}://${host}/api/track/${trackingId}" width="1" height="1" style="display:none" />`;
        
        // Tracking de cliques: Substituir links no HTML
        let trackedBody = body + trackingPixel;
        if (body && typeof body === 'string') {
          const linkRegex = /<a\s+(?:[^>]*?\s+)?href="([^"]*)"([^>]*)>/gi;
          trackedBody = body.replace(linkRegex, (match, url, attributes) => {
            if (url.startsWith('mailto:') || url.startsWith('#')) return match;
            const trackingLink = `${protocol}://${host}/api/click?id=${trackingId}&url=${encodeURIComponent(url)}`;
            return `<a href="${trackingLink}"${attributes}>`;
          }) + trackingPixel;
        }

        await transporter.sendMail({
          from: `"ZimaMail" <${fromAddr}>`,
          to, subject, html: trackedBody
        });
        success = true;
        usedRelayName = "Motor Interno";
      }

      if (success) {
        res.json({ success: true, relay: usedRelayName });
      } else {
        throw new Error(`Todos os relays falharam. Último erro: ${lastError}`);
      }
    } catch (error: any) {
      await addLog(`FALHA na entrega para ${to}: ${error.message}`, "error");
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
