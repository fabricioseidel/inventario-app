import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://TU-PROJECT-URL.supabase.co'; // ← tu URL
export const SUPABASE_ANON_KEY = 'TU-ANON-KEY';                    // ← tu anon key

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
