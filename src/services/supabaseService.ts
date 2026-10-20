import { SupabaseClient } from '@supabase/supabase-js';
import {
  supabase,
  normalizeSupabaseUrl,
  DEFAULT_SUPABASE_URL,
  DEFAULT_SUPABASE_ANON_KEY,
} from '../supabaseClient';
import {
  PrestadorConfig,
  TomadorCliente,
  ServicoItem,
  ProgramacaoAgendamento,
  NfseDocument,
  EmailConfig,
  AutomationLogEntry,
} from '../types/nfse';

export { normalizeSupabaseUrl };

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  tableName: string;
  rowKey: string;
  autoSync: boolean;
  lastSync?: string;
}

export interface AutoNfseFullMetadata {
  prestador?: PrestadorConfig;
  clientes?: TomadorCliente[];
  servicos?: ServicoItem[];
  agendamentos?: ProgramacaoAgendamento[];
  notas?: NfseDocument[];
  emailConfig?: EmailConfig;
  logs?: AutomationLogEntry[];
  isRobotActive?: boolean;
  lastUpdated?: string;
  appVersion?: string;
}

export interface SupabaseTestResult {
  sucesso: boolean;
  mensagem: string;
  tempoMs?: number;
  tabela?: string;
  detalhes?: any;
}

const DEFAULT_SUPABASE_CONFIG: SupabaseConfig = {
  url: DEFAULT_SUPABASE_URL,
  anonKey: DEFAULT_SUPABASE_ANON_KEY,
  tableName: 'autonfse_metadata',
  rowKey: 'autonfse_system_metadata',
  autoSync: true,
};

const CONFIG_STORAGE_KEY = 'autonfse_supabase_cfg_v1';

class SupabaseService {
  // Instância ÚNICA e COMPARTILHADA do cliente Supabase para toda a aplicação
  private client: SupabaseClient = supabase;
  private config: SupabaseConfig;
  private syncListeners: Array<(status: 'IDLE' | 'SYNCING' | 'SUCCESS' | 'ERROR', message?: string) => void> = [];
  private debounceTimer: any = null;

  constructor() {
    this.config = this.loadConfig();
  }

  public getClient(): SupabaseClient {
    return this.client;
  }

  public getConfig(): SupabaseConfig {
    return { ...this.config };
  }

  public saveConfig(newConfig: Partial<SupabaseConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
      url: newConfig.url ? normalizeSupabaseUrl(newConfig.url) : this.config.url,
      tableName: 'autonfse_metadata', // Isolamento estrito na tabela oficial
    };
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(this.config));
    }
  }

  private loadConfig(): SupabaseConfig {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          return {
            ...DEFAULT_SUPABASE_CONFIG,
            ...parsed,
            autoSync: true,
            tableName: 'autonfse_metadata', // Migração e isolamento forçado para autonfse_metadata
            url: normalizeSupabaseUrl(parsed.url || DEFAULT_SUPABASE_CONFIG.url),
          };
        } catch {
          // fallback
        }
      }
    }

    // Try reading environment variables if set in Vite/Vercel
    const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
    const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

    return {
      ...DEFAULT_SUPABASE_CONFIG,
      autoSync: true,
      tableName: 'autonfse_metadata',
      url: envUrl ? normalizeSupabaseUrl(envUrl) : DEFAULT_SUPABASE_CONFIG.url,
      anonKey: envKey ? String(envKey).trim() : DEFAULT_SUPABASE_CONFIG.anonKey,
    };
  }

  public onSyncChange(listener: (status: 'IDLE' | 'SYNCING' | 'SUCCESS' | 'ERROR', message?: string) => void) {
    this.syncListeners.push(listener);
    return () => {
      this.syncListeners = this.syncListeners.filter((l) => l !== listener);
    };
  }

  private notify(status: 'IDLE' | 'SYNCING' | 'SUCCESS' | 'ERROR', message?: string) {
    this.syncListeners.forEach((l) => l(status, message));
  }

  /**
   * Testa a conexão real com a API do Supabase e a tabela de metadados
   */
  public async testConnection(customUrl?: string, customKey?: string): Promise<SupabaseTestResult> {
    const url = normalizeSupabaseUrl(customUrl || this.config.url);
    const key = customKey || this.config.anonKey;

    if (!url || !key) {
      return {
        sucesso: false,
        mensagem: 'URL e Chave da API do Supabase são obrigatórios.',
      };
    }

    const start = Date.now();
    try {
      // Consulta estrita à tabela oficial e exclusiva 'autonfse_metadata'
      const targetTable = 'autonfse_metadata';
      const endpoint = `${url}/rest/v1/${targetTable}?select=user_id,updated_at&limit=1`;

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          Accept: 'application/json',
        },
      });

      const elapsed = Date.now() - start;

      if (response.ok) {
        return {
          sucesso: true,
          tempoMs: elapsed,
          tabela: targetTable,
          mensagem: `Conexão estabelecida com sucesso com o Supabase! Tabela '${targetTable}' acessível (${elapsed}ms).`,
        };
      }

      const bodyText = await response.text();
      let errorMsg = `Erro HTTP ${response.status}: ${response.statusText}`;
      try {
        const parsed = JSON.parse(bodyText);
        errorMsg = parsed.message || parsed.hint || errorMsg;
      } catch {
        // ignore
      }

      return {
        sucesso: false,
        tempoMs: elapsed,
        mensagem: `Falha na conexão com Supabase: ${errorMsg}`,
        detalhes: bodyText,
      };
    } catch (err: any) {
      return {
        sucesso: false,
        tempoMs: Date.now() - start,
        mensagem: `Erro de rede ao conectar com Supabase: ${err.message || 'Falha de comunicação'}`,
      };
    }
  }

  /**
   * Baixa os metadados do Supabase e retorna se houver dados salvos
   */
  public async pullMetadata(): Promise<AutoNfseFullMetadata | null> {
    const url = normalizeSupabaseUrl(this.config.url);
    const key = this.config.anonKey;
    const table = 'autonfse_metadata';
    const rowKey = this.config.rowKey || 'autonfse_system_metadata';

    if (!url || !key) return null;

    this.notify('SYNCING', 'Consultando metadados no Supabase...');

    try {
      const endpoint = `${url}/rest/v1/${table}?user_id=eq.${encodeURIComponent(rowKey)}&select=user_id,data,updated_at`;
      const res = await fetch(endpoint, {
        method: 'GET',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        this.notify('ERROR', `Erro ao buscar metadados: HTTP ${res.status}`);
        return null;
      }

      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0 && rows[0]?.data) {
        this.saveConfig({ lastSync: new Date().toISOString() });
        this.notify('SUCCESS', 'Metadados sincronizados do Supabase com sucesso!');
        return rows[0].data as AutoNfseFullMetadata;
      }

      this.notify('IDLE', 'Nenhum metadado anterior encontrado no Supabase (iniciando com dados locais).');
      return null;
    } catch (err: any) {
      console.warn('[Supabase] Erro no pullMetadata:', err);
      this.notify('ERROR', `Falha de sincronização: ${err.message || 'Erro de rede'}`);
      return null;
    }
  }

  /**
   * Salva os metadados completos no Supabase (com upsert)
   */
  public async pushMetadata(data: AutoNfseFullMetadata): Promise<boolean> {
    const url = normalizeSupabaseUrl(this.config.url);
    const key = this.config.anonKey;
    const table = 'autonfse_metadata';
    const rowKey = this.config.rowKey || 'autonfse_system_metadata';

    if (!url || !key) return false;

    this.notify('SYNCING', 'Enviando metadados para o Supabase...');

    try {
      // Garante que apenas os dados estruturados da nota fiscal sejam salvos no Supabase (sem arquivos brutos)
      const sanitizedData = { ...data };
      if (sanitizedData.notas && Array.isArray(sanitizedData.notas)) {
        sanitizedData.notas = sanitizedData.notas.map((n) => {
          const { xmlConteudo, ...dadosFiscais } = n;
          return dadosFiscais as NfseDocument;
        });
      }

      const payload = {
        user_id: rowKey,
        data: {
          ...sanitizedData,
          lastUpdated: new Date().toISOString(),
          appVersion: '2.0.0',
        },
        updated_at: new Date().toISOString(),
      };

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

      if (res.ok || res.status === 201 || res.status === 204) {
        const now = new Date().toISOString();
        this.saveConfig({ lastSync: now });
        this.notify('SUCCESS', `Metadados persistidos no Supabase às ${new Date().toLocaleTimeString()}!`);
        return true;
      }

      const errText = await res.text();
      console.warn('[Supabase] Falha no pushMetadata:', res.status, errText);
      this.notify('ERROR', `Erro ao gravar no Supabase: HTTP ${res.status}`);
      return false;
    } catch (err: any) {
      console.warn('[Supabase] Exceção no pushMetadata:', err);
      this.notify('ERROR', `Falha ao persistir no Supabase: ${err.message || 'Erro de conexão'}`);
      return false;
    }
  }

  /**
   * Dispara um push com debounce para evitar requisições excessivas durante digitação
   */
  public debouncedPush(data: AutoNfseFullMetadata, delayMs = 400): void {
    if (!this.config.autoSync) return;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.pushMetadata(data);
    }, delayMs);
  }

  /**
   * Retorna o script SQL completo para quem deseja criar tabelas dedicadas no Supabase
   */
  public getSqlSchemaScript(): string {
    return `-- Script Oficial de Metadados AutoNFS-e para Supabase (Tabela Exclusiva e Isolada)
-- Execute este script no SQL Editor do seu projeto Supabase:

create table if not exists public.autonfse_metadata (
  user_id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);

-- Habilitar RLS e permitir operações seguras com chave anon/publishable
alter table public.autonfse_metadata enable row level security;

create policy "Permitir leitura anon"
  on public.autonfse_metadata for select
  using (true);

create policy "Permitir insercao anon"
  on public.autonfse_metadata for insert
  with check (true);

create policy "Permitir atualizacao anon"
  on public.autonfse_metadata for update
  using (true);

create policy "Permitir exclusao anon"
  on public.autonfse_metadata for delete
  using (true);
`;
  }
}

export const supabaseService = new SupabaseService();
