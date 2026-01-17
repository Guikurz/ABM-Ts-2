import React, { useState, useMemo, useEffect } from 'react';
import { JourneyStep, LoadingState, StepType, UserProfile, Contact } from '../types';
import JourneyStepItem from './JourneyStepItem';
import { generateJourneySuggestion } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';

interface JourneyBuilderProps {
  steps: JourneyStep[];
  setSteps: React.Dispatch<React.SetStateAction<JourneyStep[]>>;
  campaignName: string;
  campaignObjective: string;
  onPointsUpdate: (points: number) => void;
  campaignStartDate?: string;
  onAutoSave?: (steps: JourneyStep[]) => void; 
  contacts?: Contact[]; // Added contacts list
}

const JourneyBuilder: React.FC<JourneyBuilderProps> = ({ steps, setSteps, campaignName, campaignObjective, onPointsUpdate, campaignStartDate, onAutoSave, contacts = [] }) => {
  const [aiStatus, setAiStatus] = useState<LoadingState>(LoadingState.IDLE);
  const [editingStep, setEditingStep] = useState<JourneyStep | null>(null);
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([]);
  
  // Helper to convert step.day to absolute Date string (YYYY-MM-DD) for input
  const getStepDateValue = (dayOffset: number) => {
    // Safety check for NaN or invalid inputs
    if (typeof dayOffset !== 'number' || isNaN(dayOffset)) {
        dayOffset = 0;
    }

    const start = campaignStartDate ? new Date(campaignStartDate) : new Date();
    // Validate start date
    if (isNaN(start.getTime())) return new Date().toISOString().split('T')[0];
    
    const targetDate = new Date(start);
    targetDate.setDate(start.getDate() + dayOffset);
    
    // Validate result date before converting to ISO string to prevent RangeError
    if (isNaN(targetDate.getTime())) return new Date().toISOString().split('T')[0];

    return targetDate.toISOString().split('T')[0];
  };

  // Helper to convert selected Date back to day offset
  const setStepDayFromDate = (dateString: string) => {
    if (!dateString) return Number(editingStep?.day) || 1;

    const start = campaignStartDate ? new Date(campaignStartDate) : new Date();
    // Validate start
    if (isNaN(start.getTime())) return 1;

    start.setHours(0,0,0,0);
    
    // Manual parse to ensure local time consistency and avoid timezone shifts from standard Date parsing of YYYY-MM-DD
    const parts = dateString.split('-');
    if (parts.length !== 3) return Number(editingStep?.day) || 1;
    
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    const day = parseInt(parts[2]);
    
    const selected = new Date(year, month, day); // Local midnight
    
    if (isNaN(selected.getTime())) return Number(editingStep?.day) || 1;

    const diffTime = selected.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Ensure at least day 1 (or allow 0 if needed, but keeping 1 as min for now)
    return diffDays < 1 ? 1 : diffDays;
  };

  // Helper to get default title based on step type
  const getDefaultTitle = (type: StepType): string => {
    switch (type) {
      case 'Email': return 'Email de Contato';
      case 'Ligação': return 'Ligação Telefônica';
      case 'WhatsApp': return 'Mensagem no WhatsApp';
      case 'LinkedIn': return 'Conexão no LinkedIn';
      case 'Mensagem LinkedIn': return 'Mensagem no LinkedIn';
      case 'Brinde': return 'Envio de Brinde';
      case 'Visita Presencial': return 'Visita Presencial';
      case 'Convite Evento': return 'Convite para Evento';
      case 'Encontro Evento': return 'Encontrar em Evento';
      case 'Almoço/Jantar': return 'Almoço ou Jantar';
      case 'Reunião Virtual': return 'Reunião Virtual';
      case 'Orçamento': return 'Enviar Orçamento';
      case 'Proposta': return 'Apresentar Proposta';
      case 'Contrato': return 'Assinatura de Contrato';
      case 'Wait': return 'Aguardar';
      default: return 'Nova Tarefa';
    }
  };

  // Fetch users for the "Responsável" dropdown
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { data } = await supabase.from('profiles').select('*');
        if (data) {
          setAvailableUsers(data);
        }
      } catch (error) {
        console.error("Erro ao carregar usuários:", error);
      }
    };
    fetchUsers();
  }, []);

  const handleDelete = (id: string) => {
    setSteps(prev => {
        const updated = prev.filter(s => s.id !== id);
        if (onAutoSave) onAutoSave(updated); // Auto-save on delete
        return updated;
    });
  };

  const handleToggleComplete = (id: string) => {
    setSteps(prev => {
      const newSteps = prev.map(s => s.id === id ? { ...s, completed: !s.completed } : s);
      const totalPoints = newSteps.reduce((acc, curr) => (curr.completed ? acc + (curr.points || 0) : acc), 0);
      onPointsUpdate(totalPoints);
      if (onAutoSave) onAutoSave(newSteps); // Auto-save on toggle
      return newSteps;
    });
  };

  const handleAiGenerate = async () => {
    setAiStatus(LoadingState.LOADING);
    try {
      const suggestedSteps = await generateJourneySuggestion(
        campaignName || "General Campaign",
        campaignObjective,
        "C-Level Executives in Tech"
      );
      
      // Get the first available user name or fallback
      const defaultOwner = availableUsers.length > 0 
        ? (availableUsers[0].full_name || availableUsers[0].email) 
        : ''; // Empty string to force manual assignment if no users

      // Assign default points and owner to generated steps
      const stepsWithPoints = suggestedSteps.map(s => ({ 
          ...s, 
          points: 50,
          owner: defaultOwner 
      }));
      setSteps(stepsWithPoints);
      if (onAutoSave) onAutoSave(stepsWithPoints); // Auto-save on AI generate
      setAiStatus(LoadingState.SUCCESS);
    } catch (e) {
      console.error(e);
      setAiStatus(LoadingState.ERROR);
    } finally {
      setTimeout(() => setAiStatus(LoadingState.IDLE), 2000);
    }
  };

  const handleAddStep = () => {
    const lastDay = steps.length > 0 ? Number(steps[steps.length - 1].day) : 0;
    
    // Default to empty to force selection
    const defaultOwner = '';

    const newStep: JourneyStep = {
      id: `manual-${Date.now()}`,
      type: 'Email',
      title: 'Email de Contato',
      description: 'Descrição da atividade...',
      day: lastDay + 2,
      points: 50,
      owner: defaultOwner
    };
    
    // Just update UI locally and open modal
    setSteps(prev => [...prev, newStep]);
    setEditingStep(newStep);
  };

  const handleUpdateStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStep) return;

    // VALIDATION: Check if owner is selected
    if (!editingStep.owner || editingStep.owner.trim() === '') {
        alert("É obrigatório selecionar um Responsável (Executor) para esta tarefa.");
        return;
    }
    
    setSteps(prev => {
        const updated = prev.map(s => s.id === editingStep.id ? editingStep : s);
        // Perform the save only when user explicitly confirms changes
        if (onAutoSave) onAutoSave(updated); 
        return updated;
    });
    setEditingStep(null);
  };

  // Filter out 'Wait' steps for display and sort by day
  const displayedSteps = useMemo(() => {
    return steps
      .filter(step => step.type !== 'Wait')
      .sort((a, b) => Number(a.day) - Number(b.day));
  }, [steps]);

  return (
    <div className="bg-white dark:bg-[#151b2b] rounded border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex flex-col flex-1 min-h-[500px]">
      <div className="flex items-center justify-between mb-6 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">account_tree</span>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Fluxo da Jornada</h2>
        </div>
        <div className="flex items-center gap-3">
          {aiStatus === LoadingState.LOADING ? (
            <div className="flex items-center gap-2 text-xs text-primary animate-pulse">
               <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
               <span>Gerando...</span>
            </div>
          ) : (
            <button
                onClick={handleAiGenerate}
                className="flex items-center gap-1 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded transition-colors"
            >
                <span className="material-symbols-outlined text-[16px]">network_intelligence</span>
                Gerar com IA
            </button>
          )}

          <div className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
            {displayedSteps.length} passos
          </div>
        </div>
      </div>

      {/* Visual Flow */}
      <div className="relative flex flex-col items-center flex-1 py-4 px-4 sm:px-10 overflow-y-auto max-h-[600px] no-scrollbar">
        <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-slate-200 dark:bg-slate-700 -translate-x-1/2 z-0"></div>

        <div className="relative z-10 mb-8">
          <div className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-4 py-1.5 rounded-full text-xs font-bold border border-green-200 dark:border-green-800/50 shadow-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">flag</span>
            Início da Jornada: {new Date(campaignStartDate || new Date()).toLocaleDateString('pt-BR')}
          </div>
        </div>

        {displayedSteps.map((step, index) => {
          const prevStep = index > 0 ? displayedSteps[index - 1] : null;
          const currentDay = Number(step.day);
          const prevDay = prevStep ? Number(prevStep.day) : 0;
          const gap = currentDay - prevDay;
          
          return (
            <React.Fragment key={step.id}>
              {/* Automatic Gap Indicator */}
              {gap > 0 && index > 0 && (
                <div className="relative z-10 w-full max-w-[240px] group mb-8">
                  <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full py-2 px-4 shadow-sm flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-slate-400 text-[18px]">history</span>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight">
                      {gap} {gap === 1 ? 'dia' : 'dias'} de intervalo
                    </span>
                  </div>
                </div>
              )}

              <JourneyStepItem 
                step={step} 
                onDelete={handleDelete} 
                onToggleComplete={handleToggleComplete}
                onEdit={setEditingStep}
              />
            </React.Fragment>
          );
        })}

        <div className="relative z-10 pb-8">
          <button 
            onClick={handleAddStep}
            className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-primary border border-dashed border-primary/40 hover:border-primary rounded-full size-10 flex items-center justify-center transition-all shadow-sm group/add"
          >
            <span className="material-symbols-outlined group-hover/add:scale-110 transition-transform">add</span>
          </button>
        </div>
      </div>

      {/* Edit Modal */}
      {editingStep && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleUpdateStep}>
              <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Editar Passo</h3>
                <p className="text-xs text-slate-500">Defina os detalhes da tarefa e quem será impactado.</p>
              </div>
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-slate-500 uppercase">Tipo da Ação</span>
                    <select 
                      className="w-full h-10 px-3 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-1 focus:ring-primary"
                      value={editingStep.type}
                      onChange={e => {
                          const newType = e.target.value as StepType;
                          setEditingStep({
                              ...editingStep, 
                              type: newType,
                              title: getDefaultTitle(newType) // Auto-update title on type change
                          });
                      }}
                    >
                      <option value="Email">Email</option>
                      <option value="Ligação">Ligação</option>
                      <option value="WhatsApp">WhatsApp</option>
                      <option value="LinkedIn">Conexão LinkedIn</option>
                      <option value="Mensagem LinkedIn">Mensagem LinkedIn</option>
                      <option value="Brinde">Brinde</option>
                      <option value="Visita Presencial">Visita Presencial</option>
                      <option value="Convite Evento">Convite Evento</option>
                      <option value="Encontro Evento">Encontro em Evento</option>
                      <option value="Almoço/Jantar">Almoço ou Jantar</option>
                      <option value="Reunião Virtual">Reunião Virtual</option>
                      <option value="Orçamento">Orçamento</option>
                      <option value="Proposta">Proposta</option>
                      <option value="Contrato">Contrato</option>
                    </select>
                  </label>
                  
                  {/* Date Input instead of Day Number */}
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-slate-500 uppercase">Data de Execução</span>
                    <input 
                      type="date"
                      className="w-full h-10 px-3 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-1 focus:ring-primary"
                      value={getStepDateValue(Number(editingStep.day))}
                      onChange={e => setEditingStep({...editingStep, day: setStepDayFromDate(e.target.value)})}
                    />
                    <span className="text-[10px] text-slate-400 text-right">Dia {editingStep.day} da campanha</span>
                  </label>
                </div>

                {/* Assignment Section - GROUPED FOR CLARITY */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-100 dark:border-slate-700">
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-3 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px]">assignment_ind</span>
                        Atribuição da Tarefa
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        {/* Responsible Person Field - REQUIRED */}
                        <label className="flex flex-col gap-1">
                            <span className="text-[11px] font-bold text-slate-500 uppercase">Quem vai fazer? (Executor) <span className="text-red-500">*</span></span>
                            <select
                                className="w-full h-10 px-3 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-1 focus:ring-primary focus:border-primary"
                                value={editingStep.owner || ''}
                                onChange={(e) => setEditingStep({...editingStep, owner: e.target.value})}
                                required
                            >
                                <option value="" disabled>Selecione um usuário...</option>
                                {availableUsers.map(user => {
                                    const displayName = user.full_name || user.email;
                                    return (
                                    <option key={user.id} value={displayName}>
                                        {displayName} {user.role ? `(${user.role})` : ''}
                                    </option>
                                    );
                                })}
                            </select>
                            {!editingStep.owner && <span className="text-[10px] text-red-500 font-bold">Obrigatório.</span>}
                        </label>

                        {/* Target Contact - New Field */}
                        <label className="flex flex-col gap-1">
                            <span className="text-[11px] font-bold text-slate-500 uppercase">Para quem? (Contato Alvo)</span>
                            <select
                                className="w-full h-10 px-3 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-1 focus:ring-primary focus:border-primary"
                                value={editingStep.targetContactName || ''}
                                onChange={(e) => setEditingStep({...editingStep, targetContactName: e.target.value})}
                            >
                                <option value="">Todos da Empresa (Geral)</option>
                                {contacts.map(c => (
                                    <option key={c.id} value={c.name}>{c.name} ({c.role})</option>
                                ))}
                            </select>
                        </label>
                    </div>
                    
                    {/* Visual Confirmation Sentence */}
                    <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-700 italic flex gap-1 items-start">
                        <span className="material-symbols-outlined text-[14px] mt-0.5 text-primary">info</span>
                        <p>
                            <strong className="text-slate-800 dark:text-slate-200">{editingStep.owner || '...'}</strong> realizará esta tarefa para <strong className="text-slate-800 dark:text-slate-200">{editingStep.targetContactName || 'todos os contatos'}</strong>.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                    <label className="col-span-2 flex flex-col gap-1">
                        <span className="text-xs font-bold text-slate-500 uppercase">Título da Tarefa</span>
                        <input 
                            type="text"
                            className="w-full h-10 px-3 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-1 focus:ring-primary"
                            value={editingStep.title}
                            onChange={e => setEditingStep({...editingStep, title: e.target.value})}
                        />
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-slate-500 uppercase">Pontos</span>
                        <input 
                            type="number"
                            className="w-full h-10 px-3 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-1 focus:ring-primary"
                            value={editingStep.points || 0}
                            onChange={e => setEditingStep({...editingStep, points: Number(e.target.value)})}
                        />
                    </label>
                </div>

                <label className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-slate-500 uppercase">Descrição / Script / Template</span>
                  <textarea 
                    className="w-full h-24 p-3 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm resize-none focus:ring-1 focus:ring-primary"
                    value={editingStep.description}
                    onChange={e => setEditingStep({...editingStep, description: e.target.value})}
                    placeholder="Ex: Olá {{nome}}, gostaria de..."
                  />
                </label>
              </div>
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-b-xl flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => {
                      // Remove if added just now and cancelled
                      if(editingStep.id.startsWith('manual-') && !steps.find(s => s.id === editingStep.id)?.owner) {
                          setSteps(prev => prev.filter(s => s.id !== editingStep.id));
                      }
                      setEditingStep(null);
                  }}
                  className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 text-sm font-bold text-white bg-primary hover:bg-blue-700 rounded shadow-md transition-colors"
                >
                  Confirmar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default JourneyBuilder;