import React from 'react';
import { JourneyStep } from '../types';

interface JourneyStepItemProps {
  step: JourneyStep;
  onDelete: (id: string) => void;
  onToggleComplete: (id: string) => void;
  onEdit: (step: JourneyStep) => void;
}

const getStepIcon = (type: string) => {
  switch (type) {
    case 'Email': return 'mail';
    case 'LinkedIn': return 'person_add'; // Conexão
    case 'Mensagem LinkedIn': return 'chat_bubble';
    case 'Ligação': return 'call';
    case 'WhatsApp': return 'chat';
    case 'Brinde': return 'redeem';
    case 'Visita Presencial': return 'storefront';
    case 'Convite Evento': return 'event';
    case 'Encontro Evento': return 'handshake';
    case 'Almoço/Jantar': return 'restaurant';
    case 'Reunião Virtual': return 'video_camera_front';
    case 'Orçamento': return 'attach_money';
    case 'Proposta': return 'description';
    case 'Contrato': return 'verified';
    default: return 'circle';
  }
};

const getStepColor = (type: string, completed?: boolean) => {
  if (completed) return 'bg-green-50 dark:bg-green-900/20 text-green-600 border-green-200 dark:border-green-800';
  
  switch (type) {
    case 'Email': return 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 border-blue-100 dark:border-blue-800';
    
    case 'LinkedIn': 
    case 'Mensagem LinkedIn':
        return 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800';
    
    case 'Ligação': return 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border-orange-100 dark:border-orange-800';
    
    case 'WhatsApp': return 'bg-green-50 dark:bg-green-900/20 text-green-600 border-green-100 dark:border-green-800';
    
    case 'Brinde': return 'bg-pink-50 dark:bg-pink-900/20 text-pink-600 border-pink-100 dark:border-pink-800';
    
    case 'Visita Presencial':
    case 'Almoço/Jantar':
        return 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-500 border-amber-100 dark:border-amber-800';
    
    case 'Reunião Virtual': return 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 border-violet-100 dark:border-violet-800';
    
    case 'Convite Evento':
    case 'Encontro Evento':
        return 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 border-purple-100 dark:border-purple-800';

    case 'Orçamento':
    case 'Proposta':
        return 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 border-cyan-100 dark:border-cyan-800';
    
    case 'Contrato':
        return 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 border-teal-100 dark:border-teal-800';

    default: return 'bg-slate-50 text-slate-500';
  }
};

const JourneyStepItem: React.FC<JourneyStepItemProps> = ({ step, onDelete, onToggleComplete, onEdit }) => {
  // Simple regex to highlight {{variables}} in description
  const highlightVariables = (text: string) => {
    const parts = text.split(/(\{\{.*?\}\})/g);
    return parts.map((part, i) => 
        part.match(/^\{\{.*\}\}$/) 
        ? <span key={i} className="text-primary font-mono bg-primary/10 rounded px-1">{part}</span> 
        : part
    );
  };

  return (
    <div className={`relative z-10 w-full max-w-md group mb-8 animate-in fade-in slide-in-from-bottom-4 duration-300`}>
      <div className={`bg-white dark:bg-slate-800 border ${step.completed ? 'border-green-500 shadow-green-100 dark:shadow-green-900/20 shadow-md' : 'border-slate-200 dark:border-slate-600'} rounded-lg p-4 shadow-sm hover:shadow-md transition-all flex flex-col relative`}>
        
        {/* Helper Badge to indicate target */}
        <div className="absolute -top-3 right-4 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-2 py-0.5 rounded-full text-[10px] font-bold text-slate-500 dark:text-slate-300 shadow-sm flex items-center gap-1 z-20">
             {step.targetContactName ? (
                <>
                    <span className="material-symbols-outlined text-[12px] text-primary">person</span>
                    <span className="text-primary">Para: {step.targetContactName}</span>
                </>
             ) : (
                <>
                    <span className="material-symbols-outlined text-[12px]">group</span>
                    Para Todos
                </>
             )}
        </div>

        <div className="flex gap-4 items-start pt-1">
            {/* Completion Checkmark/Circle */}
            <button 
            onClick={() => onToggleComplete(step.id)}
            className={`shrink-0 mt-1 size-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                step.completed 
                ? 'bg-green-500 border-green-500 text-white' 
                : 'border-slate-300 dark:border-slate-600 hover:border-primary'
            }`}
            >
            {step.completed && <span className="material-symbols-outlined text-[14px] font-bold">check</span>}
            </button>

            <div className={`size-10 rounded-lg flex items-center justify-center shrink-0 border ${getStepColor(step.type, step.completed)}`}>
            <span className="material-symbols-outlined">{getStepIcon(step.type)}</span>
            </div>
            
            <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start gap-2">
                <h3 className={`text-sm font-bold truncate ${step.completed ? 'text-green-700 dark:text-green-400 line-through opacity-70' : 'text-slate-900 dark:text-white'}`}>
                {step.title}
                </h3>
                <div className="flex items-center gap-1.5 shrink-0">
                {step.points && (
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                    +{step.points} pts
                    </span>
                )}
                <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-50 dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-100 dark:border-slate-700">
                    Dia {step.day}
                </span>
                </div>
            </div>
            <p className={`text-xs mt-1 line-clamp-3 ${step.completed ? 'text-slate-400 line-through' : 'text-slate-500 dark:text-slate-400'}`}>
                {highlightVariables(step.description)}
            </p>
            </div>
        </div>
        
        {/* Footer: Owner Information */}
        {step.owner && (
            <div className="mt-3 pt-3 border-t border-slate-50 dark:border-slate-700 flex items-center gap-2">
                <div className="size-5 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300">
                    {step.owner.charAt(0)}
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Responsável: <span className="font-semibold text-slate-700 dark:text-slate-300">{step.owner}</span>
                </span>
            </div>
        )}

        {/* Action Buttons */}
        <div className="absolute -right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all translate-x-full pl-3 flex flex-col gap-1">
          <button
            onClick={() => onEdit(step)}
            className="bg-white dark:bg-slate-700 text-slate-500 hover:text-primary p-1.5 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600 transition-colors"
            title="Editar tarefa"
          >
            <span className="material-symbols-outlined text-[18px]">edit</span>
          </button>
          <button
            onClick={() => onDelete(step.id)}
            className="bg-white dark:bg-slate-700 text-slate-500 hover:text-red-500 p-1.5 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600 transition-colors"
            title="Excluir tarefa"
          >
            <span className="material-symbols-outlined text-[18px]">delete</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default JourneyStepItem;