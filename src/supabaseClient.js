// src/supabaseClient.js
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

// Datos de tu proyecto (provisoriamente en código; luego podemos moverlos a .env)
export const SUPABASE_URL = 'https://nuuoooqfbuwodagvmmsf.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51dW9vb3FmYnV3b2RhZ3ZtbXNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMjY0MTksImV4cCI6MjA3MTgwMjQxOX0.npP1Ijnbaa8ZmOmIpUoKg1XXKkSS1KfJmDvpcXh-B5g';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
