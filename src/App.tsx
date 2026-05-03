import { useState, useEffect, useCallback, FormEvent } from 'react';
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
  HardDrive,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  MoreVertical
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from './lib/supabase';

// Tipos simplificados
interface Stats {
  activeAccounts: number;
  emailsSent: number;
  emailsReceived: number;
  storageUsed: string;
  storageAvailable: string;
}

interface MailAccount {
  id: string;
  email: string;
  full_name: string;
  domain: string;
  created_at: string;
  is_active: boolean;
}

export default function App() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'mail' | 'dns' | 'accounts' | 'logs' | 'settings'>('overview');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [isFetchingAccounts, setIsFetchingAccounts] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);

  const [emails, setEmails] = useState<any[]>([]);

  const fetchEmails = useCallback(async () => {
    try {
      const res = await fetch('/api/mail/inbox');
      const data = await res.json();
      setEmails(data);
    } catch (err) {
      console.error('Erro ao buscar emails:', err);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/logs');
      const data = await res.json();
      setLogs(data);
    } catch (err) {
      console.error('Erro ao buscar logs:', err);
    }
  }, []);

  const fetchAccounts = useCallback(async () => {
    setIsFetchingAccounts(true);
    try {
      const res = await fetch('/api/accounts');
      const data = await res.json();
      setAccounts(data || []);
      if (data) {
        setStats(prev => prev ? { ...prev, activeAccounts: data.length } : null);
      }
    } catch (err) {
      console.error('Erro ao buscar contas:', err);
    } finally {
      setIsFetchingAccounts(false);
    }
  }, []);

  useEffect(() => {
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    fetchAccounts();
    fetchEmails();
    fetchLogs();

    const interval = setInterval(() => {
      fetchEmails();
      fetchLogs();
    }, 10000); 

    return () => clearInterval(interval);
  }, [fetchAccounts, fetchEmails]);

  const handleDeleteAccount = async (id: string) => {
    if (!supabase) return;
    if (!confirm('Tem certeza que deseja excluir esta conta? Isso removerá todos os dados associados.')) return;
    
    try {
      const { error } = await supabase
        .from('mail_accounts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchAccounts();
    } catch (err) {
      alert('Erro ao excluir conta: ' + (err as Error).message);
    }
  };

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
            active={activeTab === 'logs'} 
            onClick={() => setActiveTab('logs')}
            icon={<Activity className="w-6 h-6" />}
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
            <button onClick={() => setActiveTab('logs')} className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-lg border border-slate-200 text-sm font-medium transition-all shadow-sm">
              Logs do Sistema
            </button>
            <button onClick={() => setIsAccountModalOpen(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-blue-500/10">
              Nova Conta
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
                        <ServiceItem name="SMTP Engine (Custom Node.js)" status="running" port={25} />
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
                    <MailFolderItem label="Entrada" count={emails.filter(e => !e.read).length} active icon={<Mail className="w-4 h-4" />} />
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
                        <span className={`text-sm ${!email.read ? 'font-bold text-slate-900' : 'text-slate-600'}`}>{email.from_addr || email.from}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{new Date(email.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className={`text-xs truncate ${!email.read ? 'font-bold text-slate-800' : 'text-slate-500'}`}>{email.subject}</p>
                      <p className="text-[10px] text-slate-400 truncate mt-1">{email.body?.replace(/<[^>]*>/g, '').substring(0, 100)}</p>
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
                              {(selectedEmail.from_addr || selectedEmail.from).charAt(0)}
                            </div>
                            <span>{selectedEmail.from_addr || selectedEmail.from}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><ArrowRight className="w-4 h-4" /></button>
                          <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><Shield className="w-4 h-4" /></button>
                        </div>
                      </div>
                      <div className="prose prose-slate max-w-none text-slate-600 leading-relaxed bg-slate-50 p-6 rounded-2xl border border-slate-100" dangerouslySetInnerHTML={{ __html: selectedEmail.body }} />
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
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-4xl mx-auto space-y-6"
              >
                <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Configuração Express</h2>
                      <p className="text-slate-500">Copie e cole estes registros no seu painel da Cloudflare</p>
                    </div>
                    <div className="px-4 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                       <AlertCircle className="w-3 h-3" /> Proxy Desligado
                    </div>
                  </div>

                  <div className="space-y-3">
                    <DNSRow type="A" host="mail" content="SEU_IP_ZIMAOS" desc="Aponta para o servidor" />
                    <DNSRow type="MX" host="@" content="mail.amplifamarketing.com.br" priority={10} desc="Recebimento de emails" />
                    <div className="h-px bg-slate-100 my-4" />
                    <DNSRow type="TXT" host="@" content="v=spf1 ip4:SEU_IP_ZIMAOS -all" desc="Segurança SPF" />
                    <DNSRow type="TXT" host="_dmarc" content="v=DMARC1; p=quarantine;" desc="Segurança DMARC" />
                  </div>

                  <div className="mt-10 p-6 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                        <Shield className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900">DKIM & Chaves</h4>
                        <p className="text-sm text-slate-500">Pegue a chave 'default._domainkey' no painel Admin do Stalwart</p>
                      </div>
                    </div>
                    <button className="px-5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors shadow-sm">
                      Abrir Stalwart Admin
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-blue-600 rounded-3xl p-6 text-white shadow-xl shadow-blue-500/20">
                    <div className="flex items-center gap-2 mb-3">
                      <Settings className="w-5 h-5 text-blue-200" />
                      <h4 className="font-bold">Portas Essenciais</h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {['25', '587', '993'].map(port => (
                        <span key={port} className="px-3 py-1 bg-white/10 rounded-lg text-sm font-mono font-bold">{port}</span>
                      ))}
                    </div>
                    <p className="text-[10px] mt-4 opacity-60 italic">A porta 25 é o "telefone" que outros servidores (Gmail/Outlook) usam para te ligar.</p>
                  </div>
                  <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl shadow-slate-900/10">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="w-5 h-5 text-emerald-400" />
                      <h4 className="font-bold">Acesso Seguro</h4>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Usamos as versões seguras (TLS) das portas. Seus dados viajam criptografados entre seu celular e seu ZimaOS.
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
                className="space-y-6"
              >
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <Users className="w-6 h-6 text-blue-600" />
                        Gerenciamento de Usuários
                      </h2>
                      <p className="text-sm text-slate-500">Contas de email ativas no seu domínio</p>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                      <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                          type="text" 
                          placeholder="Buscar conta..." 
                          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all"
                        />
                      </div>
                      <button 
                        onClick={() => setIsAccountModalOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                      >
                        <Plus className="w-4 h-4" /> Criar Conta
                      </button>
                    </div>
                  </div>

                  {isFetchingAccounts ? (
                    <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-4">
                      <RefreshCw className="w-8 h-8 animate-spin opacity-20" />
                      <p className="text-sm font-medium">Sincronizando contas locais...</p>
                    </div>
                  ) : accounts.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-100 italic">
                            <th className="py-3 px-4 text-slate-400 font-medium">Usuário</th>
                            <th className="py-3 px-4 text-slate-400 font-medium">Status</th>
                            <th className="py-3 px-4 text-slate-400 font-medium text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {accounts.map(account => (
                            <tr key={account.id} className="hover:bg-slate-50/50 transition-colors group">
                              <td className="py-4 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold border border-blue-100">
                                    {account.name?.[0] || account.email[0]}
                                  </div>
                                  <div>
                                    <p className="font-bold text-slate-900 leading-none mb-1">{account.name}</p>
                                    <p className="text-xs text-slate-500">{account.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 px-4">
                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  Ativa
                                </span>
                              </td>
                              <td className="py-4 px-4 text-right">
                                <div className="flex justify-end gap-2">
                                  <button className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="py-20 flex flex-col items-center justify-center text-slate-400 text-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                        <Users className="w-8 h-8 opacity-20" />
                      </div>
                      <h3 className="font-bold text-slate-900 mb-1">Nenhuma conta encontrada</h3>
                      <p className="text-sm max-w-xs mx-auto">Comece criando sua primeira conta de email profissional.</p>
                      <button 
                        onClick={() => setIsAccountModalOpen(true)}
                        className="mt-6 text-blue-600 hover:text-blue-700 font-bold text-sm flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" /> Adicionar Agora
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'logs' && (
              <motion.div 
                key="logs"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-4"
              >
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="font-bold flex items-center gap-2 text-slate-900">
                      <Activity className="w-5 h-5 text-blue-600" /> Atividade em Tempo Real
                    </h3>
                    <button onClick={fetchLogs} className="p-2 hover:bg-slate-100 rounded-lg"><RefreshCw className="w-4 h-4 text-slate-400" /></button>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                    {logs.map(log => (
                      <div key={log.id} className="p-4 flex items-start gap-4 hover:bg-slate-50 transition-colors">
                        <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                          log.type === 'error' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 
                          log.type === 'smtp' ? 'bg-blue-500' : 'bg-slate-400'
                        }`} />
                        <div className="flex-1">
                          <p className="text-sm text-slate-700 font-medium">{log.message}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-1">{new Date(log.timestamp).toLocaleString()}</p>
                        </div>
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                           log.type === 'error' ? 'bg-red-50 text-red-600' : 
                           log.type === 'smtp' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {log.type}
                        </span>
                      </div>
                    ))}
                    {logs.length === 0 && (
                      <div className="p-20 text-center text-slate-400">
                        <Activity className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p>Nenhum log registrado ainda.</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-4xl mx-auto space-y-6"
              >
                <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-8">Configurações do Provedor</h2>
                  
                  <div className="space-y-8">
                    <section>
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Credenciais de Acesso (IMAP/SMTP)</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Host de Entrada (IMAP)</p>
                          <p className="text-sm font-mono font-bold text-slate-700">mail.{window.location.hostname}</p>
                          <p className="text-[10px] text-slate-400 mt-2">Porta: 993 (SSL/TLS)</p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Host de Saída (SMTP)</p>
                          <p className="text-sm font-mono font-bold text-slate-700">mail.{window.location.hostname}</p>
                          <p className="text-[10px] text-slate-400 mt-2">Porta: 465 (SSL/TLS)</p>
                        </div>
                      </div>
                    </section>

                    <section>
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Armazenamento Nativo</h4>
                      <div className="p-6 border border-slate-100 rounded-2xl flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-amber-50 rounded-xl">
                            <HardDrive className="w-6 h-6 text-amber-600" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">Modo Local Ativado</p>
                            <p className="text-xs text-slate-500">Emails e contas salvos em /app/data/*.json</p>
                          </div>
                        </div>
                        <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-lg border border-emerald-100 uppercase tracking-widest">Seguro</span>
                      </div>
                    </section>

                    <section>
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Desenvolvedor</h4>
                      <p className="text-sm text-slate-600 leading-relaxed mb-4">
                        Este provedor foi construído sob medida para rodar nativamente no ZimaOS sem dependências de terceiros como Stalwart. 
                        Toda a lógica de SMTP e armazenamento é proprietária.
                      </p>
                      <div className="bg-slate-900 rounded-2xl p-4 text-xs font-mono text-emerald-400">
                        ZimaMail Engine v3.1.0-stable
                      </div>
                    </section>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      <ComposeModal isOpen={isComposeOpen} onClose={() => setIsComposeOpen(false)} />
      <AccountModal 
        isOpen={isAccountModalOpen} 
        onClose={() => setIsAccountModalOpen(false)} 
        onSuccess={fetchAccounts}
      />
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
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    setSending(true);
    try {
      const res = await fetch("/api/mail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, body })
      });
      const data = await res.json();
      if (data.success) {
        alert("Email enviado com sucesso!");
        onClose();
      } else {
        alert("Erro ao enviar: " + data.message);
      }
    } catch (err) {
      alert("Falha na conexão com o motor de email.");
    } finally {
      setSending(false);
    }
  };

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
          <input 
            type="text" 
            placeholder="Para:" 
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20" 
          />
          <input 
            type="text" 
            placeholder="Assunto:" 
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20" 
          />
          <textarea 
            rows={8} 
            placeholder="Escreva sua mensagem..." 
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
          ></textarea>
        </div>
        <div className="p-4 bg-slate-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2 text-slate-500 font-medium">Cancelar</button>
          <button 
            onClick={handleSend}
            disabled={sending}
            className="px-8 py-2 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 disabled:opacity-50"
          >
            {sending ? "Enviando..." : "Enviar Agora"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function AccountModal({ isOpen, onClose, onSuccess }: { isOpen: boolean, onClose: () => void, onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    domain: 'amplifamarketing.com.br'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `${formData.email}@${formData.domain}`,
          name: formData.full_name,
          password: 'zima-temp-pass' // Em produção usar um gerador de senha
        })
      });
      const data = await res.json();
      if (data.success) {
        onSuccess();
        onClose();
        setFormData({ email: '', full_name: '', domain: 'amplifamarketing.com.br' });
      } else {
        alert('Erro: ' + data.message);
      }
    } catch (err) {
      alert('Erro ao criar conta: ' + (err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200"
      >
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-900">Nova Conta de Email</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500">×</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Nome Completo</label>
              <input 
                required
                type="text" 
                value={formData.full_name}
                onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Ex: João Silva" 
                className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" 
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-1">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Email (Prefixo)</label>
                <input 
                  required
                  type="text" 
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Ex: contato" 
                  className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" 
                />
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Domínio</label>
                <select 
                  className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20fill%3D%27none%27%20viewBox%3D%270%200%2020%2020%27%3E%3Cpath%20stroke%3D%27%236b7280%27%20stroke-linecap%3D%27round%27%20stroke-linejoin%3D%27round%27%20stroke-width%3D%271.5%27%20d%3D%27m6%208%204%204%204-4%27%2F%3E%3C%2Fsvg%3E')] bg-[position:right_0.75rem_center] bg-[length:1.25rem_1.25rem] bg-no-repeat"
                  value={formData.domain}
                  onChange={e => setFormData({ ...formData, domain: e.target.value })}
                >
                  <option value="amplifamarketing.com.br">@amplifamarketing.com.br</option>
                  <option value="zimaos.local">@zimaos.local</option>
                </select>
              </div>
            </div>

            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-start gap-3">
              <Shield className="w-5 h-5 text-emerald-600 mt-0.5" />
              <p className="text-[11px] text-emerald-700 leading-relaxed">
                Esta conta será criada automaticamente no servidor Stalwart e as credenciais de acesso padrão serão enviadas para o email de recuperação configurado no Supabase.
              </p>
            </div>
          </div>
          
          <div className="p-4 bg-slate-50 flex justify-end gap-3 border-t border-slate-100">
            <button 
              type="button"
              onClick={onClose} 
              className="px-6 py-2 text-slate-500 font-medium hover:text-slate-700 transition-colors"
            >
              Cancelar
            </button>
            <button 
              disabled={isSubmitting}
              className="px-8 py-2 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Salvando...
                </>
              ) : (
                'Criar Conta'
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function DNSRow({ type, host, content, priority, desc }: any) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl transition-colors border border-transparent hover:border-slate-100 group">
      <div className="flex items-center gap-4 flex-1">
        <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center font-black text-xs text-slate-500">
          {type}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1 flex-1">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{host}</p>
            <p className="text-sm font-mono text-blue-600 font-bold truncate max-w-[200px]">
              {priority && <span className="text-slate-300 mr-2">[{priority}]</span>}
              {content}
            </p>
          </div>
          <div className="hidden md:block">
            <p className="text-xs text-slate-400 mt-4 italic">{desc}</p>
          </div>
        </div>
      </div>
      <button 
        onClick={copy}
        className={`px-4 py-2 rounded-xl text-[10px] font-bold transition-all flex items-center gap-2 ${
          copied ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        }`}
      >
        {copied ? 'Copiado!' : 'Copiar'}
      </button>
    </div>
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
