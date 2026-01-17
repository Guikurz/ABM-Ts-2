import React, { useState, useEffect } from 'react';
import { Company, Page } from '../types';
import { supabase } from '../services/supabaseClient';

interface CompaniesListProps {
  onCompanyClick: (company: Company) => void;
  userId?: string;
  onNotify?: (title: string, message: string, type: 'success' | 'info' | 'warning' | 'error', link?: Page) => void;
}

const CompaniesList: React.FC<CompaniesListProps> = ({ onCompanyClick, userId, onNotify }) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCompany, setNewCompany] = useState({ name: '', industry: '', domain: '' });

  const fetchCompaniesData = async () => {
    if (!userId) return;
    try {
      setLoading(true);
      
      // Fetch all related data in parallel for aggregation
      // Added 'steps' to campaigns selection to calculate points
      // ADDED FILTER: .eq('user_id', userId)
      const [companiesRes, contactsRes, campaignsRes, dealsRes] = await Promise.all([
          supabase.from('companies').select('*').eq('user_id', userId),
          supabase.from('contacts').select('id, company').eq('user_id', userId),
          supabase.from('campaigns').select('id, target_company, steps').eq('user_id', userId), 
          supabase.from('deals').select('id, company_id, company_name, status, value').eq('user_id', userId)
      ]);

      if (companiesRes.error) throw companiesRes.error;
      
      const companyList = companiesRes.data || [];
      const contactList = contactsRes.data || [];
      const campaignList = campaignsRes.data || [];
      const dealList = dealsRes.data || [];

      const mapped: Company[] = companyList.map(c => {
          // Count contacts (matched by company name string)
          const contactsCount = contactList.filter((ct: any) => ct.company === c.name).length;
          
          // Filter campaigns for this company
          const companyCampaigns = campaignList.filter((cp: any) => cp.target_company === c.name);
          const campaignsCount = companyCampaigns.length;
          
          // Calculate Score based on COMPLETED TASK POINTS
          let taskPointsScore = 0;
          companyCampaigns.forEach((camp: any) => {
              if (camp.steps && Array.isArray(camp.steps)) {
                  camp.steps.forEach((step: any) => {
                      if (step.completed) {
                          taskPointsScore += (step.points || 0);
                      }
                  });
              }
          });

          // Count active deals (matched by company_id uuid OR company name fallback)
          const activeDeals = dealList.filter((d: any) => 
            (d.company_id === c.id || d.company_name === c.name) && 
            (d.status === 'Open' || d.status === 'Won')
          );
          const dealsCount = activeDeals.length;

          // --- Temperature Logic (Updated Rules) ---
          // < 300: Cold
          // 300 - 500: Warm
          // > 500: Hot
          let temperature: 'Hot' | 'Warm' | 'Cold' = 'Cold';
          
          if (taskPointsScore > 500) {
              temperature = 'Hot';
          } else if (taskPointsScore >= 300) {
              temperature = 'Warm';
          } else {
              temperature = 'Cold';
          }

          return {
              id: c.id,
              name: c.name,
              industry: c.industry || 'Tech',
              size: c.size || 'N/A',
              domain: c.domain || '',
              contactsCount: contactsCount,
              campaignsCount: campaignsCount,
              deals: dealsCount,
              location: c.location,
              description: c.description,
              temperature: temperature,
              score: taskPointsScore // Now strictly calculated from task points
          };
      });
      
      // Sort by Temperature (Hot first), then Score
      mapped.sort((a, b) => {
          // Custom sort order: Hot > Warm > Cold
          const tempOrder = { 'Hot': 3, 'Warm': 2, 'Cold': 1 };
          const scoreA = tempOrder[a.temperature || 'Cold'];
          const scoreB = tempOrder[b.temperature || 'Cold'];
          
          if (scoreA !== scoreB) return scoreB - scoreA;
          
          // Secondary sort by numeric score
          return (b.score || 0) - (a.score || 0);
      });
      
      setCompanies(mapped);

    } catch (e) {
        console.error("Error fetching companies data", e);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompaniesData();
  }, [userId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompany.name) return;
    
    if (!userId) {
        alert("Erro de autenticação: ID do usuário não encontrado.");
        return;
    }

    try {
        const { error } = await supabase.from('companies').insert([{
            name: newCompany.name,
            industry: newCompany.industry,
            domain: newCompany.domain,
            user_id: userId
            // created_at is handled by default in DB
        }]);
        
        if (error) throw error;
        
        setShowCreateModal(false);
        setNewCompany({ name: '', industry: '', domain: '' });
        fetchCompaniesData();
        
        // Notify
        if (onNotify) {
            onNotify('Empresa Criada!', `A empresa ${newCompany.name} foi adicionada.`, 'success', 'companies');
        } else {
            alert("Empresa criada com sucesso!");
        }

    } catch (e: any) {
        console.error("Error creating company:", e);
        alert("Erro ao criar empresa. Verifique sua conexão ou contate o administrador.");
    }
  };

  const getTempBadge = (temp?: string) => {
      switch(temp) {
          case 'Hot': 
            return (
                <div className="flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded border border-orange-100 dark:border-orange-900/30" title="Acima de 500 pontos">
                    <span className="material-symbols-outlined text-[14px]">local_fire_department</span>
                    Quente
                </div>
            );
          case 'Warm':
            return (
                <div className="flex items-center gap-1 text-xs font-bold text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 px-2 py-1 rounded border border-yellow-100 dark:border-yellow-900/30" title="Entre 300 e 500 pontos">
                    <span className="material-symbols-outlined text-[14px]">wb_sunny</span>
                    Morna
                </div>
            );
          default:
            return (
                <div className="flex items-center gap-1 text-xs font-bold text-blue-400 bg-blue-50 dark:bg-blue-900/10 px-2 py-1 rounded border border-blue-100 dark:border-blue-900/30" title="Abaixo de 300 pontos">
                    <span className="material-symbols-outlined text-[14px]">ac_unit</span>
                    Fria
                </div>
            );
      }
  };

  return (
    <div className="p-4 lg:p-6 w-full flex flex-col gap-6 h-full relative">
      
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Empresas</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Gerencie as contas e organizações alvo.</p>
        </div>
        <div className="flex gap-2">
            <button className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                Importar CSV
            </button>
            <button 
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded shadow-sm hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
                <span className="material-symbols-outlined text-[20px]">add</span>
                Nova Empresa
            </button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#151b2b] rounded border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col flex-1 overflow-hidden">
        
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex gap-4">
           <div className="relative flex-1 max-w-md">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-[18px]">search</span>
            <input
              className="w-full h-10 pl-9 pr-3 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-slate-400"
              placeholder="Buscar por nome da empresa, domínio..."
              type="text"
            />
          </div>
          <button className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium">
             <span className="material-symbols-outlined text-[18px]">filter_list</span>
             Filtros
          </button>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto">
            {loading ? (
                <div className="flex justify-center items-center h-40">
                    <span className="material-symbols-outlined animate-spin text-primary">sync</span>
                </div>
            ) : (
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 sticky top-0">
                    <tr>
                        <th className="px-6 py-4 font-bold text-slate-900 dark:text-white">Empresa</th>
                        <th className="px-6 py-4 font-bold text-slate-900 dark:text-white">Temp.</th>
                        <th className="px-6 py-4 font-bold text-slate-900 dark:text-white">Indústria</th>
                        <th className="px-6 py-4 font-bold text-slate-900 dark:text-white text-center">Score</th>
                        <th className="px-6 py-4 font-bold text-slate-900 dark:text-white text-center">Campanhas</th>
                        <th className="px-6 py-4 font-bold text-slate-900 dark:text-white">Open Deals</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {companies.length > 0 ? companies.map((company) => (
                    <tr 
                        key={company.id} 
                        onClick={() => onCompanyClick(company)}
                        className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                    >
                        <td className="px-6 py-3">
                            <div className="flex items-center gap-3">
                                <div className="size-8 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 font-bold text-xs uppercase group-hover:bg-white dark:group-hover:bg-slate-700 group-hover:border-primary/30 transition-colors">
                                    {(company.name || 'NA').slice(0, 2)}
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900 dark:text-white group-hover:text-primary transition-colors">{company.name}</p>
                                    <p className="text-xs text-primary">{company.domain}</p>
                                </div>
                            </div>
                        </td>
                        <td className="px-6 py-3">
                            {getTempBadge(company.temperature)}
                        </td>
                        <td className="px-6 py-3 text-slate-900 dark:text-slate-300 font-medium">{company.industry}</td>
                        {/* Score Column */}
                        <td className="px-6 py-3 text-center">
                            <div className="inline-flex items-center gap-1 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 px-2 py-1 rounded border border-yellow-200 dark:border-yellow-800 text-xs font-bold" title="Pontos acumulados de tarefas concluídas">
                                <span className="material-symbols-outlined text-[14px]">workspace_premium</span>
                                {company.score || 0}
                            </div>
                        </td>
                        <td className="px-6 py-3 text-center">
                            {company.campaignsCount && company.campaignsCount > 0 ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                                    {company.campaignsCount}
                                </span>
                            ) : (
                                <span className="text-slate-400 text-xs italic">Nenhuma</span>
                            )}
                        </td>
                        <td className="px-6 py-3">
                            {company.deals > 0 ? (
                                <span className="text-green-600 font-bold">{company.deals} Active</span>
                            ) : (
                                <span className="text-slate-400">-</span>
                            )}
                        </td>
                    </tr>
                    )) : (
                        <tr>
                            <td colSpan={7} className="text-center py-10">
                                Nenhuma empresa cadastrada.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
            )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-[#151b2b] w-full max-w-md rounded-lg shadow-xl border border-slate-200 dark:border-slate-800 p-6">
                <h3 className="text-lg font-bold mb-4 text-slate-900 dark:text-white">Nova Empresa</h3>
                <form onSubmit={handleCreate} className="space-y-4">
                    <label className="block">
                        <span className="text-sm font-bold text-slate-500">Nome da Empresa</span>
                        <input 
                            className="w-full mt-1 px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                            value={newCompany.name}
                            onChange={e => setNewCompany({...newCompany, name: e.target.value})}
                            required
                        />
                    </label>
                    <label className="block">
                        <span className="text-sm font-bold text-slate-500">Indústria</span>
                        <input 
                            className="w-full mt-1 px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                            value={newCompany.industry}
                            onChange={e => setNewCompany({...newCompany, industry: e.target.value})}
                        />
                    </label>
                     <label className="block">
                        <span className="text-sm font-bold text-slate-500">Domínio (Website)</span>
                        <input 
                            className="w-full mt-1 px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                            value={newCompany.domain}
                            onChange={e => setNewCompany({...newCompany, domain: e.target.value})}
                        />
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

export default CompaniesList;