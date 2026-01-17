import React from 'react';

const IntegrationCard: React.FC<{ name: string; desc: string; connected: boolean; icon: string }> = ({ name, desc, connected, icon }) => (
    <div className="bg-white dark:bg-[#151b2b] p-5 rounded border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4">
            <div className={`size-12 rounded flex items-center justify-center text-white ${connected ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'}`}>
                <span className="material-symbols-outlined text-[24px]">{icon}</span>
            </div>
            <div>
                <h3 className="font-bold text-slate-900 dark:text-white">{name}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">{desc}</p>
            </div>
        </div>
        <div className="flex items-center gap-2">
            {connected && <span className="text-xs font-bold text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded">Conectado</span>}
            <button className={`px-3 py-1.5 rounded text-xs font-bold border transition-colors ${
                connected 
                ? 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800' 
                : 'bg-primary border-primary text-white hover:bg-blue-700'
            }`}>
                {connected ? 'Configurar' : 'Conectar'}
            </button>
        </div>
    </div>
);

const Automation: React.FC = () => {
  return (
    <div className="p-4 lg:p-8 w-full flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Automação & Integrações</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Conecte suas ferramentas e defina regras automáticas.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="flex flex-col gap-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined">extension</span>
                Integrações Nativas
            </h2>
            <IntegrationCard name="HubSpot" desc="Sincronize contatos e deals bidirecionalmente." connected={true} icon="hub" />
            <IntegrationCard name="Salesforce" desc="Enterprise CRM sync com logs de atividade." connected={false} icon="cloud" />
            <IntegrationCard name="Slack" desc="Receba notificações de respostas em tempo real." connected={true} icon="chat" />
            <IntegrationCard name="Gmail / Outlook" desc="Envie emails diretamente da sua caixa de entrada." connected={true} icon="mail" />
        </section>

        <section className="flex flex-col gap-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined">bolt</span>
                Regras de Fluxo
            </h2>
            <div className="bg-white dark:bg-[#151b2b] rounded border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                {[
                    { name: 'Parar sequência ao responder', active: true },
                    { name: 'Marcar como "Interessado" se clicar', active: true },
                    { name: 'Notificar Slack quando abrir 3x', active: false },
                    { name: 'Criar tarefa de call se visualizar LinkedIn', active: true },
                ].map((rule, i) => (
                    <div key={i} className="p-4 border-b border-slate-100 dark:border-slate-800 last:border-0 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{rule.name}</span>
                        <div className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${rule.active ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}>
                            <div className={`absolute top-1 size-3 bg-white rounded-full transition-transform ${rule.active ? 'left-6' : 'left-1'}`}></div>
                        </div>
                    </div>
                ))}
                <div className="p-3 bg-slate-50 dark:bg-slate-900/50 text-center">
                    <button className="text-primary text-sm font-bold hover:underline">+ Nova Regra</button>
                </div>
            </div>
        </section>
      </div>
    </div>
  );
};

export default Automation;