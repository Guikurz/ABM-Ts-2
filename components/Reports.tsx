import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { Deal, CampaignData, Company } from '../types';

type DateRange = '30_days' | 'quarter' | 'year' | 'custom';

const Reports: React.FC = () => {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
  const [contacts, setContacts] = useState<any[]>([]); // Using any to access created_at easily
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Date State
  const [dateRange, setDateRange] = useState<DateRange>('30_days');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Company Filter State
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('All');

  useEffect(() => {
      const fetchData = async () => {
          setLoading(true);
          try {
              // 1. Fetch Deals
              const { data: dealsData } = await supabase.from('deals').select('*');
              if (dealsData) setDeals(dealsData);

              // 2. Fetch Campaigns (with mapping)
              const { data: campaignsData } = await supabase.from('campaigns').select('*');
              if (campaignsData) {
                  const mappedCampaigns = campaignsData.map((c: any) => ({
                      ...c,
                      targetCompany: c.target_company, // Ensure camelCase mapping for logic
                      totalPoints: c.total_points
                  }));
                  setCampaigns(mappedCampaigns);
              }

              // 3. Fetch Contacts (Added 'company' field for grouping)
              const { data: contactsData } = await supabase.from('contacts').select('id, created_at, company');
              if (contactsData) setContacts(contactsData);

              // 4. Fetch Companies (For the new report section)
              const { data: companiesData } = await supabase.from('companies').select('*');
              if (companiesData) setCompanies(companiesData);

          } catch (e) {
              console.error("Unexpected error fetching report data", e);
          } finally {
              setLoading(false);
          }
      };
      fetchData();
  }, []);

  const formatCurrency = (val: number) => {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // --- Filtering Logic ---
  const filterDate = (dateString?: string) => {
      if (!dateString) return false;
      const date = new Date(dateString);
      const now = new Date();
      
      if (dateRange === 'custom') {
          if (!customStart || !customEnd) return true; // Show all if incomplete
          const start = new Date(customStart);
          const end = new Date(customEnd);
          end.setHours(23, 59, 59, 999); // End of day
          return date >= start && date <= end;
      }

      let pastDate = new Date();
      if (dateRange === '30_days') pastDate.setDate(now.getDate() - 30);
      if (dateRange === 'quarter') pastDate.setMonth(now.getMonth() - 3);
      if (dateRange === 'year') pastDate.setFullYear(now.getFullYear() - 1);

      return date >= pastDate && date <= now;
  };

  // --- Derived Metrics ---

  // 1. Volume Overview (Filtered by Date)
  const stats = useMemo(() => {
      const filteredCampaigns = campaigns.filter(c => filterDate(c.created_at));
      const filteredContacts = contacts.filter(c => filterDate(c.created_at));
      
      let emailTasks = 0;
      let linkedinTasks = 0;
      let callTasks = 0;
      let totalCompleted = 0;

      campaigns.forEach(c => {
          if (c.steps) {
              c.steps.forEach(s => {
                  if (s.completed) {
                      totalCompleted++;
                      if (s.type === 'Email') emailTasks++;
                      if (s.type === 'LinkedIn') linkedinTasks++;
                      if (s.type === 'Ligação') callTasks++;
                  }
              });
          }
      });

      return {
          newCampaigns: filteredCampaigns.length,
          newContacts: filteredContacts.length,
          totalCompleted,
          emailTasks,
          linkedinTasks,
          callTasks
      };
  }, [campaigns, contacts, dateRange, customStart, customEnd]);

  // 2. Financials (Deals)
  const dealsMetrics = useMemo(() => {
      const filteredDeals = deals.filter(d => filterDate(d.created_at));
      
      // By Company
      const byCompany = filteredDeals.reduce((acc, deal) => {
          const name = deal.company_name || 'Empresa Desconhecida';
          if (!acc[name]) acc[name] = 0;
          if (deal.status === 'Won' || deal.status === 'Open') acc[name] += deal.value;
          return acc;
      }, {} as Record<string, number>);

      // By Campaign
      const byCampaign = filteredDeals.reduce((acc, deal) => {
          if (!deal.campaign_name) return acc;

          const name = deal.campaign_name;
          if (!acc[name]) acc[name] = 0;
          if (deal.status === 'Won' || deal.status === 'Open') acc[name] += deal.value;
          return acc;
      }, {} as Record<string, number>);

      return {
          sortedCompanies: (Object.entries(byCompany) as [string, number][]).sort((a, b) => b[1] - a[1]),
          sortedCampaigns: (Object.entries(byCampaign) as [string, number][]).sort((a, b) => b[1] - a[1])
      };
  }, [deals, dateRange, customStart, customEnd]);

  // 3. Timeline Data
  const timelineData = useMemo(() => {
      let days = 30;
      if (dateRange === 'quarter') days = 90;
      if (dateRange === 'year') days = 365;
      
      if (dateRange === 'custom' && customStart && customEnd) {
          const diff = new Date(customEnd).getTime() - new Date(customStart).getTime();
          days = Math.ceil(diff / (1000 * 3600 * 24)) + 1;
          if (days > 365) days = 365;
      }
      
      const referenceDate = dateRange === 'custom' && customEnd ? new Date(customEnd) : new Date();
      const displayPoints = Math.min(days, 30); 

      const dataPoints = new Array(displayPoints).fill(0).map((_, i) => {
          const d = new Date(referenceDate);
          d.setDate(d.getDate() - (displayPoints - 1 - i));
          return {
              label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
              dateStr: d.toDateString(),
              contacts: 0,
              campaigns: 0
          };
      });

      contacts.forEach(c => {
          if (!c.created_at) return;
          const cDate = new Date(c.created_at).toDateString();
          const point = dataPoints.find(p => p.dateStr === cDate);
          if (point) point.contacts++;
      });

      return dataPoints;
  }, [contacts, campaigns, dateRange, customStart, customEnd]);

  // 4. Detailed Company Reports & Temperature Logic
  const companyPerformance = useMemo(() => {
    return companies.map(company => {
        // Filter entities for this company
        const compCampaigns = campaigns.filter(c => c.targetCompany === company.name);
        const compContacts = contacts.filter(c => c.company === company.name);
        
        // Improved Deal Matching: Match by ID OR Name (to catch deals created via Campaigns without ID link)
        const compDeals = deals.filter(d => 
            d.company_id === company.id || 
            (d.company_name && d.company_name === company.name)
        );

        // Calculate Tasks Stats & Points from Campaigns
        let tasksTotal = 0;
        let tasksCompleted = 0;
        let pointsEarned = 0; // Points from completed tasks

        compCampaigns.forEach(camp => {
            if (camp.steps) {
                camp.steps.forEach(step => {
                    if (step.type !== 'Wait') {
                        tasksTotal++;
                        if (step.completed) {
                            tasksCompleted++;
                            pointsEarned += (step.points || 0); // Sum points from completed steps
                        }
                    }
                });
            }
        });

        const activeDeals = compDeals.filter(d => d.status === 'Open' || d.status === 'Won');
        const activeDealsValue = activeDeals.reduce((acc, curr) => acc + curr.value, 0);
        const activeDealsCount = activeDeals.length;

        // --- Temperature & Engagement Score Logic (Strict Rule) ---
        const engagementScore = pointsEarned;
        
        let temperature: 'Hot' | 'Warm' | 'Cold' = 'Cold';
        
        // Rule: > 500 Hot, >= 300 Warm, else Cold
        if (engagementScore > 500) {
            temperature = 'Hot';
        } else if (engagementScore >= 300) {
            temperature = 'Warm';
        }

        return {
            id: company.id,
            name: company.name,
            campaignsCount: compCampaigns.length,
            contactsCount: compContacts.length,
            dealsCount: activeDealsCount,
            dealsValue: activeDealsValue,
            tasksTotal,
            tasksCompleted,
            tasksPending: tasksTotal - tasksCompleted,
            pointsEarned,
            engagementScore, 
            temperature
        };
    }).sort((a, b) => b.engagementScore - a.engagementScore);
  }, [companies, campaigns, contacts, deals]);

  // 5. Temperature Aggregation
  const temperatureStats = useMemo(() => {
      const hot = companyPerformance.filter(c => c.temperature === 'Hot').length;
      const warm = companyPerformance.filter(c => c.temperature === 'Warm').length;
      const cold = companyPerformance.filter(c => c.temperature === 'Cold').length;
      const total = companyPerformance.length || 1; // Avoid division by zero

      return { hot, warm, cold, total };
  }, [companyPerformance]);

  // Filtered Company List
  const displayedCompanies = useMemo(() => {
      if (selectedCompanyFilter === 'All') return companyPerformance;
      return companyPerformance.filter(c => c.id === selectedCompanyFilter);
  }, [companyPerformance, selectedCompanyFilter]);


  if (loading) {
      return (
          <div className="flex items-center justify-center h-full min-h-[400px]">
              {/* Modern Bouncing Dots Loader */}
              <div className="flex items-center gap-1.5">
                  <div className="size-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="size-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="size-2 bg-primary rounded-full animate-bounce"></div>
              </div>
          </div>
      );
  }

  return (
    <div className="p-4 lg:p-6 w-full flex flex-col gap-6 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Relatórios de Performance</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                Métricas baseadas na utilização da plataforma e execução de tarefas.
            </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 items-end">
            {dateRange === 'custom' && (
                <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1 rounded border border-slate-200 dark:border-slate-700">
                    <input 
                        type="date" 
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                        className="text-xs border-none bg-transparent focus:ring-0 text-slate-700 dark:text-slate-300"
                    />
                    <span className="text-slate-400">-</span>
                    <input 
                        type="date" 
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className="text-xs border-none bg-transparent focus:ring-0 text-slate-700 dark:text-slate-300"
                    />
                </div>
            )}
            <div className="relative">
                <select 
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value as DateRange)}
                    className="appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded pl-3 pr-8 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 focus:ring-primary focus:border-primary cursor-pointer min-w-[150px]"
                >
                    <option value="30_days">Últimos 30 dias</option>
                    <option value="quarter">Este Trimestre</option>
                    <option value="year">Este Ano</option>
                    <option value="custom">Personalizado</option>
                </select>
                <span className="absolute right-2 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-500 text-[18px] pointer-events-none">calendar_month</span>
            </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-[#151b2b] p-5 rounded border border-slate-200 dark:border-slate-800 shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase">Campanhas Criadas</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.newCampaigns}</h3>
              <div className="mt-2 text-xs text-slate-400">No período selecionado</div>
          </div>
          <div className="bg-white dark:bg-[#151b2b] p-5 rounded border border-slate-200 dark:border-slate-800 shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase">Novos Contatos</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.newContacts}</h3>
              <div className="mt-2 text-xs text-slate-400">Adicionados à base</div>
          </div>
          <div className="bg-white dark:bg-[#151b2b] p-5 rounded border border-slate-200 dark:border-slate-800 shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase">Tarefas Executadas</p>
              <h3 className="text-2xl font-bold text-primary mt-1">{stats.totalCompleted}</h3>
              <div className="mt-2 text-xs text-slate-400">Ações manuais concluídas</div>
          </div>
      </div>

      {/* --- NEW SECTION: Account Temperature Analysis --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Temperature Breakdown */}
          <div className="lg:col-span-2 bg-white dark:bg-[#151b2b] rounded-lg border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <div className="flex justify-between items-start mb-6">
                  <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span className="material-symbols-outlined text-orange-500">thermostat</span>
                      Saúde da Carteira (Temperatura)
                  </h3>
                  {/* Legend / Rules */}
                  <div className="text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                      <p><strong>Critérios de Pontuação:</strong></p>
                      <p><span className="text-blue-500 font-bold">&lt; 300 pts:</span> Fria</p>
                      <p><span className="text-yellow-600 font-bold">300 - 500 pts:</span> Morna</p>
                      <p><span className="text-orange-500 font-bold">&gt; 500 pts:</span> Quente</p>
                  </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900/30 text-center">
                      <div className="flex items-center justify-center gap-1 text-orange-600 font-bold mb-1">
                          <span className="material-symbols-outlined">local_fire_department</span>
                          <span>Quentes</span>
                      </div>
                      <span className="text-2xl font-bold text-slate-900 dark:text-white">{temperatureStats.hot}</span>
                      <p className="text-xs text-slate-500">{Math.round((temperatureStats.hot / temperatureStats.total) * 100)}% da base</p>
                  </div>
                  
                  <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-900/30 text-center">
                      <div className="flex items-center justify-center gap-1 text-yellow-600 font-bold mb-1">
                          <span className="material-symbols-outlined">wb_sunny</span>
                          <span>Mornas</span>
                      </div>
                      <span className="text-2xl font-bold text-slate-900 dark:text-white">{temperatureStats.warm}</span>
                      <p className="text-xs text-slate-500">{Math.round((temperatureStats.warm / temperatureStats.total) * 100)}% da base</p>
                  </div>

                  <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 text-center">
                      <div className="flex items-center justify-center gap-1 text-blue-500 font-bold mb-1">
                          <span className="material-symbols-outlined">ac_unit</span>
                          <span>Frias</span>
                      </div>
                      <span className="text-2xl font-bold text-slate-900 dark:text-white">{temperatureStats.cold}</span>
                      <p className="text-xs text-slate-500">{Math.round((temperatureStats.cold / temperatureStats.total) * 100)}% da base</p>
                  </div>
              </div>

              <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden flex">
                  <div className="bg-orange-500 h-full" style={{ width: `${(temperatureStats.hot / temperatureStats.total) * 100}%` }}></div>
                  <div className="bg-yellow-500 h-full" style={{ width: `${(temperatureStats.warm / temperatureStats.total) * 100}%` }}></div>
                  <div className="bg-blue-400 h-full" style={{ width: `${(temperatureStats.cold / temperatureStats.total) * 100}%` }}></div>
              </div>
          </div>

          {/* Top Engaged Companies */}
          <div className="bg-white dark:bg-[#151b2b] rounded-lg border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-yellow-500">trophy</span>
                  Top Empresas (Pontuação)
              </h3>
              
              <div className="flex flex-col gap-3">
                  {companyPerformance.slice(0, 5).map((comp, i) => (
                      <div key={comp.id} className="flex items-center justify-between p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <div className="flex items-center gap-3">
                              <span className={`text-xs font-bold w-4 ${i === 0 ? 'text-yellow-500 text-sm' : 'text-slate-400'}`}>{i + 1}</span>
                              <div className="size-8 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500 uppercase">
                                  {comp.name.slice(0, 2)}
                              </div>
                              <div className="flex flex-col">
                                  <span className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[120px]">{comp.name}</span>
                                  <span className="text-[10px] text-slate-500">{comp.contactsCount} contatos</span>
                              </div>
                          </div>
                          <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded">
                              {comp.engagementScore}
                          </span>
                      </div>
                  ))}
                  {companyPerformance.length === 0 && (
                      <div className="text-center text-slate-400 text-sm py-4">Nenhuma empresa para ranquear.</div>
                  )}
              </div>
          </div>
      </div>

      {/* NEW SECTION: Company Detailed Report */}
      <div className="bg-white dark:bg-[#151b2b] rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-500">business_center</span>
                  Relatório Detalhado por Empresa
              </h3>
              
              <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Filtrar Empresa:</label>
                  <select 
                      value={selectedCompanyFilter}
                      onChange={(e) => setSelectedCompanyFilter(e.target.value)}
                      className="h-9 pl-3 pr-8 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:ring-primary focus:border-primary cursor-pointer min-w-[200px]"
                  >
                      <option value="All">Todas as Empresas</option>
                      {companies.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                  </select>
              </div>
          </div>

          <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                          <th className="px-6 py-4 font-bold text-slate-900 dark:text-white">Empresa</th>
                          <th className="px-6 py-4 font-bold text-slate-900 dark:text-white text-center">Temp.</th>
                          <th className="px-6 py-4 font-bold text-slate-900 dark:text-white text-center">Campanhas</th>
                          <th className="px-6 py-4 font-bold text-slate-900 dark:text-white text-center">Contatos</th>
                          <th className="px-6 py-4 font-bold text-slate-900 dark:text-white text-center">Score</th>
                          <th className="px-6 py-4 font-bold text-slate-900 dark:text-white">Deals / Pipeline</th>
                          <th className="px-6 py-4 font-bold text-slate-900 dark:text-white">Tarefas (Exec./Total)</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {displayedCompanies.length > 0 ? displayedCompanies.map((row) => (
                          <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                              <td className="px-6 py-4">
                                  <span className="font-bold text-slate-900 dark:text-white block">{row.name}</span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                  {row.temperature === 'Hot' && <span className="material-symbols-outlined text-orange-500 text-[18px]" title="Quente (> 500pts)">local_fire_department</span>}
                                  {row.temperature === 'Warm' && <span className="material-symbols-outlined text-yellow-500 text-[18px]" title="Morna (300-500pts)">wb_sunny</span>}
                                  {row.temperature === 'Cold' && <span className="material-symbols-outlined text-blue-400 text-[18px]" title="Fria (< 300pts)">ac_unit</span>}
                              </td>
                              <td className="px-6 py-4 text-center">
                                  {row.campaignsCount > 0 ? (
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                          {row.campaignsCount}
                                      </span>
                                  ) : (
                                      <span className="text-slate-400">-</span>
                                  )}
                              </td>
                              <td className="px-6 py-4 text-center">
                                  <span className="text-slate-700 dark:text-slate-300 font-medium">{row.contactsCount}</span>
                              </td>
                              {/* New Score/Points Column */}
                              <td className="px-6 py-4 text-center">
                                  <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-full font-mono text-xs font-bold">
                                      {row.engagementScore}
                                  </div>
                              </td>
                              <td className="px-6 py-4">
                                  <div className="flex flex-col">
                                      <span className="text-xs font-bold text-slate-500 uppercase">{row.dealsCount} deals</span>
                                      <span className="font-bold text-green-600">{formatCurrency(row.dealsValue)}</span>
                                  </div>
                              </td>
                              <td className="px-6 py-4">
                                  {row.tasksTotal > 0 ? (
                                      <div className="flex items-center gap-2">
                                          <div className="flex-1 w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                              <div 
                                                  className="h-full bg-primary rounded-full" 
                                                  style={{ width: `${(row.tasksCompleted / row.tasksTotal) * 100}%` }}
                                              ></div>
                                          </div>
                                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                              {row.tasksCompleted} / {row.tasksTotal}
                                          </span>
                                      </div>
                                  ) : (
                                      <span className="text-xs text-slate-400 italic">Sem tarefas</span>
                                  )}
                              </td>
                          </tr>
                      )) : (
                          <tr>
                              <td colSpan={7} className="text-center py-8 text-slate-400">
                                  Nenhuma empresa encontrada com os filtros atuais.
                              </td>
                          </tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Activity Breakdown */}
          <div className="bg-white dark:bg-[#151b2b] p-6 rounded border border-slate-200 dark:border-slate-800 shadow-sm">
             <h3 className="font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-orange-500">task_alt</span>
                Atividades Realizadas por Canal (Geral)
             </h3>
             
             {stats.totalCompleted === 0 ? (
                 <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                     <span className="material-symbols-outlined text-3xl mb-2 opacity-30">do_not_disturb_on</span>
                     <p className="text-sm">Nenhuma tarefa concluída ainda.</p>
                 </div>
             ) : (
                <div className="space-y-6">
                    {/* Email */}
                    <div>
                        <div className="flex justify-between text-sm mb-1.5">
                            <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium">
                                <span className="material-symbols-outlined text-[16px]">mail</span> Email
                            </span>
                            <span className="font-bold">{stats.emailTasks} <span className="text-slate-400 font-normal">({Math.round((stats.emailTasks / stats.totalCompleted)*100)}%)</span></span>
                        </div>
                        <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(stats.emailTasks / stats.totalCompleted)*100}%` }}></div>
                        </div>
                    </div>

                    {/* LinkedIn */}
                    <div>
                        <div className="flex justify-between text-sm mb-1.5">
                            <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium">
                                <span className="material-symbols-outlined text-[16px]">person_add</span> LinkedIn
                            </span>
                            <span className="font-bold">{stats.linkedinTasks} <span className="text-slate-400 font-normal">({Math.round((stats.linkedinTasks / stats.totalCompleted)*100)}%)</span></span>
                        </div>
                        <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(stats.linkedinTasks / stats.totalCompleted)*100}%` }}></div>
                        </div>
                    </div>

                    {/* Calls */}
                    <div>
                        <div className="flex justify-between text-sm mb-1.5">
                            <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium">
                                <span className="material-symbols-outlined text-[16px]">call</span> Calls / WhatsApp
                            </span>
                            <span className="font-bold">{stats.callTasks} <span className="text-slate-400 font-normal">({Math.round((stats.callTasks / stats.totalCompleted)*100)}%)</span></span>
                        </div>
                        <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-orange-500 rounded-full" style={{ width: `${(stats.callTasks / stats.totalCompleted)*100}%` }}></div>
                        </div>
                    </div>
                </div>
             )}
          </div>

          {/* Growth Timeline */}
          <div className="bg-white dark:bg-[#151b2b] p-6 rounded border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
             <h3 className="font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-500">trending_up</span>
                Novos Cadastros (Contatos)
             </h3>
             
             <div className="flex-1 flex items-end justify-between gap-1 min-h-[200px]">
                {timelineData.map((item, i) => {
                    // Normalize height relative to max value for visualization
                    const max = Math.max(...timelineData.map(d => d.contacts)) || 1;
                    const heightPct = (item.contacts / max) * 80;
                    
                    // Only show label for every 5th item if many points
                    const showLabel = timelineData.length > 15 ? i % 5 === 0 : true;

                    return (
                        <div key={i} className="flex-1 flex flex-col justify-end items-center group relative h-full">
                            <div 
                                className="w-full max-w-[20px] bg-blue-200 dark:bg-blue-900 rounded-t hover:bg-blue-400 transition-all relative min-h-[4px]"
                                style={{ height: `${heightPct}%` }}
                            >
                                {/* Tooltip */}
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10">
                                    {item.contacts} contatos<br/>
                                    {item.label}
                                </div>
                            </div>
                            {showLabel && (
                                <span className="text-[9px] text-slate-400 mt-2 transform -rotate-45 origin-left translate-x-1">{item.label}</span>
                            )}
                        </div>
                    );
                })}
             </div>
          </div>
      </div>

      {/* Financials (Deals) */}
      <div className="bg-white dark:bg-[#151b2b] p-6 rounded border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-green-600">monetization_on</span>
              Performance de Receita (Pipeline)
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Deals by Company */}
              <div className="flex flex-col gap-4">
                  <h4 className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Receita por Cliente</h4>
                  <div className="space-y-3">
                      {dealsMetrics.sortedCompanies.length > 0 ? dealsMetrics.sortedCompanies.slice(0, 5).map(([name, val], i) => (
                          <div key={i} className="flex flex-col gap-1">
                              <div className="flex justify-between text-sm">
                                  <span className="font-medium text-slate-700 dark:text-slate-300">{name}</span>
                                  <span className="font-bold text-green-600">{formatCurrency(val)}</span>
                              </div>
                              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${(val / (dealsMetrics.sortedCompanies[0][1] || 1)) * 100}%` }}></div>
                              </div>
                          </div>
                      )) : (
                          <p className="text-sm text-slate-400">Nenhum negócio registrado neste período.</p>
                      )}
                  </div>
              </div>

              {/* Deals by Campaign */}
              <div className="flex flex-col gap-4">
                  <h4 className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Receita por Campanha</h4>
                  <div className="space-y-3">
                      {dealsMetrics.sortedCampaigns.length > 0 ? dealsMetrics.sortedCampaigns.slice(0, 5).map(([name, val], i) => (
                          <div key={i} className="flex flex-col gap-1">
                              <div className="flex justify-between text-sm">
                                  <span className="font-medium text-slate-700 dark:text-slate-300">{name}</span>
                                  <span className="font-bold text-blue-600">{formatCurrency(val)}</span>
                              </div>
                              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(val / (dealsMetrics.sortedCampaigns[0][1] || 1)) * 100}%` }}></div>
                              </div>
                          </div>
                      )) : (
                          <p className="text-sm text-slate-400">Nenhum negócio vinculado a campanhas neste período.</p>
                      )}
                  </div>
              </div>
          </div>
      </div>

    </div>
  );
};

export default Reports;