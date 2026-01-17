import React, { useState, useMemo } from 'react';
import { Page, CampaignData } from '../types';

interface CampaignListProps {
  onNavigate: (page: Page) => void;
  campaigns: any[];
  onEdit: (campaign: CampaignData) => void;
  onCreate: () => void;
}

const CampaignList: React.FC<CampaignListProps> = ({ onNavigate, campaigns, onEdit, onCreate }) => {
  const [activeTab, setActiveTab] = useState<'Active' | 'Completed'>('Active');

  const filteredCampaigns = useMemo(() => {
      if (activeTab === 'Active') {
          // Show active campaigns (anything NOT Completed)
          return campaigns.filter(c => c.status !== 'Completed');
      } else {
          // Show completed campaigns
          return campaigns.filter(c => c.status === 'Completed');
      }
  }, [campaigns, activeTab]);

  return (
    <div className="p-4 lg:p-6 w-full flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Campanhas</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Gerencie suas estratégias de outbound.</p>
        </div>
        <button 
          onClick={onCreate}
          className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded shadow-sm hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Nova Campanha
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-slate-200 dark:border-slate-800">
          <button 
            onClick={() => setActiveTab('Active')}
            className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'Active' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
              <span className="material-symbols-outlined text-[18px]">rocket_launch</span>
              Em Andamento
              <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] px-2 py-0.5 rounded-full ml-1">
                  {campaigns.filter(c => c.status !== 'Completed').length}
              </span>
          </button>
          <button 
            onClick={() => setActiveTab('Completed')}
            className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'Completed' 
                ? 'border-green-500 text-green-600' 
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
              <span className="material-symbols-outlined text-[18px]">flag_circle</span>
              Finalizadas
              <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] px-2 py-0.5 rounded-full ml-1">
                  {campaigns.filter(c => c.status === 'Completed').length}
              </span>
          </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {activeTab === 'Active' && (
            /* 'New Campaign' Ghost Card only in Active Tab */
            <button 
                onClick={onCreate}
                className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 p-5 text-slate-400 hover:text-primary hover:border-primary hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all min-h-[200px]"
            >
                <div className="size-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[24px]">add</span>
                </div>
                <span className="font-bold text-sm">Criar Nova Campanha</span>
            </button>
        )}

        {filteredCampaigns.map((camp) => (
          <div 
            key={camp.id} 
            className={`group bg-white dark:bg-[#151b2b] rounded-lg border p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col ${
                activeTab === 'Completed' 
                ? 'border-green-200/50 dark:border-green-900/30 opacity-90' 
                : 'border-slate-200 dark:border-slate-800 hover:border-primary/50 dark:hover:border-primary/50'
            }`}
            onClick={() => onEdit(camp)}
          >
            {/* Header: Company & Status */}
            <div className="flex justify-between items-start mb-4">
               <div className="flex items-center gap-2">
                 <div className="size-8 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-bold text-xs uppercase border border-slate-200 dark:border-slate-700">
                    {(camp.targetCompany || 'NA').slice(0, 2)}
                 </div>
                 <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-900 dark:text-white leading-none truncate max-w-[120px]" title={camp.targetCompany}>{camp.targetCompany}</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Empresa Alvo</span>
                 </div>
               </div>
               <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                    camp.status === 'Completed' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' :
                    'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800'
                  }`}>
                    {camp.status === 'Completed' ? 'Finalizada' : 'Em Andamento'}
               </span>
            </div>

            {/* Body: Title & Category */}
            <div className="flex-1 mb-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight group-hover:text-primary transition-colors mb-2 line-clamp-2">
                    {camp.name}
                </h3>
                <span className="inline-block px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-400">
                    {camp.objective}
                </span>
            </div>

            {/* Footer: Stats */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                    <span>Progresso</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">{camp.progress}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-4">
                      <div className={`h-full rounded-full ${camp.status === 'Completed' ? 'bg-green-500' : 'bg-primary'}`} style={{ width: `${camp.progress}%` }}></div>
                </div>
                
                <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5" title="Pontos Acumulados">
                        <span className={`material-symbols-outlined text-[16px] ${camp.status === 'Completed' ? 'text-yellow-500' : 'text-primary'}`}>workspace_premium</span>
                        <span className={`font-semibold ${camp.status === 'Completed' ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                            {camp.totalPoints || 0} pts
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5" title="Enviados">
                        <span className="material-symbols-outlined text-[16px] text-slate-400">send</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{camp.sent || 0}</span>
                    </div>
                </div>
            </div>

          </div>
        ))}
        
        {filteredCampaigns.length === 0 && activeTab === 'Completed' && (
            <div className="col-span-full py-10 text-center text-slate-400">
                <span className="material-symbols-outlined text-[32px] mb-2 opacity-50">history</span>
                <p>Nenhuma campanha finalizada ainda.</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default CampaignList;