import React, { useState, useRef, useEffect } from 'react';
import { Page, UserProfile, AppNotification, DashboardStats, AppSettings } from '../types';

interface HeaderProps {
  activePage: Page;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
  userProfile: UserProfile | null;
  onSignOut: () => void;
  onNavigate: (page: Page) => void;
  notifications: AppNotification[];
  onMarkAsRead: (id: string) => void;
  onClearAll: () => void;
  stats?: DashboardStats;
  appSettings?: AppSettings;
}

const Header: React.FC<HeaderProps> = ({ 
    activePage, 
    onToggleSidebar, 
    isSidebarOpen, 
    onNavigate,
    notifications,
    onMarkAsRead,
    onClearAll,
    stats,
}) => {
  const [isNotifMenuOpen, setIsNotifMenuOpen] = useState(false);
  const [isTutorialMenuOpen, setIsTutorialMenuOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const tutorialRef = useRef<HTMLDivElement>(null);

  // Close notification/tutorial menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifMenuOpen(false);
      }
      if (tutorialRef.current && !tutorialRef.current.contains(event.target as Node)) {
        setIsTutorialMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [notifRef, tutorialRef]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const getBreadcrumbs = () => {
    switch(activePage) {
      case 'dashboard':
        return <span className="text-slate-900 dark:text-slate-200 font-medium">Dashboard</span>;
      case 'campaigns':
        return (
          <>
            <span onClick={() => onNavigate('dashboard')} className="text-slate-500 hover:text-primary transition-colors cursor-pointer">Home</span>
            <span className="text-slate-400">/</span>
            <span className="text-slate-900 dark:text-slate-200 font-medium">Campanhas</span>
          </>
        );
      case 'campaign-editor':
        return (
          <>
            <span onClick={() => onNavigate('campaigns')} className="text-slate-500 hover:text-primary transition-colors cursor-pointer">Campanhas</span>
            <span className="text-slate-400">/</span>
            <span className="text-slate-900 dark:text-slate-200 font-medium">Editar Campanha</span>
          </>
        );
      case 'contacts':
        return <span className="text-slate-900 dark:text-slate-200 font-medium">Contatos</span>;
      case 'contact-details':
        return (
            <>
              <span onClick={() => onNavigate('contacts')} className="text-slate-500 hover:text-primary transition-colors cursor-pointer">Contatos</span>
              <span className="text-slate-400">/</span>
              <span className="text-slate-900 dark:text-slate-200 font-medium">Perfil</span>
            </>
          );
      case 'companies':
        return <span className="text-slate-900 dark:text-slate-200 font-medium">Empresas</span>;
      case 'company-details':
        return (
            <>
              <span onClick={() => onNavigate('companies')} className="text-slate-500 hover:text-primary transition-colors cursor-pointer">Empresas</span>
              <span className="text-slate-400">/</span>
              <span className="text-slate-900 dark:text-slate-200 font-medium">Detalhes</span>
            </>
          );
      case 'reports':
        return <span className="text-slate-900 dark:text-slate-200 font-medium">Relatórios</span>;
      case 'settings':
        return <span className="text-slate-900 dark:text-slate-200 font-medium">Configurações</span>;
      case 'tasks':
        return <span className="text-slate-900 dark:text-slate-200 font-medium">Tarefas</span>;
      default:
        return null;
    }
  };

  const handleNotificationClick = (notification: AppNotification) => {
      onMarkAsRead(notification.id);
      if (notification.link) {
          onNavigate(notification.link);
          setIsNotifMenuOpen(false);
      }
  };

  const getIconForType = (type: string) => {
      switch(type) {
          case 'success': return { icon: 'check_circle', color: 'text-green-500' };
          case 'warning': return { icon: 'warning', color: 'text-yellow-500' };
          case 'error': return { icon: 'error', color: 'text-red-500' };
          default: return { icon: 'info', color: 'text-blue-500' };
      }
  };

  // Tutorial Logic
  const tutorialSteps = [
      { id: 1, title: 'Criar sua primeira Empresa', done: !!stats?.hasCompany, link: 'companies', btn: 'Criar Empresa' },
      { id: 2, title: 'Cadastrar um Contato', done: !!stats?.hasContact, link: 'contacts', btn: 'Adicionar Contato' },
      { id: 3, title: 'Criar uma Campanha', done: !!stats?.hasCampaign, link: 'campaign-editor', btn: 'Criar Campanha' },
      { id: 4, title: 'Definir valor da proposta (Pontos)', done: !!stats?.hasProposalValue, link: 'campaigns', btn: 'Ver Campanhas' },
  ];
  const completedSteps = tutorialSteps.filter(s => s.done).length;
  const progress = tutorialSteps.length > 0 ? (completedSteps / tutorialSteps.length) * 100 : 0;

  return (
    <header className="h-16 flex items-center justify-between px-4 lg:px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b2b] shrink-0 gap-4 relative z-30 transition-all">
      
      <div className="flex items-center gap-4">
        {/* Toggle Sidebar Button */}
        <button 
          onClick={onToggleSidebar}
          className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
        >
          <span className="material-symbols-outlined">{isSidebarOpen ? 'menu_open' : 'menu'}</span>
        </button>

        {/* Breadcrumbs */}
        <div className="hidden md:flex items-center gap-2 text-sm">
          {getBreadcrumbs()}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Tutorial / Checklist Icon */}
        <div className="relative" ref={tutorialRef}>
            <button 
                onClick={() => setIsTutorialMenuOpen(!isTutorialMenuOpen)}
                className="relative text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 p-2 rounded transition-colors"
                title="Tutorial & Onboarding"
            >
                <span className="material-symbols-outlined">checklist</span>
                {progress < 100 && (
                     <span className="absolute top-1.5 right-1.5 size-2.5 bg-blue-500 rounded-full border-2 border-white dark:border-[#151b2b]"></span>
                )}
            </button>

             {isTutorialMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-[#151b2b] rounded-lg shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in duration-200 z-50">
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-center mb-2">
                             <h3 className="font-bold text-sm text-slate-900 dark:text-white">Tutorial</h3>
                             <span className="text-xs font-bold text-primary">{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }}></div>
                        </div>
                    </div>
                    <div className="p-2 max-h-[300px] overflow-y-auto">
                        {tutorialSteps.map((step) => (
                            <div key={step.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded transition-colors">
                                <div className={`size-5 rounded-full flex items-center justify-center border ${
                                    step.done 
                                    ? 'bg-green-500 border-green-500 text-white' 
                                    : 'border-slate-300 dark:border-slate-600 text-transparent'
                                }`}>
                                    <span className="material-symbols-outlined text-[14px]">check</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium truncate ${step.done ? 'text-slate-500 line-through' : 'text-slate-900 dark:text-white'}`}>
                                        {step.title}
                                    </p>
                                </div>
                                {!step.done && (
                                    <button 
                                        onClick={() => {
                                            onNavigate(step.link as any);
                                            setIsTutorialMenuOpen(false);
                                        }}
                                        className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded hover:bg-primary/20"
                                    >
                                        Ir
                                    </button>
                                )}
                            </div>
                        ))}
                        {progress === 100 && (
                            <div className="p-3 text-center">
                                <span className="text-xs text-green-600 font-bold flex items-center justify-center gap-1">
                                    <span className="material-symbols-outlined text-[16px]">celebration</span>
                                    Tutorial Completo!
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
        
        {/* Notification Center */}
        <div className="relative" ref={notifRef}>
            <button 
                onClick={() => setIsNotifMenuOpen(!isNotifMenuOpen)}
                className="relative text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 p-2 rounded transition-colors"
            >
                <span className="material-symbols-outlined">notifications</span>
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 size-2.5 bg-red-500 rounded-full border-2 border-white dark:border-[#151b2b]"></span>
                )}
            </button>

            {isNotifMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 md:w-96 bg-white dark:bg-[#151b2b] rounded-lg shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in duration-200 z-50">
                    <div className="flex items-center justify-between p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white">Notificações</h3>
                        {notifications.length > 0 && (
                            <button onClick={onClearAll} className="text-xs text-slate-500 hover:text-primary">Limpar todas</button>
                        )}
                    </div>
                    
                    <div className="max-h-[350px] overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center text-slate-400">
                                <span className="material-symbols-outlined text-[32px] opacity-30 mb-2">notifications_off</span>
                                <p className="text-xs">Nenhuma notificação por enquanto.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                {notifications.map((notif) => {
                                    const { icon, color } = getIconForType(notif.type);
                                    return (
                                        <div 
                                            key={notif.id} 
                                            onClick={() => handleNotificationClick(notif)}
                                            className={`p-4 flex gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors ${!notif.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                                        >
                                            <div className={`mt-0.5 ${color}`}>
                                                <span className="material-symbols-outlined text-[20px]">{icon}</span>
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between items-start">
                                                    <h4 className={`text-sm font-semibold ${!notif.read ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                                                        {notif.title}
                                                    </h4>
                                                    <span className="text-[10px] text-slate-400 whitespace-nowrap ml-2">
                                                        {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                                                    {notif.message}
                                                </p>
                                                {notif.link && (
                                                    <div className="mt-2 flex items-center gap-1 text-primary text-xs font-bold">
                                                        Ver agora <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                                                    </div>
                                                )}
                                            </div>
                                            {!notif.read && (
                                                <div className="mt-2 size-2 rounded-full bg-primary shrink-0"></div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
      </div>
    </header>
  );
};

export default Header;