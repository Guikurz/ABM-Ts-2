import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { CampaignData, JourneyStep, UserProfile } from '../types';

interface FlatTask {
  id: string;
  type: string;
  title: string;
  description: string;
  date: Date;
  completed: boolean;
  campaignId: string;
  campaignName: string;
  companyName: string;
  owner: string;
  targetContactName?: string; // Added field
  points?: number;
}

interface TasksProps {
    userId?: string;
    onGoToCampaign?: (campaignId: string) => void;
}

const Tasks: React.FC<TasksProps> = ({ userId, onGoToCampaign }) => {
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending');
  const [sortMethod, setSortMethod] = useState<'date' | 'recipient'>('date');
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
      const fetchProfile = async () => {
          if (!userId) return;
          const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
          if (data) setCurrentUserProfile(data);
      };
      fetchProfile();
  }, [userId]);

  const fetchCampaigns = async () => {
    if (!userId) return;
    setLoading(true);
    try {
        // Fetch ALL campaigns (Active and Completed) to ensure complete history in "Completed" tab
        const { data } = await supabase.from('campaigns').select('*').eq('user_id', userId);
        if (data) {
             const mapped: CampaignData[] = data.map((c: any) => ({
                id: c.id,
                name: c.name,
                targetCompany: c.target_company,
                steps: c.steps || [],
                status: c.status, // Ensure status is mapped
                created_at: c.created_at
            }));
            setCampaigns(mapped);
        }
    } catch (e) {
        console.error("Error fetching campaigns for tasks", e);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
      fetchCampaigns();
  }, [userId]);

  const onRefresh = () => {
      fetchCampaigns();
  };

  const allTasks: FlatTask[] = useMemo(() => {
      const tasks: FlatTask[] = [];
      const currentUserName = currentUserProfile?.full_name || currentUserProfile?.email;

      campaigns.forEach(camp => {
          if (camp.steps) {
              const startDate = camp.created_at ? new Date(camp.created_at) : new Date();
              camp.steps.forEach(step => {
                  if (step.type !== 'Wait') {
                      
                      // CRITICAL: Strict Filtering for Current User
                      // Ensure step owner matches current user profile name/email EXACTLY
                      if (step.owner !== currentUserName) {
                          return; // Skip this task if not owned by me
                      }

                      const dueDate = new Date(startDate);
                      dueDate.setDate(startDate.getDate() + Number(step.day));
                      
                      tasks.push({
                          id: step.id,
                          type: step.type,
                          title: step.title,
                          description: step.description,
                          date: dueDate,
                          completed: !!step.completed,
                          campaignId: camp.id || '',
                          campaignName: camp.name,
                          companyName: camp.targetCompany || '',
                          owner: step.owner || 'Não atribuído',
                          targetContactName: step.targetContactName, // Map target contact
                          points: step.points
                      });
                  }
              });
          }
      });
      return tasks;
  }, [campaigns, currentUserProfile]);

  const displayedTasks = useMemo(() => {
      // 1. Filter Logic
      let filtered = allTasks.filter(t => {
          if (filter === 'pending') return !t.completed;
          if (filter === 'completed') return t.completed;
          return true;
      });

      // 2. Sort Logic
      filtered.sort((a, b) => {
          if (sortMethod === 'date') {
              return a.date.getTime() - b.date.getTime();
          } else if (sortMethod === 'recipient') {
              // Alphabetical by Recipient (Target Name or Company if generic)
              const nameA = a.targetContactName || a.companyName || '';
              const nameB = b.targetContactName || b.companyName || '';
              return nameA.localeCompare(nameB);
          }
          return 0;
      });

      return filtered;
  }, [allTasks, filter, sortMethod]);

  const handleCompleteTask = async (task: FlatTask) => {
    setUpdatingId(task.id);
    try {
      const campaign = campaigns.find(c => c.id === task.campaignId);
      if (!campaign || !campaign.steps) return;

      const updatedSteps = campaign.steps.map(s => 
        s.id === task.id ? { ...s, completed: !s.completed } : s
      );

      // Recalculate based on active tasks (ignore 'Wait')
      const activeSteps = updatedSteps.filter(s => s.type !== 'Wait');
      const totalSteps = activeSteps.length;
      const completedSteps = activeSteps.filter(s => s.completed).length;
      
      const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
      
      // Calculate Total Points based on updated steps
      const totalPoints = updatedSteps.reduce((acc, s) => s.completed ? acc + (s.points || 0) : acc, 0);

      const { error } = await supabase
        .from('campaigns')
        .update({ 
          steps: updatedSteps,
          progress: progress,
          sent: completedSteps, 
          total_points: totalPoints, // Update points in DB
          updated_at: new Date().toISOString()
        })
        .eq('id', task.campaignId);

      if (error) throw error;
      onRefresh();

    } catch (e) {
      console.error("Error completing task:", e);
      alert("Erro ao atualizar tarefa. Tente novamente.");
    } finally {
      setUpdatingId(null);
    }
  };
  
  const getTaskIcon = (type: string) => {
    switch(type) {
        case 'Email': return 'mail';
        case 'LinkedIn': return 'person_add';
        case 'Mensagem LinkedIn': return 'chat_bubble';
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
    <div className="p-4 lg:p-6 w-full flex flex-col gap-6 h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Minhas Tarefas</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              {currentUserProfile 
                ? `Olá, ${currentUserProfile.full_name?.split(' ')[0]}. Aqui estão as tarefas atribuídas a você.`
                : 'Gerencie suas atividades diárias.'}
          </p>
        </div>
        
        <div className="flex flex-wrap gap-3 items-center">
             
             {/* Sort Dropdown */}
             <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2">
                 <span className="text-xs font-bold text-slate-500 uppercase mr-2 pl-1">Ordenar por:</span>
                 <select 
                    value={sortMethod}
                    onChange={(e) => setSortMethod(e.target.value as any)}
                    className="text-sm font-semibold bg-transparent border-none text-slate-700 dark:text-slate-300 focus:ring-0 py-1.5 pl-0 pr-8 cursor-pointer"
                 >
                     <option value="date">Prazo (Data)</option>
                     <option value="recipient">Destinatário (A-Z)</option>
                 </select>
             </div>

             {/* Filters */}
             <div className="flex bg-white dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
                <button 
                    onClick={() => setFilter('pending')}
                    className={`px-4 py-1.5 text-sm font-bold rounded-md transition-colors ${filter === 'pending' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                >
                    Pendentes
                </button>
                <button 
                    onClick={() => setFilter('completed')}
                    className={`px-4 py-1.5 text-sm font-bold rounded-md transition-colors ${filter === 'completed' ? 'bg-green-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                >
                    Concluídas
                </button>
                <button 
                    onClick={() => setFilter('all')}
                    className={`px-4 py-1.5 text-sm font-bold rounded-md transition-colors ${filter === 'all' ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                >
                    Todas
                </button>
            </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#151b2b] rounded border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col flex-1 overflow-hidden w-full">
         {loading ? (
             <div className="flex justify-center items-center h-40">
                <span className="material-symbols-outlined animate-spin text-primary">sync</span>
            </div>
         ) : (
             <div className="overflow-auto flex-1 w-full">
                 <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-4 font-bold text-slate-900 dark:text-white w-12"></th>
                            <th className="px-6 py-4 font-bold text-slate-900 dark:text-white">Tarefa</th>
                            <th className="px-6 py-4 font-bold text-slate-900 dark:text-white">Destinatário</th>
                            <th className="px-6 py-4 font-bold text-slate-900 dark:text-white">Campanha / Empresa</th>
                            <th className="px-6 py-4 font-bold text-slate-900 dark:text-white">Prazo</th>
                            <th className="px-6 py-4 font-bold text-slate-900 dark:text-white text-right">Pontos</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {displayedTasks.length > 0 ? displayedTasks.map((task) => {
                            const isOverdue = !task.completed && task.date < new Date(new Date().setHours(0,0,0,0));
                            const isToday = !task.completed && task.date.toDateString() === new Date().toDateString();

                            return (
                                <tr key={task.id} className={`group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${task.completed ? 'opacity-50 bg-slate-50 dark:bg-slate-900/30' : ''}`}>
                                    <td className="px-6 py-4">
                                        <button 
                                            onClick={() => handleCompleteTask(task)}
                                            disabled={!!updatingId}
                                            className={`size-5 rounded border-2 flex items-center justify-center transition-colors ${
                                                task.completed 
                                                ? 'bg-green-500 border-green-500 text-white' 
                                                : 'border-slate-300 dark:border-slate-600 hover:border-primary'
                                            } ${updatingId === task.id ? 'opacity-50 cursor-wait' : ''}`}
                                        >
                                            {updatingId === task.id ? (
                                                <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                                            ) : task.completed && (
                                                <span className="material-symbols-outlined text-[14px] font-bold">check</span>
                                            )}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`size-8 rounded flex items-center justify-center shrink-0 ${getTaskColor(task.type)}`}>
                                                <span className="material-symbols-outlined text-[18px]">{getTaskIcon(task.type)}</span>
                                            </div>
                                            <div>
                                                <p className={`font-bold ${task.completed ? 'line-through text-slate-500' : 'text-slate-900 dark:text-white'}`}>{task.title}</p>
                                                <p className="text-xs text-slate-500">{task.type}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {task.targetContactName ? (
                                            <div className="flex items-center gap-2">
                                                <div className="size-6 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                                    {task.targetContactName.charAt(0)}
                                                </div>
                                                <span className="font-semibold text-slate-700 dark:text-slate-300">{task.targetContactName}</span>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-slate-400 italic">Todos da Empresa</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col items-start gap-1">
                                            <span className="font-semibold text-slate-700 dark:text-slate-300">{task.companyName}</span>
                                            {/* Link to Campaign Logic */}
                                            <button 
                                                onClick={() => onGoToCampaign && onGoToCampaign(task.campaignId)}
                                                className="text-xs text-primary hover:underline flex items-center gap-1 bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10"
                                                title="Ir para a campanha"
                                            >
                                                <span className="material-symbols-outlined text-[12px]">launch</span>
                                                {task.campaignName}
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className={`flex items-center gap-1.5 text-xs font-bold ${
                                            task.completed ? 'text-slate-500' :
                                            isOverdue ? 'text-red-500' : 
                                            isToday ? 'text-green-600' : 
                                            'text-slate-600 dark:text-slate-400'
                                        }`}>
                                            <span className="material-symbols-outlined text-[16px]">
                                                {task.completed ? 'event_available' : isOverdue ? 'event_busy' : 'event'}
                                            </span>
                                            {task.date.toLocaleDateString('pt-BR')}
                                            {isOverdue && <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-[10px] uppercase">Atrasado</span>}
                                            {isToday && <span className="px-1.5 py-0.5 bg-green-100 text-green-600 rounded text-[10px] uppercase">Hoje</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {task.points && (
                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${
                                                task.completed ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                                            }`}>
                                                +{task.points} pts
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            );
                        }) : (
                            <tr>
                                <td colSpan={6} className="text-center py-12 text-slate-400">
                                    <span className="material-symbols-outlined text-[32px] mb-2 opacity-30">task_alt</span>
                                    <p>
                                        {filter === 'completed' 
                                            ? "Nenhuma tarefa concluída encontrada no histórico." 
                                            : currentUserProfile 
                                                ? "Nenhuma tarefa pendente atribuída a você no momento." 
                                                : "Nenhuma tarefa encontrada."}
                                    </p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                 </table>
             </div>
         )}
      </div>
    </div>
  );
};

export default Tasks;