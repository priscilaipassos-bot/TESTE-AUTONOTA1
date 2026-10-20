import {
  PrestadorConfig,
  TomadorCliente,
  ServicoItem,
  ProgramacaoAgendamento,
  NfseDocument,
  EmailConfig,
  AutomationLogEntry,
} from '../types/nfse';
import { generateChaveAcessoNacional, generateCodigoVerificacao, buildOfficialXmlNacional } from '../utils/nfseGenerator';
import { calculateTaxes } from '../utils/taxCalculator';
import { supabaseService, AutoNfseFullMetadata } from './supabaseService';

const STORAGE_KEYS = {
  PRESTADOR: 'autonfse_prestador_v1',
  CLIENTES: 'autonfse_clientes_v1',
  SERVICOS: 'autonfse_servicos_v1',
  AGENDAMENTOS: 'autonfse_agendamentos_v1',
  NOTAS: 'autonfse_notas_v1',
  EMAIL_CONFIG: 'autonfse_email_cfg_v1',
  LOGS: 'autonfse_logs_v1',
  ROBOT_ACTIVE: 'autonfse_robot_active_v1',
  DEMO_CLEARED: 'autonfse_demo_cleared_v1',
};

export const DEFAULT_PRESTADOR: PrestadorConfig = {
  cnpj: '46874965000104',
  razaoSocial: 'PRISCILA I PASSOS LTDA',
  nomeFantasia: 'PRISCILA I PASSOS',
  inscricaoMunicipal: '',
  regimeTributario: 'SIMPLES_NACIONAL',
  simplesNacional: true,
  aliquotaSimples: 6.0,
  email: 'priscilapassos.job@gmail.com',
  telefone: '31998131413',
  endereco: {
    logradouro: 'Rua W Dois',
    numero: '143',
    complemento: '',
    bairro: 'Pongelupe (Barreiro)',
    codigoMunicipio: '3106200',
    municipio: 'Belo Horizonte',
    uf: 'MG',
    cep: '30628015',
  },
  ambienteEmissao: 'PRODUCAO',
  metodoAutenticacao: 'API_KEY',
  provedorFiscal: 'NOTAS_ENOTAS',
  apiKeyNotas: 'ntaas_zo987DbmrHkCL6iMGLVvR3lvQP6Sr9ix',
  empresaIdNotas: '',
  proximoNumeroDps: 22,
  proximoNumeroNfse: 65,
  serieDps: '1608',
};

export const DEFAULT_CLIENTES: TomadorCliente[] = [];
export const DEFAULT_SERVICOS: ServicoItem[] = [];
export const DEFAULT_AGENDAMENTOS: ProgramacaoAgendamento[] = [];
export function generateInitialInvoices(): NfseDocument[] {
  return [];
}
export const DEFAULT_LOGS: AutomationLogEntry[] = [];

export const DEFAULT_EMAIL_CONFIG: EmailConfig = {
  provedor: 'SMTP',
  servidorSmtp: 'smtp.gmail.com',
  porta: 587,
  usuario: 'priscilapassos.job@gmail.com',
  senhaApp: '',
  remetenteNome: 'PRISCILA I PASSOS LTDA (NFS-e Nacional)',
  remetenteEmail: 'priscilapassos.job@gmail.com',
  enviarCopiaOculta: 'priscilapassos.job@gmail.com',
  assuntoTemplate: 'Nota Fiscal Eletrônica NFS-e Nacional Nº {numero_nfse} - {razao_social_cliente}',
  corpoTemplate: `Prezado(a) {razao_social_cliente},

Informamos que a Nota Fiscal de Serviços eletrônica (NFS-e Padrão Nacional / DANFSE v2.0 - Receita Federal do Brasil) referente aos serviços da competência {mes_competencia} foi emitida e autorizada com sucesso.

📄 Detalhes da NFS-e Nacional:
- Número da NFS-e: {numero_nfse}
- Chave de Acesso: {chave_acesso}
- Valor dos Serviços: {valor_total}
- Valor Líquido: {valor_liquido}

Em anexo, enviamos o Documento Auxiliar (DANFSE em formato PDF) e o arquivo XML oficial assinado digitalmente.

A autenticidade desta NFS-e pode ser verificada pela leitura do código QR no DANFSE ou através da plataforma Notaas.

Atenciosamente,
PRISCILA I PASSOS LTDA
E-mail: priscilapassos.job@gmail.com
Telefone: (31) 99813-1413`,
};

class StorageService {
  constructor() {
    if (typeof window !== 'undefined' && window.localStorage) {
      const isCleared = localStorage.getItem(STORAGE_KEYS.DEMO_CLEARED);
      if (isCleared === null) {
        localStorage.setItem(STORAGE_KEYS.DEMO_CLEARED, 'true');
      }

      // Se houver notas de demo antigas (nfs-04*), remove apenas elas preservando qualquer nota real
      const rawNotas = localStorage.getItem(STORAGE_KEYS.NOTAS);
      if (rawNotas && rawNotas.includes('nfs-041')) {
        try {
          const list: NfseDocument[] = JSON.parse(rawNotas);
          const realOnly = list.filter((n) => !n.id.startsWith('nfs-04'));
          localStorage.setItem(STORAGE_KEYS.NOTAS, JSON.stringify(realOnly));
        } catch {
          // ignore
        }
      }
    }
  }

  isDemoCleared(): boolean {
    return localStorage.getItem(STORAGE_KEYS.DEMO_CLEARED) === 'true';
  }

  clearAllDemoData(): void {
    localStorage.setItem(STORAGE_KEYS.DEMO_CLEARED, 'true');
    const existingPrestador = this.getPrestador();
    const mergedPrestador: PrestadorConfig = {
      ...DEFAULT_PRESTADOR,
      apiKeyNotas: existingPrestador.apiKeyNotas || DEFAULT_PRESTADOR.apiKeyNotas,
      empresaIdNotas: existingPrestador.empresaIdNotas || DEFAULT_PRESTADOR.empresaIdNotas,
      provedorFiscal: 'NOTAS_ENOTAS',
      metodoAutenticacao: 'API_KEY',
    };

    // IMPORTANTE: Preserva todas as notas emitidas reais! Remove apenas as notas de exemplo
    const existingNotas = this.getNotas();
    const realNotas = existingNotas.filter((n) => !n.id.startsWith('nfs-04'));
    this.saveNotas(realNotas);

    // Remove agendamentos de exemplo antigos
    const existingAgds = this.getAgendamentos().filter((a) => !a.id.startsWith('agd-00'));
    this.saveAgendamentos(existingAgds);

    this.saveClientes(this.getClientes());
    this.savePrestador(mergedPrestador);
    this.saveServicos(DEFAULT_SERVICOS);
    this.addLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      tipo: 'SISTEMA',
      nivel: 'INFO',
      mensagem: 'Ambiente fiscal Notaas atualizado para PRISCILA I PASSOS LTDA.',
    });
  }

  getPrestador(): PrestadorConfig {
    const raw = localStorage.getItem(STORAGE_KEYS.PRESTADOR);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.PRESTADOR, JSON.stringify(DEFAULT_PRESTADOR));
      return DEFAULT_PRESTADOR;
    }
    try {
      const parsed = JSON.parse(raw);
      // Inicializa com os padrões oficiais (última DPS emitida foi 21 -> próxima 22; última NFS-e emitida foi 64 -> próxima 65)
      if (parsed.proximoNumeroDps === undefined || parsed.proximoNumeroDps === null || parsed.proximoNumeroDps <= 0) {
        parsed.proximoNumeroDps = 22;
      }
      if (parsed.proximoNumeroNfse === undefined || parsed.proximoNumeroNfse === null || parsed.proximoNumeroNfse <= 0) {
        parsed.proximoNumeroNfse = 65;
      }
      parsed.serieDps = '1608';
      if (parsed.ambienteEmissao === 'HOMOLOGACAO') {
        parsed.ambienteEmissao = 'PRODUCAO';
      }
      return {
        ...DEFAULT_PRESTADOR,
        ...parsed,
        endereco: {
          ...DEFAULT_PRESTADOR.endereco,
          ...(parsed?.endereco || {}),
        },
      };
    } catch {
      return DEFAULT_PRESTADOR;
    }
  }

  savePrestador(config: PrestadorConfig): void {
    localStorage.setItem(STORAGE_KEYS.PRESTADOR, JSON.stringify(config));
    this.notifyChangeAndSync(true);
  }

  getClientes(): TomadorCliente[] {
    const raw = localStorage.getItem(STORAGE_KEYS.CLIENTES);
    if (!raw) return [];
    try {
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  saveClientes(clientes: TomadorCliente[]): void {
    localStorage.setItem(STORAGE_KEYS.CLIENTES, JSON.stringify(clientes));
    this.notifyChangeAndSync(true);
  }

  saveCliente(cliente: TomadorCliente): void {
    const list = this.getClientes();
    const idx = list.findIndex((c) => c.id === cliente.id);
    if (idx >= 0) {
      list[idx] = cliente;
    } else {
      list.unshift(cliente);
    }
    this.saveClientes(list);
  }

  deleteCliente(id: string): void {
    const list = this.getClientes().filter((c) => c.id !== id);
    this.saveClientes(list);
  }

  getServicos(): ServicoItem[] {
    const raw = localStorage.getItem(STORAGE_KEYS.SERVICOS);
    if (!raw) return [];
    try {
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  saveServicos(servicos: ServicoItem[]): void {
    localStorage.setItem(STORAGE_KEYS.SERVICOS, JSON.stringify(servicos));
    this.notifyChangeAndSync(true);
  }

  getAgendamentos(): ProgramacaoAgendamento[] {
    const raw = localStorage.getItem(STORAGE_KEYS.AGENDAMENTOS);
    if (!raw) return [];
    try {
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  saveAgendamentos(agendamentos: ProgramacaoAgendamento[]): void {
    localStorage.setItem(STORAGE_KEYS.AGENDAMENTOS, JSON.stringify(agendamentos));
    this.notifyChangeAndSync(true);
  }

  saveAgendamento(agendamento: ProgramacaoAgendamento): void {
    const list = this.getAgendamentos();
    const idx = list.findIndex((a) => a.id === agendamento.id);
    if (idx >= 0) {
      list[idx] = agendamento;
    } else {
      list.unshift(agendamento);
    }
    this.saveAgendamentos(list);
  }

  toggleAgendamento(id: string): boolean {
    const list = this.getAgendamentos();
    const item = list.find((a) => a.id === id);
    if (item) {
      item.ativo = !item.ativo;
      this.saveAgendamentos(list);
      return item.ativo;
    }
    return false;
  }

  deleteAgendamento(id: string): void {
    const list = this.getAgendamentos().filter((a) => a.id !== id);
    this.saveAgendamentos(list);
  }

  getNotas(): NfseDocument[] {
    const raw = localStorage.getItem(STORAGE_KEYS.NOTAS);
    if (!raw) return [];
    try {
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  saveNotas(notas: NfseDocument[]): void {
    localStorage.setItem(STORAGE_KEYS.NOTAS, JSON.stringify(notas));
    this.notifyChangeAndSync(true);
  }

  addNota(nota: NfseDocument): void {
    const list = this.getNotas();
    const exists = list.some((n) => n.id === nota.id || (n.numero && n.numero === nota.numero));
    if (exists) {
      this.updateNota(nota);
      return;
    }
    list.unshift(nota);
    this.saveNotas(list);
  }

  updateNota(nota: NfseDocument): void {
    const list = this.getNotas();
    const idx = list.findIndex((n) => n.id === nota.id || (n.numero && n.numero === nota.numero));
    if (idx >= 0) {
      list[idx] = nota;
      this.saveNotas(list);
    }
  }

  saveNota(nota: NfseDocument): void {
    const list = this.getNotas();
    const idx = list.findIndex((n) => n.id === nota.id || (n.numero && n.numero === nota.numero));
    if (idx >= 0) {
      list[idx] = nota;
    } else {
      list.unshift(nota);
    }
    this.saveNotas(list);
  }

  cancelNota(id: string, motivo: string): NfseDocument | null {
    const list = this.getNotas();
    const item = list.find((n) => n.id === id);
    if (item) {
      item.status = 'CANCELADA';
      item.mensagemRetorno = `Cancelada pelo usuário: ${motivo}`;
      this.saveNotas(list);
      this.addLog({
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        tipo: 'EMISSAO_NFSE',
        nivel: 'AVISO',
        mensagem: `NFS-e Nº ${item.numero} cancelada com sucesso no Portal Nacional. Motivo: ${motivo}`,
        referenciaId: item.id,
      });
      return item;
    }
    return null;
  }

  getNextNumeroDps(): string {
    const prestador = this.getPrestador();
    if (prestador.proximoNumeroDps && prestador.proximoNumeroDps > 0) {
      return String(prestador.proximoNumeroDps);
    }
    return '21';
  }

  getNextNumeroNfse(): string {
    const prestador = this.getPrestador();
    if (prestador.proximoNumeroNfse && prestador.proximoNumeroNfse > 0) {
      return String(prestador.proximoNumeroNfse);
    }
    return '64';
  }

  setProximoNumeroDps(novoNumero: number): void {
    const prestador = this.getPrestador();
    prestador.proximoNumeroDps = novoNumero;
    this.savePrestador(prestador);
  }

  setProximoNumeroNfse(novoNumero: number): void {
    const prestador = this.getPrestador();
    prestador.proximoNumeroNfse = novoNumero;
    this.savePrestador(prestador);
  }

  setSerieDps(novaSerie: string): void {
    const prestador = this.getPrestador();
    prestador.serieDps = novaSerie;
    this.savePrestador(prestador);
  }

  getEmailConfig(): EmailConfig {
    const raw = localStorage.getItem(STORAGE_KEYS.EMAIL_CONFIG);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.EMAIL_CONFIG, JSON.stringify(DEFAULT_EMAIL_CONFIG));
      return DEFAULT_EMAIL_CONFIG;
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed.usuario) {
        parsed.usuario = String(parsed.usuario).trim().replace(/@gmail\.co$/i, '@gmail.com');
      }
      if (parsed.remetenteEmail) {
        parsed.remetenteEmail = String(parsed.remetenteEmail).trim().replace(/@gmail\.co$/i, '@gmail.com');
      }
      if (parsed.enviarCopiaOculta) {
        parsed.enviarCopiaOculta = String(parsed.enviarCopiaOculta).trim().replace(/@gmail\.co$/i, '@gmail.com');
      }
      if (parsed.senhaApp) {
        parsed.senhaApp = String(parsed.senhaApp).replace(/[\s\-]/g, '').toLowerCase();
      }
      return {
        ...DEFAULT_EMAIL_CONFIG,
        ...(parsed || {}),
        usuario: parsed.usuario || DEFAULT_EMAIL_CONFIG.usuario,
        remetenteEmail: parsed.remetenteEmail || DEFAULT_EMAIL_CONFIG.remetenteEmail,
      };
    } catch {
      return DEFAULT_EMAIL_CONFIG;
    }
  }

  saveEmailConfig(cfg: EmailConfig): void {
    localStorage.setItem(STORAGE_KEYS.EMAIL_CONFIG, JSON.stringify(cfg));
    this.notifyChangeAndSync(true);
  }

  getLogs(): AutomationLogEntry[] {
    const raw = localStorage.getItem(STORAGE_KEYS.LOGS);
    if (!raw) return [];
    try {
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  saveLogs(logs: AutomationLogEntry[]): void {
    const trimmed = logs.slice(0, 100);
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(trimmed));
  }

  addLog(entry: AutomationLogEntry): void {
    const list = this.getLogs();
    list.unshift(entry);
    this.saveLogs(list);
  }

  clearLogs(): void {
    this.saveLogs([]);
  }

  isRobotActive(): boolean {
    const val = localStorage.getItem(STORAGE_KEYS.ROBOT_ACTIVE);
    return val === null ? true : val === 'true';
  }

  setRobotActive(active: boolean): void {
    localStorage.setItem(STORAGE_KEYS.ROBOT_ACTIVE, String(active));
    this.notifyChangeAndSync(true);
  }

  async resetAll(): Promise<void> {
    await this.initAndHydrate();
  }

  public isHydrated = false;
  public isInitialHydrationRunning = false;

  public isDataHydrated(): boolean {
    return this.isHydrated;
  }

  public isReady(): boolean {
    return this.isHydrated && !this.isInitialHydrationRunning;
  }

  public markHydrated(): void {
    this.isHydrated = true;
  }

  /**
   * Sincronização automática para o Supabase (autonfse_metadata):
   * Gravações automáticas sempre que os dados sofrerem alterações.
   */
  public notifyChangeAndSync(immediate = false): void {
    if (typeof window === 'undefined') return;
    if (this.isInitialHydrationRunning) {
      return;
    }

    try {
      const snapshot = this.getAllMetadataSnapshot();
      if (immediate) {
        supabaseService.pushMetadata(snapshot);
      } else {
        supabaseService.debouncedPush(snapshot, 300);
      }
    } catch (err) {
      console.warn('[Sync] Erro na gravação automática do Supabase:', err);
    }
  }

  public getAllMetadataSnapshot(): AutoNfseFullMetadata {
    // Garante que nenhum arquivo (xmlConteudo ou arquivos binários) seja salvo no Supabase.
    // Apenas os dados estruturados extraídos do XML são persistidos no Supabase.
    const notasLimpos = this.getNotas().map((n) => {
      const { xmlConteudo, ...dadosExtraidos } = n;
      return dadosExtraidos as NfseDocument;
    });

    return {
      prestador: this.getPrestador(),
      clientes: this.getClientes(),
      servicos: this.getServicos(),
      agendamentos: this.getAgendamentos(),
      notas: notasLimpos,
      emailConfig: this.getEmailConfig(),
      logs: this.getLogs(),
      isRobotActive: this.isRobotActive(),
      lastUpdated: new Date().toISOString(),
      appVersion: '2.0.0',
    };
  }

  public applyRemoteMetadata(data: AutoNfseFullMetadata): void {
    if (!data || typeof data !== 'object') return;
    this.isHydrated = true;

    if (data.prestador && typeof data.prestador === 'object') {
      localStorage.setItem(STORAGE_KEYS.PRESTADOR, JSON.stringify(data.prestador));
    }
    if (Array.isArray(data.clientes)) {
      localStorage.setItem(STORAGE_KEYS.CLIENTES, JSON.stringify(data.clientes));
    }
    if (Array.isArray(data.servicos)) {
      localStorage.setItem(STORAGE_KEYS.SERVICOS, JSON.stringify(data.servicos));
    }
    if (Array.isArray(data.agendamentos)) {
      localStorage.setItem(STORAGE_KEYS.AGENDAMENTOS, JSON.stringify(data.agendamentos));
    }
    if (Array.isArray(data.notas)) {
      const sorted = [...data.notas].sort(
        (a, b) => Number(b.numero || 0) - Number(a.numero || 0)
      );
      localStorage.setItem(STORAGE_KEYS.NOTAS, JSON.stringify(sorted));
    }
    if (data.emailConfig && typeof data.emailConfig === 'object') {
      localStorage.setItem(STORAGE_KEYS.EMAIL_CONFIG, JSON.stringify(data.emailConfig));
    }
    if (Array.isArray(data.logs)) {
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(data.logs.slice(0, 100)));
    }
    if (typeof data.isRobotActive === 'boolean') {
      localStorage.setItem(STORAGE_KEYS.ROBOT_ACTIVE, String(data.isRobotActive));
    }
  }

  public garantirDadosOficiais(): void {
    // A fonte única de verdade é o Supabase. Sem injeção de dados falsos locais.
  }

  public ensureOfficialData(): void {
    this.garantirDadosOficiais();
  }

  /**
   * Hidratação Inicial a partir do Supabase:
   * Realiza SELECT no Supabase (ou /api/metadata) para carregar os dados reais no cache.
   */
  public async initAndHydrate(): Promise<boolean> {
    this.isInitialHydrationRunning = true;
    try {
      let remote = await supabaseService.pullMetadata();
      if (!remote && typeof window !== 'undefined') {
        try {
          const apiRes = await fetch('/api/metadata');
          if (apiRes.ok) {
            const json = await apiRes.json();
            if (json.success && json.data) {
              remote = json.data;
            }
          }
        } catch {
          // ignore
        }
      }

      if (remote) {
        this.applyRemoteMetadata(remote);
        return true;
      }
    } catch (err) {
      console.warn('[StorageService] Falha ao sincronizar na inicialização:', err);
    } finally {
      this.isHydrated = true;
      this.isInitialHydrationRunning = false;
    }
    return false;
  }
}

export const storageService = new StorageService();
