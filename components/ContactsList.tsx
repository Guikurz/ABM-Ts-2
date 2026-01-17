import React, { useState, useMemo, useEffect } from 'react';
import { Contact, Page, Company, UserProfile } from '../types';
import { supabase } from '../services/supabaseClient';

interface SortConfig {
  key: 'name' | 'company' | null;
  direction: 'asc' | 'desc';
}

interface ContactsListProps {
  onContactClick?: (contact: Contact) => void;
  userId?: string;
  onNotify?: (title: string, message: string, type: 'success' | 'info' | 'warning' | 'error', link?: Page) => void;
}

const ContactsList: React.FC<ContactsListProps> = ({ onContactClick, userId, onNotify }) => {
  // States
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companiesList, setCompaniesList] = useState<Company[]>([]);
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: 'asc' });
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', email: '', role: '', company: '', owner: '' });

  const fetchContacts = async () => {
    if (!userId) return;
    try {
        setLoading(true);
        // Added Filter: .eq('user_id', userId)
        const { data, error } = await supabase.from('contacts').select('*').eq('user_id', userId);
        if (error) throw error;

        if (data) {
            const mapped: Contact[] = data.map(c => ({
                id: c.id,
                name: c.name,
                email: c.email,
                role: c.role || '',
                company: c.company || '', // This matches by string name
                status: c.status || 'New',
                last: '-',
                avatar: c.avatar || '', // FIXED: Load avatar from DB instead of hardcoded empty string
                priority: 'Média',
                selected: false
            }));
            setContacts(mapped);
        }
    } catch (e) {
        console.error("Error fetching contacts", e);
    } finally {
        setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    if (!userId) return;
    try {
        // Added Filter: .eq('user_id', userId)
        const { data } = await supabase.from('companies').select('*').eq('user_id', userId);
        if (data) {
            const mapped: Company[] = data.map(c => ({
                id: c.id,
                name: c.name,
                industry: c.industry || '',
                size: c.size || '',
                domain: c.domain || '',
                contactsCount: 0,
                deals: 0
            }));
            setCompaniesList(mapped);
        }
    } catch (e) {
        console.error("Error fetching companies list", e);
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
    fetchContacts();
    fetchCompanies();
    fetchUsers();
  }, [userId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContact.name || !newContact.email || !newContact.company || !newContact.owner) {
        alert("Por favor, preencha Nome, Email, Empresa e Responsável.");
        return;
    }
    
    if (!userId) {
        alert("Erro de autenticação: ID do usuário não encontrado.");
        return;
    }

    try {
        const { error } = await supabase.from('contacts').insert([{
            name: newContact.name,
            email: newContact.email,
            role: newContact.role,
            company: newContact.company, 
            user_id: userId,
            owners: [newContact.owner] // Store as array
        }]);

        if (error) throw error;

        setShowCreateModal(false);
        setNewContact({ name: '', email: '', role: '', company: '', owner: '' });
        fetchContacts();
        
        if (onNotify) {
            onNotify('Contato Criado!', `${newContact.name} foi adicionado com sucesso.`, 'success', 'contacts');
        } else {
            alert("Contato criado com sucesso!");
        }

    } catch (e: any) {
        console.error("Error creating contact:", e);
        alert("Erro ao criar contato. Verifique sua conexão ou contate o administrador.");
    }
  };

  // CSV Parsing and Upload Logic
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
            
            // Basic mapping of CSV headers to DB columns
            const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('nome'));
            const emailIdx = headers.findIndex(h => h.includes('email') || h.includes('e-mail'));
            const companyIdx = headers.findIndex(h => h.includes('company') || h.includes('empresa'));
            const roleIdx = headers.findIndex(h => h.includes('role') || h.includes('cargo'));

            if (nameIdx === -1 || emailIdx === -1) {
                throw new Error("O CSV precisa ter pelo menos colunas de 'Nome' e 'Email'.");
            }

            const rowsToInsert = [];

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                // Simple regex to split by comma but ignore commas inside quotes
                const row = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
                const cols = line.split(',').map(c => c.trim().replace(/"/g, '')); // Simple split fallback

                const name = cols[nameIdx];
                const email = cols[emailIdx];
                const company = companyIdx !== -1 ? cols[companyIdx] : '';
                const role = roleIdx !== -1 ? cols[roleIdx] : '';

                if (name && email) {
                    rowsToInsert.push({
                        name,
                        email,
                        role,
                        company, // Import company name from CSV
                        user_id: userId,
                        status: 'New'
                    });
                }
            }

            if (rowsToInsert.length > 0) {
                const { error } = await supabase.from('contacts').insert(rowsToInsert);
                if (error) throw error;
                
                if (onNotify) {
                    onNotify('Importação Concluída', `${rowsToInsert.length} contatos foram importados.`, 'success', 'contacts');
                } else {
                    alert(`${rowsToInsert.length} contatos importados com sucesso!`);
                }
                setIsImportModalOpen(false);
                setImportFile(null);
                fetchContacts();
            } else {
                alert("Nenhum contato válido encontrado no arquivo.");
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

  // Handlers
  const handleSort = (key: 'name' | 'company') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedContacts = useMemo(() => {
    let result = [...contacts];

    // Filter
    result = result.filter(contact => {
      const matchesSearch = 
        contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (contact.email && contact.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        contact.company.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'All' || contact.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    // Sort
    if (sortConfig.key) {
      result.sort((a, b) => {
        const aValue = (a as any)[sortConfig.key!].toLowerCase();
        const bValue = (b as any)[sortConfig.key!].toLowerCase();
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [contacts, searchTerm, statusFilter, sortConfig]);

  return (
    <div className="p-4 lg:p-6 w-full flex flex-col gap-6 h-full relative">
      
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Contatos</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Gerencie sua base de leads individuais.</p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={() => setIsImportModalOpen(true)}
                className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
                Importar CSV
            </button>
            <button 
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded shadow-sm hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
                <span className="material-symbols-outlined text-[20px]">add</span>
                Novo Contato
            </button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#151b2b] rounded border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col flex-1 overflow-hidden">
        
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-4">
           <div className="relative flex-1 max-w-md">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-[18px]">search</span>
            <input
              className="w-full h-10 pl-9 pr-3 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-slate-400"
              placeholder="Buscar por nome, email ou empresa..."
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-2">
             <div className="relative">
                <select 
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-10 pl-3 pr-8 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm focus:ring-primary focus:border-primary cursor-pointer"
                >
                    <option value="All">Todos os Status</option>
                    <option value="New">New</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Replied">Replied</option>
                    <option value="Bounced">Bounced</option>
                </select>
             </div>
             <button className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium">
                <span className="material-symbols-outlined text-[18px]">filter_list</span>
                Mais Filtros
             </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto">
            {loading ? (
                <div className="flex justify-center items-center h-40">
                    <span className="material-symbols-outlined animate-spin text-primary">sync</span>
                </div>
            ) : (
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
                    <tr>
                        <th 
                            className="px-6 py-4 font-bold text-slate-900 dark:text-white cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group select-none"
                            onClick={() => handleSort('name')}
                        >
                            <div className="flex items-center gap-1">
                                Nome
                                <span className={`material-symbols-outlined text-[16px] text-slate-400 transition-opacity ${sortConfig.key === 'name' ? 'opacity-100 text-primary' : 'opacity-0 group-hover:opacity-50'}`}>
                                    {sortConfig.key === 'name' && sortConfig.direction === 'desc' ? 'arrow_downward' : 'arrow_upward'}
                                </span>
                            </div>
                        </th>
                        <th 
                            className="px-6 py-4 font-bold text-slate-900 dark:text-white cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group select-none"
                            onClick={() => handleSort('company')}
                        >
                             <div className="flex items-center gap-1">
                                Empresa
                                <span className={`material-symbols-outlined text-[16px] text-slate-400 transition-opacity ${sortConfig.key === 'company' ? 'opacity-100 text-primary' : 'opacity-0 group-hover:opacity-50'}`}>
                                    {sortConfig.key === 'company' && sortConfig.direction === 'desc' ? 'arrow_downward' : 'arrow_upward'}
                                </span>
                            </div>
                        </th>
                        <th className="px-6 py-4 font-bold text-slate-900 dark:text-white">Email</th>
                        <th className="px-6 py-4 font-bold text-slate-900 dark:text-white">Status</th>
                        <th className="px-6 py-4 font-bold text-slate-900 dark:text-white">Último Contato</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredAndSortedContacts.length > 0 ? (
                        filteredAndSortedContacts.map((contact) => (
                        <tr 
                            key={contact.id} 
                            onClick={() => onContactClick && onContactClick(contact)}
                            className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                        >
                            <td className="px-6 py-3">
                                <div className="flex items-center gap-3">
                                    {contact.avatar ? (
                                        <div 
                                            className="size-8 rounded-full bg-slate-200 bg-cover bg-center shrink-0 border border-slate-200 dark:border-slate-700"
                                            style={{ backgroundImage: `url("${contact.avatar}")` }}
                                        ></div>
                                    ) : (
                                        <div className="size-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs shrink-0">
                                            {contact.name.charAt(0)}
                                        </div>
                                    )}
                                    <div>
                                        <p className="font-semibold text-slate-900 dark:text-white group-hover:text-primary transition-colors">{contact.name}</p>
                                        <p className="text-xs text-slate-400">{contact.role}</p>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-3 text-slate-900 dark:text-slate-300 font-medium">{contact.company || '-'}</td>
                            <td className="px-6 py-3">{contact.email}</td>
                            <td className="px-6 py-3">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${
                                    contact.status === 'Contacted' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' :
                                    contact.status === 'Replied' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                                    contact.status === 'Bounced' ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
                                    'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                }`}>
                                    {contact.status}
                                </span>
                            </td>
                            <td className="px-6 py-3">{contact.last}</td>
                        </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={5} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                                Nenhum contato encontrado.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
            )}
        </div>
      </div>

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-[#151b2b] w-full max-w-lg rounded-lg shadow-xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Importar Contatos</h3>
                    <button onClick={() => setIsImportModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                
                <form onSubmit={handleImportSubmit} className="p-6 flex flex-col gap-4">
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded text-xs text-blue-700 dark:text-blue-300">
                        <p className="font-bold mb-1">Dica de Formato CSV:</p>
                        <p>O arquivo deve conter cabeçalhos: <b>Name, Email, Company, Role</b>.</p>
                        <p className="mt-1 opacity-80">Se a coluna 'Company' corresponder a uma empresa existente, eles serão vinculados automaticamente.</p>
                    </div>

                    <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Empresa de Destino (Opcional)</span>
                        <select className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-primary focus:border-primary">
                            <option value="">Usar coluna 'Company' do CSV</option>
                            {companiesList.map(c => (
                                <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                        </select>
                        <span className="text-xs text-slate-500">Se selecionado, forçará todos os contatos para esta empresa.</span>
                    </label>

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
                            <span className="text-xs text-slate-400">Suporta .csv (Max 5MB)</span>
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
                            Importar Contatos
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-[#151b2b] w-full max-w-md rounded-lg shadow-xl border border-slate-200 dark:border-slate-800 p-6">
                <h3 className="text-lg font-bold mb-4 text-slate-900 dark:text-white">Novo Contato</h3>
                <form onSubmit={handleCreate} className="space-y-4">
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
                        <span className="text-sm font-bold text-slate-500">Empresa <span className="text-red-500">*</span></span>
                        <select 
                            className="w-full mt-1 px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                            value={newContact.company}
                            onChange={e => setNewContact({...newContact, company: e.target.value})}
                            required
                        >
                            <option value="">Selecione uma empresa...</option>
                            {companiesList.map(c => (
                                <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                        </select>
                        {companiesList.length === 0 && <span className="text-xs text-red-500 mt-1">Nenhuma empresa cadastrada.</span>}
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
                        <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm font-bold text-slate-500">Cancelar</button>
                        <button type="submit" className="px-4 py-2 text-sm font-bold bg-primary text-white rounded">Criar</button>
                    </div>
                </form>
            </div>
        </div>
      )}

    </div>
  );
};

export default ContactsList;