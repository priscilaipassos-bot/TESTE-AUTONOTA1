import { supabase, normalizeSupabaseUrl } from '../supabaseClient';
import { supabaseService } from './supabaseService';

export interface UserAuthConfig {
  email: string;
  passwordHash: string;
  precisaTrocarSenha: boolean;
  ultimoAcesso?: string;
  criadoEm?: string;
  atualizadoEm?: string;
}

export interface AuthSession {
  email: string;
  loggedAt: string;
}

const STORAGE_KEY_AUTH = 'autonfse_auth_user';
const STORAGE_KEY_SESSION = 'autonfse_session';
const ROW_KEY_AUTH = 'autonfse_auth_user';

// Senha inicial padrão: 'senha1' (SHA-256)
export const DEFAULT_AUTH_CONFIG: UserAuthConfig = {
  email: 'priscilaipassos@gmail.com',
  passwordHash: 'a991e84c62a25c5a972f67c47cd81f31063c2dde905a8428977b0458073465cd',
  precisaTrocarSenha: true,
  criadoEm: '2026-09-29T21:30:00.000Z',
};

/**
 * Gera o Hash SHA-256 da senha usando Web Crypto API padrão
 */
export async function hashPassword(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

class AuthService {
  /**
   * Obtém a configuração de autenticação do cache local com fallback para padrão
   */
  public getStoredAuthConfig(): UserAuthConfig {
    if (typeof window === 'undefined') return DEFAULT_AUTH_CONFIG;
    try {
      const stored = localStorage.getItem(STORAGE_KEY_AUTH);
      if (stored) {
        return { ...DEFAULT_AUTH_CONFIG, ...JSON.parse(stored) };
      }
    } catch {
      // fallback
    }
    return DEFAULT_AUTH_CONFIG;
  }

  /**
   * Busca e sincroniza as credenciais de autenticação diretamente do Supabase
   */
  public async syncWithSupabase(): Promise<UserAuthConfig> {
    const config = supabaseService.getConfig();
    const table = 'autonfse_metadata';

    try {
      const { data, error } = await supabase
        .from(table)
        .select('user_id, data, updated_at')
        .eq('user_id', ROW_KEY_AUTH);

      if (!error && Array.isArray(data) && data.length > 0 && data[0]?.data?.email) {
        const remoteAuth: UserAuthConfig = {
          ...DEFAULT_AUTH_CONFIG,
          ...data[0].data,
        };
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(remoteAuth));
        }
        return remoteAuth;
      }

      // Fallback REST se necessário
      const url = normalizeSupabaseUrl(config.url);
      const key = config.anonKey;
      if (url && key) {
        const endpoint = `${url}/rest/v1/${table}?user_id=eq.${ROW_KEY_AUTH}&select=user_id,data,updated_at`;
        const res = await fetch(endpoint, {
          method: 'GET',
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            Accept: 'application/json',
          },
        });

        if (res.ok) {
          const rows = await res.json();
          if (Array.isArray(rows) && rows.length > 0 && rows[0]?.data?.email) {
            const remoteAuth: UserAuthConfig = {
              ...DEFAULT_AUTH_CONFIG,
              ...rows[0].data,
            };
            if (typeof window !== 'undefined') {
              localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(remoteAuth));
            }
            return remoteAuth;
          }
        }
      }
    } catch (err) {
      console.warn('[AuthService] Falha ao sincronizar com Supabase:', err);
    }

    return this.getStoredAuthConfig();
  }

  /**
   * Salva a configuração de autenticação no Supabase e no cache local
   */
  public async saveRemoteAuthConfig(authConfig: UserAuthConfig): Promise<boolean> {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(authConfig));
    }

    const config = supabaseService.getConfig();
    const table = 'autonfse_metadata';

    try {
      const payload = {
        user_id: ROW_KEY_AUTH,
        data: {
          ...authConfig,
          atualizadoEm: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from(table)
        .upsert(payload);

      if (!error) return true;

      // Fallback REST
      const url = normalizeSupabaseUrl(config.url);
      const key = config.anonKey;
      if (!url || !key) return false;

      const res = await fetch(`${url}/rest/v1/${table}`, {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify(payload),
      });

      return res.ok || res.status === 201 || res.status === 204;
    } catch (err) {
      console.warn('[AuthService] Erro ao salvar no Supabase:', err);
      return false;
    }
  }

  /**
   * Valida o login do usuário.
   */
  public async login(
    emailInput: string,
    passwordPlain: string
  ): Promise<{
    sucesso: boolean;
    precisaTrocarSenha?: boolean;
    mensagem?: string;
  }> {
    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail || !passwordPlain) {
      return { sucesso: false, mensagem: 'Informe o e-mail e a senha de acesso.' };
    }

    // Tenta sincronizar primeiro do Supabase para ter a credencial mais atualizada
    let currentAuth = await this.syncWithSupabase();
    if (!currentAuth || !currentAuth.email) {
      currentAuth = this.getStoredAuthConfig();
    }

    // Verifica e-mail
    if (cleanEmail !== currentAuth.email.trim().toLowerCase()) {
      return {
        sucesso: false,
        mensagem: 'E-mail não autorizado para acesso ao sistema.',
      };
    }

    // Calcula o hash da senha informada
    const inputHash = await hashPassword(passwordPlain);

    if (inputHash !== currentAuth.passwordHash) {
      return {
        sucesso: false,
        mensagem: 'Senha incorreta. Verifique suas credenciais.',
      };
    }

    // Se a senha estiver correta, verifica se é o primeiro acesso (precisa alterar senha)
    if (currentAuth.precisaTrocarSenha) {
      return {
        sucesso: true,
        precisaTrocarSenha: true,
        mensagem: 'Acesso validado. Por favor, defina sua nova senha definitiva.',
      };
    }

    // Login concluído com sucesso e senha definitiva já cadastrada
    this.createSession(currentAuth.email);
    currentAuth.ultimoAcesso = new Date().toISOString();
    this.saveRemoteAuthConfig(currentAuth).catch(() => {});

    return {
      sucesso: true,
      precisaTrocarSenha: false,
      mensagem: 'Login realizado com sucesso.',
    };
  }

  /**
   * Altera a senha do usuário e salva no Supabase
   */
  public async changePassword(
    novaSenha: string,
    confirmacaoSenha: string
  ): Promise<{ sucesso: boolean; mensagem: string }> {
    if (!novaSenha || novaSenha.trim().length < 6) {
      return {
        sucesso: false,
        mensagem: 'A nova senha deve possuir no mínimo 6 caracteres.',
      };
    }

    if (novaSenha !== confirmacaoSenha) {
      return {
        sucesso: false,
        mensagem: 'A confirmação de senha não confere com a nova senha digitada.',
      };
    }

    if (novaSenha === 'senha1') {
      return {
        sucesso: false,
        mensagem: 'A nova senha deve ser diferente da senha padrão inicial (senha1).',
      };
    }

    const currentAuth = this.getStoredAuthConfig();
    const newHash = await hashPassword(novaSenha);

    const updatedAuth: UserAuthConfig = {
      ...currentAuth,
      passwordHash: newHash,
      precisaTrocarSenha: false,
      atualizadoEm: new Date().toISOString(),
      ultimoAcesso: new Date().toISOString(),
    };

    // Salva no Supabase e no cache local
    await this.saveRemoteAuthConfig(updatedAuth);

    // Inicia a sessão mantida
    this.createSession(updatedAuth.email);

    return {
      sucesso: true,
      mensagem: 'Nova senha cadastrada com sucesso e salva no Supabase!',
    };
  }

  /**
   * Cria a sessão do usuário no localStorage
   */
  public createSession(email: string): void {
    if (typeof window === 'undefined') return;
    const session: AuthSession = {
      email,
      loggedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
  }

  /**
   * Retorna a sessão ativa se o usuário estiver logado
   */
  public getSession(): AuthSession | null {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SESSION);
      if (stored) {
        return JSON.parse(stored) as AuthSession;
      }
    } catch {
      // ignore
    }
    return null;
  }

  /**
   * Encerra a sessão atual (Logout)
   */
  public logout(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY_SESSION);
  }
}

export const authService = new AuthService();
