import React, { useState, useEffect } from 'react';
import CampaignDetails from './CampaignDetails';
import JourneyBuilder from './JourneyBuilder';
import AudienceSelector from './AudienceSelector';
import { CampaignData, Contact, JourneyStep, Page, Company, Deal } from '../types';
import { supabase } from '../services/supabaseClient';

interface CampaignEditorProps {
  onNavigate: (page: Page) => void;
  onSave: (campaign: CampaignData) => void;
  onDelete: (id: string) => void;
  initialCampaign?: CampaignData; 
  onContactClick?: (contact: Contact) => void; 
}

const INITIAL_STEPS: JourneyStep[] = [
  {
    id: '1',
    type: 'Email',
    title: 'Email de Apresentação',
    description: 'Olá {{nome}}, vi que a {{empresa}} está crescendo e gostaria de apresentar...',
    day: 1,
    points: 50,
    owner: 'Fernanda Lima'
  },
  {
    id: '3',
    type: 'LinkedIn',
    title: 'Conexão LinkedIn',
    description: 'Conexão manual ou automática com nota personalizada.',
    day: 3, 
    points: 100,
    owner: 'Roberto M.'
  }
];

const DEFAULT_CAMPAIGN: CampaignData = {
    name: 'Nova Campanha',
    targetCompany: '',
    objective: 'Agendar Reunião',
    totalPoints: 0,
    status: 'Active'
};

const CampaignEditor: React.FC<CampaignEditorProps> = ({ onNavigate, onSave, onDelete, initialCampaign, onContactClick }) => {
  const [campaignData, setCampaignData] = useState<CampaignData>(initialCampaign || DEFAULT_CAMPAIGN);
  const [steps, setSteps] = useState<JourneyStep[]>(
      (initialCampaign?.steps && initialCampaign.steps.length > 0) 
        ? initialCampaign.steps 
        : INITIAL_STEPS
  );
  
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [availableCompanies, setAvailableCompanies] = useState<Company[]>([]);
  const [campaignDeals, setCampaignDeals] = useState<Deal[]>([]);
  
  // Deal Modal State (Existing "Add Deal" functionality)
  const [showDealModal, setShowDealModal] = useState(false);
  const [newDeal, setNewDeal] = useState({ title: '', value: '', status: 'Open' as 'Open' | 'Won' | 'Lost' });

  // Finish Campaign Modal State
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [finishStep, setFinishStep] = useState<'confirm' | 'details'>('confirm');
  const [hasWonDeal, setHasWonDeal] = useState<boolean | null>(null);
  const [closingDeal, setClosingDeal] = useState({ title: '', value: '' });
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    if (initialCampaign) {
        setCampaignData(initialCampaign);
        if (initialCampaign.steps && initialCampaign.steps.length > 0) {
            setSteps(initialCampaign.steps);
        } else {
            setSteps(INITIAL_STEPS);
        }
    } else {
        setCampaignData(DEFAULT_CAMPAIGN);
        setSteps(INITIAL_STEPS);
    }
  }, [initialCampaign]);

  useEffect(() => {
    const fetchCompanies = async () => {
        try {
            const { data, error } = await supabase.from('companies').select('*');
            if (error) throw error;
            if (data) {
                const mappedCompanies: Company[] = data.map((c: any) => ({
                    id: c.id,
                    name: c.name,
                    industry: c.industry,
                    size: c.size,
                    domain: c.domain,
                    contactsCount: 0,
                    deals: 0,
                    location: c.location,
                    description: c.description
                }));
                setAvailableCompanies(mappedCompanies);
            }
        } catch (error) {
            console.error("Error loading companies for dropdown:", error);
        }
    };

    const fetchDeals = async () => {
        if (!initialCampaign?.id) return;
        try {
            const { data } = await supabase.from('deals').select('*').eq('campaign_id', initialCampaign.id);
            if (data) setCampaignDeals(data);
        } catch (e) {
            console.error("Error loading deals", e);
        }
    };

    fetchCompanies();
    fetchDeals();
  }, [initialCampaign]);

  useEffect(() => {
      const fetchCompanyContacts = async () => {
          if (!campaignData.targetCompany) {
              setContacts([]);
              return;
          }
          setLoadingContacts(true);
          try {
              const { data, error } = await supabase
                .from('contacts')
                .select('*')
                .eq('company', campaignData.targetCompany);
              
              if (error) throw error;
              if (data) {
                   const mapped: Contact[] = data.map(c => ({
                        id: c.id,
                        name: c.name,
                        email: c.email,
                        role: c.role || '',
                        company: c.company || '',
                        status: c.status || 'New',
                        last: '-',
                        avatar: '',
                        priority: c.priority || 'Média',
                        selected: true 
                   }));
                   setContacts(mapped);
              } else {
                  setContacts([]);
              }
          } catch (e) {
              console.error("Error fetching company contacts", e);
          } finally {
              setLoadingContacts(false);
          }
      };
      fetchCompanyContacts();
  }, [campaignData.targetCompany]);

  const handleCampaignChange = (data: Partial<CampaignData>) => {
    setCampaignData(prev => ({ ...prev, ...data }));
  };

  const handleDeleteClick = () => {
    if (window.confirm("Tem certeza que deseja excluir esta campanha? Esta ação é irreversível.")) {
      if (campaignData.id) {
        onDelete(campaignData.id);
      } else {
        onNavigate('campaigns');
      }
    }
  };

  const handleSaveClick = () => {
    if (!campaignData.name || !campaignData.targetCompany) {
      alert("Por favor, preencha o nome da campanha e selecione uma empresa.");
      return;
    }
    // Force status to Active if it's currently saving
    const statusToSave = campaignData.status === 'Completed' ? 'Completed' : 'Active';
    onSave({ ...campaignData, status: statusToSave, steps });
  };

  const handleAutoSave = (updatedSteps: JourneyStep[]) => {
      if (campaignData.name && campaignData.targetCompany) {
          // Keep current status on auto-save
          onSave({ ...campaignData, steps: updatedSteps });
      }
  };

  const handlePointsUpdate = (points: number) => {
    setCampaignData(prev => ({ ...prev, totalPoints: points }));
  };

  // --- Finish Campaign Logic ---
  const openFinishModal = () => {
      if (!campaignData.id || campaignData.id.toString().startsWith('camp-')) {
          alert("Salve a campanha antes de finalizar.");
          return;
      }
      setFinishStep('confirm');
      setHasWonDeal(null);
      setClosingDeal({ title: `Fechamento - ${campaignData.name}`, value: '' });
      setShowFinishModal(true);
  };

  const handleFinishConfirm = async () => {
      setFinishing(true);
      try {
          const { data: sessionData } = await supabase.auth.getSession();
          const userId = sessionData.session?.user.id;

          // 1. Create Deal if Won
          if (hasWonDeal && closingDeal.value) {
              const numericValue = parseFloat(closingDeal.value.replace(/[^0-9.]/g, ''));
              await supabase.from('deals').insert([{
                  title: closingDeal.title,
                  value: numericValue,
                  status: 'Won',
                  campaign_id: campaignData.id,
                  campaign_name: campaignData.name,
                  company_name: campaignData.targetCompany,
                  user_id: userId,
                  created_at: new Date()
              }]);
          }

          // 2. Update Campaign Status
          // IMPORTANT: Recalculate total points from current steps state to ensure accuracy
          const finalTotalPoints = steps.reduce((acc, s) => s.completed ? acc + (s.points || 0) : acc, 0);

          const updatedCampaign = { 
              ...campaignData, 
              status: 'Completed', 
              steps, 
              progress: 100,
              totalPoints: finalTotalPoints 
          };
          
          onSave(updatedCampaign);
          
          setShowFinishModal(false);
          alert("Campanha finalizada com sucesso!");
          onNavigate('campaigns');

      } catch (e: any) {
          console.error("Error finishing campaign:", e);
          alert("Erro ao finalizar campanha.");
      } finally {
          setFinishing(false);
      }
  };

  // Existing Deal Logic (Side Modal)
  const handleAddDeal = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!campaignData.id || !newDeal.title || !newDeal.value) return;
      try {
          const { data: sessionData } = await supabase.auth.getSession();
          const userId = sessionData.session?.user.id;
          const numericValue = parseFloat(newDeal.value.replace(/[^0-9.]/g, ''));

          const dealPayload = {
              title: newDeal.title,
              value: numericValue,
              status: newDeal.status,
              campaign_id: campaignData.id,
              campaign_name: campaignData.name,
              company_name: campaignData.targetCompany, 
              user_id: userId,
              created_at: new Date()
          };

          const { data, error } = await supabase.from('deals').insert([dealPayload]).select().single();
          if (error) throw error;
          
          setNewDeal({ title: '', value: '', status: 'Open' });
          setShowDealModal(false);
          if (data) setCampaignDeals(prev => [...prev, data]);

      } catch (e: any) {
          console.error(e);
          alert("Erro ao adicionar deal: " + e.message);
      }
  };

  const formatCurrency = (val: number) => {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="w-full max-w-full flex flex-col gap-6 p-4 lg:p-6 pb-10">
      {/* Page Heading & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                {initialCampaign?.id && !initialCampaign.id.startsWith('camp-') ? 'Editar Campanha' : 'Nova Campanha'}
            </h1>
            {campaignData.status === 'Completed' && (
                <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-3 py-1 rounded-full text-xs font-bold uppercase border border-blue-200 dark:border-blue-800">
                    Finalizada
                </span>
            )}
            {campaignData.totalPoints !== undefined && (
              <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-bold border border-primary/20">
                <span className="material-symbols-outlined text-[18px]">workspace_premium</span>
                {campaignData.totalPoints} Pontos
              </div>
            )}
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Defina os parâmetros, a audiência e o fluxo de cadência para seus leads.</p>
        </div>
        <div className="flex items-center gap-3">
          {initialCampaign?.id && (
              <button 
                onClick={handleDeleteClick}
                className="px-4 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 text-sm font-bold rounded transition-colors flex items-center gap-2"
            >
                <span className="material-symbols-outlined text-[18px]">delete</span>
                Excluir
            </button>
          )}
          
          <button 
            onClick={handleSaveClick}
            className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">save</span>
            Salvar
          </button>

          {campaignData.status !== 'Completed' && initialCampaign?.id && !initialCampaign.id.startsWith('camp-') && (
              <button 
                onClick={openFinishModal}
                className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded shadow-sm hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">flag_circle</span>
                Finalizar
              </button>
          )}
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-full">
        <div className="xl:col-span-7 flex flex-col gap-6">
          <CampaignDetails 
            data={campaignData} 
            onChange={handleCampaignChange}
            companies={availableCompanies}
          />
          
          {campaignData.id && !campaignData.id.toString().startsWith('camp-') && (
              <div className="bg-white dark:bg-[#151b2b] rounded border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-green-600">monetization_on</span>
                        <h2 className="text-base font-bold text-slate-900 dark:text-white">Pipeline da Campanha</h2>
                    </div>
                    <button onClick={() => setShowDealModal(true)} className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">add</span> Adicionar Negócio
                    </button>
                  </div>
                  <div className="space-y-2">
                      {campaignDeals.length > 0 ? campaignDeals.map((deal, i) => (
                          <div key={i} className="flex justify-between items-center p-3 rounded bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                              <div>
                                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{deal.title}</p>
                                  <p className="text-xs text-green-600 font-mono">{formatCurrency(deal.value)}</p>
                              </div>
                              <span className={`px-2 py-1 text-[10px] uppercase font-bold rounded ${
                                  deal.status === 'Won' ? 'bg-green-100 text-green-700' : 
                                  deal.status === 'Lost' ? 'bg-red-100 text-red-700' :
                                  'bg-slate-200 text-slate-600'
                              }`}>
                                  {deal.status}
                              </span>
                          </div>
                      )) : (
                          <div className="text-center text-xs text-slate-400 py-4">Nenhum negócio associado a esta campanha.</div>
                      )}
                  </div>
              </div>
          )}

          <JourneyBuilder 
            steps={steps} 
            setSteps={setSteps}
            campaignName={campaignData.name}
            campaignObjective={campaignData.objective}
            onPointsUpdate={handlePointsUpdate}
            campaignStartDate={campaignData.created_at || new Date().toISOString()} 
            onAutoSave={handleAutoSave}
            contacts={contacts} 
          />
        </div>

        <div className="xl:col-span-5 flex flex-col h-full min-h-[500px]">
            {loadingContacts ? (
                <div className="bg-white dark:bg-[#151b2b] rounded border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-center p-10 h-full max-h-[400px]">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                        <span className="material-symbols-outlined text-4xl animate-spin text-primary">sync</span>
                        <p className="text-sm font-medium">Carregando contatos de {campaignData.targetCompany}...</p>
                    </div>
                </div>
            ) : (
                <AudienceSelector 
                    contacts={contacts} 
                    targetCompany={campaignData.targetCompany}
                    onContactClick={onContactClick} 
                />
            )}
        </div>
      </div>

      {/* Manual Add Deal Modal */}
      {showDealModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-[#151b2b] w-full max-w-sm rounded-lg shadow-xl border border-slate-200 dark:border-slate-800 p-6">
                <h3 className="text-lg font-bold mb-4 text-slate-900 dark:text-white">Adicionar Negócio</h3>
                <form onSubmit={handleAddDeal} className="space-y-4">
                    <label className="block">
                        <span className="text-sm font-bold text-slate-500">Título</span>
                        <input 
                            className="w-full mt-1 px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                            placeholder="Ex: Contrato Anual"
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
                        <button type="submit" className="px-4 py-2 text-sm font-bold bg-primary text-white rounded hover:bg-blue-700">Adicionar</button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Finalize Campaign Modal */}
      {showFinishModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-[#151b2b] w-full max-w-md rounded-lg shadow-xl border border-slate-200 dark:border-slate-800 p-6 animate-in fade-in zoom-in duration-200">
                  <div className="text-center mb-6">
                      <div className="size-12 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                          <span className="material-symbols-outlined text-[28px]">check_circle</span>
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white">Finalizar Campanha</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                          Parabéns! Vamos registrar o resultado final desta campanha.
                      </p>
                  </div>

                  {finishStep === 'confirm' ? (
                      <div className="space-y-4">
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-300 text-center">
                              Houve fechamento de negócio (Deal) nesta campanha?
                          </p>
                          <div className="grid grid-cols-2 gap-3">
                              <button 
                                  onClick={() => { setHasWonDeal(false); handleFinishConfirm(); }}
                                  className="px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold transition-colors"
                              >
                                  Não houve
                              </button>
                              <button 
                                  onClick={() => { setHasWonDeal(true); setFinishStep('details'); }}
                                  className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold shadow-sm transition-colors"
                              >
                                  Sim, fechamos!
                              </button>
                          </div>
                          <button onClick={() => setShowFinishModal(false)} className="w-full text-center text-xs text-slate-400 mt-2 hover:underline">Cancelar</button>
                      </div>
                  ) : (
                      <div className="space-y-4">
                          <label className="block">
                              <span className="text-sm font-bold text-slate-500">Título do Negócio</span>
                              <input 
                                  className="w-full mt-1 px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                                  value={closingDeal.title}
                                  onChange={e => setClosingDeal({...closingDeal, title: e.target.value})}
                              />
                          </label>
                          <label className="block">
                              <span className="text-sm font-bold text-slate-500">Valor Total (R$)</span>
                              <input 
                                  type="number"
                                  className="w-full mt-1 px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                                  placeholder="0.00"
                                  value={closingDeal.value}
                                  onChange={e => setClosingDeal({...closingDeal, value: e.target.value})}
                              />
                          </label>
                          <div className="flex gap-3 pt-2">
                              <button 
                                  onClick={() => setFinishStep('confirm')}
                                  className="flex-1 px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded"
                              >
                                  Voltar
                              </button>
                              <button 
                                  onClick={handleFinishConfirm}
                                  disabled={finishing || !closingDeal.value}
                                  className="flex-1 px-4 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded shadow-sm disabled:opacity-50"
                              >
                                  {finishing ? 'Salvando...' : 'Confirmar & Finalizar'}
                              </button>
                          </div>
                      </div>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};

export default CampaignEditor;