import { createClient } from '@supabase/supabase-js';

// Configuração do Supabase
const SUPABASE_URL = 'https://pwtmqjujwcwhfsqoljot.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3dG1xanVqd2N3aGZzcW9sam90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyNDUwOTMsImV4cCI6MjA4MTgyMTA5M30.e1nU4S8LHxP5HhcJ6fMH0iGtQCmqLNF2FwFSkYlKSeo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);