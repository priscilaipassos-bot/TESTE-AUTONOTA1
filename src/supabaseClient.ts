import { createClient, SupabaseClient } from '@supabase/supabase-js';

// URL e chave padrão do Supabase para o AutoNFS-e Nacional
export const DEFAULT_SUPABASE_URL = 'https://gcpvceeaeyeufofntmwc.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_INQR2qlr9so3jznxFhIzMA_ccbtG9b3';

export function normalizeSupabaseUrl(rawUrl: string): string {
  let clean = String(rawUrl || '').trim();
  if (clean.endsWith('/')) clean = clean.slice(0, -1);
  if (clean.endsWith('/rest/v1')) clean = clean.replace(/\/rest\/v1$/, '');
  return clean;
}

// Resgata configurações de ambiente ou localStorage se disponível
function getInitialConfig(): { url: string; anonKey: string } {
  let url = DEFAULT_SUPABASE_URL;
  let anonKey = DEFAULT_SUPABASE_ANON_KEY;

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = localStorage.getItem('autonfse_supabase_cfg_v1');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.url) url = normalizeSupabaseUrl(parsed.url);
        if (parsed.anonKey) anonKey = String(parsed.anonKey).trim();
      }
    } catch {
      // fallback para valores padrão
    }
  }

  const envUrl = (import.meta as any)?.env?.VITE_SUPABASE_URL;
  const envKey = (import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY;
  if (envUrl) url = normalizeSupabaseUrl(envUrl);
  if (envKey) anonKey = String(envKey).trim();

  return { url, anonKey };
}

const { url: initialUrl, anonKey: initialKey } = getInitialConfig();

/**
 * Instância ÚNICA e CENTRALIZADA do Supabase Client para toda a aplicação.
 * Elimina o aviso 'Multiple GoTrueClient instances detected' configurando persistSession e autoRefreshToken como false.
 */
export const supabase: SupabaseClient = createClient(initialUrl, initialKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

export default supabase;
