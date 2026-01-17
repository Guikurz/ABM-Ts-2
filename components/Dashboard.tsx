import React, { useMemo } from 'react';
import { UserProfile, DashboardStats, Page, CampaignData } from '../types';

interface DashboardProps {
  userProfile: UserProfile | null;
  stats?: DashboardStats;
  campaigns?: CampaignData[];
  onNavigate?: (page: Page) => void;
}

const StatCard: React.FC<{ title: string; value: string; trend?: string; isPositive?: boolean; icon: string; colorClass?: string }> = ({ title, value, trend, isPositive, icon, colorClass = "text-primary bg-slate-50 dark:bg-slate-800" }) => (
  <div className="bg-white dark:bg-[#151b2b] p-6 rounded border border-slate-200 dark:border-slate-800 shadow-sm">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">{title}</p>
        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{value}</h3>
      </div>
      <div className={`p-2 rounded ${colorClass}`}>
        <span className="material-symbols-outlined">{icon}</span>
      </div>
    </div>
    {trend && (
        <div className={`mt-4 flex items-center gap-1 text-xs font-bold ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
        <span className="material-symbols-outlined text-[16px]">{isPositive ? 'trending_up' : 'trending_down'}</span>
        <span>{trend}</span>
        <span className="text-slate-400 dark:text-slate-500 font-medium ml-1">vs mês anterior</span>
        </div>
    )}
  </div>
);

const OnboardingStep: React.FC<{ title: string; done: boolean; onClick: () => void; buttonText: string }> = ({ title, done, onClick, buttonText }) => (
    <div className={`flex items-center justify-between p-4 rounded-lg border transition-all ${done ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-900/30' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
        <div className="flex items-center gap-3">
            <div className={`size-6 rounded-full flex items-center justify-center border ${done ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300 text-transparent'}`}>
                <span className="material-symbols-outlined text-[16px]">check</span>
            </div>
            <span className={`text-sm font-medium ${done ? 'text-green-800 dark:text-green-400 line-through' : 'text-slate-700 dark:text-slate-300'}`}>{title}</span>
        </div>
        {!done && (
            <button 
                onClick={onClick}
                className="text-xs font-bold text-primary hover:underline"
            >
                {buttonText}
            </button>
        )}
    </div>
);

// Reusable Task Table Component for Dashboard
const TaskTable: React.FC<{ tasks: any[], title: string, icon: string, emptyMessage: string, onNavigate?: (page: Page) => void, headerColor?: string }> = ({ tasks, title, icon, emptyMessage, onNavigate, headerColor = "text-primary" }) => {
    
    const getTaskIcon = (type: string) => {
        switch(type) {
            case 'Email': return 'mail';
            case 'LinkedIn': 
            case 'Mensagem LinkedIn': return 'chat_bubble'; // Updated icon
            case 'Ligação': return 'call';
            case 'WhatsApp': return 'chat';
            case 'Brinde': return 'redeem';
            case 'Reunião Virtual': return 'video_camera_front';
            default: return 'task_alt';
        }
    };
  
    const getTaskColor = (type: string) => {
        switch(type) {
            case 'Email': return 'bg-blue-100 text-blue-600';
            case 'LinkedIn': 
            case 'Mensagem LinkedIn': return 'bg-indigo-100 text-indigo-600';
            case 'Ligação': return 'bg-orange-100 text-orange-600';
            case 'WhatsApp': return 'bg-green-100 text-green-600';
            case 'Brinde': return 'bg-pink-100 text-pink-600';
            case 'Reunião Virtual': return 'bg-violet-100 text-violet-600';
            default: return 'bg-slate-100 text-slate-600';
        }
    };

    return (
        <div className="bg-white dark:bg-[#151b2b] rounded border border-slate-200 dark:border-slate-800 shadow-sm p-6 flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <span className={`material-symbols-outlined ${headerColor}`}>{icon}</span>
                    <h3 className="font-bold text-slate-900 dark:text-white">{title}</h3>
                </div>
                <button onClick={() => onNavigate && onNavigate('tasks')} className="text-primary text-xs font-bold hover:underline flex items-center gap-1">
                    Ver todas
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
            </div>

            <div className="overflow-x-auto flex-1">
                {tasks.length > 0 ? (
                <table className="w-full text-left text-sm">
                    <thead className="text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                        <tr>
                            <th className="pb-3 font-semibold pl-2">Atividade</th>
                            <th className="pb-3 font-semibold">Campanha</th>
                            <th className="pb-3 font-semibold hidden sm:table-cell">Responsável</th>
                            <th className="pb-3 font-semibold text-right pr-2">Prazo</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {tasks.map((task) => (
                            <tr key={task.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <td className="py-3 pl-2">
                                    <div className="flex items-center gap-3">
                                        <div className={`size-8 rounded flex items-center justify-center shrink-0 ${getTaskColor(task.type)}`}>
                                            <span className="material-symbols-outlined text-[16px]">{getTaskIcon(task.type)}</span>
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-900 dark:text-white truncate max-w-[150px]">{task.title}</p>
                                            <p className="text-xs text-slate-500">{task.type}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="py-3">
                                    <p className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[120px]">{task.campaign}</p>
                                    <p className="text-xs text-primary truncate max-w-[120px]">{task.company}</p>
                                </td>
                                <td className="py-3 hidden sm:table-cell">
                                    <div className="flex items-center gap-2">
                                        <div className="size-5 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                            {task.owner.charAt(0)}
                                        </div>
                                        <span className="text-xs text-slate-600 dark:text-slate-400 truncate max-w-[100px]">{task.owner}</span>
                                    </div>
                                </td>
                                <td className="py-3 text-right pr-2">
                                    <span className={`text-xs font-bold ${
                                        new Date().toDateString() === task.date.toDateString() ? 'text-green-600' :
                                        task.date < new Date() ? 'text-red-500' : 'text-slate-500'
                                    }`}>
                                        {task.date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center text-slate-400 h-full">
                        <span className="material-symbols-outlined text-3xl mb-2 opacity-30">event_available</span>
                        <p className="text-sm">{emptyMessage}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const Dashboard: React.FC<DashboardProps> = ({ userProfile, stats, campaigns = [], onNavigate }) => {
  const userName = userProfile?.full_name?.split(' ')[0] || 'Usuário';

  // Get Current Month dynamically
  const currentMonth = new Date().toLocaleString('pt-BR', { month: 'long' });
  const displayMonth = currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1);

  // Calculate progress safely
  const steps = [
      { id: 1, title: 'Criar sua primeira Empresa', done: !!stats?.hasCompany, link: 'companies', btn: 'Criar Empresa' },
      { id: 2, title: 'Cadastrar um Contato', done: !!stats?.hasContact, link: 'contacts', btn: 'Adicionar Contato' },
      { id: 3, title: 'Criar uma Campanha', done: !!stats?.hasCampaign, link: 'campaign-editor', btn: 'Criar Campanha' },
      { id: 4, title: 'Definir valor da proposta (Pontos)', done: !!stats?.hasProposalValue, link: 'campaigns', btn: 'Ver Campanhas' },
  ];
  
  const completedCount = steps.filter(s => s.done).length;
  const progress = steps.length > 0 ? (completedCount / steps.length) * 100 : 0;
  const isTutorialComplete = progress === 100;

  const formatCurrency = (value: number) => {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
  };

  // Split Tasks: Today vs Upcoming
  const { todayTasks, upcomingTasks } = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0); // Normalize today to midnight

    const tTasks: any[] = [];
    const uTasks: any[] = [];

    campaigns.forEach(camp => {
        if (camp.status === 'Active' || camp.status === 'Ativa') {
            const start = camp.created_at ? new Date(camp.created_at) : new Date();
            
            camp.steps?.forEach(step => {
                if (!step.completed && step.type !== 'Wait') {
                    // Calculate Due Date based on step.day
                    const dueDate = new Date(start);
                    dueDate.setDate(start.getDate() + Number(step.day));
                    const dueDateNormalized = new Date(dueDate);
                    dueDateNormalized.setHours(0,0,0,0);
                    
                    const taskObj = {
                        id: step.id,
                        title: step.title,
                        type: step.type,
                        campaign: camp.name,
                        company: camp.targetCompany,
                        date: dueDate, // Keep full date object for sorting
                        owner: step.owner || 'Não atribuído'
                    };

                    if (dueDateNormalized.getTime() <= today.getTime()) {
                        // Today or Overdue goes to "Agenda de Hoje"
                        tTasks.push(taskObj);
                    } else {
                        // Future dates go to "Próximas"
                        uTasks.push(taskObj);
                    }
                }
            });
        }
    });

    // Sort by Date (Closest first)
    tTasks.sort((a, b) => a.date.getTime() - b.date.getTime());
    uTasks.sort((a, b) => a.date.getTime() - b.date.getTime());

    return { 
        todayTasks: tTasks.slice(0, 5), 
        upcomingTasks: uTasks.slice(0, 5) 
    };
  }, [campaigns]);

  return (
    <div className="p-4 lg:p-6 w-full flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Visão Geral ({displayMonth})</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Bem-vindo de volta, {userName}.</p>
      </div>

      {/* Onboarding Widget - ONLY SHOW IF STATS ARE LOADED AND INCOMPLETE */}
      {stats && !isTutorialComplete && (
          <div className="bg-white dark:bg-[#151b2b] rounded-xl border border-primary/20 shadow-lg shadow-primary/5 overflow-hidden">
              <div className="p-6 bg-gradient-to-r from-primary/5 to-transparent border-b border-primary/10">
                  <div className="flex justify-between items-end mb-2">
                      <div>
                          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                              <span className="material-symbols-outlined text-primary">rocket_launch</span>
                              Primeiros Passos
                          </h2>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Complete o tutorial para ativar sua conta 100%.</p>
                      </div>
                      <span className="text-2xl font-bold text-primary">{Math.round(progress)}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-primary transition-all duration-500 ease-out" style={{ width: `${progress}%` }}></div>
                  </div>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {steps.map((step) => (
                      <OnboardingStep 
                        key={step.id} 
                        title={step.title} 
                        done={!!step.done} 
                        onClick={() => onNavigate && onNavigate(step.link as any)}
                        buttonText={step.btn}
                      />
                  ))}
              </div>
          </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard 
            title="Pipeline Gerado" 
            value={formatCurrency(stats?.pipelineValue || 0)}
            trend={stats?.pipelineValue ? "+0%" : undefined} 
            isPositive={true} 
            icon="payments" 
            colorClass="text-green-600 bg-green-50 dark:bg-green-900/20"
        />
        <StatCard 
            title="Campanhas Ativas" 
            value={String(stats?.activeCampaignsCount || 0)}
            trend={stats?.activeCampaignsCount ? "+0" : undefined}
            isPositive={true} 
            icon="rocket_launch" 
            colorClass="text-blue-600 bg-blue-50 dark:bg-blue-900/20"
        />
        <StatCard 
            title="Campanhas Finalizadas" 
            value={String(stats?.completedCampaignsCount || 0)}
            trend={stats?.completedCampaignsCount ? "+0" : undefined}
            isPositive={true} 
            icon="flag_circle" 
            colorClass="text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20"
        />
        <StatCard 
            title="Ações Realizadas" 
            value={String(stats?.totalActions || 0)}
            trend={stats?.totalActions ? "+0%" : undefined}
            isPositive={true} 
            icon="bolt" 
            colorClass="text-orange-600 bg-orange-50 dark:bg-orange-900/20"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Column: Agenda (2/3 width) - Now split into two blocks */}
        <div className="lg:col-span-2 flex flex-col gap-6">
            
            {/* Widget 1: Today's Tasks */}
            <TaskTable 
                tasks={todayTasks} 
                title="Agenda de Hoje" 
                icon="event_note" 
                emptyMessage="Sua agenda de hoje está livre!"
                onNavigate={onNavigate}
            />

            {/* Widget 2: Upcoming Tasks */}
            <TaskTable 
                tasks={upcomingTasks} 
                title="Próximas Atividades" 
                icon="upcoming" 
                headerColor="text-blue-500"
                emptyMessage="Nenhuma atividade futura agendada."
                onNavigate={onNavigate}
            />

        </div>

        {/* Right Column: Recent Campaigns (1/3 width) */}
        <div className="lg:col-span-1 bg-white dark:bg-[#151b2b] rounded border border-slate-200 dark:border-slate-800 shadow-sm p-6 flex flex-col h-fit">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 dark:text-white">Recentes</h3>
          </div>
          
          <div className="flex flex-col gap-3">
              {campaigns.length > 0 ? campaigns.slice(0, 4).map((camp, i) => (
                  <div key={i} className="flex justify-between items-center p-3 rounded bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-primary/30 transition-colors cursor-pointer" onClick={() => onNavigate && onNavigate('campaigns')}>
                      <div>
                          <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate max-w-[120px]">{camp.name}</h4>
                          <span className={`text-[10px] font-bold uppercase ${
                              camp.status === 'Active' ? 'text-green-600' : 'text-slate-500'
                          }`}>{camp.status}</span>
                      </div>
                      <div className="text-right">
                          <p className="text-xs text-slate-500 mb-1">Progresso</p>
                          <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div className="h-full bg-primary" style={{ width: `${camp.progress}%` }}></div>
                          </div>
                      </div>
                  </div>
              )) : (
                <div className="text-center py-6 text-slate-400 text-sm">
                    Nenhuma campanha recente.
                </div>
              )}
              {campaigns.length > 0 && <button onClick={() => onNavigate && onNavigate('campaigns')} className="mt-2 w-full py-2 text-sm border border-slate-200 dark:border-slate-700 rounded text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800">Ver todas</button>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;