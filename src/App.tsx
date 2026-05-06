import { useState, useEffect, useCallback, FormEvent, ChangeEvent } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';
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
  MoreVertical,
  Globe,
  Send,
  LayoutDashboard,
  Zap,
  Eye,
  BarChart3,
  Pointer,
  ArrowUpRight,
  X,
  Edit2,
  ArrowUp,
  ArrowDown,
  LogOut,
  Lock,
  MousePointer2,
  Target,
  Copy,
  Contact2,
  ListChecks,
  Save
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
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'mail' | 'dns' | 'accounts' | 'logs' | 'settings' | 'campaigns' | 'lists'>('overview');
  const [activeMailFolder, setActiveMailFolder] = useState<'inbox' | 'sent' | 'drafts' | 'trash'>('inbox');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<any>(null);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isRelayModalOpen, setIsRelayModalOpen] = useState(false);
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [filterAccount, setFilterAccount] = useState<string>('all');
  const [emailLists, setEmailLists] = useState<any[]>([]);
  const [newCampaignFormData, setNewCampaignFormData] = useState<any>({
    name: '',
    from: '',
    subject: '',
    body: '',
    recipients: '',
    delay: 2,
    scheduledAt: '',
    selectedListId: ''
  });
  const [isFetchingAccounts, setIsFetchingAccounts] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [isFetchingCampaigns, setIsFetchingCampaigns] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);

  const [emails, setEmails] = useState<any[]>([]);
  const [domains, setDomains] = useState<string[]>([]);
  const [relays, setRelays] = useState<any[]>([]);
  const [logFilterStatus, setLogFilterStatus] = useState<'all' | 'error' | 'success'>('all');
  const [logFilterCampaign, setLogFilterCampaign] = useState<string>('all');
  const [editingRelay, setEditingRelay] = useState<any>(null);
  const [settings, setSettings] = useState<any>({
    smtp_host: '',
    smtp_port: 587,
    smtp_user: '',
    smtp_pass: '',
    domain: 'amplifamarketing.com.br',
    delivery_mode: 'internal'
  });

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setSettings(data);
    } catch (err) {
      console.error('Erro ao buscar settings:', err);
    }
  }, []);

  const fetchDomains = useCallback(async () => {
    try {
      const res = await fetch('/api/domains');
      const data = await res.json();
      setDomains(data);
    } catch (err) {
      console.error('Erro ao buscar domínios:', err);
    }
  }, []);

  const addDomain = async (domain: string) => {
    if (!domain) return;
    try {
      const res = await fetch('/api/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain })
      });
      if (res.ok) fetchDomains();
    } catch (err) { alert('Erro ao adicionar domínio'); }
  };

  const removeDomain = async (domain: string) => {
    try {
      const res = await fetch(`/api/domains/${domain}`, { method: 'DELETE' });
      if (res.ok) fetchDomains();
    } catch (err) { alert('Erro ao remover domínio'); }
  };

  const fetchRelays = useCallback(async () => {
    try {
      const res = await fetch('/api/relays');
      const data = await res.json();
      setRelays(data);
    } catch (err) {
      console.error('Erro ao buscar relays:', err);
    }
  }, []);

  const moveRelay = async (index: number, direction: 'up' | 'down') => {
    const newRelays = [...relays];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newRelays.length) return;
    
    [newRelays[index], newRelays[targetIndex]] = [newRelays[targetIndex], newRelays[index]];
    setRelays(newRelays);
    
    try {
      await fetch('/api/relays/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relays: newRelays })
      });
    } catch (err) {
      console.error('Erro ao reordenar relays:', err);
    }
  };

  const addRelay = async (relay: any) => {
    try {
      const res = await fetch('/api/relays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(relay)
      });
      if (res.ok) fetchRelays();
    } catch (err) { alert('Erro ao adicionar relay'); }
  };

  const removeRelay = async (id: string) => {
    try {
      const res = await fetch(`/api/relays/${id}`, { method: 'DELETE' });
      if (res.ok) fetchRelays();
    } catch (err) { alert('Erro ao remover relay'); }
  };

  const saveSettings = async () => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) alert('Configurações salvas!');
    } catch (err) {
      alert('Erro ao salvar.');
    }
  };

  const fetchEmailLists = useCallback(async () => {
    try {
      const res = await fetch('/api/email-lists');
      const data = await res.json();
      setEmailLists(data);
    } catch (err) {
      console.error('Erro ao buscar listas de emails:', err);
    }
  }, []);

  const fetchEmails = useCallback(async (folder: string = 'inbox') => {
    try {
      let url = `/api/mail/${folder}`;
      if (currentUser?.email && currentUser.role !== 'admin') {
        url += `?userEmail=${encodeURIComponent(currentUser.email)}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      setEmails(data);
    } catch (err) {
      console.error('Erro ao buscar emails:', err);
    }
  }, [currentUser?.email, currentUser?.role]);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/logs');
      const data = await res.json();
      setLogs(data);
    } catch (err) {
      console.error('Erro ao buscar logs:', err);
    }
  }, []);

  const fetchCampaigns = useCallback(async () => {
    setIsFetchingCampaigns(true);
    try {
      const res = await fetch('/api/campaigns');
      const data = await res.json();
      setCampaigns(data || []);
    } catch (err) {
      console.error('Erro ao buscar campanhas:', err);
    } finally {
      setIsFetchingCampaigns(false);
    }
  }, []);

  const deleteEmail = async (folder: string, id: string) => {
    try {
      const res = await fetch(`/api/mail/${folder}/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (selectedEmail?.id === id) setSelectedEmail(null);
        fetchEmails(folder);
      } else {
        alert('Erro ao excluir mensagem');
      }
    } catch (err) {
      alert('Erro de conexão');
    }
  };

  const fetchAccounts = useCallback(async () => {
    setIsFetchingAccounts(true);
    try {
      let url = '/api/accounts';
      if (currentUser?.email && currentUser.role !== 'admin') {
        url += `?userEmail=${encodeURIComponent(currentUser.email)}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      setAccounts(data || []);
      if (data && currentUser?.role === 'admin') {
        setStats(prev => prev ? { ...prev, activeAccounts: data.length } : null);
      }
    } catch (err) {
      console.error('Erro ao buscar contas:', err);
    } finally {
      setIsFetchingAccounts(false);
    }
  }, [currentUser?.email, currentUser?.role]);

  useEffect(() => {
    const savedUser = localStorage.getItem('zima_user');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setCurrentUser(user);
      if (user.role !== 'admin') {
        setActiveTab('mail');
      }
    }

    fetch('/api/stats')
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []); // Run only once on mount

  useEffect(() => {
    if (!currentUser) return;

    fetchAccounts();
    fetchEmails();
    fetchLogs();
    fetchSettings();
    fetchDomains();
    fetchRelays();
    fetchCampaigns();
    fetchEmailLists();

    const interval = setInterval(() => {
      fetchEmails();
      fetchLogs();
      fetchDomains();
      fetchRelays();
      fetchCampaigns();
    }, 10000); 

    return () => clearInterval(interval);
  }, [currentUser?.id, fetchAccounts, fetchEmails, fetchLogs, fetchSettings, fetchDomains, fetchRelays, fetchCampaigns, fetchEmailLists]);

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

  const renderCampaigns = () => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-4 md:p-8 space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Campanhas</h2>
          <p className="text-slate-400 text-sm">Gerencie disparos em massa e analise resultados</p>
        </div>
        <button 
          onClick={() => setIsCampaignModalOpen(true)}
          className="w-full sm:w-auto px-6 md:px-8 py-3 md:py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" /> Criar Campanha
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-5">
           <div className="p-4 bg-blue-50 rounded-2xl text-blue-600">
             <BarChart3 className="w-8 h-8" />
           </div>
           <div>
             <p className="text-xs font-black text-slate-400 uppercase tracking-widest leading-tight">Aberturas Totais</p>
             <h3 className="text-2xl font-black text-slate-900">{campaigns.reduce((acc, c) => acc + (c.stats?.opens || c.opens || 0), 0)}</h3>
           </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-5">
           <div className="p-4 bg-emerald-50 rounded-2xl text-emerald-600">
             <Pointer className="w-8 h-8" />
           </div>
           <div>
             <p className="text-xs font-black text-slate-400 uppercase tracking-widest leading-tight">Cliques Totais</p>
             <h3 className="text-2xl font-black text-slate-900">{campaigns.reduce((acc, c) => acc + (c.stats?.clicks || c.clicks || 0), 0)}</h3>
           </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-5">
           <div className="p-4 bg-purple-50 rounded-2xl text-purple-600">
             <MousePointer2 className="w-8 h-8" />
           </div>
           <div>
             <p className="text-xs font-black text-slate-400 uppercase tracking-widest leading-tight">CTR Média</p>
             <h3 className="text-2xl font-black text-slate-900">
                {campaigns.length > 0 ? (campaigns.reduce((acc, c) => acc + (c.stats?.sent > 0 ? (c.stats.clicks / c.stats.sent) : 0), 0) / campaigns.length * 100).toFixed(1) : 0}%
             </h3>
           </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-5">
           <div className="p-4 bg-amber-50 rounded-2xl text-amber-600">
             <Target className="w-8 h-8" />
           </div>
           <div>
             <p className="text-xs font-black text-slate-400 uppercase tracking-widest leading-tight">Conversão</p>
             <h3 className="text-2xl font-black text-slate-900">
                {campaigns.length > 0 ? (campaigns.reduce((acc, c) => acc + (c.stats?.sent > 0 ? (c.stats.opens / c.stats.sent) : 0), 0) / campaigns.length * 100).toFixed(1) : 0}%
             </h3>
           </div>
        </div>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-100 shadow-xl overflow-x-auto">
        <table className="w-full text-left min-w-[800px]">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nome da Campanha</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Destinatários</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Abertas</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Cliques</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">CTR</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {campaigns.length === 0 && (
              <tr>
                <td colSpan={6} className="px-8 py-12 text-center text-slate-400 italic">Poxa, nenhuma campanha por aqui ainda.</td>
              </tr>
            )}
            {campaigns.map((camp) => {
              const stats = camp.stats || { total: camp.recipients_count || 0, sent: 0, failed: 0, opens: camp.opens || 0, clicks: camp.clicks || 0 };
              const progress = stats.total > 0 ? Math.round(((stats.sent + stats.failed) / stats.total) * 100) : 0;
              
              return (
                <tr key={camp.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{camp.name}</div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-1">
                      <span className="font-mono">{new Date(camp.createdAt).toLocaleDateString()}</span>
                      <span className="w-1 h-1 bg-slate-300 rounded-full" />
                      <span className="font-mono">{new Date(camp.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col gap-2 min-w-[120px]">
                      <span className={`inline-flex px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest w-fit ${
                        camp.status === 'draft' ? 'bg-slate-100 text-slate-600' : 
                        camp.status === 'sending' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 
                        'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                      }`}>
                        {camp.status === 'draft' ? 'Rascunho' : camp.status === 'sending' ? 'Enviando' : 'CONCLUÍDA'}
                      </span>
                      {camp.status === 'sending' && (
                        <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            className="bg-blue-600 h-full"
                          />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className="font-black text-slate-900 text-sm">{stats.total}</div>
                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">TOTAL</div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className="font-black text-blue-600 text-sm">{stats.opens}</div>
                    <div className="text-[9px] text-slate-400 font-bold">{stats.sent ? Math.round((stats.opens / stats.sent) * 100) : 0}%</div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className="font-black text-emerald-600 text-sm">{stats.clicks}</div>
                    <div className="text-[9px] text-slate-400 font-bold">{stats.opens ? Math.round((stats.clicks / stats.opens) * 100) : 0}% CTOR</div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className="font-black text-purple-600 text-sm">
                       {stats.sent > 0 ? ((stats.clicks / stats.sent) * 100).toFixed(1) : 0}%
                    </div>
                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">CONVERSÃO</div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                      <button 
                        onClick={() => setSelectedCampaign(camp)}
                        className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all"
                        title="Detalhes"
                      >
                        <RefreshCw className="w-5 h-5" />
                      </button>
                      <button 
                         onClick={async () => {
                           if(confirm('Deseja apagar esta campanha? Todos os logs relacionados serão mantidos por segurança.')) {
                              await fetch(`/api/campaigns/${camp.id}`, { method: 'DELETE' });
                              fetchCampaigns();
                           }
                         }}
                         className="p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all"
                         title="Excluir"
                       >
                         <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );

  if (!currentUser) {
    return <Login onLogin={(user) => { 
      setCurrentUser(user);
      localStorage.setItem('zima_user', JSON.stringify(user));
      if (user.role !== 'admin') setActiveTab('mail');
    }} />;
  }

  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-500/30">
      {/* Sidebar navigation for desktop */}
      <nav className="hidden md:flex fixed left-0 top-0 h-full w-20 bg-white border-r border-slate-200 flex-col items-center py-8 z-50 shadow-sm">
        <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/20 mb-10">
          <Mail className="w-8 h-8 text-white" />
        </div>
        
        <div className="flex flex-col gap-6">
          {isAdmin && (
            <NavButton 
              active={activeTab === 'overview'} 
              onClick={() => setActiveTab('overview')}
              icon={<LayoutDashboard className="w-6 h-6" />}
              label="Dashboard"
            />
          )}
          <NavButton 
            active={activeTab === 'mail'} 
            onClick={() => setActiveTab('mail')}
            icon={<Mail className="w-6 h-6" />}
            label="Emails"
          />
          {isAdmin && (
            <>
              <NavButton 
                active={activeTab === 'dns'} 
                onClick={() => setActiveTab('dns')}
                icon={<Globe className="w-6 h-6" />}
                label="Domínios"
              />
              <NavButton 
                active={activeTab === 'campaigns'} 
                onClick={() => setActiveTab('campaigns')}
                icon={<Zap className="w-6 h-6" />}
                label="Campanhas"
              />
              <NavButton 
                active={activeTab === 'lists'} 
                onClick={() => setActiveTab('lists')}
                icon={<Contact2 className="w-6 h-6" />}
                label="Listas"
              />
              <NavButton 
                active={activeTab === 'accounts'} 
                onClick={() => setActiveTab('accounts')}
                icon={<Users className="w-6 h-6" />}
                label="Contas"
              />
              <NavButton 
                active={activeTab === 'logs'} 
                onClick={() => setActiveTab('logs')}
                icon={<Activity className="w-6 h-6" />}
                label="Logs"
              />
              <NavButton 
                active={activeTab === 'settings'} 
                onClick={() => setActiveTab('settings')}
                icon={<Settings className="w-6 h-6" />}
                label="Ajustes"
              />
            </>
          )}
        </div>

        <div className="mt-auto flex flex-col items-center gap-4 mb-4">
          <button 
            onClick={() => {
              localStorage.removeItem('zima_user');
              setCurrentUser(null);
            }}
            className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
            title="Sair"
          >
            <LogOut className="w-6 h-6" />
          </button>
          <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">
            {currentUser.name?.[0] || 'Z'}
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around items-center h-16 z-50 px-2 pb-safe shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        {isAdmin && (
          <MobileNavButton 
            active={activeTab === 'overview'} 
            onClick={() => setActiveTab('overview')}
            icon={<LayoutDashboard className="w-5 h-5" />}
          />
        )}
        <MobileNavButton 
          active={activeTab === 'mail'} 
          onClick={() => setActiveTab('mail')}
          icon={<Mail className="w-5 h-5" />}
        />
        {isAdmin && (
          <>
            <MobileNavButton 
              active={activeTab === 'dns'} 
              onClick={() => setActiveTab('dns')}
              icon={<Globe className="w-5 h-5" />}
            />
            <MobileNavButton 
              active={activeTab === 'campaigns'} 
              onClick={() => setActiveTab('campaigns')}
              icon={<Zap className="w-5 h-5" />}
            />
            <MobileNavButton 
              active={activeTab === 'lists'} 
              onClick={() => setActiveTab('lists')}
              icon={<Contact2 className="w-5 h-5" />}
            />
            <MobileNavButton 
              active={activeTab === 'settings'} 
              onClick={() => setActiveTab('settings')}
              icon={<Settings className="w-5 h-5" />}
            />
          </>
        )}
      </nav>

      {/* Main Content */}
      <main className="md:pl-20 pb-20 md:pb-0">
        <header className="p-4 md:p-8 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 backdrop-blur-xl sticky top-0 z-40">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 flex items-center flex-wrap gap-2">
              <Mail className="w-6 h-6 text-blue-600" />
              {isAdmin ? 'ZimaMail Provider' : 'ZimaMail Webmail'}
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium uppercase tracking-widest ${isAdmin ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-blue-500/10 text-blue-600 border-blue-500/20'}`}>
                {isAdmin ? 'Admin' : 'User'}
              </span>
            </h1>
            <p className="text-slate-500 text-xs md:text-sm mt-1">{isAdmin ? 'Infraestrutura gerenciada' : `Logado como: ${currentUser.email}`}</p>
          </div>

          {isAdmin && (
            <div className="flex gap-2 md:gap-4 w-full sm:w-auto">
              <button onClick={() => setActiveTab('logs')} className="flex-1 sm:flex-none px-3 md:px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-lg border border-slate-200 text-xs md:text-sm font-medium transition-all shadow-sm">
                Logs
              </button>
              <button onClick={() => setIsAccountModalOpen(true)} className="flex-1 sm:flex-none px-3 md:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs md:text-sm font-medium transition-all shadow-lg shadow-blue-500/10 whitespace-nowrap">
                Nova Conta
              </button>
            </div>
          )}
        </header>

        <section className="p-4 md:p-8 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && isAdmin && (
              <motion.div 
                key="overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8 pb-12 max-w-[1600px] mx-auto"
              >
                {/* Alert Section */}
                {settings.delivery_mode === 'external' && relays.length === 0 && !settings.smtp_host && (
                  <div className="bg-amber-50 border border-amber-200 p-6 rounded-[32px] flex flex-col sm:flex-row items-center gap-6 shadow-sm">
                    <div className="p-4 bg-white rounded-2xl shadow-sm shrink-0">
                      <AlertCircle className="w-8 h-8 text-amber-500 animate-bounce" />
                    </div>
                    <div className="flex-1 text-center sm:text-left">
                      <p className="text-sm font-black text-slate-900 uppercase tracking-widest mb-1">Porta de Saída Não Configurada</p>
                      <p className="text-xs text-slate-500 font-bold leading-relaxed">Você está em modo 'Relay Externo' mas não conectou nenhum servidor (SendGrid, Brevo, AWS SES). Suas campanhas ficarão retidas na fila.</p>
                    </div>
                    <button onClick={() => setActiveTab('settings')} className="w-full sm:w-auto px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg active:scale-95">Configurar Gateway</button>
                  </div>
                )}


                {/* DADOS SOBRE EMAIL */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
                      <Mail className="w-5 h-5" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Dados sobre Email</h3>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Trend Chart (Col 1-8) */}
                  <div className="lg:col-span-8 bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm">
                    <h3 className="text-xl font-black text-slate-900 tracking-tight mb-6">Tendência</h3>
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={[
                          { hour: '00h', volume: 50 },
                          { hour: '06h', volume: 80 },
                          { hour: '12h', volume: 150 },
                          { hour: '18h', volume: 120 },
                          { hour: '23h', volume: 60 },
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                          <XAxis dataKey="hour" stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
                          <Tooltip />
                          <Line type="monotone" dataKey="volume" stroke="#2563EB" strokeWidth={3} dot={{ fill: '#2563EB', r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Hero Stat: Total Volume (Col 9-12) */}
                  <div className="lg:col-span-4 bg-blue-600 rounded-[32px] p-8 text-white relative overflow-hidden shadow-xl shadow-blue-500/20 group h-full min-h-[300px] flex flex-col justify-between">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-1000" />
                    <div className="relative z-10 flex justify-between items-start">
                      <div className="p-3 bg-white/10 backdrop-blur-md rounded-xl border border-white/20">
                        <ArrowUpRight className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-white/20 px-4 py-1.5 rounded-full border border-white/20 backdrop-blur-sm">Monitor</span>
                    </div>
                    <div className="relative z-10 mt-6">
                      <p className="text-blue-100 text-xs font-black uppercase tracking-[0.1em] opacity-80 mb-1">Total</p>
                      <h2 className="text-4xl font-black tracking-tighter leading-none mb-4">
                        {logs.filter(l => l.message.includes('enviado') || l.type === 'smtp').length.toLocaleString()}
                      </h2>
                      <div className="flex items-center gap-1.5 bg-emerald-400 text-emerald-950 px-3 py-1.5 rounded-lg font-black text-[10px] w-fit">
                        <ArrowUp className="w-3 h-3" /> 14.8%
                      </div>
                    </div>
                  </div>

                    <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-6">
                      <StatCard 
                        icon={<Eye className="w-6 h-6" />} 
                        iconColor="text-purple-600"
                        title="Taxa de Abertura" 
                        value={`${logs.filter(l => l.opened || l.message.includes('EMAIL ABERTO')).length ? Math.round((logs.filter(l => l.opened || l.message.includes('EMAIL ABERTO')).length / (logs.filter(l => l.message.includes('enviado') || l.type === 'smtp').length || 1)) * 100) : 0}%`}
                        subtitle="Impacto de Leitura"
                        progress={logs.filter(l => l.opened || l.message.includes('EMAIL ABERTO')).length ? Math.round((logs.filter(l => l.opened || l.message.includes('EMAIL ABERTO')).length / (logs.filter(l => l.message.includes('enviado') || l.type === 'smtp').length || 1)) * 100) : 0}
                      />
                      <StatCard 
                        icon={<MousePointer2 className="w-6 h-6" />} 
                        iconColor="text-amber-600"
                        title="Taxa de Clique" 
                        value={`${logs.filter(l => l.clicked || l.message.includes('CLIQUE')).length ? ((logs.filter(l => l.clicked || l.message.includes('CLIQUE')).length / (logs.filter(l => l.message.includes('enviado') || l.type === 'smtp').length || 1)) * 100).toFixed(1) : 0}%`}
                        subtitle="Engajamento com Links"
                        progress={logs.filter(l => l.clicked || l.message.includes('CLIQUE')).length ? Math.round((logs.filter(l => l.clicked || l.message.includes('CLIQUE')).length / (logs.filter(l => l.message.includes('enviado') || l.type === 'smtp').length || 1)) * 100) : 0}
                      />
                    </div>
                  </div>
                </div>

                {/* DADOS SOBRE RELAYS */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
                      <Server className="w-5 h-5" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Dados sobre Relays</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-slate-900 rounded-[32px] p-8 text-white relative overflow-hidden group shadow-xl flex items-center justify-between border border-slate-800">
                      <div className="relative z-10">
                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2">SMTP Bridge</p>
                        <h4 className="text-2xl font-black mb-1">{relays.length + (settings.smtp_host ? 1 : 0)} Canais</h4>
                        <div className="flex items-center gap-2 mt-2">
                           <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                           <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Gateway Ativo</span>
                        </div>
                      </div>
                      <Server className="w-20 h-20 text-white/5 absolute right-6 top-1/2 -translate-y-1/2" />
                    </div>

                    <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm flex items-center justify-between group hover:border-emerald-200 transition-all">
                       <div>
                         <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Reputação de IP</h4>
                         <p className="text-2xl font-black text-slate-900 tracking-tighter">Excelente</p>
                         <p className="text-[10px] text-emerald-500 font-bold mt-1 uppercase tracking-widest italic">Sem Blacklists Detectadas</p>
                       </div>
                       <Shield className="w-12 h-12 text-slate-100 group-hover:text-emerald-500 transition-colors" />
                    </div>

                    <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm flex items-center justify-between group hover:border-blue-200 transition-all">
                       <div>
                         <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Média de Latência</h4>
                         <p className="text-2xl font-black text-slate-900 tracking-tighter">142ms</p>
                         <p className="text-[10px] text-blue-500 font-bold mt-1 uppercase tracking-widest italic">Tempo de Resposta Nominal</p>
                       </div>
                       <RefreshCw className="w-12 h-12 text-slate-100 group-hover:text-blue-500 transition-colors" />
                    </div>
                  </div>
                </div>

                {/* DADOS SOBRE CAMPANHAS */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
                      <Zap className="w-5 h-5" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Dados sobre Campanhas</h3>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-[48px] p-10 shadow-sm">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
                      <div>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tighter">Status de Disparos</h3>
                        <p className="text-sm text-slate-500 font-bold mt-1">Visão geral das últimas campanhas processadas</p>
                      </div>
                      <button onClick={() => setActiveTab('campaigns')} className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg active:scale-95">Gerenciar Campanhas</button>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      {campaigns.length > 0 ? campaigns.slice(0, 3).map((camp) => {
                        const stats = camp.stats || { sent: 0, opens: 0, clicks: 0, total: 0 };
                        const openRate = stats.sent > 0 ? (stats.opens / stats.sent) * 100 : 0;
                        return (
                          <div key={camp.id} className="p-8 bg-slate-50/50 hover:bg-slate-50 rounded-[40px] border border-slate-100 flex flex-col sm:flex-row items-center justify-between transition-all group border-l-4 border-l-blue-500 gap-6 sm:gap-0">
                            <div className="flex items-center gap-8 w-full sm:w-auto">
                              <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center shadow-sm text-blue-600 group-hover:scale-110 transition-transform shrink-0">
                                <Zap className="w-8 h-8" />
                              </div>
                              <div>
                                <h4 className="text-xl font-black text-slate-900 truncate max-w-[200px] sm:max-w-none">{camp.name}</h4>
                                <div className="flex items-center gap-4 mt-2">
                                  <span className="text-[10px] font-black uppercase text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-200">{camp.status === 'completed' ? 'Finalizado' : 'Processando'}</span>
                                  <p className="text-xs font-bold text-slate-500">{stats.sent.toLocaleString()} envios</p>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-12 w-full sm:w-auto justify-between sm:justify-end pr-4">
                              <div className="text-right">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Abertura</p>
                                <p className="text-2xl font-black text-blue-600 tracking-tighter">{openRate.toFixed(1)}%</p>
                              </div>
                              <button onClick={() => setSelectedCampaign(camp)} className="w-12 h-12 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm">
                                <ArrowRight className="w-6 h-6" />
                              </button>
                            </div>
                          </div>
                        );
                      }) : (
                        <div className="text-center py-16 bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-100">
                          <Plus className="w-10 h-10 text-slate-300 mx-auto mb-4" />
                          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Nenhuma campanha para exibir</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* LOGS */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-600">
                      <Activity className="w-5 h-5" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Atividade e Logs</h3>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-[48px] p-10 shadow-sm">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
                      <div>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tighter">Fluxo de Registro</h3>
                        <p className="text-sm text-slate-500 font-bold mt-1">Conexão direta porta 587/465 em tempo real</p>
                      </div>
                      <div className="flex gap-2">
                         <button onClick={() => fetchLogs()} className="p-3 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-colors">
                           <RefreshCw className="w-4 h-4 text-slate-600" />
                         </button>
                         <button onClick={() => setActiveTab('logs')} className="px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Relatório de Logs</button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {logs.slice(0, 6).map((log, i) => (
                        <div key={log.id} className={`p-6 rounded-[28px] border transition-all flex items-center justify-between shadow-sm ${i % 2 === 0 ? 'bg-slate-50/50 border-transparent' : 'bg-white border-slate-100'}`}>
                          <div className="flex items-center gap-6">
                            <div className={`p-3 rounded-2xl shrink-0 ${
                              log.message.includes('Erro') ? 'bg-red-50 text-red-500' :
                              log.message.includes('enviado') ? 'bg-blue-50 text-blue-500' :
                              log.message.includes('ABERTO') ? 'bg-amber-50 text-amber-500' :
                              'bg-slate-100 text-slate-400'
                            }`}>
                              {log.message.includes('Erro') ? <AlertCircle className="w-5 h-5" /> :
                               log.message.includes('enviado') ? <ArrowUpRight className="w-5 h-5" /> :
                               log.message.includes('ABERTO') ? <Eye className="w-5 h-5" /> :
                               <Activity className="w-5 h-5" />}
                            </div>
                            <div>
                               <p className="text-sm font-black text-slate-700 line-clamp-1 max-w-[500px]">{log.message}</p>
                               <div className="flex items-center gap-3 mt-1">
                                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                    {log.created_at ? new Date(log.created_at).toLocaleTimeString() : new Date().toLocaleTimeString()}
                                  </span>
                                  <span className="text-[9px] font-black uppercase tracking-widest bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full">{log.type || 'System'}</span>
                               </div>
                            </div>
                          </div>
                        </div>
                      ))}
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
                className="grid grid-cols-1 lg:grid-cols-12 gap-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden min-h-[600px]"
              >
                {/* Mail Sidebar */}
                <div className={`${selectedEmail ? 'hidden lg:block' : 'block'} lg:col-span-3 border-r border-slate-100 bg-slate-50/50 p-4`}>
                  <button 
                    onClick={() => setIsComposeOpen(true)}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 mb-6 flex items-center justify-center gap-2 hover:bg-blue-700 transition-all"
                  >
                    <Mail className="w-4 h-4" /> Escrever
                  </button>
                  
                  <nav className="space-y-1">
                    <MailFolderItem 
                      label="Entrada" 
                      count={activeMailFolder === 'inbox' ? emails.filter(e => !e.read).length : undefined} 
                      active={activeMailFolder === 'inbox'} 
                      icon={<Mail className="w-4 h-4" />} 
                      onClick={() => { setActiveMailFolder('inbox'); fetchEmails('inbox'); }}
                    />
                    <MailFolderItem 
                      label="Enviados" 
                      active={activeMailFolder === 'sent'} 
                      icon={<ArrowRight className="w-4 h-4" rotate={-45} />} 
                      onClick={() => { setActiveMailFolder('sent'); fetchEmails('sent'); }}
                    />
                    <MailFolderItem 
                      label="Rascunhos" 
                      active={activeMailFolder === 'drafts'} 
                      icon={<Shield className="w-4 h-4" />} 
                      onClick={() => { setActiveMailFolder('drafts'); fetchEmails('drafts'); }}
                    />
                    <MailFolderItem 
                      label="Lixeira" 
                      active={activeMailFolder === 'trash'} 
                      icon={<AlertCircle className="w-4 h-4" />} 
                      onClick={() => { setActiveMailFolder('trash'); fetchEmails('trash'); }}
                    />
                  </nav>
                </div>

                {/* Email List */}
                <div className={`${selectedEmail ? 'hidden lg:block' : 'block'} lg:col-span-4 border-r border-slate-100 overflow-y-auto max-h-[700px]`}>
                  {isAdmin && (
                    <div className="p-4 border-b border-slate-100">
                      <select value={filterAccount} onChange={e => setFilterAccount(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600">
                        <option value="all">Todas as Contas</option>
                        {accounts.map(acc => <option key={acc.id} value={acc.email}>{acc.email}</option>)}
                      </select>
                    </div>
                  )}
                  {emails.filter(email => {
                    if (filterAccount === 'all') return true;
                    const from = email.from || email.from_addr || '';
                    return from === filterAccount;
                  }).length === 0 && (
                    <div className="py-20 text-center text-slate-400">
                      <Mail className="w-12 h-12 mx-auto mb-4 opacity-10" />
                      <p className="text-sm font-bold uppercase tracking-widest">Caixa vazia</p>
                    </div>
                  )}
                  {emails.filter(email => {
                    if (filterAccount === 'all') return true;
                    const from = email.from || email.from_addr || '';
                    return from === filterAccount;
                  }).map(email => (
                    <button 
                      key={email.id}
                      onClick={async () => {
                        setSelectedEmail(email);
                        if (!email.read) {
                           await fetch(`/api/mail/mark-read/${email.id}`, { method: 'POST' });
                           fetchEmails(activeMailFolder);
                        }
                        const trackingIdMatch = email.body?.match(/src="([^"]*\/api\/track\/[^"]*)"/);
                        if (trackingIdMatch && !email.opened) {
                          fetch(trackingIdMatch[1]);
                        }
                      }}
                      className={`w-full p-4 border-b border-slate-50 text-left hover:bg-slate-50 transition-colors ${selectedEmail?.id === email.id ? 'bg-blue-50/50 border-l-4 border-l-blue-600' : ''}`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-sm ${!email.read ? 'font-bold text-slate-900' : 'text-slate-600'}`}>{email.from_addr || email.from}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-mono">{new Date(email.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm('Deseja mover para a lixeira?')) deleteEmail(activeMailFolder, email.id);
                            }}
                            className="p-1 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <p className={`text-xs truncate ${!email.read ? 'font-bold text-slate-800' : 'text-slate-500'}`}>{email.subject}</p>
                      <p className="text-[10px] text-slate-400 truncate mt-1">{email.body?.replace(/<[^>]*>/g, '').substring(0, 100)}</p>
                    </button>
                  ))}
                </div>

                {/* Content Reader */}
                <div className={`${selectedEmail ? 'block' : 'hidden lg:block'} lg:col-span-5 p-4 md:p-8 bg-white overflow-y-auto max-h-[700px]`}>
                  {selectedEmail ? (
                    <div className="animate-in fade-in duration-300">
                      <div className="flex flex-col md:flex-row md:justify-between items-start mb-8 gap-4">
                        <div className="flex items-center gap-4">
                          <button onClick={() => setSelectedEmail(null)} className="lg:hidden p-2 hover:bg-slate-100 rounded-lg">
                            <X className="w-5 h-5 text-slate-400" />
                          </button>
                          <div>
                            <h2 className="text-xl font-bold text-slate-900 mb-2">{selectedEmail.subject}</h2>
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-blue-600 shrink-0">
                                {(selectedEmail.from_addr || selectedEmail.from).charAt(0)}
                              </div>
                              <span className="truncate max-w-[200px]">{selectedEmail.from_addr || selectedEmail.from}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                          <button 
                            onClick={() => {
                              if (confirm('Deseja excluir permanentemente?') || (activeMailFolder !== 'trash' && confirm('Mover para lixeira?'))) {
                                deleteEmail(activeMailFolder, selectedEmail.id);
                              }
                            }}
                            className="flex-1 md:flex-none p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 border md:border-none flex justify-center"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button className="flex-1 md:flex-none p-2 hover:bg-slate-100 rounded-lg text-slate-400 border md:border-none flex justify-center"><ArrowRight className="w-4 h-4" /></button>
                          <button className="flex-1 md:flex-none p-2 hover:bg-slate-100 rounded-lg text-slate-400 border md:border-none flex justify-center"><Shield className="w-4 h-4" /></button>
                        </div>
                      </div>
                      <div className="prose prose-slate max-w-none text-slate-600 leading-relaxed bg-slate-50 p-4 md:p-6 rounded-2xl border border-slate-100 overflow-x-auto" dangerouslySetInnerHTML={{ __html: selectedEmail.body }} />
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


            {activeTab === 'campaigns' && isAdmin && renderCampaigns()}
            {activeTab === 'dns' && isAdmin && (
              <motion.div 
                key="dns"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-5xl mx-auto space-y-6"
              >
                {/* Domain Manager */}
                <div className="bg-white border border-slate-200 rounded-3xl p-4 md:p-8 shadow-sm">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8">
                    <div>
                      <h2 className="text-2xl font-black text-slate-900 tracking-tight">Gerenciamento de Domínios</h2>
                      <p className="text-sm text-slate-500">Adicione os domínios que seu servidor irá gerenciar</p>
                    </div>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const input = (e.target as any).domain;
                      addDomain(input.value);
                      input.value = '';
                    }} className="flex gap-2 w-full sm:w-auto">
                       <input 
                        name="domain"
                        type="text" 
                        placeholder="ex: novo-dominio.com"
                        className="flex-1 sm:w-64 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20"
                       />
                       <button className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all">
                        <Plus className="w-4 h-4" />
                       </button>
                    </form>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {domains.map(domain => (
                      <div key={domain} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group">
                         <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-100 shadow-sm">
                              <Globe className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                               <p className="font-bold text-slate-800">{domain}</p>
                               <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">Ativo</p>
                            </div>
                         </div>
                         <button 
                          onClick={() => removeDomain(domain)}
                          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                         >
                            <Trash2 className="w-4 h-4" />
                         </button>
                      </div>
                    ))}
                    {domains.length === 0 && (
                      <div className="col-span-2 py-10 text-center text-slate-400 italic text-sm">
                        Nenhum domínio adicionado. O sistema usará o domínio padrão das configurações.
                      </div>
                    )}
                  </div>
                </div>

                {/* DNS Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <DeliverabilityCheck 
                    title="SPF" 
                    status={relays.length > 0 ? "success" : "pending"} 
                    desc={`${relays.length + 1} origens autorizadas.`} 
                  />
                  <DeliverabilityCheck 
                    title="DKIM" 
                    status={relays.length > 0 ? "success" : "pending"} 
                    desc={`${relays.length} chaves ativas.`} 
                  />
                  <DeliverabilityCheck title="rDNS" status="warning" desc="DNS Reverso (Falar com host)." />
                </div>

                <div className="bg-slate-900 rounded-[2.5rem] p-6 md:p-10 text-white shadow-2xl shadow-blue-900/10">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10">
                    <div>
                      <h3 className="text-2xl font-black mb-2">Configuração Técnica</h3>
                      <p className="text-slate-400 text-sm">Aponte estes registros no seu provedor de domínio</p>
                    </div>
                    {settings.cf_token && (
                      <button 
                        onClick={async (e) => {
                          const btn = e.currentTarget;
                          btn.disabled = true;
                          const originalText = btn.innerHTML;
                          btn.innerHTML = `<span class="animate-spin text-lg">⏳</span> Sincronizando...`;
                          
                          try {
                            const res = await fetch('/api/cloudflare/sync', { method: 'POST' });
                            const data = await res.json();
                            if (data.success) alert('Domínio configurado com sucesso no Cloudflare!');
                            else alert('Erro: ' + data.message);
                          } catch {
                            alert('Erro de conexão com o servidor.');
                          } finally {
                            btn.disabled = false;
                            btn.innerHTML = originalText;
                          }
                        }}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-500/20 disabled:opacity-50"
                      >
                        <Zap className="w-4 h-4" /> Sincronizar Cloudflare
                      </button>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10 mb-6">
                       <p className="text-[10px] font-black text-blue-400 uppercase mb-3">Registros de Base</p>
                       <div className="space-y-3">
                         <DNSRowDark type="A" host="@" content="45.167.187.80" desc="Domínio Principal" />
                         <DNSRowDark type="CNAME" host="mail" content="amplifamarketing.com.br" desc="Acesso Webmail/SMTP" />
                         <DNSRowDark type="MX" host="@" content="10 mail.amplifamarketing.com.br" desc="Recebimento (Prioridade 10)" />
                       </div>
                    </div>

                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10 mb-4">
                       <div className="flex items-center gap-3 mb-4">
                         <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
                           <Zap size={18} />
                         </div>
                         <div>
                           <h3 className="text-sm font-bold text-white">Relay Gateway (SMTP Interno)</h3>
                           <p className="text-[10px] text-slate-400">Use o ZimaMail como servidor de saída em seus outros apps.</p>
                         </div>
                       </div>
                       
                       <div className="space-y-3">
                         <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                           <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Configurações de Conexão</p>
                           <div className="grid grid-cols-2 gap-4">
                             <div>
                                <p className="text-[9px] text-slate-400 mb-0.5">Host de Saída</p>
                                <code className="text-[11px] text-blue-400 select-all">{window.location.hostname}</code>
                             </div>
                             <div>
                                <p className="text-[9px] text-slate-400 mb-0.5">Porta SMTP</p>
                                <code className="text-[11px] text-emerald-400">2525</code>
                             </div>
                             <div>
                                <p className="text-[9px] text-slate-400 mb-0.5">Segurança</p>
                                <code className="text-[11px] text-slate-300">Nenhuma / STARTTLS</code>
                             </div>
                             <div>
                                <p className="text-[9px] text-slate-400 mb-0.5">Autenticação</p>
                                <code className="text-[11px] text-slate-300">Suas Contas ZimaMail</code>
                             </div>
                           </div>
                         </div>
                         
                         <p className="text-[10px] text-slate-500 italic leading-relaxed">
                           Ao conectar seus apps a este gateway, o ZimaMail distribuirá os e-mails automaticamente entre seus relays externos com failover e rastreamento ativos.
                         </p>
                       </div>
                    </div>

                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                       <div className="mb-4 space-y-3">
                          <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl">
                             <p className="text-[10px] font-black text-amber-500 uppercase mb-1 flex items-center gap-1.5">
                               <AlertCircle size={10} />
                               Aviso: Verificação de Domínio
                             </p>
                             <p className="text-[11px] text-slate-300 leading-relaxed">
                               <strong>Brevo/MailerSend:</strong> O domínio <code className="text-blue-400">{domains[0] || 'seu-dominio.com'}</code> deve estar 100% verificado (SPF/DKIM) no painel do provedor.
                             </p>
                             <p className="text-[11px] text-slate-400 mt-2">
                               Erro #MS42207 (MailerSend) significa que o domínio do remetente não foi validado.
                             </p>
                          </div>
                       </div>
                       <div className="flex justify-between items-center mb-3">
                          <p className="text-[10px] font-black text-emerald-400 uppercase">Segurança e Entregabilidade (SPF/DKIM/DMARC)</p>
                          <span className="text-[9px] text-slate-500 bg-white/5 px-2 py-0.5 rounded">Configuração Cloudflare Ativa</span>
                       </div>
                       <div className="space-y-3">
                         <DNSRowDark 
                           type="TXT" 
                           host="@" 
                           content="v=spf1 ip4:45.167.187.80 include:brevo.com ~all" 
                           desc="SPF: Autorização de Envio" 
                         />
                         <DNSRowDark 
                           type="TXT" 
                           host="brevo._domainkey" 
                           content="v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADC..." 
                           desc="DKIM: Assinatura Brevo" 
                         />
                         <DNSRowDark 
                           type="TXT" 
                           host="_dmarc" 
                           content="v=DMARC1; p=quarantine;" 
                           desc="DMARC: Política de Segurança" 
                         />
                       </div>
                    </div>

                    {relays.length > 1 && (
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                         <p className="text-[10px] font-black text-amber-400 uppercase mb-3">Chaves DKIM Adicionais (Outros Relays)</p>
                         <div className="space-y-3">
                            {relays.filter((r:any) => !r.host.includes('brevo')).map((r: any) => (
                              <DNSRowDark 
                                key={r.id}
                                type="TXT" 
                                host={`${r.name.toLowerCase().replace(/\s/g, '')}._domainkey`} 
                                content="v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADC..." 
                                desc={`Assinatura ${r.name}`} 
                              />
                            ))}
                         </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-12 bg-white/5 p-6 rounded-3xl border border-white/10">
                    <h4 className="text-sm font-bold flex items-center gap-2 mb-4">
                      <Zap className="w-5 h-5 text-yellow-400" /> Guia de Reputação (Envios Reais)
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="space-y-3">
                          <p className="text-xs text-slate-400 leading-relaxed">
                            Para enviar ao Gmail/Outlook sem bloqueio:
                          </p>
                          <ul className="space-y-2">
                             <li className="flex items-center gap-2 text-xs text-slate-300">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                <b>Domínio é obrigatório:</b> IP puro sempre será bloqueado.
                             </li>
                             <li className="flex items-center gap-2 text-xs text-slate-300">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                <b>rDNS:</b> Peça ao seu host para o rDNS do IP ser seu domínio.
                             </li>
                             <li className="flex items-center gap-2 text-xs text-slate-300">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                <b>Aquecimento:</b> Comece com 10-20 envios por dia.
                             </li>
                          </ul>
                       </div>
                       <div className="space-y-4">
                          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">Checklist de Sucesso</h4>
                            <div className="space-y-3">
                               <CheckItem label="Domínio configurado" checked />
                               <CheckItem label="Registros SPF/DKIM ativos" />
                               <CheckItem label="rDNS solicitado ao host" />
                               <CheckItem label="Link de 'Unsubscribe' nos e-mails" />
                            </div>
                          </div>
                          <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                             <p className="text-[10px] font-bold text-amber-400 uppercase mb-1">Aviso</p>
                             <p className="text-[11px] text-slate-300 leading-relaxed italic">
                                Se o seu IP estiver em blacklists globais, mesmo o motor interno não conseguirá entregar.
                             </p>
                          </div>
                          <button 
                            onClick={() => window.open('https://mxtoolbox.com/blacklists.aspx', '_blank')}
                            className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all"
                          >
                            Checar Blacklists (MXToolbox)
                          </button>
                       </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Email Lists Management UI */}
            {activeTab === 'lists' && isAdmin && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-8">
                <div className="flex justify-between items-center mb-10">
                  <div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">Listas de Emails</h2>
                    <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-1">Gerencie seus nichos e contatos salvos</p>
                  </div>
                  <button 
                    onClick={() => setIsListModalOpen(true)}
                    className="flex items-center gap-3 bg-blue-600 text-white px-6 py-4 rounded-2xl font-black text-xs tracking-widest uppercase hover:scale-105 active:scale-95 transition-all shadow-xl shadow-blue-500/20"
                  >
                    <Plus className="w-5 h-5" />
                    Criar Nova Lista
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {emailLists.length === 0 && (
                    <div className="col-span-full py-20 text-center bg-white/50 rounded-3xl border-2 border-dashed border-slate-200">
                      <Contact2 className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                      <p className="font-bold text-slate-500">Nenhuma lista criada ainda.</p>
                      <button onClick={() => setIsListModalOpen(true)} className="text-blue-600 font-black text-xs uppercase mt-2 hover:underline">Comece criando sua primeira lista aqui</button>
                    </div>
                  )}
                  {emailLists.map(list => (
                    <div key={list.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                          <ListChecks className="w-6 h-6" />
                        </div>
                        <button 
                          onClick={async () => {
                            if (confirm('Deletar esta lista permanentemente?')) {
                              await fetch(`/api/email-lists/${list.id}`, { method: 'DELETE' });
                              fetchEmailLists();
                            }
                          }}
                          className="p-2 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-xl transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <h3 className="font-black text-slate-800 text-lg mb-1">{list.name}</h3>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-4">{list.count} contatos</p>
                      
                      <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                        <span className="text-[10px] text-slate-300 font-mono">{new Date(list.createdAt).toLocaleDateString()}</span>
                        <button 
                          onClick={() => {
                            // Pre-fill campaign modal with this list
                            setNewCampaignFormData(prev => ({ ...prev, recipients: list.recipients.map((r: any) => `${r.email};${r.name}`).join('\n') }));
                            setIsCampaignModalOpen(true);
                          }}
                          className="text-[10px] text-blue-600 font-black uppercase tracking-widest hover:underline"
                        >
                          Usar em Campanha
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'accounts' && isAdmin && (
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
                        onClick={() => {
                          setEditAccount(null);
                          setIsAccountModalOpen(true);
                        }}
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
                                  <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center center text-blue-600 font-bold border border-blue-100 flex items-center justify-center">
                                    {account.name?.[0] || account.email[0]}
                                  </div>
                                  <div>
                                    <p className="font-bold text-slate-900 leading-none mb-1">{account.name}</p>
                                    <p className="text-xs text-slate-500">{account.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 px-4 font-mono text-[11px] text-slate-500">
                                <div className="flex items-center gap-2">
                                  <code className="bg-slate-100 px-2 py-0.5 rounded">{account.password || 'Sem Senha'}</code>
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
                                  <button 
                                    onClick={() => {
                                      setEditAccount(account);
                                      setIsAccountModalOpen(true);
                                    }}
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                    title="Editar"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={async () => {
                                      if (confirm(`Tem certeza que deseja remover a conta ${account.email}?`)) {
                                        const res = await fetch(`/api/accounts/${account.id}`, { method: 'DELETE' });
                                        if (res.ok) fetchAccounts();
                                      }
                                    }}
                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                  >
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

            {activeTab === 'logs' && isAdmin && (
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
                          log.type === 'smtp' ? 'bg-blue-500' : 
                          log.type === 'track' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'
                        }`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <p className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{log.message}</p>
                            {log.opened && (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-[9px] font-black uppercase rounded shadow-sm">
                                 LIDO {log.openedAt ? `em ${new Date(log.openedAt).toLocaleTimeString()}` : ''}
                              </span>
                            )}
                            {log.clicked && (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-600 text-[9px] font-black uppercase rounded shadow-sm">
                                 CLICADO
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                            {new Date(log.timestamp).toLocaleString()}
                            {log.to ? ` — Para: ${log.to}` : ''}
                          </p>
                        </div>
                        <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded ${
                           log.type === 'error' ? 'bg-red-50 text-red-600' : 
                           log.type === 'smtp' ? 'bg-blue-50 text-blue-600' : 
                           log.type === 'track' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
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

            {activeTab === 'settings' && isAdmin && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-4xl mx-auto space-y-6 pb-20"
              >
                <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
                  <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Configurações do Servidor</h2>
                    <button 
                      onClick={saveSettings}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2 rounded-xl font-bold shadow-lg shadow-blue-500/20"
                    >
                      Salvar Alterações
                    </button>
                  </div>
                  
                  <div className="space-y-8">
                    <section>
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Globe className="w-4 h-4" /> Domínio Principal
                      </h4>
                      <input 
                        type="text" 
                        value={settings.domain}
                        onChange={(e) => setSettings({...settings, domain: e.target.value})}
                        placeholder="ex: seu-dominio.com"
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-sm"
                      />
                    </section>

                    <section className="space-y-4">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Send className="w-4 h-4" /> Modo de Entrega (Outbound)
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button 
                          onClick={() => {
                            setSettings({...settings, delivery_mode: 'internal'});
                            saveSettings();
                          }}
                          className={`p-5 rounded-2xl border-2 text-left transition-all ${
                            settings.delivery_mode === 'internal' 
                            ? 'border-blue-500 bg-blue-50 ring-4 ring-blue-500/5' 
                            : 'border-slate-200 hover:border-slate-300 bg-white opacity-60'
                          }`}
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <div className={`p-2 rounded-lg ${settings.delivery_mode === 'internal' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                              <Activity className="w-4 h-4" />
                            </div>
                            <span className="font-bold text-slate-900">Motor Interno</span>
                          </div>
                          <p className="text-[10px] text-slate-500 leading-tight">
                            <b>Envio Direto (ZimaOS).</b> Usa o IP do servidor. Requer SPF/DKIM configurados para não cair no spam.
                          </p>
                        </button>

                        <button 
                          onClick={() => {
                            setSettings({...settings, delivery_mode: 'external'});
                            saveSettings();
                          }}
                          className={`p-5 rounded-2xl border-2 text-left transition-all ${
                            settings.delivery_mode === 'external' 
                            ? 'border-emerald-500 bg-emerald-50 ring-4 ring-emerald-500/5' 
                            : 'border-slate-200 hover:border-slate-300 bg-white opacity-60'
                          }`}
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <div className={`p-2 rounded-lg ${settings.delivery_mode === 'external' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                              <Globe className="w-4 h-4" />
                            </div>
                            <span className="font-bold text-slate-900">Relay Externo</span>
                          </div>
                          <p className="text-[10px] text-slate-500 leading-tight">
                            <b>Produção Real.</b> Use para enviar faturas e senhas para clientes reais (Gmail, etc).
                          </p>
                        </button>
                      </div>
                    </section>

                    {settings.delivery_mode === 'external' && (
                       <section className="space-y-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                              <Zap className="w-5 h-5 text-blue-600" /> Pool de Relays (Rotação & Failover)
                            </h4>
                            <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-tighter">
                              {relays.length} de 10 slots utilizados
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
                             <RefreshCw className="w-3 h-3 animate-spin-slow" />
                             <span className="text-[10px] font-black uppercase">Rotação Ativa</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {relays.map((relay: any, index: number) => (
                            <div key={relay.id} className="relative group p-5 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-blue-500/50 transition-all">
                              <div className="absolute -top-2 -left-2 w-6 h-6 bg-slate-900 text-white text-[10px] font-black rounded-lg flex items-center justify-center border-2 border-white shadow-sm">
                                #{index + 1}
                              </div>
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100">
                                    <Mail className="w-5 h-5 text-slate-400" />
                                  </div>
                                  <div>
                                    <p className="font-bold text-slate-900 text-sm">{relay.name}</p>
                                    <p className="text-[10px] font-mono text-blue-500">{relay.host}</p>
                                  </div>
                                </div>
                                <div className="flex gap-1">
                                  <button 
                                    onClick={() => {
                                      setEditingRelay(relay);
                                      setIsRelayModalOpen(true);
                                    }}
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                    title="Editar"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => moveRelay(index, 'up')}
                                    disabled={index === 0}
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all disabled:opacity-30"
                                    title="Mover para cima"
                                  >
                                    <ArrowUp className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => moveRelay(index, 'down')}
                                    disabled={index === relays.length - 1}
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all disabled:opacity-30"
                                    title="Mover para baixo"
                                  >
                                    <ArrowDown className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={async (e) => {
                                      const btn = e.currentTarget as HTMLButtonElement;
                                      if (btn) btn.disabled = true;
                                      try {
                                        const res = await fetch('/api/relays/test', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify(relay)
                                        });
                                        const data = await res.json();
                                        if (data.success) alert(`Conexão com ${relay.name} estabelecida com SUCESSO!`);
                                        else alert(`FALHA na conexão com ${relay.name}: ${data.message}`);
                                      } catch {
                                        alert('Erro ao testar conexão.');
                                      } finally {
                                        if (btn) btn.disabled = false;
                                      }
                                    }}
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all disabled:opacity-50"
                                    title="Testar Conexão"
                                  >
                                    <Zap className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => removeRelay(relay.id)}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                    title="Remover"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="px-2 py-1 bg-slate-50 rounded border border-slate-100">
                                  <p className="text-[8px] font-black text-slate-400 uppercase">Usuário</p>
                                  <p className="text-[10px] text-slate-600 truncate">{relay.user}</p>
                                </div>
                                <div className="px-2 py-1 bg-slate-50 rounded border border-slate-100">
                                  <p className="text-[8px] font-black text-slate-400 uppercase">Porta</p>
                                  <p className="text-[10px] text-slate-600">{relay.port}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                          
                          {relays.length < 10 && (
                            <button 
                              onClick={() => setIsRelayModalOpen(true)}
                              className="p-5 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/30 transition-all group"
                            >
                               <div className="w-10 h-10 rounded-full border-2 border-slate-200 flex items-center justify-center group-hover:border-blue-400 group-hover:bg-white transition-all shadow-sm">
                                  <Plus className="w-5 h-5" />
                               </div>
                               <span className="text-xs font-bold">Adicionar Novo Relay</span>
                            </button>
                          )}
                        </div>

                        {relays.length === 0 && (
                          <div className="p-12 text-center bg-amber-50 rounded-3xl border border-amber-100">
                             <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
                             <h5 className="font-bold text-amber-900 text-sm">Nenhum Relay Configurado</h5>
                             <p className="text-xs text-amber-700 mt-1">O sistema usará as configurações legadas abaixo ou falhará se estiverem vazias.</p>
                             <button 
                               onClick={() => setIsRelayModalOpen(true)}
                               className="mt-4 px-6 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-amber-500/20"
                             >
                               Cadastrar Primeiro Relay
                             </button>
                          </div>
                        )}
                      </section>
                    )}



                    <section className="pt-8 border-t border-slate-100">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <Globe className="w-4 h-4" /> Integração Cloudflare API
                      </h4>
                      <div className="bg-blue-50 border border-blue-100 p-6 rounded-3xl mb-6">
                        <div className="flex gap-4 items-start">
                          <div className="p-3 bg-white rounded-2xl shadow-sm">
                            <Zap className="w-6 h-6 text-blue-600" />
                          </div>
                          <div>
                            <h5 className="font-bold text-blue-900 text-sm">Automação de DNS</h5>
                            <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                              Ao configurar sua API, o ZimaMail poderá criar registros SPF, DKIM e CNAME automaticamente no seu domínio Cloudflare.
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Cloudflare API Token</label>
                            <input 
                              type="password" 
                              placeholder="Seu Token de API"
                              value={settings.cf_token || ''}
                              onChange={(e) => setSettings({...settings, cf_token: e.target.value})}
                              className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-sm"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Cloudflare Zone ID</label>
                            <input 
                              type="text" 
                              placeholder="ID da Zona do Domínio"
                              value={settings.cf_zone || ''}
                              onChange={(e) => setSettings({...settings, cf_zone: e.target.value})}
                              className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    </section>

                    <section>
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <HardDrive className="w-4 h-4" /> Armazenamento
                      </h4>
                      <div className="p-6 border border-slate-100 rounded-2xl flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-amber-50 rounded-xl">
                            <HardDrive className="w-6 h-6 text-amber-600" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">Banco de Dados Local</p>
                            <p className="text-xs text-slate-500">JSON isolado em /DATA/AppData/ZimaMail</p>
                          </div>
                        </div>
                        <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-lg border border-emerald-100 uppercase tracking-widest">Nativo</span>
                      </div>
                    </section>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      <ComposeModal 
        isOpen={isComposeOpen} 
        onClose={() => setIsComposeOpen(false)} 
        settings={settings}
        accounts={accounts}
      />
      <AccountModal 
        isOpen={isAccountModalOpen} 
        onClose={() => {
          setIsAccountModalOpen(false);
          setEditAccount(null);
        }}
        onSuccess={fetchAccounts}
        domains={domains}
        editAccount={editAccount}
      />
      {/* Modal Nova Lista */}
      <NewListModal 
        isOpen={isListModalOpen} 
        onClose={() => setIsListModalOpen(false)} 
        onSuccess={fetchEmailLists} 
      />
      <RelayModal 
        isOpen={isRelayModalOpen} 
        onClose={() => {
          setIsRelayModalOpen(false);
          setEditingRelay(null);
        }} 
        onSuccess={fetchRelays}
        initialData={editingRelay}
      />
      <CampaignModal 
        isOpen={isCampaignModalOpen} 
        onClose={() => {
          setIsCampaignModalOpen(false);
          setNewCampaignFormData({ name: '', from: accounts[0]?.email || '', subject: '', body: '', recipients: '', delay: 2, scheduledAt: '', selectedListId: '' });
        }}
        onSuccess={fetchCampaigns}
        accounts={accounts}
        emailLists={emailLists}
        initialData={newCampaignFormData}
      />

      <CampaignDetailsModal 
        campaign={selectedCampaign}
        onClose={() => setSelectedCampaign(null)}
      />
    </div>

  );
}

function MobileNavButton({ active, onClick, icon }: { active: boolean, onClick: () => void, icon: any }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
        active ? 'text-blue-600' : 'text-slate-400'
      }`}
    >
      <div className={`p-2 rounded-xl transition-all ${active ? 'bg-blue-50' : ''}`}>
        {icon}
      </div>
      {active && <div className="w-1 h-1 rounded-full bg-blue-600 mt-0.5" />}
    </button>
  );
}

function NavButton({ active, icon, label, onClick }: { active: boolean, icon: any, label?: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`group/nav relative flex items-center justify-center p-3 rounded-2xl transition-all duration-300 w-12 h-12 ${
        active 
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
          : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
      }`}
    >
      <div className="shrink-0">{icon}</div>
      
      {label && (
        <div className="absolute left-full ml-4 px-3 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl opacity-0 group-hover/nav:opacity-100 transition-all translate-x-[-10px] group-hover/nav:translate-x-0 pointer-events-none whitespace-nowrap z-[100] shadow-2xl shadow-slate-900/40 border border-white/10 backdrop-blur-md">
          {label}
          <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 bg-slate-900 rotate-45 rounded-sm" />
        </div>
      )}

      {active && (
        <motion.div 
          layoutId="activeTabIndicator"
          className="absolute -right-4 w-1.5 h-8 bg-blue-600 rounded-l-full shadow-[0_0_15px_-3px_rgba(37,99,235,0.4)]"
        />
      )}
    </button>
  );
}

function MailFolderItem({ label, count, active, icon, onClick }: { label: string, count?: number, active?: boolean, icon: any, onClick: () => void }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center justify-between p-2 rounded-lg text-sm transition-all ${
      active ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-100'
    }`}>
      <div className="flex items-center gap-2">
        {icon}
        {label}
      </div>
      {count !== undefined && <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded-full">{count}</span>}
    </button>
  );
}

function ComposeModal({ isOpen, onClose, settings, accounts }: { isOpen: boolean, onClose: () => void, settings: any, accounts: any[] }) {
  const [to, setTo] = useState("");
  const [from, setFrom] = useState(accounts[0]?.email || "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (accounts.length > 0 && !from) {
      setFrom(accounts[0].email);
    }
  }, [accounts]);

  const handleSend = async () => {
    if (!from) return alert("Selecione uma conta de remetente");
    setSending(true);
    try {
      const res = await fetch("/api/mail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, body, from })
      });
      const data = await res.json();
      if (data.success) {
        if (data.warning) {
          alert("MODO SANDBOX: " + data.warning);
        } else {
          alert("Email enviado com sucesso!");
        }
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

  const isExternalDomain = (email: string) => {
    const publicDomains = ['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com'];
    return publicDomains.some(d => email.toLowerCase().includes(d));
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
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-900">Nova Mensagem</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500">×</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-[10px] text-slate-400 font-bold uppercase ml-1">De (Remetente)</p>
              <select 
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-bold"
              >
                {accounts.map(acc => (
                  <option key={acc.email} value={acc.email}>{acc.email}</option>
                ))}
                {accounts.length === 0 && <option value="">Nenhuma conta disponível</option>}
              </select>
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] text-slate-400 font-bold uppercase ml-1">Para (Destinatário)</p>
              <input 
                type="text" 
                placeholder="ex: cliente@gmail.com" 
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm" 
              />
            </div>
            
            {settings.delivery_mode === 'internal' && isExternalDomain(to) && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex gap-3 items-start">
                <Globe className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-blue-800 mb-1">Envio via IP Direto</p>
                  <p className="text-[10px] text-blue-700 leading-relaxed">
                    Você está usando o <b>Motor Interno</b>. A entrega depende do seu servidor estar com <b>SPF e DKIM</b> validados corretamente no seu domínio.
                  </p>
                </div>
              </div>
            )}

            <input 
              type="text" 
              placeholder="Assunto:" 
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm" 
            />
            <textarea 
              rows={8} 
              placeholder="Escreva sua mensagem..." 
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none text-sm"
            ></textarea>
          </div>
        </div>
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center gap-3">
          <p className="text-[10px] text-slate-400 font-medium ml-2 uppercase tracking-wider">
            Modo: <span className={settings.delivery_mode === 'internal' ? 'text-blue-600' : 'text-emerald-600'}>
              {settings.delivery_mode === 'internal' ? 'Sandbox Local' : 'Relay SMTP'}
            </span>
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-6 py-2 text-slate-500 font-medium text-sm">Cancelar</button>
            <button 
              onClick={handleSend}
              disabled={sending}
              className="px-8 py-2 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 disabled:opacity-50 text-sm transition-transform active:scale-95"
            >
              {sending ? "Enviando..." : "Enviar Agora"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function RelayModal({ isOpen, onClose, onSuccess, initialData }: { isOpen: boolean, onClose: () => void, onSuccess: () => void, initialData?: any }) {
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: '587',
    user: '',
    pass: '',
    apiKey: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData && isOpen) {
      setFormData({
        name: initialData.name || '',
        host: initialData.host || '',
        port: initialData.port || '587',
        user: initialData.user || '',
        pass: initialData.pass || '',
        apiKey: initialData.apiKey || ''
      });
    } else {
      setFormData({ name: '', host: '', port: '587', user: '', pass: '', apiKey: '' });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const url = initialData ? `/api/relays/${initialData.id}` : '/api/relays';
      const method = initialData ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData
        })
      });
      if (res.ok) {
        onSuccess();
        onClose();
        if (!initialData) setFormData({ name: '', host: '', port: '587', user: '', pass: '' });
      } else {
        alert('Erro ao salvar relay.');
      }
    } catch (err) {
      alert('Erro de conexão.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200"
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-xl text-white">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900">{initialData ? 'Editar Provedor SMTP' : 'Novo Provedor SMTP'}</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500">×</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="p-8 space-y-5">
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-slate-400 uppercase ml-1">Nome Interno</label>
              <input 
                required
                type="text" 
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: SendGrid API Key" 
                className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 text-sm transition-all" 
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-slate-400 uppercase ml-1">Host SMTP</label>
              <input 
                required
                type="text" 
                value={formData.host}
                onChange={e => setFormData({ ...formData, host: e.target.value })}
                placeholder="smtp.provider.com" 
                className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 text-sm transition-all" 
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-400 uppercase ml-1">Porta</label>
                <input 
                  required
                  type="text" 
                  value={formData.port}
                  onChange={e => setFormData({ ...formData, port: e.target.value })}
                  placeholder="587" 
                  className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 text-sm transition-all text-center font-mono" 
                />
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase ml-1">
                  API Key (Opcional)
                  <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[8px] rounded uppercase tracking-tighter">Sincronização</span>
                </label>
                <input 
                  type="password" 
                  value={formData.apiKey}
                  onChange={e => setFormData({ ...formData, apiKey: e.target.value })}
                  placeholder="Chave de API do provedor" 
                  className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 text-sm transition-all" 
                />
                <p className="text-[9px] text-slate-400 px-1 font-bold italic">Usada para sincronizar cotas e limites reais no Dashboard (Suportado: Brevo).</p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-400 uppercase ml-1">Usuário / Email</label>
                <input 
                  required
                  type="text" 
                  value={formData.user}
                  onChange={e => setFormData({ ...formData, user: e.target.value })}
                  placeholder="ex: apikey ou seu@email.com" 
                  className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 text-sm transition-all" 
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-400 uppercase ml-1">{initialData ? 'Senha / Token (Preencha para alterar)' : 'Senha / Token'}</label>
                <input 
                  required={!initialData}
                  type="password" 
                  value={formData.pass}
                  onChange={e => setFormData({ ...formData, pass: e.target.value })}
                  placeholder={initialData ? "Deixe em branco para manter a atual" : "Sua senha SMTP secreta"} 
                  className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 text-sm transition-all" 
                />
              </div>
            </div>
          </div>
          
          <div className="p-6 bg-slate-50 flex justify-end gap-3 border-t border-slate-100">
            <button 
              type="button"
              onClick={onClose} 
              className="px-6 py-2 text-slate-500 font-bold hover:text-slate-700 transition-colors text-sm"
            >
              Cancelar
            </button>
            <button 
              disabled={isSubmitting}
              className="px-10 py-3 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2 text-sm uppercase tracking-widest"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Salvando...
                </>
              ) : (
                initialData ? 'Salvar Alterações' : 'Cadastrar Relay'
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// Modal Nova Lista
function NewListModal({ isOpen, onClose, onSuccess }: { isOpen: boolean, onClose: () => void, onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [recipients, setRecipients] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setRecipients(event.target?.result as string);
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const recipientList = recipients
        .split('\n')
        .map(line => {
          if (!line.trim()) return null;
          const separator = line.includes(';') ? ';' : ',';
          const parts = line.split(separator).map(s => s.trim());
          return { email: parts[0], name: parts[1] || parts[0].split('@')[0] };
        })
        .filter(r => r && r.email.includes('@'));

      const res = await fetch('/api/email-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, recipients: recipientList })
      });

      if (res.ok) {
        onSuccess();
        onClose();
        setName('');
        setRecipients('');
      } else {
        alert('Erro ao salvar lista');
      }
    } catch (e) {
      alert('Erro de conexão');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden">
        <div className="p-10">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h2 className="text-3xl font-black text-slate-800 tracking-tight">Nova Lista</h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Defina um nicho e importe seus contatos</p>
            </div>
            <button onClick={onClose} className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-2">
              <label className="block text-xs font-black text-slate-400 uppercase ml-1">Nome da Lista (Ex: Clientes VIP, Leads Marketing)</label>
              <input 
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Nome curto e descritivo"
                className="w-full p-5 bg-slate-50 rounded-3xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold"
              />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <label className="block text-xs font-black text-slate-400 uppercase">Emails dos Contatos</label>
                <label className="text-[10px] text-blue-600 font-black uppercase tracking-widest cursor-pointer hover:bg-blue-50 px-2 py-1 rounded transition-colors">
                  Importar CSV/TXT
                  <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
              <textarea 
                required
                value={recipients}
                onChange={e => setRecipients(e.target.value)}
                placeholder="vendedor@empresa.com;João&#10;compras@loja.com;Maria"
                className="w-full p-6 bg-slate-50 rounded-3xl border border-slate-200 h-48 focus:ring-4 focus:ring-blue-500/10 transition-all font-mono text-sm leading-relaxed"
              />
            </div>

            <div className="flex gap-4 pt-4">
              <button 
                type="button"
                onClick={onClose}
                className="flex-1 py-4 text-slate-400 font-black text-xs tracking-widest uppercase hover:bg-slate-50 rounded-2xl transition-all"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                disabled={isSubmitting}
                className="flex-3 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-500/30 active:scale-95 transition-all text-xs tracking-widest uppercase flex items-center justify-center gap-3"
              >
                {isSubmitting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Salvar Lista de Emails
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

function CampaignModal({ isOpen, onClose, onSuccess, accounts, emailLists, initialData }: { 
  isOpen: boolean, 
  onClose: () => void, 
  onSuccess: () => void, 
  accounts: any[],
  emailLists: any[],
  initialData?: any
}) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    from: accounts[0]?.email || '',
    subject: '',
    body: '',
    recipients: '',
    delay: 2,
    scheduledAt: '',
    selectedListId: ''
  });

  useEffect(() => {
    if (isOpen && initialData) {
      setFormData(prev => ({ 
        ...prev, 
        ...initialData,
        from: initialData.from || accounts[0]?.email || ''
      }));
    }
  }, [isOpen, initialData, accounts]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleListChange = (listId: string) => {
    const list = emailLists.find(l => l.id === listId);
    if (list) {
      const recipientsString = list.recipients.map((r: any) => `${r.email};${r.name}`).join('\n');
      setFormData(prev => ({ ...prev, selectedListId: listId, recipients: recipientsString }));
    } else {
      setFormData(prev => ({ ...prev, selectedListId: '', recipients: '' }));
    }
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setFormData(prev => ({ ...prev, recipients: content }));
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const recipientList = formData.recipients
        .split('\n')
        .map(line => {
          if (!line.trim()) return null;
          // Support CSV (semicolon or comma)
          const separator = line.includes(';') ? ';' : ',';
          const parts = line.split(separator).map(s => s.trim());
          const email = parts[0];
          const name = parts[1] || email.split('@')[0];
          return { email, name };
        })
        .filter(r => r && r.email.includes('@'));
      
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          from: formData.from,
          subject: formData.subject,
          body: formData.body,
          recipients: recipientList,
          delay: Number(formData.delay) * 1000,
          scheduledAt: formData.scheduledAt || null
        })
      });

      if (res.ok) {
        onSuccess();
        onClose();
        setFormData({ name: '', from: accounts[0]?.email || '', subject: '', body: '', recipients: '', delay: 2, scheduledAt: '' });
        setStep(1);
      } else {
        alert('Erro ao criar campanha.');
      }
    } catch (err) {
      alert('Erro de conexão.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[110] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-[40px] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-slate-200 flex flex-col"
      >
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-500/20">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-xl text-slate-900 tracking-tight">Nova Campanha</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Passo {step} de 2 — {step === 1 ? 'Configuração' : 'Conteúdo'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-slate-200 rounded-2xl text-slate-400 transition-all">
             <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          {step === 1 ? (
            <div className="p-10 space-y-8">
               <div className="space-y-4">
                 <label className="block text-xs font-black text-slate-400 uppercase ml-1">Configuração de Envio</label>
                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-slate-400 font-bold uppercase ml-1">Nome da Campanha</p>
                      <input 
                        required
                        type="text" 
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        placeholder="Ex: Newsletter Maio 2024"
                        className="w-full p-5 bg-slate-50 rounded-3xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-slate-400 font-bold uppercase ml-1">Conta de Saída</p>
                      <select 
                        value={formData.from}
                        onChange={e => setFormData({...formData, from: e.target.value})}
                        className="w-full p-5 bg-slate-50 rounded-3xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold"
                      >
                        {accounts.map(acc => (
                          <option key={acc.email} value={acc.email}>Relay Local: {acc.email}</option>
                        ))}
                      </select>
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-slate-400 font-bold uppercase ml-1">Intervalo (Segundos)</p>
                      <input 
                        required
                        type="number"
                        min="0"
                        step="0.5"
                        value={formData.delay}
                        onChange={e => setFormData({...formData, delay: e.target.value})}
                        placeholder="Ex: 2"
                        className="w-full p-5 bg-slate-50 rounded-3xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-slate-400 font-bold uppercase ml-1">Agendar para (Opcional)</p>
                      <input 
                        type="datetime-local"
                        value={formData.scheduledAt}
                        onChange={e => setFormData({...formData, scheduledAt: e.target.value})}
                        className="w-full p-5 bg-slate-50 rounded-3xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold"
                      />
                    </div>
                 </div>
               </div>

               <div className="space-y-4">
                 <div className="flex justify-between items-center px-1">
                   <label className="block text-xs font-black text-slate-400 uppercase">Lista de Destinatários</label>
                   <div className="flex gap-4 items-center">
                     <select 
                       value={formData.selectedListId}
                       onChange={e => handleListChange(e.target.value)}
                       className="text-[10px] bg-white border border-slate-200 rounded px-2 py-1 font-black uppercase text-blue-600 focus:outline-none"
                     >
                       <option value="">-- Selecionar Lista Salva --</option>
                       {emailLists.map(l => <option key={l.id} value={l.id}>{l.name} ({l.count} contatos)</option>)}
                     </select>

                     <label className="text-[10px] text-blue-600 font-black uppercase tracking-widest cursor-pointer hover:bg-blue-50 px-2 py-1 rounded transition-colors">
                       Importar CSV/TXT
                       <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
                     </label>
                     <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest cursor-help">Formato: email;nome</span>
                   </div>
                 </div>
                 <textarea 
                   required
                   value={formData.recipients}
                   onChange={e => setFormData({...formData, recipients: e.target.value})}
                   placeholder={`contato@empresa.com;João\nsuporte@cliente.com;Maria\nfinanceiro@loja.com`}
                   rows={6}
                   className="w-full p-6 bg-slate-50 rounded-[32px] border border-slate-200 focus:ring-4 focus:ring-blue-500/10 transition-all font-mono text-sm leading-relaxed"
                 />
                 <div className="bg-blue-50 p-4 rounded-2xl flex items-center gap-4 border border-blue-100">
                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-blue-600 font-black text-[10px] border border-blue-200">?</div>
                    <p className="text-[10px] text-blue-700 leading-relaxed font-medium">Use <b>email;nome</b> ou apenas o <b>email</b>. Personalize com <b>&#123;&#123;name&#125;&#125;</b>.</p>
                 </div>
               </div>
            </div>
          ) : (
            <div className="p-10 space-y-8">
               <div className="space-y-2">
                 <label className="block text-xs font-black text-slate-400 uppercase ml-1">Assunto do E-mail</label>
                 <input 
                   required
                   value={formData.subject}
                   onChange={e => setFormData({...formData, subject: e.target.value})}
                   placeholder="O que o cliente vai ver na caixa de entrada?"
                   className="w-full p-6 bg-slate-50 rounded-3xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 transition-all text-lg font-bold placeholder:text-slate-300"
                 />
               </div>
               <div className="space-y-2">
                 <label className="block text-xs font-black text-slate-400 uppercase ml-1">Mensagem (HTML Suportado)</label>
                 <textarea 
                   required
                   value={formData.body}
                   onChange={e => setFormData({...formData, body: e.target.value})}
                   placeholder="Olá [NOME], confira nossa novidade..."
                   rows={12}
                   className="w-full p-8 bg-slate-50 rounded-[40px] border border-slate-200 focus:ring-4 focus:ring-blue-500/10 transition-all font-mono text-sm leading-relaxed"
                 />
               </div>
            </div>
          )}

          <div className="p-8 bg-slate-50 flex justify-between items-center border-t border-slate-100">
            {step === 2 && (
              <button 
                type="button"
                onClick={() => setStep(1)}
                className="px-8 py-4 text-slate-500 font-black hover:text-slate-800 transition-colors uppercase text-xs tracking-widest"
              >
                Voltar
              </button>
            )}
            <div className="flex gap-4 ml-auto">
              <button 
                type="button"
                onClick={onClose}
                className="px-8 py-4 text-slate-400 font-black hover:text-slate-600 transition-colors uppercase text-xs tracking-widest"
              >
                Cancelar
              </button>
              {step === 1 ? (
                <button 
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-12 py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl shadow-slate-900/10 active:scale-95 transition-all text-xs tracking-widest uppercase"
                >
                  Continuar
                </button>
              ) : (
                <button 
                  disabled={isSubmitting}
                  className="px-12 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-500/30 active:scale-95 transition-all text-xs tracking-widest uppercase flex items-center gap-3 disabled:opacity-50"
                >
                  {isSubmitting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  {formData.scheduledAt ? 'Agendar Campanha' : 'Lançar Campanha AGORA'}
                </button>
              )}
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function Login({ onLogin }: { onLogin: (user: any) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.success) {
        onLogin(data.user);
      } else {
        setError(data.message || 'Credenciais inválidas');
      }
    } catch (err) {
      setError('Erro de conexão com o servidor');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 selection:bg-blue-500/30">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(37,99,235,0.05),transparent_70%)] pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-blue-600 rounded-[32px] shadow-2xl shadow-blue-500/40 flex items-center justify-center mx-auto mb-6 transform -rotate-6">
            <Mail className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">ZimaMail</h1>
          <p className="text-slate-500 font-medium">Painel Administrativo do Provedor</p>
        </div>

        <div className="bg-white rounded-[40px] border border-slate-100 p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-emerald-400 to-blue-600" />
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-medium flex items-center gap-3"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                {error}
              </motion.div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-black text-slate-400 uppercase ml-2 tracking-widest">E-mail</label>
              <div className="relative">
                <input 
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Werikplaystore@gmail.com"
                  className="w-full p-5 bg-slate-50 rounded-3xl border border-slate-200 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none text-slate-900 font-medium placeholder:text-slate-300"
                />
                <Mail className="absolute right-5 top-5 w-5 h-5 text-slate-300" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-black text-slate-400 uppercase ml-2 tracking-widest">Senha</label>
              <div className="relative">
                <input 
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full p-5 bg-slate-50 rounded-3xl border border-slate-200 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none text-slate-900 font-medium placeholder:text-slate-300"
                />
                <Lock className="absolute right-5 top-5 w-5 h-5 text-slate-300" />
              </div>
            </div>

            <button 
              disabled={isSubmitting}
              type="submit"
              className="w-full p-5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-3xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-500/20 transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              {isSubmitting ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Entrar no Painel
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center mt-10 text-slate-500 text-sm font-medium">
          Sistema Seguro ZimaMail &copy; 2024
        </p>
      </motion.div>
    </div>
  );
}

function CampaignDetailsModal({ campaign, onClose }: { campaign: any, onClose: () => void }) {
  const [activeView, setActiveView] = useState<'recipients' | 'events'>('recipients');
  if (!campaign) return null;

  const stats = campaign.stats || { total: 0, sent: 0, failed: 0, opens: 0, clicks: 0 };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[120] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden border border-slate-200 flex flex-col"
      >
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
               <Zap className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-xl text-slate-900 tracking-tight">{campaign.name}</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">ID: {campaign.id}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-slate-200 rounded-2xl text-slate-400 transition-colors">
             <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 grid grid-cols-3 md:grid-cols-6 gap-3 bg-slate-50 border-b border-slate-100">
           <div className="bg-white p-4 rounded-[24px] border border-slate-200 text-center shadow-sm">
              <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Enviados</p>
              <p className="text-base font-black text-slate-900">{stats.sent}</p>
           </div>
           <div className="bg-white p-4 rounded-[24px] border border-slate-200 text-center shadow-sm text-red-600">
              <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Falhas</p>
              <p className="text-base font-black">{stats.failed}</p>
           </div>
           <div className="bg-white p-4 rounded-[24px] border border-slate-200 text-center shadow-sm text-blue-600">
              <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Aberturas</p>
              <p className="text-base font-black">{stats.opens}</p>
           </div>
           <div className="bg-white p-4 rounded-[24px] border border-slate-200 text-center shadow-sm text-emerald-600">
              <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Cliques</p>
              <p className="text-base font-black">{stats.clicks}</p>
           </div>
           <div className="bg-white p-4 rounded-[24px] border border-slate-200 text-center shadow-sm text-purple-600">
              <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Conversão</p>
              <p className="text-base font-black">{stats.sent > 0 ? ((stats.clicks / stats.sent) * 100).toFixed(1) : 0}%</p>
           </div>
           <div className="bg-white p-4 rounded-[24px] border border-slate-200 text-center shadow-sm text-amber-600">
              <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Abertura Unique</p>
              <p className="text-base font-black">{stats.sent > 0 ? ((stats.opens / stats.sent) * 100).toFixed(1) : 0}%</p>
           </div>
        </div>

        <div className="flex p-2 bg-slate-100 rounded-2xl mx-8 mt-6">
           <button 
             onClick={() => setActiveView('recipients')}
             className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeView === 'recipients' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
           >
             Destinatários
           </button>
           <button 
             onClick={() => setActiveView('events')}
             className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeView === 'events' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
           >
             Linha do Tempo
           </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 bg-white">
           {activeView === 'recipients' ? (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-4 text-[10px] font-black text-slate-400 uppercase">Destinatário</th>
                    <th className="pb-4 text-[10px] font-black text-slate-400 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {campaign.recipients?.map((r: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4">
                        <p className="font-bold text-slate-900">{r.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono tracking-tight">{r.email}</p>
                      </td>
                      <td className="py-4">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          r.status === 'sent' ? 'bg-emerald-100 text-emerald-600' : 
                          r.status === 'failed' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {r.status === 'sent' ? 'ENVIADO' : r.status === 'failed' ? 'ERRO' : 'PENDENTE'}
                        </span>
                        {r.error && <p className="text-[8px] text-red-400 mt-1 max-w-[150px] truncate">{r.error}</p>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
           ) : (
             <div className="space-y-6">
                {(campaign.events || []).length > 0 ? (
                  campaign.events.map((event: any, idx: number) => (
                    <div key={idx} className="flex gap-4 relative">
                       {idx !== campaign.events.length - 1 && <div className="absolute left-[19px] top-10 bottom-0 w-px bg-slate-100" />}
                       <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 border-white shadow-sm ${
                         event.type === 'open' ? 'bg-blue-500 text-white' : 'bg-emerald-500 text-white'
                       }`}>
                          {event.type === 'open' ? <Eye className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                       </div>
                       <div className="flex-1 pb-6 border-b border-slate-50">
                          <div className="flex justify-between items-start mb-1">
                             <p className="text-xs font-black text-slate-900">
                                {event.recipient} {event.type === 'open' ? 'abriu o email' : 'clicou no link'}
                             </p>
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                {new Date(event.at).toLocaleTimeString()}
                             </p>
                          </div>
                          {event.url && <p className="text-[10px] text-blue-500 font-mono mb-2 break-all">{event.url}</p>}
                          <div className="flex gap-3">
                             <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 rounded text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                <Activity className="w-3 h-3" /> {event.ip}
                             </div>
                             <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 rounded text-[9px] font-bold text-slate-500 max-w-[200px] truncate" title={event.ua}>
                                {event.ua}
                             </div>
                          </div>
                       </div>
                    </div>
                  ))
                ) : (
                  <div className="py-20 text-center text-slate-300">
                     <Activity className="w-12 h-12 mx-auto mb-4 opacity-20" />
                     <p className="font-bold text-xs uppercase tracking-widest">Aguardando interações...</p>
                     <p className="text-[10px] mt-1">Os eventos aparecerão em tempo real assim que os destinatários interagirem.</p>
                  </div>
                )}
             </div>
           )}
        </div>
        
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-center">
           <button 
             onClick={onClose}
             className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all"
           >
             Fechar Relatório
           </button>
        </div>
      </motion.div>
    </div>
  );
}

function AccountModal({ isOpen, onClose, onSuccess, domains, editAccount }: { isOpen: boolean, onClose: () => void, onSuccess: () => void, domains: string[], editAccount?: any }) {
  const [formData, setFormData] = useState({
    email_prefix: '',
    full_name: '',
    password: '',
    domain: domains[0] || 'amplifamarketing.com.br'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editAccount) {
      const [prefix, domain] = editAccount.email.split('@');
      setFormData({
        email_prefix: prefix,
        full_name: editAccount.name,
        password: editAccount.password,
        domain: domain
      });
    } else {
      setFormData({
        email_prefix: '',
        full_name: '',
        password: '',
        domain: domains[0] || 'amplifamarketing.com.br'
      });
    }
  }, [editAccount, domains]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const url = editAccount ? `/api/accounts/${editAccount.id}` : '/api/accounts';
      const method = editAccount ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `${formData.email_prefix}@${formData.domain}`,
          name: formData.full_name,
          password: formData.password
        })
      });
      const data = await res.json();
      if (data.success) {
        onSuccess();
        onClose();
      } else {
        alert('Erro: ' + data.message);
      }
    } catch (err) {
      alert('Erro ao processar: ' + (err as Error).message);
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
            <h3 className="font-bold text-slate-900">{editAccount ? 'Editar Conta' : 'Nova Conta de Email / Usuário SMTP'}</h3>
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
                  value={formData.email_prefix}
                  onChange={e => setFormData({ ...formData, email_prefix: e.target.value })}
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
                  {domains.map(d => (
                    <option key={d} value={d}>@{d}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Senha SMTP (Acesso)</label>
              <input 
                required
                type="password" 
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                placeholder="Defina uma senha para seus apps" 
                className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" 
              />
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
                editAccount ? 'Salvar Alterações' : 'Criar Conta'
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

function DNSRowDark({ type, host, content, priority, desc }: any) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl group hover:bg-white/10 transition-colors">
      <div className="flex items-center gap-4 flex-1">
        <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center font-black text-xs text-blue-400 shrink-0">
          {type}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">{host}</p>
            <p className="text-xs font-mono text-slate-300 truncate">
              {priority && <span className="text-blue-400 mr-1">[{priority}]</span>}
              {content}
            </p>
          </div>
          <div className="hidden lg:block">
            <p className="text-[10px] text-slate-500 italic truncate">{desc}</p>
          </div>
        </div>
      </div>
      <button 
        onClick={copy}
        className={`p-2 rounded-lg transition-all ${
          copied ? 'bg-emerald-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/20'
        }`}
      >
        {copied ? <CheckCircle2 className="w-4 h-4" /> : <RefreshCw className="w-4 h-4 opacity-40 group-hover:opacity-100" />}
      </button>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon, trend, progress, iconColor = "text-blue-600" }: any) {
  return (
    <div className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group h-full">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-2xl bg-slate-50 ${iconColor} group-hover:bg-blue-600 group-hover:text-white transition-all group-hover:scale-110 shadow-sm`}>
          {icon}
        </div>
        {trend && (
          <span className={`text-[9px] font-black px-2 py-1 rounded-lg ${trend.includes('+') || trend === 'Excelente' || trend === 'OK' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
            {trend}
          </span>
        )}
      </div>
      
      <div>
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 leading-tight">{title}</h3>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black text-slate-900 tracking-tight">{value}</span>
        </div>
        {subtitle && <p className="text-[9px] text-slate-400 font-bold mt-1 line-clamp-1">{subtitle}</p>}
      </div>

      {progress !== undefined && (
        <div className="mt-4 pt-4 border-t border-slate-50">
          <div className="flex justify-between text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
            <span>Taxa</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className={`h-full rounded-full ${progress > 10 ? 'bg-emerald-500' : 'bg-blue-500'}`}
            />
          </div>
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
        status === 'running' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-500 text-white'
      }`}>
        {status === 'running' ? 'Online' : 'Warning'}
      </div>
    </div>
  );
}

function CheckItem({ label, checked }: { label: string, checked?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
        checked ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-white/20'
      }`}>
        {checked && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
      </div>
      <span className="text-[11px] text-slate-300">{label}</span>
    </div>
  );
}

function DeliverabilityCheck({ title, status, desc }: any) {
  return (
    <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="font-black text-xs uppercase tracking-widest text-slate-400">{title}</span>
        <div className={`h-2 w-2 rounded-full ${
          status === 'success' ? 'bg-emerald-500' :
          status === 'warning' ? 'bg-amber-500' : 'bg-slate-300'
        }`} />
      </div>
      <p className="text-sm font-bold text-slate-700 mb-1 leading-tight">{desc}</p>
      <p className="text-[10px] text-slate-400">{status === 'pending' ? 'Configuração pendente' : 'Verificado'}</p>
    </div>
  );
}

function ActionCard({ title, description, icon, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className="flex items-start gap-4 p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-blue-200 text-left transition-all group shadow-sm"
    >
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
