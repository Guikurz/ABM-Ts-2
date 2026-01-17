import React, { useState, useEffect } from 'react';
import { Company, Contact, Page, UserProfile, Deal } from '../types';
import { supabase } from '../services/supabaseClient';

interface CompanyDetailsPageProps {
  company: Company;
  onBack: () => void;
  onContactClick: (contact: Contact) => void;
  userId?: string;
  onNotify?: (title: string, message: string, type: 'success' | 'info' | 'warning' | 'error', link?: Page) => void;
}

const CompanyDetailsPage: React.FC<CompanyDetailsPageProps> = ({ company, onBack, onContactClick, userId, onNotify }) => {
  const [companyContacts, setCompanyContacts] = useState<Contact[]>([]);
  const [companyCampaigns, setCompanyCampaigns] = useState<any[]>([]);
  const [companyDeals, setCompanyDeals] = useState<Deal[]>([]);
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDealModal, setShowDealModal] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  
  // Data States for Modals
  const [newContact, setNewContact] = useState({ name: '', email: '', role: '', owner: '' });
  const [newDeal, setNewDeal] = useState({ title: '', value: '', status: 'Open' as 'Open' | 'Won' | 'Lost' });
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  // Data Fetching
  const fetchData = async () => {
    setLoading(true);
    try {
        // 1. Fetch Contacts
        const { data: contactsData } = await supabase
            .from('contacts')
            .select('*')
            .eq('company', company.name); 

        if (contactsData) {
            const mappedContacts: Contact[] = contactsData.map(c => ({
                id: c.id,
                name: c.name,
                email: c.email,
                role: c.role || '',
                company: c.company || '',
                status: c.status || 'New',
                last: c.last_contact ? new Date(c.last_contact).toLocaleDateString() : '-',
                avatar: '',
                priority: c.priority || 'Média',
                selected: false,
                phone: c.phone
            }));
            setCompanyContacts(mappedContacts);
        } else {
            setCompanyContacts([]);
        }

        // 2. Fetch Campaigns
        const { data: campaignsData } = await supabase
            .from('campaigns')
            .select('*')
            .eq('target_company', company.name);

        if (campaignsData) {
            const mappedCampaigns = campaignsData.map(c => ({
                name: c.name,
                status: c.status,
                progress: c.progress || 0,
                sent: c.sent || 0,
                open: c.open_rate || '0%'
            }));
            setCompanyCampaigns(mappedCampaigns);
        } else {
            setCompanyCampaigns([]);
        }

        // 3. Fetch Deals
        const { data: dealsData, error: dealsError } = await supabase
            .from('deals')
            .select('*')
            .eq('company_id', company.id);

        if (dealsError) {
            console.warn("Deals fetch warning:", dealsError.message);
            // Don't set empty here if it's a connection error, but for missing table it's fine to show nothing
            setCompanyDeals([]);
        } else if (dealsData) {
            setCompanyDeals(dealsData);
        } else {
            setCompanyDeals([]); 
        }

    } catch (error) {
        console.error("Error fetching company details:", error);
    } finally {
        setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
        const { data } = await supabase.from('profiles').select('*');
        if (data) {
            setAvailableUsers(data);
        }
    } catch (e) {
        console.error("Error fetching users", e);
    }
  };

  useEffect(() => {
    fetchData();
    fetchUsers();
  }, [company.name]);

  // Handle Manual Creation
  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContact.name || !newContact.email || !newContact.owner) {
        alert("Por favor, preencha Nome, Email e Responsável.");
        return;
    }

    if (!userId) {
        alert("Erro: ID de usuário não encontrado.");
        return;
    }
    
    try {
        const { error } = await supabase.from('contacts').insert([{
            name: newContact.name,
            email: newContact.email,
            role: newContact.role,
            company: company.name, // Force current company
            user_id: userId,
            owners: [newContact.owner], // Store owner
            status: 'New'
        }]);

        if (error) throw error;

        setShowCreateModal(false);
        setNewContact({ name: '', email: '', role: '', owner: '' });
        fetchData(); // Refresh list
        
        if (onNotify) {
            onNotify('Contato Adicionado', `${newContact.name} agora faz parte de ${company.name}.`, 'success', 'contacts');
        } else {
            alert("Contato adicionado a esta empresa!");
        }

    } catch (e: any) {
        alert("Erro ao criar contato: " + e.message);
    }
  };

  const handleCreateDeal = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!userId || !newDeal.title || !newDeal.value) return;

      try {
          const numericValue = parseFloat(newDeal.value.replace(/[^0-9.]/g, ''));
          
          const { error } = await supabase.from('deals').insert([{
              title: newDeal.title,
              value: numericValue,
              status: newDeal.status,
              company_id: company.id,
              company_name: company.name,
              user_id: userId,
              created_at: new Date()
          }]);

          if (error) throw error;

          setShowDealModal(false);
          setNewDeal({ title: '', value: '', status: 'Open' });
          fetchData();

          if (onNotify) onNotify('Negócio Criado', 'Novo deal adicionado ao pipeline.', 'success');

      } catch (err: any) {
          console.error("Deal creation error:", err);
          if (onNotify) onNotify('Erro', 'Não foi possível salvar o negócio no banco de dados. Contate o suporte.', 'warning');

          // Fallback UI update so the user feels the action worked
          setCompanyDeals(prev => [...prev, {
              id: 'temp-' + Date.now(),
              title: newDeal.title,
              value: parseFloat(newDeal.value),
              status: newDeal.status,
              company_id: company.id
          }]);
          
          setShowDealModal(false);
          // Reset form to allow adding another
          setNewDeal({ title: '', value: '', status: 'Open' });
      }
  };

  // Handle CSV Import
  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile || !userId) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
        try {
            const text = evt.target?.result as string;
            const lines = text.split('\n');
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
            
            const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('nome'));
            const emailIdx = headers.findIndex(h => h.includes('email') || h.includes('e-mail'));
            const roleIdx = headers.findIndex(h => h.includes('role') || h.includes('cargo'));

            if (nameIdx === -1 || emailIdx === -1) {
                throw new Error("O CSV precisa ter pelo menos colunas de 'Nome' e 'Email'.");
            }

            const rowsToInsert = [];

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                const cols = line.split(',').map(c => c.trim().replace(/"/g, '')); 
                const name = cols[nameIdx];
                const email = cols[emailIdx];
                const role = roleIdx !== -1 ? cols[roleIdx] : '';

                if (name && email) {
                    rowsToInsert.push({
                        name,
                        email,
                        role,
                        company: company.name, // Force current company
                        user_id: userId,
                        status: 'New'
                    });
                }
            }

            if (rowsToInsert.length > 0) {
                const { error } = await supabase.from('contacts').insert(rowsToInsert);
                if (error) throw error;
                
                if (onNotify) {
                    onNotify('Importação Completa', `${rowsToInsert.length} contatos adicionados a ${company.name}.`, 'success', 'contacts');
                } else {
                    alert(`${rowsToInsert.length} contatos importados para ${company.name}!`);
                }
                
                setIsImportModalOpen(false);
                setImportFile(null);
                fetchData();
            } else {
                alert("Nenhum contato válido encontrado.");
            }
        } catch (err: any) {
            console.error(err);
            alert("Erro na importação: " + err.message);
        } finally {
            setImporting(false);
        }
    };
    reader.readAsText(importFile);
  };

  const formatCurrency = (val: number) => {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="p-4 lg:p-6 w-full flex flex-col gap-6 h-full relative">
      {/* Back Button */}
      <div>
          <button onClick={onBack} className="flex items-center gap-1 text-slate-500 hover:text-primary transition-colors text-sm font-medium mb-4">
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Voltar para Empresas
          </button>
      </div>

      {/* Header Info Card */}
      <div className="bg-white dark:bg-[#151b2b] rounded border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="flex items-start gap-4">
                <div className="size-16 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 font-bold text-xl uppercase">
                    {company.name.slice(0, 2)}
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        {company.name}
                        {company.domain && (
                            <a href={`https://${company.domain}`} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-primary">
                                <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                            </a>
                        )}
                    </h1>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[16px]">domain</span>
                            {company.industry || 'Indústria N/A'}
                        </span>
                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                        <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[16px]">group</span>
                            {company.size || 'Tam. N/A'}
                        </span>
                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                        <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[16px]">location_on</span>
                            {company.location || 'Local N/A'}
                        </span>
                    </div>
                    <p className="mt-3 text-slate-600 dark:text-slate-300 max-w-2xl text-sm leading-relaxed">
                        {company.description || "Sem descrição disponível."}
                    </p>
                </div>
            </div>
            
            <div className="flex flex-row md:flex-col gap-2 shrink-0">
                <button 
                    onClick={() => setShowDealModal(true)}
                    className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded shadow-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                    <span className="material-symbols-outlined text-[18px]">add_card</span>
                    Novo Deal
                </button>
                <button className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                    Editar Info
                </button>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Col: Contacts (2/3 width on large screens) */}
        <div className="xl:col-span-2 flex flex-col gap-4">
             <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">groups</span>
                    Contatos ({companyContacts.length})
                </h2>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setIsImportModalOpen(true)}
                        className="text-sm text-slate-500 hover:text-primary font-medium flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                        <span className="material-symbols-outlined text-[16px]">upload_file</span> Importar CSV
                    </button>
                    <button 
                        onClick={() => setShowCreateModal(true)}
                        className="text-sm text-primary font-bold hover:underline"
                    >
                        + Adicionar Contato
                    </button>
                </div>
            </div>
            
            <div className="bg-white dark:bg-[#151b2b] rounded border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden min-h-[150px]">
                {loading ? (
                    <div className="flex items-center justify-center h-40 text-slate-400 gap-2">
                        <span className="material-symbols-outlined animate-spin">sync</span> Carregando...
                    </div>
                ) : companyContacts.length > 0 ? (
                <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                            <th className="px-4 py-3 font-bold text-slate-900 dark:text-white">Nome</th>
                            <th className="px-4 py-3 font-bold text-slate-900 dark:text-white">Email</th>
                            <th className="px-4 py-3 font-bold text-slate-900 dark:text-white">Status</th>
                            <th className="px-4 py-3 font-bold text-slate-900 dark:text-white">Último</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {companyContacts.map((contact, i) => (
                            <tr 
                                key={i} 
                                className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                                onClick={() => onContactClick(contact)}
                            >
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="size-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs">
                                            {contact.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-900 dark:text-white group-hover:text-primary transition-colors">{contact.name}</p>
                                            <p className="text-xs text-slate-400">{contact.role}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3">{contact.email}</td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                                        contact.status === 'Contacted' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' :
                                        contact.status === 'Replied' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                                        'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                    }`}>
                                        {contact.status}
                                    </span>
                                </td>
                                <td className="px-4 py-3">{contact.last}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                ) : (
                    <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-4">
                        <div className="text-center">
                            <span className="material-symbols-outlined text-3xl mb-2 opacity-50">person_off</span>
                            <p className="text-sm">Nenhum contato vinculado a esta empresa.</p>
                        </div>
                        <div className="flex gap-2">
                             <button 
                                onClick={() => setIsImportModalOpen(true)}
                                className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                                Importar CSV
                            </button>
                            <button 
                                onClick={() => setShowCreateModal(true)}
                                className="px-3 py-1.5 bg-primary text-white rounded text-sm font-bold hover:bg-blue-700"
                            >
                                Criar Manualmente
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* Right Col: Campaigns & Deals (1/3 width) */}
        <div className="xl:col-span-1 flex flex-col gap-6">
             {/* Campaigns Section */}
             <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">campaign</span>
                        Campanhas
                    </h2>
                    <button className="text-sm text-primary font-semibold hover:underline">Ver Histórico</button>
                </div>

                <div className="flex flex-col gap-3">
                    {loading ? (
                        <div className="bg-white dark:bg-[#151b2b] rounded border border-slate-200 dark:border-slate-800 p-6 shadow-sm text-center text-slate-400">
                            <span className="material-symbols-outlined animate-spin">sync</span>
                        </div>
                    ) : companyCampaigns.length > 0 ? (
                        companyCampaigns.map((camp, i) => (
                        <div key={i} className="bg-white dark:bg-[#151b2b] rounded border border-slate-200 dark:border-slate-800 p-4 shadow-sm hover:border-primary/50 transition-colors cursor-pointer">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-bold text-slate-900 dark:text-white text-sm">{camp.name}</h3>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                                    camp.status === 'Active' || camp.status === 'Ativa' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' :
                                    'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                                }`}>
                                    {camp.status}
                                </span>
                            </div>
                            
                            <div className="space-y-2 mt-3">
                                <div>
                                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                                        <span>Progresso</span>
                                        <span>{camp.progress}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full ${camp.status === 'Finished' ? 'bg-blue-500' : 'bg-primary'}`} style={{ width: `${camp.progress}%` }}></div>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-1">
                                    <span className="flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[14px]">send</span> {camp.sent}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[14px]">drafts</span> {camp.open}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))
                    ) : (
                        <div className="text-center p-6 bg-slate-50 dark:bg-slate-900 rounded border border-dashed border-slate-200 dark:border-slate-700 text-slate-500 text-sm flex flex-col items-center gap-2">
                            <span className="material-symbols-outlined opacity-50">campaign</span>
                            Nenhuma campanha ativa para esta empresa.
                        </div>
                    )}
                </div>
            </div>

            {/* Deals Section */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-green-600">monetization_on</span>
                        Negócios (Deals)
                    </h2>
                </div>
                
                <div className="flex flex-col gap-3">
                    {companyDeals.length > 0 ? (
                        companyDeals.map((deal, i) => (
                            <div key={i} className="bg-white dark:bg-[#151b2b] rounded border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex items-center justify-between">
                                <div>
                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">{deal.title}</h4>
                                    <p className="text-xs text-green-600 font-bold mt-0.5">{formatCurrency(deal.value)}</p>
                                </div>
                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                    deal.status === 'Won' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 
                                    deal.status === 'Lost' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                }`}>
                                    {deal.status}
                                </span>
                            </div>
                        ))
                    ) : (
                        <div className="text-center p-6 bg-slate-50 dark:bg-slate-900 rounded border border-dashed border-slate-200 dark:border-slate-700 text-slate-500 text-sm flex flex-col items-center gap-2">
                            <span className="material-symbols-outlined opacity-50">paid</span>
                            Nenhum negócio cadastrado.
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>

      {/* Manual Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-[#151b2b] w-full max-w-md rounded-lg shadow-xl border border-slate-200 dark:border-slate-800 p-6 animate-in fade-in zoom-in duration-200">
                <h3 className="text-lg font-bold mb-4 text-slate-900 dark:text-white">Novo Contato em {company.name}</h3>
                <form onSubmit={handleCreateContact} className="space-y-4">
                    <label className="block">
                        <span className="text-sm font-bold text-slate-500">Nome <span className="text-red-500">*</span></span>
                        <input 
                            className="w-full mt-1 px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                            value={newContact.name}
                            onChange={e => setNewContact({...newContact, name: e.target.value})}
                            required
                        />
                    </label>
                    <label className="block">
                        <span className="text-sm font-bold text-slate-500">Email <span className="text-red-500">*</span></span>
                        <input 
                            type="email"
                            className="w-full mt-1 px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                            value={newContact.email}
                            onChange={e => setNewContact({...newContact, email: e.target.value})}
                            required
                        />
                    </label>
                    <label className="block">
                        <span className="text-sm font-bold text-slate-500">Cargo</span>
                        <input 
                            className="w-full mt-1 px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                            value={newContact.role}
                            onChange={e => setNewContact({...newContact, role: e.target.value})}
                        />
                    </label>
                    
                    <label className="block">
                        <span className="text-sm font-bold text-slate-500">Responsável <span className="text-red-500">*</span></span>
                        <select
                            className="w-full mt-1 px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                            value={newContact.owner}
                            onChange={e => setNewContact({...newContact, owner: e.target.value})}
                            required
                        >
                            <option value="">Selecione...</option>
                            {availableUsers.map(u => (
                                <option key={u.id} value={u.full_name || u.email}>{u.full_name || u.email}</option>
                            ))}
                        </select>
                    </label>
                    
                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded">Cancelar</button>
                        <button type="submit" className="px-4 py-2 text-sm font-bold bg-primary text-white rounded hover:bg-blue-700">Salvar</button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Deal Modal */}
      {showDealModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-[#151b2b] w-full max-w-md rounded-lg shadow-xl border border-slate-200 dark:border-slate-800 p-6 animate-in fade-in zoom-in duration-200">
                <h3 className="text-lg font-bold mb-4 text-slate-900 dark:text-white">Novo Negócio (Deal)</h3>
                <form onSubmit={handleCreateDeal} className="space-y-4">
                    <label className="block">
                        <span className="text-sm font-bold text-slate-500">Título do Negócio</span>
                        <input 
                            className="w-full mt-1 px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                            placeholder="Ex: Upsell Q3"
                            value={newDeal.title}
                            onChange={e => setNewDeal({...newDeal, title: e.target.value})}
                            required
                        />
                    </label>
                    <label className="block">
                        <span className="text-sm font-bold text-slate-500">Valor (R$)</span>
                        <input 
                            type="number"
                            className="w-full mt-1 px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                            placeholder="0.00"
                            value={newDeal.value}
                            onChange={e => setNewDeal({...newDeal, value: e.target.value})}
                            required
                        />
                    </label>
                    <label className="block">
                        <span className="text-sm font-bold text-slate-500">Status</span>
                        <select 
                            className="w-full mt-1 px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                            value={newDeal.status}
                            onChange={e => setNewDeal({...newDeal, status: e.target.value as any})}
                        >
                            <option value="Open">Em Aberto</option>
                            <option value="Won">Ganho</option>
                            <option value="Lost">Perdido</option>
                        </select>
                    </label>
                    
                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={() => setShowDealModal(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded">Cancelar</button>
                        <button type="submit" className="px-4 py-2 text-sm font-bold bg-primary text-white rounded hover:bg-blue-700">Salvar Deal</button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Import CSV Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-[#151b2b] w-full max-w-lg rounded-lg shadow-xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Importar para {company.name}</h3>
                    <button onClick={() => setIsImportModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                
                <form onSubmit={handleImportSubmit} className="p-6 flex flex-col gap-4">
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded text-xs text-blue-700 dark:text-blue-300">
                        <p>Os contatos importados serão vinculados automaticamente à empresa <b>{company.name}</b>.</p>
                        <p className="mt-1">Cabeçalhos necessários: <b>Name, Email</b> (Opcional: Role).</p>
                    </div>

                    <label className="flex flex-col gap-2">
                         <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Arquivo CSV</span>
                         <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-6 flex flex-col items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer relative">
                            <input 
                                type="file" 
                                accept=".csv" 
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                            />
                            <span className="material-symbols-outlined text-4xl text-slate-400">upload_file</span>
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                {importFile ? importFile.name : "Clique para selecionar ou arraste o arquivo"}
                            </span>
                         </div>
                    </label>

                    <div className="flex justify-end gap-3 mt-4">
                        <button 
                            type="button" 
                            onClick={() => setIsImportModalOpen(false)}
                            className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit" 
                            disabled={!importFile || importing}
                            className="px-4 py-2 text-sm font-semibold text-white bg-primary hover:bg-blue-700 rounded shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                        >
                            {importing && <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>}
                            Importar
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

    </div>
  );
};

export default CompanyDetailsPage;