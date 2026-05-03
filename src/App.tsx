import { useState, useEffect } from 'react';
import { 
  Mail, 
  Shield, 
  Server, 
  Users, 
  Activity, 
  Settings, 
  Database,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  HardDrive
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Tipos simplificados
interface Stats {
  activeAccounts: number;
  emailsSent: number;
  emailsReceived: number;
  storageUsed: string;
  storageAvailable: string;
}

export default function App() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'mail' | 'dns' | 'accounts' | 'settings'>('overview');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<any>(null);

  // Mock de emails para a interface profissional
  const [emails, setEmails] = useState([
    { id: 1, from: 'Suporte ZimaOS', subject: 'Boas-vindas ao seu novo Provedor', snippet: 'Seu servidor de email profissional está configurado e pronto para uso. Lembre-se de configurar o DNS corretamente.', date: '10:30', read: false },
    { id: 2, from: 'Segurança Supabase', subject: 'Chaves de API sincronizadas', snippet: 'A sincronização entre o Stalwart e o Supabase foi concluída com sucesso. Seus metadados estão protegidos.', date: 'Ontem', read: true },
    { id: 3, from: 'Noreply @ GitHub', subject: 'Novo Deploy Detectado', snippet: 'A build do seu dashboard terminou sem erros. Versão 2.4.0-stable ativa.', date: '2 dias atrás', read: true },
  ]);

  useEffect(() => {
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-500/30">
      {/* Sidebar navigation */}
      <nav className="fixed left-0 top-0 h-full w-20 bg-white border-r border-slate-200 flex flex-col items-center py-8 gap-8 z-50 shadow-sm">
        <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/20">
          <Mail className="w-8 h-8 text-white" />
        </div>
        
        <div className="flex flex-col gap-4 mt-8">
          <NavButton 
            active={activeTab === 'overview'} 
            onClick={() => setActiveTab('overview')}
            icon={<Activity className="w-6 h-6" />}
          />
          <NavButton 
            active={activeTab === 'mail'} 
            onClick={() => setActiveTab('mail')}
            icon={<Mail className="w-6 h-6" />}
          />
          <NavButton 
            active={activeTab === 'dns'} 
            onClick={() => setActiveTab('dns')}
            icon={<Shield className="w-6 h-6" />}
          />
          <NavButton 
            active={activeTab === 'accounts'} 
            onClick={() => setActiveTab('accounts')}
            icon={<Users className="w-6 h-6" />}
          />
          <NavButton 
            active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')}
            icon={<Settings className="w-6 h-6" />}
          />
        </div>

        <div className="mt-auto">
          <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">
            ZM
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pl-20">
        <header className="p-8 border-b border-slate-200 flex justify-between items-center bg-white/80 backdrop-blur-xl sticky top-0 z-40">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Server className="w-6 h-6 text-blue-600" />
              ZimaMail Provider
              <span className="text-xs bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium ml-2 uppercase tracking-widest">
                Production
              </span>
            </h1>
            <p className="text-slate-500 text-sm mt-1">Infraestrutura gerenciada por Docker no ZimaOS</p>
          </div>

          <div className="flex gap-4">
            <button className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-lg border border-slate-200 text-sm font-medium transition-all shadow-sm">
              Logs do Sistema
            </button>
            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-blue-500/10">
              Novo Domínio
            </button>
          </div>
        </header>

        <section className="p-8 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div 
                key="overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatCard 
                    title="Contas Ativas" 
                    value={stats?.activeAccounts || 0} 
                    icon={<Users className="w-5 h-5 text-blue-600" />}
                    trend="+2 este mês"
                  />
                  <StatCard 
                    title="Emails Enviados" 
                    value={stats?.emailsSent || 0} 
                    icon={<Mail className="w-5 h-5 text-blue-500" />}
                  />
                  <StatCard 
                    title="Emails Recebidos" 
                    value={stats?.emailsReceived || 0} 
                    icon={<Activity className="w-5 h-5 text-emerald-600" />}
                  />
                  <StatCard 
                    title="Uso de Disco" 
                    value={stats?.storageUsed || '0GB'} 
                    subtitle={`de ${stats?.storageAvailable || '50GB'}`}
                    icon={<HardDrive className="w-5 h-5 text-amber-600" />}
                    progress={20}
                  />
                </div>

                {/* Main Dashboard Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="font-semibold text-lg text-slate-900">Status dos Serviços</h3>
                        <span className="text-xs text-slate-400 uppercase tracking-widest font-bold">Monitoramento Tempo Real</span>
                      </div>
                      
                      <div className="space-y-4">
                        <ServiceItem name="SMTP Server (Stalwart)" status="running" port={25} />
                        <ServiceItem name="IMAP Core" status="running" port={993} />
                        <ServiceItem name="Supabase DB Connection" status="running" type="External" />
                        <ServiceItem name="Spam Filter (Rspamd)" status="warning" message="Atualizando bases..." />
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                      <h3 className="font-semibold text-lg text-slate-900 mb-6">Ações Rápidas</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <ActionCard 
                          title="Gerar Chaves DKIM/SPF" 
                          description="Melhore a entregabilidade dos seus emails"
                          icon={<Shield className="w-6 h-6" />}
                        />
                        <ActionCard 
                          title="Backup Supabase" 
                          description="Sincronizar metadados agora"
                          icon={<Database className="w-6 h-6" />}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-xl shadow-blue-500/20">
                      <h3 className="font-bold text-lg mb-2">Configuração ZimaOS</h3>
                      <p className="text-blue-50 opacity-90 text-sm mb-4 leading-relaxed">
                        Seus arquivos de email estão sendo armazenados diretamente na raiz do sistema de dados:
                      </p>
                      <code className="block bg-blue-700/50 px-3 py-2 rounded text-xs font-mono mb-6">
                        /DATA/AppData/ZimaMail/
                      </code>
                      <button className="w-full py-2.5 bg-white text-blue-600 rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-95">
                        Abrir Gerenciador de Arquivos
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                      <h3 className="font-semibold text-slate-900 mb-4">Integridade do Database</h3>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-sm text-slate-600">Conectado ao Supabase</span>
                      </div>
                      <div className="text-xs text-slate-400 font-mono line-clamp-1 bg-slate-50 p-2 rounded">
                        ais-supabase-project.supabase.co
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'mail' && (
              <motion.div 
                key="mail"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-12 gap-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden min-h-[600px]"
              >
                {/* Mail Sidebar */}
                <div className="col-span-3 border-r border-slate-100 bg-slate-50/50 p-4">
                  <button 
                    onClick={() => setIsComposeOpen(true)}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 mb-6 flex items-center justify-center gap-2 hover:bg-blue-700 transition-all"
                  >
                    <Mail className="w-4 h-4" /> Escrever
                  </button>
                  
                  <nav className="space-y-1">
                    <MailFolderItem label="Entrada" count={2} active icon={<Mail className="w-4 h-4" />} />
                    <MailFolderItem label="Enviados" icon={<ArrowRight className="w-4 h-4" rotate={-45} />} />
                    <MailFolderItem label="Rascunhos" icon={<Shield className="w-4 h-4" />} />
                    <MailFolderItem label="Lixeira" icon={<AlertCircle className="w-4 h-4" />} />
                  </nav>
                </div>

                {/* Email List */}
                <div className="col-span-4 border-r border-slate-100 overflow-y-auto max-h-[700px]">
                  {emails.map(email => (
                    <button 
                      key={email.id}
                      onClick={() => setSelectedEmail(email)}
                      className={`w-full p-4 border-b border-slate-50 text-left hover:bg-slate-50 transition-colors ${selectedEmail?.id === email.id ? 'bg-blue-50/50 border-l-4 border-l-blue-600' : ''}`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-sm ${!email.read ? 'font-bold text-slate-900' : 'text-slate-600'}`}>{email.from}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{email.date}</span>
                      </div>
                      <p className={`text-xs truncate ${!email.read ? 'font-bold text-slate-800' : 'text-slate-500'}`}>{email.subject}</p>
                      <p className="text-[10px] text-slate-400 truncate mt-1">{email.snippet}</p>
                    </button>
                  ))}
                </div>

                {/* Content Reader */}
                <div className="col-span-5 p-8 bg-white overflow-y-auto max-h-[700px]">
                  {selectedEmail ? (
                    <div className="animate-in fade-in duration-300">
                      <div className="flex justify-between items-start mb-8">
                        <div>
                          <h2 className="text-xl font-bold text-slate-900 mb-2">{selectedEmail.subject}</h2>
                          <div className="flex items-center gap-2 text-sm text-slate-500">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-blue-600">
                              {selectedEmail.from.charAt(0)}
                            </div>
                            <span>{selectedEmail.from}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><ArrowRight className="w-4 h-4" /></button>
                          <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><Shield className="w-4 h-4" /></button>
                        </div>
                      </div>
                      <div className="prose prose-slate max-w-none text-slate-600 leading-relaxed">
                        <p>{selectedEmail.snippet}</p>
                        <p className="mt-4">
                          Esta é uma ferramenta profissional de email rodando no seu ZimaOS. 
                          Os dados estão seguros no Supabase e os arquivos de armazenamento estão em /DATA/AppData/ZimaMail.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                       <Mail className="w-12 h-12 mb-4 opacity-20" />
                       <p className="text-sm">Selecione um email para ler</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'dns' && (
              <motion.div 
                key="dns"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 mb-1">Configuração de DNS</h2>
                      <p className="text-sm text-slate-500">Ajuste estes registros no seu painel da Cloudflare</p>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-xs font-medium">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Desligue o Proxy (Nuvem Laranja)
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="py-3 px-4 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Tipo</th>
                          <th className="py-3 px-4 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Nome</th>
                          <th className="py-3 px-4 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Conteúdo</th>
                          <th className="py-3 px-4 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Proxy</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-slate-600">
                        <DNSRow type="A" host="mail" content="SEU_IP_ZIMAOS" proxy="DNS Only" />
                        <DNSRow type="MX" host="@" content="mail.amplifamarketing.com.br" priority={10} proxy="DNS Only" />
                        <DNSRow type="TXT" host="@" content="v=spf1 ip4:SEU_IP_ZIMAOS -all" proxy="N/A" />
                        <DNSRow type="TXT" host="_dmarc" content="v=DMARC1; p=quarantine;" proxy="N/A" />
                        <DNSRow type="TXT" host="default._domainkey" content="(Pego no Stalwart Admin)" proxy="N/A" />
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-8 p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <h4 className="text-sm font-bold text-blue-800 mb-2 flex items-center gap-2">
                      <Settings className="w-4 h-4" /> Importante: Portas do Roteador
                    </h4>
                    <p className="text-xs text-blue-700 leading-relaxed">
                      Sua rede local precisa encaminhar as portas <strong>25, 465, 587, 993 e 143</strong> para o IP interno do seu ZimaOS. Se a sua operadora bloqueia a porta 25 (comum em redes residenciais), você precisará de um Relay ou uma IP Fixo profissional.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'accounts' && (
              <motion.div 
                key="accounts"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm"
              >
                <div className="max-w-md mx-auto py-12">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-100">
                    <Users className="w-10 h-10 text-slate-400" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 mb-2">Gerenciamento de Contas</h2>
                  <p className="text-slate-500 mb-8">
                    As contas de usuário são sincronizadas diretamente com o Supabase Auth.
                  </p>
                  <button className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-transform">
                    Carregar Usuários do Supabase
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      <ComposeModal isOpen={isComposeOpen} onClose={() => setIsComposeOpen(false)} />
    </div>

  );
}

function NavButton({ active, icon, onClick }: { active: boolean, icon: any, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`p-3 rounded-xl transition-all ${
        active 
          ? 'bg-slate-100 text-blue-600 border border-slate-200 shadow-inner' 
          : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
      }`}
    >
      {icon}
    </button>
  );
}

function MailFolderItem({ label, count, active, icon }: { label: string, count?: number, active?: boolean, icon: any }) {
  return (
    <button className={`w-full flex items-center justify-between p-2 rounded-lg text-sm transition-all ${
      active ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-100'
    }`}>
      <div className="flex items-center gap-2">
        {icon}
        {label}
      </div>
      {count && <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded-full">{count}</span>}
    </button>
  );
}

function ComposeModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200"
      >
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-900">Nova Mensagem</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500">×</button>
        </div>
        <div className="p-6 space-y-4">
          <input type="text" placeholder="Para:" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          <input type="text" placeholder="Assunto:" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          <textarea rows={8} placeholder="Escreva sua mensagem..." className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"></textarea>
        </div>
        <div className="p-4 bg-slate-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2 text-slate-500 font-medium">Cancelar</button>
          <button className="px-8 py-2 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20">Enviar Agora</button>
        </div>
      </motion.div>
    </div>
  );
}

function DNSRow({ type, host, content, proxy, priority }: any) {
  return (
    <tr className="hover:bg-slate-50/50">
      <td className="py-4 px-4"><span className="px-2 py-1 bg-slate-100 rounded text-[10px] font-bold text-slate-600">{type}</span></td>
      <td className="py-4 px-4 font-mono text-xs">{host}</td>
      <td className="py-4 px-4 font-mono text-xs text-blue-600">
        {priority && <span className="mr-1 text-slate-300">[{priority}]</span>}
        {content}
      </td>
      <td className="py-4 px-4">
        {proxy === 'DNS Only' ? (
          <span className="flex items-center gap-1.5 text-amber-600 font-medium text-xs">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Somente DNS
          </span>
        ) : (
          <span className="text-slate-400 text-xs">{proxy}</span>
        )}
      </td>
    </tr>
  );
}

function StatCard({ title, value, subtitle, icon, trend, progress }: any) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-blue-200 transition-colors group shadow-sm">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-blue-50 transition-colors">
          {icon}
        </div>
        {trend && <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-tighter bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">{trend}</span>}
      </div>
      <div>
        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">{title}</p>
        <div className="flex items-baseline gap-2">
          <h4 className="text-2xl font-bold text-slate-900">{value}</h4>
          {subtitle && <span className="text-slate-400 text-xs">{subtitle}</span>}
        </div>
      </div>
      {progress !== undefined && (
        <div className="mt-4 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-blue-600" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}

function ServiceItem({ name, status, port, type, message }: any) {
  return (
    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
      <div className="flex items-center gap-3">
        {status === 'running' ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        ) : (
          <AlertCircle className="w-4 h-4 text-amber-500" />
        )}
        <div>
          <p className="text-sm font-medium text-slate-700">{name}</p>
          <p className="text-[10px] text-slate-400 font-mono">
            {port ? `PORTA: ${port}` : type ? `TIPO: ${type}` : message}
          </p>
        </div>
      </div>
      <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
        status === 'running' ? 'bg-emerald-50 text-white' : 'bg-amber-500 text-white'
      }`}>
        {status === 'running' ? 'Online' : 'Warning'}
      </div>
    </div>
  );
}

function ActionCard({ title, description, icon }: any) {
  return (
    <button className="flex items-start gap-4 p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-blue-200 text-left transition-all group shadow-sm">
      <div className="p-3 bg-slate-50 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
        {icon}
      </div>
      <div>
        <p className="text-sm font-bold text-slate-900 mb-0.5">{title}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
    </button>
  );
}
