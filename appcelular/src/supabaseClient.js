// src/supabaseClient.js
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

// Datos de tu proyecto (provisoriamente en código; luego podemos moverlos a .env)
export const SUPABASE_URL = 'https://nuuoooqfbuwodagvmmsf.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51dW9vb3FmYnV3b2RhZ3ZtbXNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMjY0MTksImV4cCI6MjA3MTgwMjQxOX0.npP1Ijnbaa8ZmOmIpUoKg1XXKkSS1KfJmDvpcXh-B5g';

// 🔑 Service Role Key - Permite bypass de RLS para sincronización de app móvil
// ⚠️ IMPORTANTE: Esta key debe mantenerse secreta. Solo usar en apps internas controladas.
export const SUPABASE_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51dW9vb3FmYnV3b2RhZ3ZtbXNmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIyNjQxOSwiZXhwIjoyMDcxODAyNDE5fQ.eu0UFKrhWk9YrM5yjnfLPRV4s0zm-cFWO7CnhVLjb1E';

// Usar service_role key para bypass de RLS en sincronización
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});
