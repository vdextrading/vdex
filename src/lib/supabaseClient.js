import { createClient } from '@supabase/supabase-js';

const cleanEnv = (value) => {
  let v = String(value ?? '').trim();
  for (;;) {
    const first = v[0];
    const last = v[v.length - 1];
    const pair =
      first === '<' ? '>' :
      first === '(' ? ')' :
      first === '"' ? '"' :
      first === "'" ? "'" :
      first === '`' ? '`' :
      null;
    if (!pair || last !== pair) break;
    v = v.slice(1, -1).trim();
  }
  return v;
};

const extractJwt = (value) => {
  const v = String(value ?? '').trim();
  const match = v.match(/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  return match?.[0] || v;
};

const url = cleanEnv(import.meta.env.VITE_SUPABASE_URL).replace(/\/+$/, '');
const anon = extractJwt(cleanEnv(import.meta.env.VITE_SUPABASE_ANON_KEY));

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

export const clearSupabaseAuthStorage = () => {
  if (typeof localStorage === 'undefined') return;
  const keys = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (key.startsWith('sb-') && key.includes('-auth-token')) keys.push(key);
  }
  keys.forEach((key) => localStorage.removeItem(key));
};
