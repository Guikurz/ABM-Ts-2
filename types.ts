
export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  role?: string;
  company?: string;
  language?: string;
}

export interface AppSettings {
  id?: string;
  user_id?: string;
  app_name: string;
  logo_url?: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  timestamp: Date;
  read: boolean;
  link?: Page; // Page to navigate to when clicked
  linkData?: any; // Extra data for navigation (e.g., company object)
}

export interface Contact {
  id: string;
  name: string;
  role: string;
  company: string;
  avatar: string;
  priority: 'Alta' | 'Média' | 'Baixa';
  selected: boolean;
  type?: 'person' | 'generic'; // generic for the "JR" avatar example
  email?: string;
  phone?: string;
  linkedin?: string;
  instagram?: string;
  children?: string; // e.g., "2 boys"
  sportsTeam?: string; // e.g., "Flamengo"
  notes?: string;
  activeCampaign?: string;
  status?: string;
  last?: string;
  // New fields
  address?: string;
  personalEmail?: string;
  hobbies?: string;
  pets?: string;
  maritalStatus?: string;
  age?: number;
  owners?: string[]; // List of names/ids of responsible users
}

export interface Company {
  id: string;
  name: string;
  industry: string;
  size: string;
  domain: string;
  contactsCount: number;
  campaignsCount?: number; // Added field
  deals: number;
  description?: string;
  location?: string;
  // Calculated frontend field for temperature
  temperature?: 'Hot' | 'Warm' | 'Cold';
  score?: number;
}

export interface Deal {
  id: string;
  title: string;
  value: number;
  status: 'Open' | 'Won' | 'Lost';
  company_id?: string;
  company_name?: string; // Denormalized for easier display in reports
  campaign_id?: string;
  campaign_name?: string; // Denormalized for easier display in reports
  created_at?: string;
  user_id?: string;
}

export type StepType = 
  'Email' | 
  'LinkedIn' | 
  'Mensagem LinkedIn' |
  'Ligação' | 
  'WhatsApp' | 
  'Brinde' | 
  'Visita Presencial' | 
  'Convite Evento' | 
  'Encontro Evento' | 
  'Almoço/Jantar' | 
  'Reunião Virtual' | 
  'Orçamento' |
  'Proposta' |
  'Contrato' |
  'Wait';

export interface JourneyStep {
  id: string;
  type: StepType;
  title: string;
  description: string;
  day: number | string;
  completed?: boolean;
  points?: number;
  owner?: string; // Responsible for this specific step
  targetContactName?: string; // Optional: Assign step to specific contact within the company
}

export interface CampaignData {
  id?: string;
  name: string;
  targetCompany?: string;
  objective: string;
  totalPoints?: number;
  status?: string;
  progress?: number;
  sent?: number;
  open?: string;
  steps?: JourneyStep[]; // Field to store the journey flow
  open_rate?: string; // Add this to match usage
  created_at?: string;
}

export interface DashboardStats {
  hasCompany: boolean;
  hasContact: boolean;
  hasCampaign: boolean;
  hasProposalValue: boolean; // Indicates if any campaign has points/value > 0
  
  // Numeric metrics
  pipelineValue: number;
  activeCampaignsCount: number;
  completedCampaignsCount: number;
  totalActions: number;
}

export enum LoadingState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export type Page = 'dashboard' | 'campaigns' | 'campaign-editor' | 'contacts' | 'contact-details' | 'companies' | 'company-details' | 'reports' | 'settings' | 'tasks';
