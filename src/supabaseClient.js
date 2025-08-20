import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://TU-PROJECT-URL.supabase.co'; // ← tu URL
export const SUPABASE_ANON_KEY = 'TU-ANON-KEY';                    // ← tu anon key

// Supabase client removed for now. Use environment-specific remote sync implementation later.
export const supabase = null;
