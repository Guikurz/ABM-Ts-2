import React from 'react';
import { CampaignData, Company } from '../types';

interface CampaignDetailsProps {
  data: CampaignData;
  onChange: (data: Partial<CampaignData>) => void;
  companies: Company[];
}

const CampaignDetails: React.FC<CampaignDetailsProps> = ({ data, onChange, companies }) => {
  return (
    <div className="bg-white dark:bg-[#151b2b] rounded border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
        <span className="material-symbols-outlined text-primary">tune</span>
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Detalhes da Campanha</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Nome da Campanha</span>
          <input
            className="w-full h-10 px-3 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary transition-all placeholder:text-slate-400"
            type="text"
            value={data.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Ex: Prospecção Q3"
          />
        </label>
        
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Empresa Alvo</span>
          <select
            className="w-full h-10 px-3 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary transition-all"
            value={data.targetCompany || ''}
            onChange={(e) => onChange({ targetCompany: e.target.value })}
            disabled={companies.length === 0}
          >
            <option value="">{companies.length === 0 ? 'Nenhuma empresa cadastrada' : 'Selecione uma empresa...'}</option>
            {companies.map(company => (
              <option key={company.id} value={company.name}>{company.name}</option>
            ))}
          </select>
          {companies.length === 0 && (
             <span className="text-[10px] text-red-500 font-medium">Cadastre uma empresa primeiro.</span>
          )}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Objetivo</span>
          <select
            className="w-full h-10 px-3 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary transition-all"
            value={data.objective}
            onChange={(e) => onChange({ objective: e.target.value })}
          >
            <option>Agendar Reunião</option>
            <option>Nutrição de Leads</option>
            <option>Webinar Invite</option>
            <option>Upsell de Clientes</option>
          </select>
        </label>
      </div>
    </div>
  );
};

export default CampaignDetails;