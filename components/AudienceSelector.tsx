import React, { useState } from 'react';
import { Contact } from '../types';

interface AudienceSelectorProps {
  contacts: Contact[];
  targetCompany?: string;
  onContactClick?: (contact: Contact) => void;
}

const AudienceSelector: React.FC<AudienceSelectorProps> = ({ contacts, targetCompany, onContactClick }) => {
  const [filter, setFilter] = useState('');
  
  // Filter by search term (Company filtering is done in parent)
  const filteredContacts = contacts.filter(c => {
    const matchesSearch = 
      c.name.toLowerCase().includes(filter.toLowerCase()) || 
      c.role.toLowerCase().includes(filter.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="bg-white dark:bg-[#151b2b] rounded border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col h-full max-h-[calc(100vh-160px)]">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">groups</span>
            <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white leading-none">Público Alvo</h2>
                <p className="text-[10px] text-slate-500 mt-1 font-medium">Todos os contatos abaixo entrarão no fluxo.</p>
            </div>
          </div>
          <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-1 rounded">
            {contacts.length} Contatos
          </span>
        </div>
        
        {targetCompany ? (
           <div className="mb-3 mt-2 text-xs text-slate-500">
              Empresa selecionada: <strong className="text-slate-800 dark:text-slate-200">{targetCompany}</strong>
           </div>
        ) : (
            <div className="mb-3 mt-2 text-xs text-orange-500 font-bold bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded inline-block">
                Selecione uma empresa para carregar contatos
            </div>
        )}

        {/* Search & Filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-[18px]">search</span>
            <input
              className="w-full h-9 pl-9 pr-3 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-slate-400"
              placeholder="Buscar cargo ou nome..."
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              disabled={!targetCompany}
            />
          </div>
        </div>
      </div>
      
      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredContacts.length > 0 ? (
          filteredContacts.map(contact => (
            <div
              key={contact.id}
              onClick={() => onContactClick && onContactClick(contact)}
              className="group flex items-center gap-3 p-2 rounded border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer relative"
            >
              {/* Avatar */}
              {contact.type === 'generic' ? (
                  <div className="size-9 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold shrink-0">
                      {contact.name.charAt(0)}
                  </div>
              ) : (
                  <div 
                      className="size-9 rounded-full bg-slate-200 bg-cover bg-center shrink-0 border border-slate-200 dark:border-slate-700" 
                      style={{ backgroundImage: `url("${contact.avatar}")` }}
                  ></div>
              )}
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-primary transition-colors">{contact.name}</p>
                    {/* Status Indicator implies readiness */}
                    <div className="size-1.5 rounded-full bg-green-500" title="Pronto para a jornada"></div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{contact.role}</p>
              </div>
              
              {contact.priority === 'Alta' && (
                <div className="text-[10px] font-bold text-green-600 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded border border-green-100 dark:border-green-900/30">
                  Alta
                </div>
              )}

              {/* View Profile Icon */}
              <div className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-800 shadow-sm p-1 rounded-full border border-slate-200 dark:border-slate-700">
                  <span className="material-symbols-outlined text-[16px] text-primary">visibility</span>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 h-full">
            <span className="material-symbols-outlined text-4xl mb-2 opacity-30">person_off</span>
            <p className="text-sm">
                {targetCompany ? "Nenhum contato encontrado." : "Aguardando seleção de empresa..."}
            </p>
          </div>
        )}
      </div>
      
      {/* Footer Pagination */}
      <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50">
        <span className="font-medium">Total: {filteredContacts.length} contatos na jornada</span>
      </div>
    </div>
  );
};

export default AudienceSelector;