import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import { SMTPServer } from "smtp-server";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";
import dns from "dns/promises";
import dnsRaw from "dns";
import fetch from "node-fetch";
import "dotenv/config";

// --- Configuração Global de DNS ---
// Força preferência por IPv4 e define servidores DNS confiáveis caso o resolver do sistema falhe
if (dnsRaw.setDefaultResultOrder) {
  dnsRaw.setDefaultResultOrder('ipv4first');
}

// Tenta configurar servidores DNS externos se houver erro de resolução
try {
  dnsRaw.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
  console.log("[DNS] Servidores DNS configurados para Google/Cloudflare.");
} catch (e) {
  console.warn("[DNS] Não foi possível definir servidores DNS customizados:", e);
}

// --- Configuração do Supabase ---
let supabaseUrl = (process.env.SUPABASE_URL || "").trim();
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

// Limpeza de URL e garantia de protocolo
if (supabaseUrl) {
  // Remove espaços, aspas ou barras finais acidentais
  supabaseUrl = supabaseUrl.replace(/['"]+/g, '').trim().replace(/\/$/, '');
  if (!supabaseUrl.startsWith("http")) {
    supabaseUrl = `https://${supabaseUrl}`;
  }
}

console.log(`[STORAGE] URL: "${supabaseUrl}" (Length: ${supabaseUrl.length})`);

if (!supabaseUrl || !supabaseKey) {
  console.error("ERRO CRÍTICO: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.");
  process.exit(1);
}

console.log(`[STORAGE] Tentando conectar ao Supabase em: ${supabaseUrl}`);

// Verificar DNS antes de inicializar o cliente
try {
  const supabaseHostname = new URL(supabaseUrl).hostname;
  dnsRaw.lookup(supabaseHostname, (err, address) => {
    if (err) {
      console.error(`[DNS ERROR] Não foi possível resolver o host do Supabase (${supabaseHostname}):`, err);
    } else {
      console.log(`[DNS OK] Host ${supabaseHostname} resolvido para ${address}`);
    }
  });
} catch (e) {
  console.error("[STORAGE] Erro ao processar URL do Supabase:", e);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  },
  global: {
    // @ts-ignore - Usar node-fetch para maior compatibilidade com DNS em containers
    fetch: async (url: string, options: any) => {
      try {
        return await fetch(url, options);
      } catch (err: any) {
        console.error(`[FETCH ERROR] Falha ao acessar ${url}:`, err.message);
        if (err.code === 'ENOTFOUND') {
          try {
             const u = new URL(url);
             console.error(`[DNS ERROR] Host ${u.hostname} não encontrado.`);
          } catch(e) {}
        }
        throw err;
      }
    }
  }
});
console.log("[STORAGE] Cliente Supabase instanciado com node-fetch.");

async function initStorage() {
  try {
    // Inicialização do Supabase: garante que configurações básicas existam
    const { data: settings, error } = await supabase.from('settings').select('*').eq('id', 'main').single();
    
    if (error && error.code !== 'PGRST116') {
      console.error("[STORAGE] Erro ao verificar settings no Supabase:", error);
    }

    if (!settings) {
      console.log("[STORAGE] Criando configurações iniciais no Supabase...");
      await supabase.from('settings').insert({
        id: 'main',
        domain: process.env.DEFAULT_DOMAIN || "amplifamarketing.com.br",
        delivery_mode: process.env.DELIVERY_MODE || "internal"
      });
    }

    // Garante que a conta do Administrador Mestre existe
    const { data: adminExists } = await supabase.from('accounts').select('id').eq('email', 'werikplaystore@gmail.com').single();
    if (!adminExists) {
      console.log("[STORAGE] Criando conta de administrador mestre...");
      await supabase.from('accounts').insert({
        id: '1',
        email: 'werikplaystore@gmail.com',
        password: 'We12wi25k#3912*',
        name: 'Werik',
        role: 'admin',
        created_at: new Date().toISOString()
      });
    }

  } catch (err) {
    console.error("Erro ao inicializar armazenamento:", err);
  }
}

async function addLog(message: string, type: "info" | "error" | "smtp" | "track" | "success" | "warning" = "info", metadata: any = {}) {
  const logItem = {
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    message,
    type,
    metadata
  };

  try {
    await supabase.from('logs').insert([logItem]);
  } catch (e) {
    console.error("Falha ao salvar log no Supabase:", e);
  }
}

// --- Helpers de Armazenamento Supabase ---
async function getSettings() {
  const { data, error } = await supabase.from('settings').select('*').eq('id', 'main').single();
  if (error) {
    console.error("Erro ao buscar configurações no Supabase:", error);
    return {};
  }
  return data;
}

async function getRelays() {
  const { data, error } = await supabase.from('relays').select('*').order('created_at', { ascending: true });
  if (error) {
    console.error("Erro ao buscar relays no Supabase:", error);
    return [];
  }
  return data;
}

async function updateRelayQuota(relayId: string) {
  try {
    const { data: relay, error: selectError } = await supabase.from('relays').select('sent').eq('id', relayId).single();
    if (selectError) throw selectError;
    
    if (relay) {
      const { error: updateError } = await supabase.from('relays').update({ sent: (relay.sent || 0) + 1 }).eq('id', relayId);
      if (updateError) throw updateError;
    }
  } catch (err) {
    console.error("Erro ao atualizar quota do relay no Supabase:", err);
  }
}

async function relayEmail(to: string, subject: string, body: string, from?: string, campaignId?: string, trackInfo: any = {}, personalization: any = {}) {
  const settings = await getSettings();
  const relays = await getRelays();
  
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
      if (relay.api_key && relay.quota && relay.sent >= relay.quota) {
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
          tls: {
            rejectUnauthorized: false
          },
          timeout: 15000,
          connectionTimeout: 15000
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
          from: fromAddr.includes('<') ? fromAddr : `"ZimaMail" <${fromAddr}>`,
          to, 
          subject: personalizedSubject, 
          html: trackedBody
        });

        usedRelayName = relay.name || relay.host;
        success = true;
        
        // Save to SENT table
        try {
          await supabase.from('sent').insert([{
            id: Date.now().toString() + '_' + Math.random().toString(36).substring(2, 7),
            to: to,
            from: fromAddr,
            subject: personalizedSubject,
            body: personalizedBody,
            sent_at: new Date().toISOString()
          }]);
        } catch (dbErr) {
          console.error("Erro ao salvar log de envio:", dbErr);
        }
        
        // Update quota usage
        await updateRelayQuota(relay.id);

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

    // Save to SENT table
    try {
      await supabase.from('sent').insert([{
        id: Date.now().toString() + '_' + Math.random().toString(36).substring(2, 7),
        to: to,
        from: fromAddr,
        subject: personalizedSubject,
        body: personalizedBody,
        sent_at: new Date().toISOString()
      }]);
    } catch (dbErr) {
      console.error("Erro ao salvar log de envio direto:", dbErr);
    }

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
        const { data: account, error } = await supabase.from('accounts').select('*').eq('email', auth.username).eq('password', auth.password).single();
        
        if (error || !account) {
          return callback(new Error("Usuário ou senha SMTP inválidos"));
        }

        return callback(null, { user: account });
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
            const extractEmail = (field: any) => {
               if (!field) return "";
               if (typeof field === 'string') return field;
               if (field.value && Array.isArray(field.value) && field.value[0]) {
                 return field.value[0].address || field.text || "";
               }
               return (field.text || "").replace(/^.*<|>.*$/g, '').trim();
            };

            const to = extractEmail(parsed.to);
            const from = extractEmail(parsed.from);
            
            if (!to) throw new Error("Destinatário ausente.");

            await relayEmail(to, parsed.subject || "(Sem Assunto)", parsed.html || parsed.text || "", from);
            await addLog(`Gateway Relay: Email encaminhado por ${(session.user as any).email} para ${to}`, "smtp");
            return callback();
          } catch (relayErr: any) {
            await addLog(`Gateway Relay Erro: ${relayErr.message}`, "error");
            return callback(new Error(`Falha no encaminhamento: ${relayErr.message}`));
          }
        }

        // Se não autenticado, salva no INBOX (Recebimento padrão) com validação de domínio
        const from = parsed.from?.text || "Desconhecido";
        const subject = parsed.subject || "";
        const body = parsed.html || parsed.text || "";
        
        try {
          // 1. Filtro Anti-Spam Básico
          const spamPatterns = [
            /t_Smtp\.LocalIP/i,
            /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, // Assunto sendo apenas um IP
            /no-reply@no-reply\.com/i
          ];

          if (spamPatterns.some(p => p.test(subject) || p.test(from) || p.test(body))) {
            console.log(`[SMTP SPAM] Bloqueado de ${from}: pattern match.`);
            return callback();
          }

          // 2. Validação de Domínio (Apenas aceita se o destinatário for de um domínio gerenciado)
          const recipients = parsed.to instanceof Array ? parsed.to : (parsed.to ? [parsed.to] : []);
          const { data: managedDomains } = await supabase.from('domains').select('domain');
          const domains = (managedDomains || []).map((d: any) => d.domain.toLowerCase());

          const hasValidRecipient = recipients.some(r => {
            const email = r.text || "";
            const domain = email.split('@')[1]?.toLowerCase();
            return domains.includes(domain);
          });

          if (!hasValidRecipient && domains.length > 0) {
            console.log(`[SMTP REJECT] Destinatário inválido ou domínio não gerenciado: ${recipients.map(r => r.text).join(', ')}`);
            return callback(); // Simula sucesso para o remetente mas não salva
          }

          const newEmail = {
            id: Date.now().toString(),
            from_addr: from,
            to_addr: recipients.map(t => t.text).join(","),
            subject: subject,
            body: body,
            received_at: new Date().toISOString(),
            read: false
          };

          const { error } = await supabase.from('emails').insert([newEmail]);
          if (error) throw error;

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
      if (email?.toLowerCase() === "werikplaystore@gmail.com" && password === "We12wi25k#3912*") {
        return res.json({ success: true, user: { name: "Administrador Mestre", email: "Werikplaystore@gmail.com", role: "admin" } });
      }

      const { data: account, error } = await supabase.from('accounts').select('*').eq('email', email).eq('password', password).single();
      
      if (!error && account) {
        // Garantir que contas comuns tenham o role 'user' se não estiver definido
        const userWithRole = { role: 'user', ...account };
        res.json({ success: true, user: userWithRole });
      } else {
        res.status(401).json({ success: false, message: "Email ou senha inválidos" });
      }
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "online", version: "0.4.4", engine: "ZimaMail Native" });
  });

  app.get("/api/health/blacklist", async (req, res) => {
    try {
      let publicIp = process.env.SERVER_IP;
      if (!publicIp || publicIp === '127.0.0.1' || publicIp === '0.0.0.0' || publicIp === 'localhost') {
        try {
          const ipRes = await fetch('https://api.ipify.org?format=json');
          const ipData: any = await ipRes.json();
          publicIp = ipData.ip;
        } catch (e) {
          publicIp = 'unknown';
        }
      }

      if (!publicIp || publicIp === 'unknown' || publicIp === '127.0.0.1') {
        return res.json({ success: false, message: "IP Público não detectado ou inválido para monitoramento." });
      }

      const reverseIp = publicIp.split('.').reverse().join('.');
      const blacklists = [
        { name: 'Spamhaus ZEN', host: 'zen.spamhaus.org' },
        { name: 'Spamcop', host: 'bl.spamcop.net' },
        { name: 'Sorbs DNSBL', host: 'dnsbl.sorbs.net' },
        { name: 'CBL (Abuseat)', host: 'cbl.abuseat.org' },
        { name: 'Surriel BL', host: 'psbl.surriel.com' },
        { name: 'Abuse.ch Ransomware', host: 'rbl.abuse.ch' }
      ];

      const results = await Promise.all(blacklists.map(async (bl) => {
        try {
          const query = `${reverseIp}.${bl.host}`;
          const addresses = await dns.resolve4(query);
          return { name: bl.name, host: bl.host, listed: addresses.length > 0, status: 'LISTADO', detail: addresses[0] };
        } catch (e) {
          return { name: bl.name, host: bl.host, listed: false, status: 'OK' };
        }
      }));

      const listedCount = results.filter(r => r.listed).length;
      
      let ptr = 'Não configurado';
      try {
        const ptrs = await dns.reverse(publicIp);
        ptr = ptrs[0] || 'Não configurado';
      } catch (e) {}

      res.json({
        success: true,
        ip: publicIp,
        ptr,
        listedCount,
        details: results,
        status: listedCount === 0 ? 'Excelente' : (listedCount < 2 ? 'Risco Moderado' : 'Perigo / Blacklist'),
        color: listedCount === 0 ? 'emerald' : (listedCount < 2 ? 'amber' : 'red')
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // --- API Keys Management ---
  app.get("/api/keys", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error("[API_KEYS] Erro ao buscar:", error);
        throw error;
      }
      res.json(data || []);
    } catch (e: any) {
      console.error("[API_KEYS] Catch error:", e);
      res.status(500).json({ error: e.message || "Erro interno ao buscar chaves" });
    }
  });

  app.post("/api/keys", async (req, res) => {
    try {
      const { name, permissions } = req.body;
      const key = `zm_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`;
      
      const { data, error } = await supabase.from('api_keys').insert([{
        name,
        key,
        permissions: permissions || ['read', 'write']
      }]).select().single();
      
      if (error) {
        console.error("[API_KEYS] Erro ao criar:", error);
        throw error;
      }
      // Retornamos a chave completa apenas na criação
      res.json({ ...data, key });
    } catch (e: any) {
      console.error("[API_KEYS] Create error:", e);
      res.status(500).json({ error: e.message || "Erro ao gerar chave" });
    }
  });

  app.delete("/api/keys/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { error } = await supabase.from('api_keys').delete().eq('id', id);
      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  async function checkApiKey(req: express.Request, permission: 'read' | 'write' = 'read') {
    const key = req.headers['x-api-key'] as string;
    if (!key) return false;

    const { data, error } = await supabase.from('api_keys').select('*').eq('key', key).single();
    if (error || !data) return false;

    if (!data.permissions.includes(permission)) return false;

    // Update last used (async, don't block)
    supabase.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', data.id).then();
    
    return true;
  }

  app.get("/api/logs", async (req, res) => {
    // Permitir chave de API
    if (req.headers['x-api-key']) {
      const authorized = await checkApiKey(req, 'read');
      if (!authorized) return res.status(401).json({ error: "API Key inválida ou sem permissão de leitura" });
    }

    try {
      const { data, error } = await supabase.from('logs').select('*').order('timestamp', { ascending: false }).limit(100);
      if (error) throw error;
      res.json(data);
    } catch (e: any) { 
      await addLog(`Erro ao carregar logs: ${e.message}`, "error");
      res.json([]); 
    }
  });

  app.get("/api/accounts", async (req, res) => {
    try {
      const { userEmail } = req.query;
      let query = supabase.from('accounts').select('*');
      if (userEmail) query = query.eq('email', userEmail);
      const { data, error } = await query;
      if (error) throw error;
      res.json(data);
    } catch (e: any) { 
      await addLog(`Erro ao carregar contas: ${e.message}`, "error");
      res.json([]); 
    }
  });

  app.post("/api/accounts", async (req, res) => {
    const { email, password, name } = req.body;
    try {
      const newAccount = { 
        id: Date.now().toString(), 
        email, 
        password, 
        name, 
        role: 'user', 
        created_at: new Date().toISOString() 
      };

      const { error: sbError } = await supabase.from('accounts').insert([newAccount]);
      if (sbError) throw sbError;

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
      
      const { data, error } = await supabase.from('accounts').update({ email, password, name }).eq('id', id).select().single();
      if (error) throw error;

      if (data) {
        await addLog(`Conta atualizada: ${email}`, "info");
        res.json({ success: true, account: data });
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
      const { error } = await supabase.from('accounts').delete().eq('id', id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/settings", async (req, res) => {
    try {
      res.json(await getSettings());
    } catch (e) { res.json({}); }
  });

  app.post("/api/settings", async (req, res) => {
    try {
      const { error } = await supabase.from('settings').upsert({ id: 'main', ...req.body });
      if (error) throw error;
      await addLog("Configurações atualizadas", "info");
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Endpoints de diagnóstico
  app.get("/api/health-check", async (req, res) => {
    const results: any = {
      timestamp: new Date().toISOString(),
      dns: {},
      env: {
        has_url: !!process.env.SUPABASE_URL,
        has_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      }
    };

    const hosts = ['google.com', 'github.com'];
    if (process.env.SUPABASE_URL) {
      try {
        hosts.push(new URL(process.env.SUPABASE_URL).hostname);
      } catch(e) {}
    }
    
    for (const host of hosts) {
      try {
        const addr2 = await dns.lookup(host);
        results.dns[host] = { status: 'OK', address: addr2.address };
      } catch (e: any) {
        results.dns[host] = { status: 'ERROR', message: e.message, code: e.code };
      }
    }

    res.json(results);
  });

  app.get("/api/domains", async (req, res) => {
    try {
      const { data, error } = await supabase.from('domains').select('domain');
      if (error) throw error;
      res.json(data.map((d: any) => d.domain));
    } catch (e) { res.json([]); }
  });

  app.get("/api/relays", async (req, res) => {
    try {
      res.json(await getRelays());
    } catch (e) { res.json([]); }
  });

  app.get("/api/campaigns", async (req, res) => {
    try {
      const { data, error } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      res.json(data);
    } catch (e) { res.json([]); }
  });

  app.post("/api/campaigns", async (req, res) => {
    try {
      const { name, subject, body, from, recipients, delay, scheduledAt } = req.body; 
      
      const campaign = { 
        id: Date.now().toString(), 
        name,
        subject,
        body,
        from,
        delay: delay || 500,
        createdAt: new Date().toISOString(),
        scheduledAt: scheduledAt || null,
        status: scheduledAt ? 'scheduled' : 'sending',
        stats: {
          total: recipients.length,
          sent: 0,
          failed: 0,
          opens: 0,
          clicks: 0
        },
        recipients: recipients.map((r: any) => ({ ...r, status: 'pending' }))
      };

      // Map fields to SQL snake_case
      const { error: sbError } = await supabase.from('campaigns').insert([{
        id: campaign.id,
        name: campaign.name,
        subject: campaign.subject,
        body: campaign.body,
        from: campaign.from,
        delay: campaign.delay,
        scheduled_at: campaign.scheduledAt,
        status: campaign.status,
        stats: campaign.stats,
        recipients: campaign.recipients,
        created_at: campaign.createdAt
      }]);

      if (sbError) throw sbError;
      
      if (!scheduledAt) {
        processCampaign(campaign, req);
      }

      res.json({ success: true, campaign });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  async function processCampaign(campaign: any, req: any) {
    const protocol = req.headers?.['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers?.['x-forwarded-host'] || req.get?.('host') || 'localhost:3000';

    for (let i = 0; i < campaign.recipients.length; i++) {
      const recipient = campaign.recipients[i];
      if (recipient.status === 'sent') continue;

      try {
        await relayEmail(
          recipient.email, 
          campaign.subject, 
          campaign.body, 
          campaign.from, 
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
      
      if (i % 5 === 0 || i === campaign.recipients.length - 1) {
        const nextStatus = i === campaign.recipients.length - 1 ? 'completed' : 'sending';
        
        await supabase.from('campaigns').update({ 
          status: nextStatus,
          stats: campaign.stats,
          recipients: campaign.recipients
        }).eq('id', campaign.id);
      }
      await new Promise(r => setTimeout(r, campaign.delay));
    }
  }

  // Monitor de agendamentos
  setInterval(async () => {
    try {
      const { data: campaigns, error } = await supabase.from('campaigns').select('*').eq('status', 'scheduled');
      if (error) throw error;

      const now = new Date();
      for (const campaign of campaigns) {
        if (campaign.scheduled_at) {
          const scheduledDate = new Date(campaign.scheduled_at);
          if (now >= scheduledDate) {
            await supabase.from('campaigns').update({ status: 'sending' }).eq('id', campaign.id);
            // Re-mapear campos de snake_case para o objeto JS esperado pela processCampaign
            const processedCampaign = {
               ...campaign,
               scheduledAt: campaign.scheduled_at,
               createdAt: campaign.created_at,
               status: 'sending'
            };
            processCampaign(processedCampaign, { protocol: 'https', headers: {} });
          }
        }
      }
    } catch (e) {}
  }, 30000); 

  app.delete("/api/campaigns/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { error } = await supabase.from('campaigns').delete().eq('id', id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/relays", async (req, res) => {
    try {
      const { name, host, port, user, pass, apiKey } = req.body;
      const relay = { 
        id: Date.now().toString(), 
        name,
        host,
        port,
        user,
        pass,
        quota: 1000,
        sent: 0,
        api_key: apiKey || '',
        created_at: new Date().toISOString()
      };
      const { error } = await supabase.from('relays').insert([relay]);
      if (error) throw error;
      
      await addLog(`Novo Relay configurado: ${relay.name}`, "info");
      res.json({ success: true, relay });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/relays/:id/sync", async (req, res) => {
    const { id } = req.params;
    try {
      const { data: relay, error } = await supabase.from('relays').select('*').eq('id', id).single();
      if (error || !relay) return res.status(404).json({ error: "Relay não encontrado" });

      if (!relay.api_key) return res.status(400).json({ error: "API Key não configurada para este relay." });

      const name = (relay.name || "").toLowerCase();
      const host = (relay.host || "").toLowerCase();

      // BREVO
      if (host.includes('brevo') || name.includes('brevo') || host.includes('sendinblue')) {
        const response = await fetch('https://api.brevo.com/v3/account', {
          headers: { 'api-key': relay.api_key }
        });
        
        if (response.ok) {
          const data: any = await response.json();
          const emailPlan = data.plan?.find((p: any) => p.type === 'email');
          if (emailPlan) {
            const credits = emailPlan.credits;
            await supabase.from('relays').update({ quota: credits }).eq('id', id);
            await addLog(`Quota sync (Brevo) completa: ${credits} créditos`, "info");
            return res.json({ success: true, quota: credits });
          }
        }
      }

      // SENDGRID
      if (host.includes('sendgrid') || name.includes('sendgrid')) {
        const response = await fetch('https://api.sendgrid.com/v3/user/credits', {
          headers: { 'Authorization': `Bearer ${relay.api_key}` }
        });

        if (response.ok) {
          const data: any = await response.json();
          const total = data.total || 0;
          await supabase.from('relays').update({ quota: total }).eq('id', id);
          await addLog(`Quota sync (SendGrid) completa: ${total} créditos`, "info");
          return res.json({ success: true, quota: total });
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
      const { name, host, port, user, pass, apiKey } = req.body;
      
      const updateData: any = { name, host, port, user };
      if (pass) updateData.pass = pass;
      if (apiKey !== undefined) updateData.api_key = apiKey;

      const { error } = await supabase.from('relays').update(updateData).eq('id', id);
      if (error) throw error;
      await addLog(`Relay atualizado: ${name || id}`, "info");
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.delete("/api/relays/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { error } = await supabase.from('relays').delete().eq('id', id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/cloudflare/sync", async (req, res) => {
    try {
      const settings = await getSettings();
      const relays = await getRelays();
      
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
      const sanitizedHost = (relay.host || "").replace(/[^a-zA-Z0-9.-]/g, "").toLowerCase();
      await addLog(`Testando conexão com relay: ${relay.name || sanitizedHost}`, "info");
      
      const transporterOptions: any = {
        host: sanitizedHost,
        port: parseInt(relay.port),
        secure: relay.port == 465,
        auth: { user: (relay.user || "").trim(), pass: (relay.pass || "").trim() },
        tls: {
          rejectUnauthorized: false
        },
        connectionTimeout: 10000
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
      const { error } = await supabase.from('domains').upsert({ domain });
      if (error) throw error;
      
      await addLog(`Novo domínio gerenciado: ${domain}`, "info");

      // Integração Automática com Relays
      const relays = await getRelays();
      for (const relay of relays) {
        if (!relay.api_key) continue;

        try {
          if (relay.host?.includes('sendgrid')) {
            // SendGrid: Domain Authentication
            const sgRes = await fetch("https://api.sendgrid.com/v3/whitelabel/domains", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${relay.api_key}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                domain: domain,
                automatic_security: true,
                custom_spf: true
              })
            });
            if (sgRes.ok) {
              await addLog(`Domínio ${domain} registrado automaticamente no SendGrid (${relay.name})`, "success");
            } else {
              const errData = await sgRes.json();
              await addLog(`Falha ao registrar domínio ${domain} no SendGrid (${relay.name}): ${JSON.stringify(errData)}`, "warning");
              console.warn(`[SendGrid] Falha ao registrar domínio ${domain}:`, errData);
            }
          } else if (relay.host?.includes('brevo') || relay.host?.includes('sibintegra')) {
            // Brevo: Add Domain
            const brevoRes = await fetch("https://api.brevo.com/v3/senders/domains", {
              method: "POST",
              headers: {
                "api-key": relay.api_key,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ domain: domain })
            });
            if (brevoRes.ok) {
              await addLog(`Domínio ${domain} registrado automaticamente no Brevo (${relay.name})`, "success");
            } else {
              const errData = await brevoRes.json();
              await addLog(`Falha ao registrar domínio ${domain} no Brevo (${relay.name}): ${JSON.stringify(errData)}`, "warning");
              console.warn(`[Brevo] Falha ao registrar domínio ${domain}:`, errData);
            }
          }
        } catch (e) {
          await addLog(`Erro crítico na integração do domínio ${domain} com ${relay.name}`, "error");
          console.error(`Erro ao integrar domínio ${domain} com relay ${relay.name}:`, e);
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.delete("/api/domains/:domain", async (req, res) => {
    try {
      const { domain } = req.params;
      const { error } = await supabase.from('domains').delete().eq('domain', domain);
      if (error) throw error;
      await addLog(`Domínio removido: ${domain}`, "info");
      res.json({ success: true });
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
        const campaignId = parts[parts.length - 3] || parts[1];
        
        const { data: campaign } = await supabase.from('campaigns').select('*').eq('id', campaignId).single();
        if (campaign) {
          const stats = campaign.stats || { total: 0, sent: 0, failed: 0, opens: 0, clicks: 0 };
          stats.opens = (stats.opens || 0) + 1;
          const events = campaign.events || [];
          events.unshift({ type: 'open', recipient, at: new Date().toISOString(), ip, ua: userAgent });
          await supabase.from('campaigns').update({ stats, events }).eq('id', campaignId);
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
        
        const { data: campaign } = await supabase.from('campaigns').select('*').eq('id', campaignId).single();
        
        if (campaign) {
          const stats = campaign.stats || { total: 0, sent: 0, failed: 0, opens: 0, clicks: 0 };
          stats.clicks = (stats.clicks || 0) + 1;

          const events = campaign.events || [];
          events.unshift({
            type: 'click',
            recipient,
            url,
            at: new Date().toISOString(),
            ip,
            ua: userAgent
          });

          await supabase.from('campaigns').update({ stats, events }).eq('id', campaignId);
        }
      }
      await addLog(`CLIQUE: ${recipient} clicou em ${url}`, "track", { clicked: true, url, trackerId: id, recipient, ip, ua: userAgent });
    } catch (e) {
      console.error('Erro no rastreio de clique:', e);
    }

    res.redirect(url as string);
  });

  app.post("/api/mail/mark-read/:id", async (req, res) => {
    const { id } = req.params;
    try {
      await supabase.from('emails').update({ read: true }).eq('id', id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/mail/:folder", async (req, res) => {
    // Permitir chave de API
    if (req.headers['x-api-key']) {
      const authorized = await checkApiKey(req, 'read');
      if (!authorized) return res.status(401).json({ error: "API Key inválida ou sem permissão de leitura" });
    }

    const { folder } = req.params;
    const { userEmail } = req.query; 
    
    const allowedFolders = ['inbox', 'sent', 'drafts', 'trash'];
    if (!allowedFolders.includes(folder)) {
        return res.status(404).json({ error: "Pasta não encontrada" });
    }
    
    try {
      let query = supabase.from('emails').select('*').order('received_at', { ascending: false });
      
      if (userEmail) {
        // Para simplificar, assumindo que inbox/sent etc estão na mesma tabela diferenciavel por filtros ou pastas físicas virtuais
        // Se todas as pastas estão no Supabase, precisamos filtrar o folder também se houver coluna folder
        // Por enquanto, o app parece focar mais no INBOX
        query = query.or(`to_addr.eq.${userEmail},to_addr.ilike.%${userEmail}%`);
      }
      
      const { data: emails, error } = await query;
      if (error) throw error;

      res.json(emails || []);
    } catch (e: any) { 
      res.json([]); 
    }
  });

  app.delete("/api/mail/:folder/:id", async (req, res) => {
    // ... code omitted for brevity as it pertained to previous edit ...
  });

  // EMAIL LISTS ENDPOINTS
  app.get("/api/email-lists", async (req, res) => {
    try {
      const { data, error } = await supabase.from('email_lists').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      res.json(data);
    } catch (e) {
      res.json([]);
    }
  });

  app.post("/api/email-lists", async (req, res) => {
    try {
      const { name, recipients } = req.body;
      const newList = {
        id: Date.now().toString(),
        name,
        recipients, 
        count: recipients.length,
        created_at: new Date().toISOString()
      };

      const { error } = await supabase.from('email_lists').insert([newList]);
      if (error) throw error;
      
      res.json(newList);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/email-lists/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { error } = await supabase.from('email_lists').delete().eq('id', id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/mail/send", async (req, res) => {
    // Permitir chave de API
    if (req.headers['x-api-key']) {
      const authorized = await checkApiKey(req, 'write');
      if (!authorized) return res.status(401).json({ error: "API Key inválida ou sem permissão de escrita" });
    }

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
      const { count: aCount } = await supabase.from('accounts').select('*', { count: 'exact', head: true });
      const { count: eCount } = await supabase.from('emails').select('*', { count: 'exact', head: true });
      
      res.json({
        activeAccounts: aCount || 0,
        emailsReceived: eCount || 0,
        storageUsed: "Supabase Cloud",
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
