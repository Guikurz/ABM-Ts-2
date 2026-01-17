import React from 'react';
import { Page, UserProfile, AppSettings } from '../types';

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
  appSettings?: AppSettings;
  onSignOut: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activePage, onNavigate, isOpen, onClose, userProfile, appSettings, onSignOut }) => {
  const getLinkClass = (page: Page) => {
    const base = "flex items-center gap-3 px-3 py-2.5 rounded transition-colors cursor-pointer group/item whitespace-nowrap ";
    if (activePage === page || (activePage === 'campaign-editor' && page === 'campaigns')) {
      return base + "bg-primary/10 text-primary font-bold";
    }
    return base + "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary dark:hover:text-primary";
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const appName = appSettings?.app_name || 'Hard Sales';
  const logoUrl = appSettings?.logo_url;

  return (
    <aside 
      className={`
        bg-white dark:bg-[#151b2b] border-r border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-300 ease-in-out group z-20 flex-shrink-0 overflow-hidden
        ${isOpen ? 'w-72 opacity-100' : 'w-0 opacity-0 border-none'}
      `}
    >
      {/* Sidebar Header Space - Just a label now */}
      <div className="h-16 flex items-center px-6 border-b border-slate-100 dark:border-slate-800/50 shrink-0">
         <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Menu</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 flex flex-col gap-1 px-4">
        <div onClick={() => onNavigate('dashboard')} className={getLinkClass('dashboard')}>
          <span className="material-symbols-outlined text-[24px]">dashboard</span>
          <span className="block text-sm">Dashboard</span>
        </div>
        
        <div onClick={() => onNavigate('tasks')} className={getLinkClass('tasks')}>
          <span className="material-symbols-outlined text-[24px]">check_circle</span>
          <span className="block text-sm">Tarefas</span>
        </div>

        <div onClick={() => onNavigate('campaigns')} className={getLinkClass('campaigns')}>
          <span className={`material-symbols-outlined text-[24px] ${activePage === 'campaigns' || activePage === 'campaign-editor' ? 'fill-1' : ''}`}>campaign</span>
          <span className="block text-sm">Campanhas</span>
        </div>
        <div onClick={() => onNavigate('contacts')} className={getLinkClass('contacts')}>
          <span className="material-symbols-outlined text-[24px]">groups</span>
          <span className="block text-sm">Contatos</span>
        </div>
        <div onClick={() => onNavigate('companies')} className={getLinkClass('companies')}>
          <span className="material-symbols-outlined text-[24px]">domain</span>
          <span className="block text-sm">Empresas</span>
        </div>
        <div onClick={() => onNavigate('reports')} className={getLinkClass('reports')}>
          <span className="material-symbols-outlined text-[24px]">bar_chart</span>
          <span className="block text-sm">Relatórios</span>
        </div>
      </nav>

      {/* Bottom Section: Branding -> Profile -> Settings */}
      <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-6 bg-slate-50/50 dark:bg-slate-900/20">
        
        {/* 1. Branding (Logo & Company Name) - UPDATED: Left aligned & Smaller & Hidden if no logo */}
        <div className="flex flex-col items-start gap-2 px-1">
            {logoUrl && (
                <img src={logoUrl} alt="Logo" className="h-12 w-auto max-w-[160px] object-contain mb-1" />
            )}
            <div className="flex flex-col w-full text-left">
                <h1 className="text-slate-900 dark:text-white text-base font-bold leading-tight break-words">{appName}</h1>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">ABM Platform</p>
            </div>
        </div>

        {/* Separator */}
        <div className="w-full h-px bg-slate-200 dark:bg-slate-700/50"></div>

        {/* 2. User Profile - Large (Kept as requested previously) */}
        <div className="flex items-center gap-4 px-1">
            {userProfile?.avatar_url ? (
                <div 
                    className="size-12 rounded-full bg-cover bg-center shrink-0 border-2 border-white dark:border-slate-700 shadow-sm" 
                    style={{ backgroundImage: `url("${userProfile.avatar_url}")` }}
                ></div>
            ) : (
                <div className="size-12 rounded-full bg-primary text-white shrink-0 border-2 border-white dark:border-slate-700 flex items-center justify-center text-lg font-bold shadow-sm">
                    {getInitials(userProfile?.full_name || userProfile?.email)}
                </div>
            )}
            <div className="flex flex-col overflow-hidden min-w-0 flex-1">
                <p className="text-base font-bold text-slate-900 dark:text-white truncate" title={userProfile?.full_name || 'Usuário'}>
                    {userProfile?.full_name || 'Usuário'}
                </p>
                <button onClick={onSignOut} className="text-xs text-red-500 hover:text-red-600 font-bold hover:underline flex items-center gap-1 mt-0.5 justify-start w-fit">
                    Sair
                    <span className="material-symbols-outlined text-[14px]">logout</span>
                </button>
            </div>
        </div>

        {/* 3. Settings Button */}
        <div onClick={() => onNavigate('settings')} className={`${getLinkClass('settings')} bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm justify-center !px-0 !py-3`}>
          <span className="material-symbols-outlined text-[20px]">settings</span>
          <span className="block text-sm font-bold">Configurações</span>
        </div>

      </div>
    </aside>
  );
};

export default Sidebar;