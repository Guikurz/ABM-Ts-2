import React, { useState, useEffect } from 'react';
import { supabase } from './services/supabaseClient';
import { Session } from '@supabase/supabase-js';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import CampaignList from './components/CampaignList';
import CampaignEditor from './components/CampaignEditor';
import ContactsList from './components/ContactsList';
import CompaniesList from './components/CompaniesList';
import CompanyDetailsPage from './components/CompanyDetailsPage';
import ContactDetailsPage from './components/ContactDetailsPage';
import Reports from './components/Reports';
import Settings from './components/Settings';
import Tasks from './components/Tasks';
import Automation from './components/Automation';
import { 
  Page, UserProfile, AppNotification, DashboardStats, 
  CampaignData, Contact, Company, AppSettings 
} from './types';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true); // Added initial loading state
  
  // Data States
  const [stats, setStats] = useState<DashboardStats | undefined>(undefined);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
  
  // Navigation States
  const [editingCampaign, setEditingCampaign] = useState<CampaignData | undefined>(undefined);
  const [viewingContact, setViewingContact] = useState<Contact | undefined>(undefined);
  const [viewingCompany, setViewingCompany] = useState<Company | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
          fetchInitialData(session.user.id);
      } else {
          setInitialLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
          // If already loaded, don't trigger full reload logic again unless needed
          if (!userProfile) fetchInitialData(session.user.id);
      } else {
          setUserProfile(null);
          setAppSettings(undefined);
          setInitialLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchInitialData = async (userId: string) => {
      try {
        await Promise.all([
            fetchProfile(userId),
            fetchAppSettings(userId),
            fetchStats(userId),
            fetchCampaigns(userId)
        ]);
      } catch (e) {
          console.error("Failed to load initial data", e);
      } finally {
          setInitialLoading(false); // Enable app rendering immediately
      }
  };

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) setUserProfile(data);
  };

  const fetchAppSettings = async (userId: string) => {
    const { data } = await supabase.from('app_settings').select('*').eq('user_id', userId).single();
    if (data) setAppSettings(data);
  };

  const fetchStats = async (userId: string) => {
    // Mocking stats fetching logic based on real data counts
    // In a real app, this might be a complex query or a dedicated RPC function
    try {
        const [
            { count: companiesCount },
            { count: contactsCount },
            { count: campaignsCount },
            { data: campaigns },
            { data: deals }
        ] = await Promise.all([
            supabase.from('companies').select('*', { count: 'exact', head: true }).eq('user_id', userId),
            supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('user_id', userId),
            supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('user_id', userId),
            supabase.from('campaigns').select('id, steps, status').eq('user_id', userId),
            supabase.from('deals').select('value, status').eq('user_id', userId)
        ]);

        let totalActions = 0;
        let completedCampaignsCount = 0;
        let activeCampaignsCount = 0;
        let hasProposalValue = false;

        if (campaigns) {
             campaigns.forEach((c: any) => {
                 if (c.status === 'Completed') completedCampaignsCount++;
                 else activeCampaignsCount++;
                 
                 if (c.steps) {
                     c.steps.forEach((s: any) => {
                         if (s.completed) totalActions++;
                         if ((s.points || 0) > 0) hasProposalValue = true;
                     });
                 }
             });
        }

        const pipelineValue = deals?.filter((d: any) => d.status === 'Open' || d.status === 'Won')
            .reduce((acc: number, d: any) => acc + (d.value || 0), 0) || 0;

        setStats({
            hasCompany: (companiesCount || 0) > 0,
            hasContact: (contactsCount || 0) > 0,
            hasCampaign: (campaignsCount || 0) > 0,
            hasProposalValue: hasProposalValue,
            pipelineValue,
            activeCampaignsCount,
            completedCampaignsCount,
            totalActions
        });

    } catch (e) {
        console.error("Error fetching stats", e);
    }
  };

  const fetchCampaigns = async (userId: string) => {
      const { data } = await supabase.from('campaigns').select('*').eq('user_id', userId).order('created_at', { ascending: false });
      if (data) {
          const mapped: CampaignData[] = data.map((c: any) => ({
              id: c.id,
              name: c.name,
              targetCompany: c.target_company,
              objective: c.objective,
              status: c.status,
              progress: c.progress,
              sent: c.sent,
              open: c.open_rate,
              steps: c.steps,
              totalPoints: c.total_points,
              created_at: c.created_at
          }));
          setCampaigns(mapped);
      }
  };

  const addNotification = (title: string, message: string, type: 'success' | 'info' | 'warning' | 'error', link?: Page, linkData?: any) => {
      const newNotif: AppNotification = {
          id: Date.now().toString(),
          title,
          message,
          type,
          timestamp: new Date(),
          read: false,
          link,
          linkData
      };
      setNotifications(prev => [newNotif, ...prev]);
  };

  // --- Actions ---

  const handleSaveCampaign = async (campaign: CampaignData) => {
    if (!session?.user?.id) return;

    // NOTE: Removed setLoading(true) here to prevent full-screen loading spinner
    // from unmounting the JourneyBuilder/Modal components during auto-saves.
    
    try {
        // Ensure we calculate 'sent', 'points' and 'progress' correctly based on steps state
        let sentCount = 0;
        let calculatedPoints = 0;
        let calculatedProgress = 0;

        if (campaign.steps && campaign.steps.length > 0) {
            // Filter out 'Wait' steps for progress/task counting (Wait steps are just delays)
            const activeSteps = campaign.steps.filter(s => s.type !== 'Wait');
            const totalSteps = activeSteps.length;
            const completedSteps = activeSteps.filter(s => s.completed).length;

            sentCount = completedSteps;
            
            // Calculate points (sum of all completed steps)
            calculatedPoints = campaign.steps.reduce((acc, s) => s.completed ? acc + (s.points || 0) : acc, 0);

            // Calculate progress % based on tasks completed vs total tasks
            if (totalSteps > 0) {
                calculatedProgress = Math.round((completedSteps / totalSteps) * 100);
            }
        }

        const campaignPayload: any = {
            name: campaign.name,
            target_company: campaign.targetCompany,
            objective: campaign.objective,
            status: campaign.status || 'Active',
            progress: calculatedProgress, // Use calculated progress
            sent: sentCount, // Use calculated count
            open_rate: campaign.open || '0%',
            total_points: calculatedPoints, // Use calculated points
            user_id: session.user.id,
            steps: campaign.steps || [],
            updated_at: new Date().toISOString()
        };
        
        // Preserve created_at if updating, set if new
        if (campaign.created_at) {
             campaignPayload.created_at = campaign.created_at;
        } else {
             campaignPayload.created_at = new Date().toISOString();
        }

        const isUpdate = campaign.id && !campaign.id.toString().startsWith('camp-');

        if (isUpdate) {
            campaignPayload.id = campaign.id;
        }

        const { data, error } = await supabase
            .from('campaigns')
            .upsert(campaignPayload)
            .select()
            .single();

        if (error) throw error;

        await fetchCampaigns(session.user.id);
        await fetchStats(session.user.id); 
        
        // Notify Success
        addNotification(
            'Campanha Salva!', 
            `A campanha "${campaign.name}" foi atualizada com sucesso.`, 
            'success',
            'campaign-editor',
            { campaign: data ? { ...campaign, id: data.id, totalPoints: calculatedPoints, progress: calculatedProgress } : campaign } // Link back to editor with data
        );

        if (isUpdate && data) {
            // If updating, update the local editing state so user sees changes immediately but stays on page
            const updatedCampaignData: CampaignData = {
                ...campaign,
                id: data.id,
                totalPoints: calculatedPoints,
                progress: calculatedProgress,
                steps: data.steps || campaign.steps
            };
            setEditingCampaign(updatedCampaignData);
            // DO NOT change currentPage here, stay on 'campaign-editor'
        } else {
            // New campaign created, go back to list
            setEditingCampaign(undefined);
            setCurrentPage('campaigns');
        }

    } catch (err: any) {
        console.error("Error saving campaign:", err);
        addNotification('Erro', "Falha ao salvar campanha. Verifique se o banco de dados possui todas as colunas necessárias.", 'error');
    }
  };

  const handleDeleteCampaign = async (id: string) => {
      if (!session?.user?.id) return;
      try {
          const { error } = await supabase.from('campaigns').delete().eq('id', id);
          if (error) throw error;
          
          await fetchCampaigns(session.user.id);
          await fetchStats(session.user.id);
          setEditingCampaign(undefined);
          setCurrentPage('campaigns');
          addNotification('Campanha Excluída', 'A campanha foi removida com sucesso.', 'info');
      } catch (e: any) {
          console.error("Error deleting campaign", e);
          alert("Erro ao excluir campanha.");
      }
  };

  const handleNavigate = (page: Page) => {
    setCurrentPage(page);
    if (page === 'campaigns') setEditingCampaign(undefined);
    if (page === 'contacts') setViewingContact(undefined);
    if (page === 'companies') setViewingCompany(undefined);
    // On mobile, close sidebar on navigate
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUserProfile(null);
  };

  // --- Render ---

  if (!session) {
    return <Login />;
  }

  // Initial Loading Screen to prevent Dashboard blinking
  if (initialLoading) {
      return (
          <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-slate-900">
              <div className="flex flex-col items-center gap-4">
                  {/* Modern Loading Bar */}
                  <div className="w-24 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-primary w-full animate-pulse"></div>
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden font-sans w-full">
      <Sidebar 
        activePage={currentPage} 
        onNavigate={handleNavigate} 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        userProfile={userProfile}
        appSettings={appSettings}
        onSignOut={handleSignOut}
      />

      <div className="flex-1 flex flex-col h-full overflow-hidden relative w-full">
        <Header 
            activePage={currentPage} 
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            isSidebarOpen={isSidebarOpen}
            userProfile={userProfile}
            onSignOut={handleSignOut}
            onNavigate={handleNavigate}
            notifications={notifications}
            onMarkAsRead={(id) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))}
            onClearAll={() => setNotifications([])}
            stats={stats}
            appSettings={appSettings}
        />

        <main className="flex-1 overflow-auto w-full">
           {currentPage === 'dashboard' && (
               <Dashboard 
                  userProfile={userProfile} 
                  stats={stats} 
                  campaigns={campaigns} 
                  onNavigate={handleNavigate}
               />
           )}
           
           {currentPage === 'campaigns' && (
               <CampaignList 
                  campaigns={campaigns} 
                  onNavigate={handleNavigate}
                  onEdit={(camp) => {
                      setEditingCampaign(camp);
                      setCurrentPage('campaign-editor');
                  }}
                  onCreate={() => {
                      setEditingCampaign(undefined);
                      setCurrentPage('campaign-editor');
                  }}
               />
           )}

           {currentPage === 'campaign-editor' && (
               <CampaignEditor 
                  onNavigate={handleNavigate} 
                  initialCampaign={editingCampaign}
                  onSave={handleSaveCampaign}
                  onDelete={handleDeleteCampaign}
                  onContactClick={(contact) => {
                      setViewingContact(contact);
                      setCurrentPage('contact-details');
                  }}
               />
           )}

           {currentPage === 'contacts' && (
               <ContactsList 
                  userId={session.user.id}
                  onContactClick={(contact) => {
                      setViewingContact(contact);
                      setCurrentPage('contact-details');
                  }}
                  onNotify={addNotification}
               />
           )}

           {currentPage === 'contact-details' && viewingContact && (
               <ContactDetailsPage 
                  contact={viewingContact}
                  onBack={() => {
                      if (editingCampaign) setCurrentPage('campaign-editor'); // Back to editor if came from there
                      else setCurrentPage('contacts');
                  }}
                  onCompanyClick={(companyName) => {
                      // We need to fetch the company ID or object based on name to navigate
                      // For now we will just switch to companies list and try to search?
                      // Ideally we find the company object.
                      // Simple implementation: Switch to Companies List
                      setCurrentPage('companies');
                  }}
               />
           )}

           {currentPage === 'companies' && (
               <CompaniesList 
                  userId={session.user.id}
                  onCompanyClick={(company) => {
                      setViewingCompany(company);
                      setCurrentPage('company-details');
                  }}
                  onNotify={addNotification}
               />
           )}

           {currentPage === 'company-details' && viewingCompany && (
               <CompanyDetailsPage 
                  company={viewingCompany}
                  onBack={() => setCurrentPage('companies')}
                  onContactClick={(contact) => {
                      setViewingContact(contact);
                      setCurrentPage('contact-details');
                  }}
                  userId={session.user.id}
                  onNotify={addNotification}
               />
           )}

           {currentPage === 'reports' && <Reports />}
           
           {currentPage === 'settings' && (
               <Settings 
                  userProfile={userProfile} 
                  appSettings={appSettings}
                  onProfileUpdate={() => fetchProfile(session.user.id)}
                  onAppSettingsUpdate={() => fetchAppSettings(session.user.id)}
               />
           )}

           {currentPage === 'tasks' && (
               <Tasks 
                  userId={session.user.id} 
                  onGoToCampaign={(campaignId) => {
                      const camp = campaigns.find(c => c.id === campaignId);
                      if (camp) {
                          setEditingCampaign(camp);
                          setCurrentPage('campaign-editor');
                      }
                  }}
               />
           )}
           
           {/* Placeholder for future pages */}
           {currentPage === 'automation' && <Automation />}
        </main>
      </div>
    </div>
  );
};

export default App;