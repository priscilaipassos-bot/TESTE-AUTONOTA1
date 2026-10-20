import React, { useState } from 'react';
import {
  X,
  Building2,
  Key,
  Mail,
  Check,
  ShieldCheck,
  Upload,
  RefreshCcw,
  ExternalLink,
  Trash2,
  Send,
  CheckCircle2,
  AlertCircle,
  Database,
  Cloud,
  Copy,
  Server,
  CheckCheck,
  Globe,
} from 'lucide-react';
import { PrestadorConfig, EmailConfig, AutomationLogEntry } from '../types/nfse';
import { formatDateTime } from '../utils/formatters';
import { supabaseService, normalizeSupabaseUrl } from '../services/supabaseService';
import { storageService } from '../services/storageService';
import { AutomationRunner } from '../services/automationRunner';
import { AVAILABLE_TEMPLATE_TAGS, renderTemplateWithContext } from '../utils/templateHelper';
import { TemplateTagsHelper } from './TemplateTagsHelper';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  prestador: PrestadorConfig;
  emailConfig: EmailConfig;
  logs?: AutomationLogEntry[];
  isRobotActive?: boolean;
  onClearLogs?: () => void;
  onSavePrestador: (p: PrestadorConfig) => void;
  onSaveEmailConfig: (e: EmailConfig) => void;
  onResetSampleData: () => void;
  onClearDemoData: () => void;
  onRefreshAllData?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  prestador,
  emailConfig,
  logs = [],
  isRobotActive = true,
  onClearLogs,
  onSavePrestador,
  onSaveEmailConfig,
  onResetSampleData,
  onClearDemoData,
  onRefreshAllData,
}) => {
  const [activeTab, setActiveTab] = useState<'PRESTADOR' | 'EMISSOR' | 'EMAIL' | 'SUPABASE' | 'LOGS'>('PRESTADOR');
  const [logFilter, setLogFilter] = useState<string>('ALL');

  // Prestador form state
  const [pCnpj, setPCnpj] = useState(prestador.cnpj);
  const [pRazao, setPRazao] = useState(prestador.razaoSocial);
  const [pFantasia, setPFantasia] = useState(prestador.nomeFantasia);
  const [pIm, setPIm] = useState(prestador.inscricaoMunicipal);
  const [pRegime, setPRegime] = useState(prestador.regimeTributario);
  const [pEmail, setPEmail] = useState(prestador.email);
  const [pTelefone, setPTelefone] = useState(prestador.telefone);
  const [pLogradouro, setPLogradouro] = useState(prestador.endereco.logradouro);
  const [pNumero, setPNumero] = useState(prestador.endereco.numero);
  const [pBairro, setPBairro] = useState(prestador.endereco.bairro);
  const [pMunicipio, setPMunicipio] = useState(prestador.endereco.municipio);
  const [pIbge, setPIbge] = useState(prestador.endereco.codigoMunicipio);
  const [pUf, setPUf] = useState(prestador.endereco.uf);
  const [pCep, setPCep] = useState(prestador.endereco.cep);
  const [pUrlConsulta, setPUrlConsulta] = useState(prestador.urlConsultaNfse || '');

  // Emissor federal form state
  const [pAmbiente, setPAmbiente] = useState(prestador.ambienteEmissao);
  const [pApiKeyNotas, setPApiKeyNotas] = useState(prestador.apiKeyNotas || '');
  const [pEmpresaIdNotas, setPEmpresaIdNotas] = useState(prestador.empresaIdNotas || '');
  const [pProximoNumeroDps, setPProximoNumeroDps] = useState<number>(prestador.proximoNumeroDps || 21);
  const [pProximoNumeroNfse, setPProximoNumeroNfse] = useState<number>(prestador.proximoNumeroNfse || 64);
  const [pSerieDps, setPSerieDps] = useState<string>(prestador.serieDps || '1608');
  const [testingNotaas, setTestingNotaas] = useState(false);
  const [notaasStatus, setNotaasStatus] = useState<string | null>(null);
  const [notaasError, setNotaasError] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);
  const [probeNfseLog, setProbeNfseLog] = useState<{
    envio: any;
    retorno: any;
    tempoMs: number;
    sucesso: boolean;
  } | null>(null);

  // Email form state
  const [eProvedor, setEProvedor] = useState(emailConfig.provedor);
  const [eSmtp, setESmtp] = useState(emailConfig.servidorSmtp);
  const [ePorta, setEPorta] = useState(emailConfig.porta);
  const [eUsuario, setEUsuario] = useState(emailConfig.usuario);
  const [eSenhaApp, setESenhaApp] = useState(emailConfig.senhaApp || '');
  const [eRemetenteNome, setERemetenteNome] = useState(emailConfig.remetenteNome);
  const [eRemetenteEmail, setERemetenteEmail] = useState(emailConfig.remetenteEmail);
  const [eCopiaOculta, setECopiaOculta] = useState(emailConfig.enviarCopiaOculta || '');
  const [eAssunto, setEAssunto] = useState(emailConfig.assuntoTemplate);
  const [eCorpo, setECorpo] = useState(emailConfig.corpoTemplate);

  // Teste de Email state
  const [testEmailDestino, setTestEmailDestino] = useState(emailConfig.remetenteEmail || 'priscilaipassos@gmail.com');
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{
    sucesso: boolean;
    mensagem: string;
  } | null>(null);

  // Supabase & Vercel state
  const initialSbConfig = supabaseService.getConfig();
  const [sbUrl, setSbUrl] = useState(initialSbConfig.url);
  const [sbKey, setSbKey] = useState(initialSbConfig.anonKey);
  const [sbTable, setSbTable] = useState(initialSbConfig.tableName || 'autonfse_metadata');
  const [sbRowKey, setSbRowKey] = useState(initialSbConfig.rowKey || 'autonfse_system_metadata');
  const [sbAutoSync, setSbAutoSync] = useState(initialSbConfig.autoSync ?? true);
  const [lastSyncTime, setLastSyncTime] = useState<string | undefined>(initialSbConfig.lastSync);
  const [testingSb, setTestingSb] = useState(false);
  const [sbStatus, setSbStatus] = useState<string | null>(null);
  const [sbError, setSbError] = useState<string | null>(null);
  const [syncingSb, setSyncingSb] = useState(false);
  const [sbSyncFeedback, setSbSyncFeedback] = useState<{
    sucesso: boolean;
    mensagem: string;
  } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [testingVercel, setTestingVercel] = useState(false);
  const [vercelDiag, setVercelDiag] = useState<any>(null);

  const handleTestVercel = async () => {
    setTestingVercel(true);
    setVercelDiag(null);
    try {
      const res = await fetch('/api/vercel/status');
      const json = await res.json();
      setVercelDiag(json);
    } catch (err: any) {
      setVercelDiag({ success: false, error: err.message });
    } finally {
      setTestingVercel(false);
    }
  };

  const [savedAlert, setSavedAlert] = useState(false);
  const [sequencialMsg, setSequencialMsg] = useState<string | null>(null);

  const handleAplicarSequencial = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    const dpsNum = Number(pProximoNumeroDps);
    const nfseNum = Number(pProximoNumeroNfse);
    if (isNaN(dpsNum) || dpsNum <= 0) {
      alert('Informe um número válido e maior que zero para a DPS.');
      return;
    }
    if (isNaN(nfseNum) || nfseNum <= 0) {
      alert('Informe um número válido e maior que zero para a NFS-e.');
      return;
    }
    storageService.setProximoNumeroDps(dpsNum);
    storageService.setProximoNumeroNfse(nfseNum);
    storageService.setSerieDps(pSerieDps.trim() || '1608');
    const updated: PrestadorConfig = {
      ...prestador,
      proximoNumeroDps: dpsNum,
      proximoNumeroNfse: nfseNum,
      serieDps: pSerieDps.trim() || '1608',
    };
    onSavePrestador(updated);
    setSequencialMsg(`✅ Sequência ajustada com sucesso! A próxima nota emitida usará DPS Nº ${dpsNum} e NFS-e Oficial Nº ${nfseNum}. O sistema seguirá a partir desses números.`);
    setTimeout(() => setSequencialMsg(null), 7000);
  };

  React.useEffect(() => {
    if (isOpen) {
      const currentSb = supabaseService.getConfig();
      setSbUrl(currentSb.url);
      setSbKey(currentSb.anonKey);
      setSbTable(currentSb.tableName || 'autonfse_metadata');
      setSbRowKey(currentSb.rowKey || 'autonfse_system_metadata');
      setSbAutoSync(currentSb.autoSync ?? true);
      setLastSyncTime(currentSb.lastSync);
      setSbStatus(null);
      setSbError(null);
      setSbSyncFeedback(null);

      setPCnpj(prestador.cnpj);
      setPRazao(prestador.razaoSocial);
      setPFantasia(prestador.nomeFantasia);
      setPIm(prestador.inscricaoMunicipal);
      setPRegime(prestador.regimeTributario);
      setPEmail(prestador.email);
      setPTelefone(prestador.telefone);
      setPLogradouro(prestador.endereco.logradouro);
      setPNumero(prestador.endereco.numero);
      setPBairro(prestador.endereco.bairro);
      setPMunicipio(prestador.endereco.municipio);
      setPIbge(prestador.endereco.codigoMunicipio);
      setPUf(prestador.endereco.uf);
      setPCep(prestador.endereco.cep);
      setPUrlConsulta(prestador.urlConsultaNfse || '');

      setPAmbiente(prestador.ambienteEmissao || 'HOMOLOGACAO');
      setPApiKeyNotas(prestador.apiKeyNotas || '');
      setPEmpresaIdNotas(prestador.empresaIdNotas || '');
      setPProximoNumeroDps(prestador.proximoNumeroDps || 21);
      setPProximoNumeroNfse(prestador.proximoNumeroNfse || 64);
      setPSerieDps(prestador.serieDps || '1608');

      setEProvedor(emailConfig.provedor);
      setESmtp(emailConfig.servidorSmtp);
      setEPorta(emailConfig.porta);
      setEUsuario((emailConfig.usuario || 'priscilapassos.job@gmail.com').trim().replace(/@gmail\.co$/i, '@gmail.com'));
      setESenhaApp(emailConfig.senhaApp || '');
      setERemetenteNome(emailConfig.remetenteNome);
      setERemetenteEmail((emailConfig.remetenteEmail || 'priscilapassos.job@gmail.com').trim().replace(/@gmail\.co$/i, '@gmail.com'));
      setECopiaOculta((emailConfig.enviarCopiaOculta || '').trim().replace(/@gmail\.co$/i, '@gmail.com'));
      setEAssunto(emailConfig.assuntoTemplate);
      setECorpo(emailConfig.corpoTemplate);
    }
  }, [isOpen, prestador, emailConfig]);

  if (!isOpen) return null;

  const handleSaveAll = (e: React.FormEvent) => {
    e.preventDefault();

    const updatedPrestador: PrestadorConfig = {
      ...prestador,
      cnpj: pCnpj.replace(/\D/g, ''),
      razaoSocial: pRazao.trim(),
      nomeFantasia: pFantasia.trim(),
      inscricaoMunicipal: pIm.trim(),
      regimeTributario: pRegime,
      email: pEmail.trim(),
      telefone: pTelefone.trim(),
      endereco: {
        logradouro: pLogradouro.trim(),
        numero: pNumero.trim(),
        bairro: pBairro.trim(),
        municipio: pMunicipio.trim(),
        codigoMunicipio: pIbge.trim(),
        uf: pUf.trim().toUpperCase(),
        cep: pCep.replace(/\D/g, ''),
      },
      ambienteEmissao: pAmbiente,
      apiKeyNotas: pApiKeyNotas.trim(),
      empresaIdNotas: pEmpresaIdNotas.trim(),
      proximoNumeroDps: Number(pProximoNumeroDps) || 21,
      proximoNumeroNfse: Number(pProximoNumeroNfse) || 64,
      serieDps: pSerieDps.trim() || '1608',
      urlConsultaNfse: pUrlConsulta.trim() || undefined,
      provedorFiscal: 'NOTAS_ENOTAS',
      metodoAutenticacao: 'API_KEY',
    };

    const cleanUser = eUsuario.trim().replace(/@gmail\.co$/i, '@gmail.com');
    const cleanRemetente = eRemetenteEmail.trim().replace(/@gmail\.co$/i, '@gmail.com');
    const cleanBcc = eCopiaOculta.trim().replace(/@gmail\.co$/i, '@gmail.com');
    const cleanSenha = eSenhaApp.replace(/[\s\-]/g, '').toLowerCase();

    const updatedEmail: EmailConfig = {
      provedor: eProvedor,
      servidorSmtp: eSmtp.trim(),
      porta: Number(ePorta),
      usuario: cleanUser,
      senhaApp: cleanSenha,
      remetenteNome: eRemetenteNome.trim(),
      remetenteEmail: cleanRemetente,
      enviarCopiaOculta: cleanBcc,
      assuntoTemplate: eAssunto,
      corpoTemplate: eCorpo,
    };

    onSavePrestador(updatedPrestador);
    onSaveEmailConfig(updatedEmail);

    supabaseService.saveConfig({
      url: sbUrl.trim(),
      anonKey: sbKey.trim(),
      tableName: sbTable.trim(),
      rowKey: sbRowKey.trim(),
      autoSync: sbAutoSync,
    });

    setSavedAlert(true);
    setTimeout(() => {
      setSavedAlert(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Configurações do Sistema AutoNFS-e</span>
            </h3>
            <p className="text-xs text-slate-500">
              Parametrização da empresa emissora, integração Notaas, disparo de E-mail e nuvem Supabase/Vercel
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-100/60 px-3 sm:px-4 pt-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('PRESTADOR')}
            className={`px-3 py-2 text-xs font-medium rounded-t-lg whitespace-nowrap transition-colors border-t border-x cursor-pointer ${
              activeTab === 'PRESTADOR'
                ? 'bg-white text-slate-950 font-bold border-slate-200 border-b-transparent'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            Empresa Emissora
          </button>

          <button
            onClick={() => setActiveTab('EMISSOR')}
            className={`px-3 py-2 text-xs font-medium rounded-t-lg whitespace-nowrap transition-colors border-t border-x cursor-pointer ${
              activeTab === 'EMISSOR'
                ? 'bg-white text-slate-950 font-bold border-slate-200 border-b-transparent'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            Integração Notaas (API)
          </button>

          <button
            onClick={() => setActiveTab('EMAIL')}
            className={`px-3 py-2 text-xs font-medium rounded-t-lg whitespace-nowrap transition-colors border-t border-x cursor-pointer ${
              activeTab === 'EMAIL'
                ? 'bg-white text-slate-950 font-bold border-slate-200 border-b-transparent'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            Disparo por E-mail
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('SUPABASE')}
            className={`px-3 py-2 text-xs font-medium rounded-t-lg whitespace-nowrap transition-colors border-t border-x flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'SUPABASE'
                ? 'bg-white text-slate-950 font-bold border-slate-200 border-b-transparent'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-blue-600" />
            <span>Vercel & Supabase</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-blue-100 text-blue-800">
              Nuvem
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('LOGS')}
            className={`px-3 py-2 text-xs font-medium rounded-t-lg whitespace-nowrap transition-colors border-t border-x flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'LOGS'
                ? 'bg-white text-slate-950 font-bold border-slate-200 border-b-transparent'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <span>Logs do Robô</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              isRobotActive ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-700'
            }`}>
              {logs.length}
            </span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSaveAll} className="overflow-y-auto p-5 space-y-4 text-xs">
          {/* TAB 1: PRESTADOR */}
          {activeTab === 'PRESTADOR' && (
            <div className="space-y-4">
              {/* Card de Controle de Sequenciamento Oficial (DPS e NFS-e) */}
              <div className="p-4 bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-slate-50 border border-blue-200 rounded-xl space-y-3 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                      123
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 flex-wrap">
                        <span>Controle de Sequenciamento Fiscal (DPS e NFS-e Oficial)</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          🔄 Atualizado Automaticamente
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-600">
                        O sistema auto-incrementa (+1) esses números a cada emissão autorizada. Você pode alterar qualquer valor abaixo para <strong>forçar um novo sequencial</strong> que será seguido a partir daqui.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="bg-white p-3 rounded-lg border border-blue-200 shadow-2xs">
                    <label className="block font-semibold text-slate-800 mb-1 text-xs">
                      Próximo Número da DPS:
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={pProximoNumeroDps}
                      onChange={(e) => setPProximoNumeroDps(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    />
                    <span className="text-[10.5px] text-slate-500 mt-1 block">
                      Declaração Prévia de Serviço enviada à Receita (Última: {Math.max(1, pProximoNumeroDps - 1)}).
                    </span>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-blue-200 shadow-2xs">
                    <label className="block font-semibold text-slate-800 mb-1 text-xs">
                      Próxima NFS-e Oficial:
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={pProximoNumeroNfse}
                      onChange={(e) => setPProximoNumeroNfse(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    />
                    <span className="text-[10.5px] text-slate-500 mt-1 block">
                      Número oficial da Nota Fiscal de Serviços (Última: {Math.max(1, pProximoNumeroNfse - 1)}).
                    </span>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-blue-200 shadow-2xs">
                    <label className="block font-semibold text-slate-800 mb-1 text-xs">
                      Série da DPS (Declaração):
                    </label>
                    <input
                      type="text"
                      value={pSerieDps}
                      onChange={(e) => setPSerieDps(e.target.value)}
                      placeholder="1608"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    />
                    <span className="text-[10.5px] text-slate-500 mt-1 block">
                      Série fixada no Portal Nacional: <strong>1608</strong>.
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-blue-100">
                  <span className="text-[11px] text-slate-500">
                    💡 Qualquer alteração salva aqui será rigorosamente seguida a partir da próxima emissão.
                  </span>
                  <button
                    type="button"
                    onClick={handleAplicarSequencial}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg transition-colors shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Salvar e Fixar Sequência Agora</span>
                  </button>
                </div>

                {sequencialMsg && (
                  <div className="p-2.5 bg-emerald-100 border border-emerald-300 text-emerald-900 font-semibold text-xs rounded-lg flex items-center gap-1.5 animate-in fade-in duration-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{sequencialMsg}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">CNPJ do Prestador:</label>
                  <input
                    type="text"
                    required
                    value={pCnpj}
                    onChange={(e) => setPCnpj(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Inscrição Municipal:</label>
                  <input
                    type="text"
                    value={pIm}
                    onChange={(e) => setPIm(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Razão Social:</label>
                  <input
                    type="text"
                    required
                    value={pRazao}
                    onChange={(e) => setPRazao(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nome Fantasia:</label>
                  <input
                    type="text"
                    value={pFantasia}
                    onChange={(e) => setPFantasia(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Regime Tributário:</label>
                  <select
                    value={pRegime}
                    onChange={(e) => setPRegime(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  >
                    <option value="SIMPLES_NACIONAL">Simples Nacional (ME / EPP)</option>
                    <option value="MEI">MEI - Microempreendedor Individual</option>
                    <option value="LUCRO_PRESUMIDO">Lucro Presumido</option>
                    <option value="LUCRO_REAL">Lucro Real</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">E-mail Fiscal:</label>
                  <input
                    type="email"
                    required
                    value={pEmail}
                    onChange={(e) => setPEmail(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Telefone de Contato:</label>
                  <input
                    type="text"
                    value={pTelefone}
                    onChange={(e) => setPTelefone(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-900"
                  />
                </div>
              </div>

              {/* Endereço */}
              <div className="pt-2 border-t border-slate-200">
                <span className="font-bold text-slate-800 block mb-2">Endereço da Sede:</span>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-slate-600 mb-0.5">Logradouro:</label>
                    <input
                      type="text"
                      value={pLogradouro}
                      onChange={(e) => setPLogradouro(e.target.value)}
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-0.5">Número:</label>
                    <input
                      type="text"
                      value={pNumero}
                      onChange={(e) => setPNumero(e.target.value)}
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 mt-2">
                  <div>
                    <label className="block text-slate-600 mb-0.5">Bairro:</label>
                    <input
                      type="text"
                      value={pBairro}
                      onChange={(e) => setPBairro(e.target.value)}
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-0.5">Município:</label>
                    <input
                      type="text"
                      value={pMunicipio}
                      onChange={(e) => setPMunicipio(e.target.value)}
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-0.5">Cód. IBGE:</label>
                    <input
                      type="text"
                      value={pIbge}
                      onChange={(e) => setPIbge(e.target.value)}
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-slate-900 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-0.5">UF:</label>
                    <input
                      type="text"
                      maxLength={2}
                      value={pUf}
                      onChange={(e) => setPUf(e.target.value)}
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-slate-900 uppercase font-mono"
                    />
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-200">
                  <label className="block font-semibold text-slate-700 mb-1">
                    URL de Consulta Pública da Nota Fiscal (Preenchimento Automático via QR Code):
                  </label>
                  <input
                    type="url"
                    value={pUrlConsulta}
                    onChange={(e) => setPUrlConsulta(e.target.value)}
                    placeholder="https://www.nfse.gov.br/consultapublica"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono text-xs"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    O QR Code e o link do DANFSE apontarão para este endereço preenchendo automaticamente o número da nota fiscal (?numero=...&chv=...&cnpj=...). Deixe em branco para utilizar o padrão da Receita Federal (Portal Nacional da NFS-e).
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: INTEGRAÇÃO NOTAAS */}
          {activeTab === 'EMISSOR' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-blue-950">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 font-bold">
                    <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0" />
                    <span className="text-sm">Integração Notaas (Emissão de NFS-e)</span>
                  </div>
                  <a
                    href="https://platform.notaas.com.br"
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-blue-300 text-blue-800 rounded-md hover:bg-blue-100 transition-colors flex items-center gap-1 self-start sm:self-auto"
                  >
                    <span>Abrir Painel Notaas</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-[11.5px] text-slate-700 leading-relaxed">
                  Todas as notas são emitidas através da plataforma <strong>Notaas (platform.notaas.com.br)</strong>. 
                  O Notaas é responsável por autorizar a nota nos órgãos fiscais, gerar o número, emitir o DANFSE em PDF e disponibilizar o XML assinado.
                </p>
              </div>

              {/* Configurações Notaas */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-4 shadow-2xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-800 mb-1 text-xs flex items-center justify-between">
                      <span>API Key / Token Notaas:</span>
                      <span className="text-[10px] text-blue-700 font-mono">ntaas_*</span>
                    </label>
                    <input
                      type="text"
                      value={pApiKeyNotas}
                      placeholder="Cole sua chave aqui (Ex: ntaas_...)"
                      onChange={(e) => {
                        setPApiKeyNotas(e.target.value);
                        setNotaasStatus(null);
                        setNotaasError(null);
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-900 text-xs focus:ring-1 focus:ring-blue-500 focus:bg-white"
                    />
                    <span className="text-[10.5px] text-slate-500 mt-1 block">
                      Obtida no painel do Notaas em <strong>Desenvolvedores &gt; Chaves de API</strong>.
                    </span>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1 text-xs">
                      Ambiente de Emissão no Notaas:
                    </label>
                    <select
                      value={pAmbiente}
                      onChange={(e) => setPAmbiente(e.target.value as 'PRODUCAO' | 'HOMOLOGACAO')}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs font-medium focus:ring-1 focus:ring-blue-500 focus:bg-white"
                    >
                      <option value="HOMOLOGACAO">Homologação (Sandbox / Testes)</option>
                      <option value="PRODUCAO">Produção (Notas Oficiais com Valor Fiscal)</option>
                    </select>
                    <span className="text-[10.5px] text-slate-500 mt-1 block">
                      {pAmbiente === 'HOMOLOGACAO' 
                        ? 'Notas de teste no sandbox do Notaas (sem valor fiscal).' 
                        : 'Notas oficiais transmitidas para a Receita Federal / Município.'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-blue-50/60 rounded-lg border border-blue-200">
                    <div>
                      <label className="block font-semibold text-slate-800 mb-1 text-xs">
                        Próximo Número da DPS:
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={pProximoNumeroDps}
                        onChange={(e) => setPProximoNumeroDps(Math.max(1, parseInt(e.target.value, 10) || 21))}
                        className="w-full px-3 py-2 bg-white border border-blue-300 rounded-lg text-slate-900 text-xs font-mono font-bold focus:ring-1 focus:ring-blue-500"
                      />
                      <span className="text-[10.5px] text-slate-600 mt-1 block">
                        Sequencial da DPS (Última: 20, próxima: <strong>21</strong>).
                      </span>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-800 mb-1 text-xs">
                        Próxima NFS-e Oficial:
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={pProximoNumeroNfse}
                        onChange={(e) => setPProximoNumeroNfse(Math.max(1, parseInt(e.target.value, 10) || 64))}
                        className="w-full px-3 py-2 bg-white border border-blue-300 rounded-lg text-slate-900 text-xs font-mono font-bold focus:ring-1 focus:ring-blue-500"
                      />
                      <span className="text-[10.5px] text-slate-600 mt-1 block">
                        Número oficial da Nota (Última: 63, próxima: <strong>64</strong>).
                      </span>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-800 mb-1 text-xs">
                        Série da DPS (Declaração):
                      </label>
                      <input
                        type="text"
                        value={pSerieDps}
                        onChange={(e) => setPSerieDps(e.target.value)}
                        placeholder="1608"
                        className="w-full px-3 py-2 bg-white border border-blue-300 rounded-lg text-slate-900 text-xs font-mono font-bold focus:ring-1 focus:ring-blue-500"
                      />
                      <span className="text-[10.5px] text-slate-600 mt-1 block">
                        Série oficial fixada: <strong>1608</strong>.
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] text-slate-500">
                      💡 <em>Atualização automática:</em> O robô avança +1 a cada nota autorizada. Altere qualquer número acima para forçar um novo início.
                    </span>
                    <button
                      type="button"
                      onClick={handleAplicarSequencial}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg transition-colors shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Salvar e Fixar Sequência Agora</span>
                    </button>
                  </div>

                  {sequencialMsg && (
                    <div className="p-2.5 bg-emerald-100 border border-emerald-300 text-emerald-900 font-semibold text-xs rounded-lg flex items-center gap-1.5 animate-in fade-in duration-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{sequencialMsg}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-xs text-slate-500">
                    Teste a autenticação da sua chave de API com os servidores da Notaas:
                  </span>
                  <button
                    type="button"
                    disabled={testingNotaas || !pApiKeyNotas.trim()}
                    onClick={async () => {
                      setTestingNotaas(true);
                      setNotaasStatus(null);
                      setNotaasError(null);
                      try {
                        const tokenLimpo = pApiKeyNotas.trim();

                        // Chamada segura para o endpoint proxy interno (server-side)
                        const res = await fetch('/api/notaas/test-connection', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            apiKey: tokenLimpo,
                            empresaId: pEmpresaIdNotas.trim() || undefined,
                          }),
                        });

                        const resText = await res.text();
                        let data: any = null;
                        try {
                          data = JSON.parse(resText);
                        } catch {
                          data = null;
                        }

                        const diag = data?.diagnostico ? ` [${data.diagnostico}]` : '';
                        if (res.ok && data?.success) {
                          setNotaasStatus(
                            `${data.message || data.mensagem || 'Conectado com sucesso!'}${
                              data.empresa ? ` Empresa: ${data.empresa.razaoSocial} (${data.empresa.cnpj || ''})` : ''
                            }${diag}`
                          );
                        } else {
                          const errorMsg =
                            data?.message ||
                            data?.error ||
                            (res.status === 404
                              ? 'Endpoint /api/notaas/test-connection não encontrado no servidor.'
                              : `Erro HTTP ${res.status}: ${resText || 'Falha na resposta do servidor'}`);
                          const extra = data?.detalhes ? ` (${data.detalhes})` : '';
                          setNotaasError(`${errorMsg}${extra}${diag}`);
                        }
                      } catch (err: any) {
                        setNotaasError(`Falha de comunicação com o servidor da aplicação: ${err.message || 'Verifique sua conexão de rede'}`);
                      } finally {
                        setTestingNotaas(false);
                      }
                    }}
                    className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCcw className={`w-3.5 h-3.5 ${testingNotaas ? 'animate-spin' : ''}`} />
                    <span>{testingNotaas ? 'Validando...' : 'Testar Conexão Notaas'}</span>
                  </button>
                </div>

                {notaasStatus && (
                  <div className="p-3 bg-blue-50 border border-blue-300 rounded-lg text-blue-900 text-xs font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-700 shrink-0" />
                    <span>{notaasStatus}</span>
                  </div>
                )}

                {notaasError && (
                  <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-900 text-xs font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{notaasError}</span>
                  </div>
                )}
              </div>

              {/* Guia de Configuração no Painel Notaas */}
              <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-amber-950 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Configuração necessária no Notaas (Prevenção do Erro E0120):</span>
                </div>
                <p className="text-[11.5px] leading-relaxed text-amber-900">
                  No painel do Notaas (<strong>platform.notaas.com.br &gt; Empresa / Prestador</strong>), verifique o campo <strong>Inscrição Municipal</strong>.
                  Se o seu município não exige IM no convênio do Portal Nacional da NFS-e, a Receita Federal rejeita com <em>&quot;E0120: IM do prestador não deve ser informado, pois não existem informações complementares registradas no CNC NFS-e...&quot;</em>.
                </p>
                <p className="text-[11.5px] leading-relaxed text-amber-900 font-medium">
                  👉 <strong>Solução no Notaas:</strong> Apague o número da <em>Inscrição Municipal</em> no cadastro da sua empresa no Notaas (deixe o campo em branco e salve) para que as notas sejam autorizadas sem impedimento.
                </p>
              </div>

              <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200">
                💡 <strong>Emissão Automática:</strong> Sempre que você emitir uma nota imediatamente ou por agendamento, ela é transmitida diretamente para o seu painel em <code>platform.notaas.com.br</code> com os dados fiscais e cadastrais.
              </div>
            </div>
          )}

          {/* TAB 3: EMAIL */}
          {activeTab === 'EMAIL' && (
            <div className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-1">
                  <label className="block font-semibold text-slate-700 mb-1">Servidor SMTP:</label>
                  <input
                    type="text"
                    value={eSmtp}
                    onChange={(e) => setESmtp(e.target.value)}
                    placeholder="smtp.gmail.com"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono text-xs"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="block font-semibold text-slate-700 mb-1">Porta:</label>
                  <input
                    type="number"
                    value={ePorta}
                    onChange={(e) => setEPorta(parseInt(e.target.value, 10) || 587)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-900 text-xs"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="block font-semibold text-slate-700 mb-1">E-mail / Usuário:</label>
                  <input
                    type="email"
                    value={eUsuario}
                    onChange={(e) => setEUsuario(e.target.value)}
                    placeholder="seuemail@gmail.com"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Senha de App:</span>
                    <span className="text-[10px] text-blue-600 font-normal">Gmail (16 letras)</span>
                  </label>
                  <input
                    type="password"
                    value={eSenhaApp}
                    onChange={(e) => setESenhaApp(e.target.value)}
                    placeholder="ex: abcd efgh ijkl mnop"
                    className="w-full px-2.5 py-1.5 bg-white border border-blue-300 focus:ring-1 focus:ring-blue-500 rounded-lg font-mono text-slate-900 text-xs shadow-2xs"
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-200">
                💡 <strong>Como obter a Senha de Aplicativo no Gmail:</strong> Acesse sua <em>Conta Google &gt; Segurança &gt; Verificação em 2 etapas &gt; Senhas de app</em>, crie uma com o nome "AutoNFSe" e cole aqui o código de 16 caracteres gerado.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nome do Remetente:</label>
                  <input
                    type="text"
                    value={eRemetenteNome}
                    onChange={(e) => setERemetenteNome(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">E-mail Remetente:</label>
                  <input
                    type="email"
                    value={eRemetenteEmail}
                    onChange={(e) => setERemetenteEmail(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Enviar Cópia Oculta (BCC para contabilidade / outros e-mails):
                </label>
                <input
                  type="text"
                  value={eCopiaOculta}
                  onChange={(e) => setECopiaOculta(e.target.value)}
                  placeholder="fiscal@suaempresa.com.br, contabilidade@escritorio.com.br"
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Permite múltiplos e-mails separados por vírgula (,) ou ponto e vírgula (;).
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assunto do E-mail:</label>
                <input
                  type="text"
                  value={eAssunto}
                  onChange={(e) => setEAssunto(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                />
                <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px]">
                  <span className="text-slate-500 font-medium mr-1">Inserir no assunto:</span>
                  {[
                    { tag: '{numero_nfse}', label: 'Nº NFS-e' },
                    { tag: '{razao_social_cliente}', label: 'Cliente' },
                    { tag: '{mes_competencia}', label: 'Mês/Ano' },
                    { tag: '{periodo}', label: 'Período' },
                    { tag: '{valor_total}', label: 'Valor Total' },
                  ].map((item) => (
                    <button
                      type="button"
                      key={item.tag}
                      onClick={() => setEAssunto((prev) => (prev ? `${prev} ${item.tag}` : item.tag))}
                      className="px-1.5 py-0.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 rounded font-mono text-slate-700 transition-colors cursor-pointer"
                      title={`Clique para inserir no assunto: ${item.tag}`}
                    >
                      +{item.tag}
                    </button>
                  ))}
                </div>
                {eAssunto && eAssunto.includes('{') && (
                  <div className="mt-1 text-[11px] text-slate-700 font-mono bg-blue-50/60 p-1.5 rounded border border-blue-200/80">
                    <span className="font-semibold text-blue-900">Prévia do Assunto: </span>
                    {renderTemplateWithContext(eAssunto, {
                      cliente: { razaoSocial: 'NITNAVE SERVICOS NAVAIS LTDA', documento: '00000000000191' },
                      numeroNfse: '64',
                      valorServico: 3900,
                    })}
                  </div>
                )}
              </div>

              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                  <label className="block font-semibold text-slate-700">
                    Corpo da Mensagem (Texto do E-mail enviado aos clientes):
                  </label>
                  <span className="text-[10px] text-emerald-800 font-semibold bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCheck className="w-3 h-3 text-emerald-600" />
                    O e-mail enviado aos clientes respeita rigorosamente este modelo
                  </span>
                </div>
                <textarea
                  rows={8}
                  value={eCorpo}
                  onChange={(e) => setECorpo(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono text-[11px] text-slate-900 leading-relaxed"
                />

                <TemplateTagsHelper
                  onInsertTag={(tag) => setECorpo((prev) => (prev ? `${prev} ${tag}` : tag))}
                  previewText={eCorpo}
                  previewContext={{
                    cliente: {
                      razaoSocial: 'NITNAVE SERVICOS NAVAIS LTDA',
                      documento: '00000000000191',
                      email: 'fiscal@nitnave.com.br',
                      endereco: {
                        logradouro: 'Av. Feliciano Sodré',
                        numero: '300',
                        bairro: 'Centro',
                        municipio: 'Niterói',
                        uf: 'RJ',
                        cep: '24030012',
                      },
                      nomeContato: 'Roberto Ramos',
                    },
                    prestador: {
                      razaoSocial: pRazao || 'PRISCILA I PASSOS LTDA',
                      cnpj: pCnpj.replace(/\D/g, '') || '46874965000104',
                      email: eRemetenteEmail || 'priscilapassos.job@gmail.com',
                      telefone: pTelefone || '(31) 99813-1413',
                    },
                    servicoDescricao:
                      'Locação de Aparelho de medição de dureza MIC 10 (Sonda, cabo, ponteira removível, bloco padrão retangular e maleta de armazenamento) Período mensal de medição industrial.',
                    numeroNfse: '64',
                    numeroDps: '21',
                    serieDps: '1608',
                    chaveAcesso: '3106200468749650001045590000000000010000000064',
                    codigoVerificacao: 'NFS-64B8',
                    valorServico: 3900.0,
                    aliquotaIss: 0.0,
                  }}
                  previewTitle="Visualização do E-mail que chegará ao Cliente (respeitando o modelo acima):"
                  targetFieldLabel="corpo do e-mail"
                />

                <div className="p-2.5 bg-emerald-50/90 border border-emerald-300/80 rounded-lg text-[11px] text-emerald-950 flex items-start gap-2 shadow-2xs">
                  <span className="text-sm">💡</span>
                  <div>
                    <strong>Discriminação dos Serviços e Disparo de E-mail Unificados:</strong> As mesmas tags (como <code>{'{mes_competencia}'}</code>, <code>{'{periodo}'}</code>, <code>{'{razao_social_cliente}'}</code>, <code>{'{cnpj_cliente}'}</code>, <code>{'{valor_total}'}</code>, etc.) funcionam de forma idêntica tanto no <strong>Texto do E-mail</strong> quanto na <strong>Discriminação dos Serviços</strong> em agendamentos e emissões imediatas, atualizadas a cada mês automaticamente.
                  </div>
                </div>
              </div>

              {/* Botão e Painel de Teste de Envio de E-mail */}
              <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-lg space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-blue-950 text-xs flex items-center gap-1.5">
                      <Mail className="w-4 h-4 text-blue-700" />
                      <span>Testar Envio Real de E-mail:</span>
                    </div>
                    <p className="text-[11px] text-blue-800 mt-0.5">
                      Dispara uma mensagem de verificação com modelo de anexo da NFS-e para validar seu SMTP e recebimento na caixa de entrada.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={sendingTestEmail}
                    onClick={async () => {
                      if (!testEmailDestino || !testEmailDestino.includes('@')) {
                        alert('Por favor, informe um endereço de e-mail válido para o teste.');
                        return;
                      }

                      if (!eSenhaApp) {
                        setTestEmailResult({
                          sucesso: false,
                          mensagem: 'Atenção: O campo "Senha de App" está vazio! O Gmail bloqueia conexões sem a Senha de Aplicativo de 16 caracteres. Preencha o campo "Senha de App" acima e clique em Salvar.',
                        });
                        return;
                      }

                      setSendingTestEmail(true);
                      setTestEmailResult(null);

                      try {
                        const sampleNotaParaTeste = {
                          numero: 'TESTE-2026',
                          serie: '900',
                          dpsNumero: '000000001',
                          dpsSerie: '70000',
                          chaveAcesso: '3106200468749650001045590000000000010000000012',
                          codigoVerificacao: 'TST-2026',
                          dataEmissao: new Date().toISOString(),
                          dataCompetencia: '2026-09',
                          status: 'AUTORIZADA',
                          prestador: {
                            cnpj: pCnpj.replace(/\D/g, '') || '46874965000104',
                            razaoSocial: pRazao || 'PRISCILA I PASSOS LTDA',
                            inscricaoMunicipal: pIm || 'Isento',
                            email: eRemetenteEmail || 'priscilapassos.job@gmail.com',
                            telefone: pTelefone || '(31) 99813-1413',
                            regimeTributario: pRegime || 'SIMPLES_NACIONAL',
                            ambienteEmissao: pAmbiente || 'HOMOLOGACAO',
                            endereco: {
                              logradouro: pLogradouro || 'Rua Principal',
                              numero: pNumero || '100',
                              bairro: pBairro || 'Centro',
                              municipio: pMunicipio || 'Belo Horizonte',
                              uf: pUf || 'MG',
                              cep: pCep.replace(/\D/g, '') || '30100000',
                              codigoMunicipio: pIbge || '3106200',
                            },
                          },
                          tomador: {
                            documento: '00000000000191',
                            tipoInscricao: 'CNPJ',
                            razaoSocial: 'Destinatário de Teste de E-mail',
                            email: testEmailDestino,
                            endereco: {
                              logradouro: 'Av. Teste',
                              numero: '500',
                              bairro: 'Centro',
                              municipio: 'Belo Horizonte',
                              uf: 'MG',
                              cep: '30100000',
                              codigoMunicipio: '3106200',
                            },
                          },
                          servico: {
                            codigoTributacaoNacional: '01.07.01',
                            itemLC116: '1.07',
                            cnae: '6202-3/00',
                            descricao: 'Demonstração de teste de envio de NFS-e Nacional com DANFSE (PDF) e XML anexados.',
                            localPrestacaoMunicipio: pMunicipio || 'Belo Horizonte',
                            localPrestacaoUf: pUf || 'MG',
                          },
                          impostos: {
                            valorServicos: 1500.0,
                            aliquotaIss: 2.0,
                            valorIss: 30.0,
                            baseCalculo: 1500.0,
                            issRetido: false,
                            valorLiquido: 1500.0,
                            valorPis: 0,
                            valorCofins: 0,
                            valorInss: 0,
                            valorIr: 0,
                            valorCsll: 0,
                            totalRetencoes: 0,
                            descontoIncondicionado: 0,
                            valorDeducoes: 0,
                          },
                          xmlConteudo: '<?xml version="1.0" encoding="UTF-8"?><NFSe><infNFSe id="TESTE"><numero>TESTE-2026</numero></infNFSe></NFSe>',
                        };

                        // Salva imediatamente para persistir qualquer edição feita pelo usuário no modelo
                        const cleanUser = eUsuario.trim();
                        const cleanRemetente = eRemetenteEmail.trim();
                        const cleanBcc = eCopiaOculta.trim();
                        const cleanSenha = eSenhaApp.replace(/[\s\-]/g, '').toLowerCase();

                        const currentEmailConfig: EmailConfig = {
                          provedor: eProvedor,
                          servidorSmtp: eSmtp.trim(),
                          porta: Number(ePorta),
                          usuario: cleanUser,
                          senhaApp: cleanSenha,
                          remetenteNome: eRemetenteNome.trim(),
                          remetenteEmail: cleanRemetente,
                          enviarCopiaOculta: cleanBcc,
                          assuntoTemplate: eAssunto,
                          corpoTemplate: eCorpo,
                        };
                        storageService.saveEmailConfig(currentEmailConfig);
                        onSaveEmailConfig(currentEmailConfig);

                        // Renderiza o corpo e assunto reais configurados pelo usuário
                        const corpoPersonalizado = AutomationRunner.renderTemplate(eCorpo, sampleNotaParaTeste as any);
                        const assuntoPersonalizado = `[TESTE] ${AutomationRunner.renderTemplate(eAssunto, sampleNotaParaTeste as any)}`;

                        const res = await fetch('/api/send-email', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            servidorSmtp: eSmtp,
                            porta: ePorta,
                            usuario: cleanUser,
                            senhaApp: cleanSenha,
                            remetenteNome: eRemetenteNome,
                            remetenteEmail: cleanRemetente,
                            destinatario: testEmailDestino,
                            assunto: assuntoPersonalizado,
                            corpo: corpoPersonalizado,
                            nota: sampleNotaParaTeste, // Anexa automaticamente o DANFSE em PDF oficial e o XML
                          }),
                        });

                        const resText = await res.text();
                        let data: any = null;
                        try {
                          data = JSON.parse(resText);
                        } catch {
                          data = null;
                        }

                        if (res.ok && data?.success) {
                          setTestEmailResult({
                            sucesso: true,
                            mensagem: `✅ E-mail transmitido com sucesso para ${testEmailDestino} com DANFSE (PDF) e XML anexados! O servidor do Gmail confirmou o envio (ID: ${data.messageId || 'OK'}). Verifique sua caixa de entrada e spam.`,
                          });
                        } else {
                          const errMsg = data?.error || (res.status >= 500 ? `O servidor retornou HTTP ${res.status}. Verifique se a Senha de Aplicativo de 16 letras foi gerada no Google.` : resText || 'Erro desconhecido ao autenticar no servidor SMTP.');
                          setTestEmailResult({
                            sucesso: false,
                            mensagem: `❌ Falha ao enviar: ${errMsg}`,
                          });
                        }
                      } catch (err: any) {
                        setTestEmailResult({
                          sucesso: false,
                          mensagem: `❌ Erro de conexão com o servidor de e-mail: ${err.message || 'Falha ao contatar a API local.'}`,
                        });
                      } finally {
                        setSendingTestEmail(false);
                      }
                    }}
                    className="px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-medium rounded-lg text-xs transition-colors shadow-2xs flex items-center gap-1.5 self-start sm:self-auto cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    <Send className={`w-3.5 h-3.5 ${sendingTestEmail ? 'animate-bounce' : ''}`} />
                    <span>{sendingTestEmail ? 'Enviando E-mail...' : 'Testar Envio de E-mail'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <label className="text-xs font-semibold text-slate-700 shrink-0">E-mail de Destino do Teste:</label>
                  <input
                    type="email"
                    value={testEmailDestino}
                    onChange={(e) => setTestEmailDestino(e.target.value)}
                    placeholder="seuemail@gmail.com"
                    className="flex-1 px-2.5 py-1 bg-white border border-slate-300 rounded text-xs text-slate-900 font-medium"
                  />
                </div>

                {testEmailResult && (
                  <div className={`p-2.5 rounded-lg border text-xs flex items-start gap-2 ${
                    testEmailResult.sucesso
                      ? 'bg-blue-100/80 border-blue-300 text-blue-900'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}>
                    {testEmailResult.sucesso ? (
                      <CheckCircle2 className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <span className="font-medium">{testEmailResult.mensagem}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: VERCEL & SUPABASE */}
          {activeTab === 'SUPABASE' && (
            <div className="space-y-4">
              {/* Header Box */}
              <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-slate-950 text-white p-4 rounded-xl border border-blue-800/40 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-blue-500/10 rounded-lg border border-blue-500/30 text-blue-400 shrink-0">
                      <Database className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-blue-300 flex items-center gap-2">
                        <span>Supabase & Vercel — Armazenamento & Hospedagem</span>
                      </h4>
                      <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                        Sistema preparado para deploy na Vercel com persistência completa de metadados, notas fiscais, clientes e agendamentos no banco Supabase.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5 bg-blue-500/20 text-blue-300 border border-blue-500/40">
                      <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                      Pronto para Vercel
                    </span>
                  </div>
                </div>

                {lastSyncTime && (
                  <div className="mt-3 pt-2.5 border-t border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>Última sincronização com Supabase: <strong className="text-slate-200">{new Date(lastSyncTime).toLocaleString('pt-BR')}</strong></span>
                  </div>
                )}
              </div>

              {/* Form de Conexão Supabase */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3.5">
                <h5 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-700" />
                  <span>Credenciais do Banco de Metadados (Supabase)</span>
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      URL da API Supabase (Endpoint):
                    </label>
                    <input
                      type="text"
                      value={sbUrl}
                      onChange={(e) => setSbUrl(e.target.value)}
                      placeholder="https://gcpvceeaeyeufofntmwc.supabase.co"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-slate-900 text-xs"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      Suporta tanto a URL raiz quanto com /rest/v1/
                    </span>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Chave da API (Publishable / Anon Key):
                    </label>
                    <input
                      type="text"
                      value={sbKey}
                      onChange={(e) => setSbKey(e.target.value)}
                      placeholder="sb_publishable_..."
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-slate-900 text-xs"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      Chave de publicação para leitura e gravação segura de metadados
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Tabela de Metadados no Supabase:
                    </label>
                    <input
                      type="text"
                      value={sbTable}
                      onChange={(e) => setSbTable(e.target.value)}
                      placeholder="autonfse_metadata"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-slate-900 text-xs"
                    />
                    <span className="text-[10px] text-blue-700 mt-0.5 block font-medium">
                      ✓ Tabela exclusiva &quot;autonfse_metadata&quot; isolada e ativa no seu banco Supabase
                    </span>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Identificador de Registro (Row Key):
                    </label>
                    <input
                      type="text"
                      value={sbRowKey}
                      onChange={(e) => setSbRowKey(e.target.value)}
                      placeholder="autonfse_system_metadata"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-slate-900 text-xs"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      Agrupa todos os metadados do AutoNFS-e de forma atômica
                    </span>
                  </div>
                </div>

                {/* Sincronização automática */}
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={sbAutoSync}
                      onChange={(e) => setSbAutoSync(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    <div>
                      <span className="font-semibold text-slate-900 block text-xs">
                        Sincronização Automática em Tempo Real (Auto-Save)
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        Salva instantaneamente no Supabase qualquer nota emitida, alteração de cliente ou agendamento
                      </span>
                    </div>
                  </label>

                  <button
                    type="button"
                    disabled={testingSb || !sbUrl.trim() || !sbKey.trim()}
                    onClick={async () => {
                      setTestingSb(true);
                      setSbStatus(null);
                      setSbError(null);
                      try {
                        const result = await supabaseService.testConnection(sbUrl, sbKey);
                        if (result.sucesso) {
                          setSbStatus(`✅ ${result.mensagem}`);
                        } else {
                          setSbError(`❌ ${result.mensagem}`);
                        }
                      } catch (err: any) {
                        setSbError(`Erro ao testar: ${err.message}`);
                      } finally {
                        setTestingSb(false);
                      }
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    <RefreshCcw className={`w-3.5 h-3.5 ${testingSb ? 'animate-spin' : ''}`} />
                    <span>{testingSb ? 'Testando...' : 'Testar Conexão Supabase'}</span>
                  </button>
                </div>

                {/* Feedback do Teste */}
                {sbStatus && (
                  <div className="p-2.5 bg-blue-100/80 border border-blue-300 rounded-lg text-blue-900 text-xs font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-700 shrink-0" />
                    <span>{sbStatus}</span>
                  </div>
                )}

                {sbError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-lg text-rose-900 text-xs font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{sbError}</span>
                  </div>
                )}
              </div>

              {/* Botões de Ação de Sincronização Manual */}
              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h5 className="font-bold text-blue-950 text-xs flex items-center gap-1.5">
                      <Cloud className="w-4 h-4 text-blue-700" />
                      <span>Sincronização Manual dos Metadados</span>
                    </h5>
                    <p className="text-[11px] text-blue-800 mt-0.5">
                      Transfira todos os cadastros (prestador, clientes, serviços, agendamentos e histórico fiscal) entre o armazenamento local e o Supabase.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={syncingSb}
                      onClick={async () => {
                        setSyncingSb(true);
                        setSbSyncFeedback(null);
                        try {
                          const snapshot = storageService.getAllMetadataSnapshot();
                          const ok = await supabaseService.pushMetadata(snapshot);
                          if (ok) {
                            setLastSyncTime(new Date().toISOString());
                            setSbSyncFeedback({
                              sucesso: true,
                              mensagem: 'Todos os metadados foram enviados e salvos com sucesso no Supabase!',
                            });
                          } else {
                            setSbSyncFeedback({
                              sucesso: false,
                              mensagem: 'Falha ao salvar no Supabase. Verifique a URL e a Chave.',
                            });
                          }
                        } catch (err: any) {
                          setSbSyncFeedback({
                            sucesso: false,
                            mensagem: `Erro: ${err.message}`,
                          });
                        } finally {
                          setSyncingSb(false);
                        }
                      }}
                      className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Cloud className={`w-3.5 h-3.5 ${syncingSb ? 'animate-bounce' : ''}`} />
                      <span>{syncingSb ? 'Sincronizando...' : 'Enviar para Supabase'}</span>
                    </button>

                    <button
                      type="button"
                        disabled={syncingSb}
                        onClick={async () => {
                          if (!confirm('Deseja puxar os dados salvos na nuvem Supabase e atualizar a visualização local?')) return;
                          setSyncingSb(true);
                          setSbSyncFeedback(null);
                          try {
                            const remote = await supabaseService.pullMetadata();
                            if (remote) {
                              storageService.applyRemoteMetadata(remote);
                              if (onRefreshAllData) onRefreshAllData();
                              setLastSyncTime(new Date().toISOString());
                              setSbSyncFeedback({
                                sucesso: true,
                                mensagem: 'Metadados restaurados do Supabase com sucesso!',
                              });
                            } else {
                              storageService.garantirDadosOficiais();
                              if (onRefreshAllData) onRefreshAllData();
                              setSbSyncFeedback({
                                sucesso: true,
                                mensagem: 'Cadastros oficiais restaurados no navegador (NFS-e 64, 63, NITNAVE).',
                              });
                            }
                          } catch (err: any) {
                            setSbSyncFeedback({
                              sucesso: false,
                              mensagem: `Erro: ${err.message}`,
                            });
                          } finally {
                            setSyncingSb(false);
                          }
                        }}
                        className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCcw className={`w-3.5 h-3.5 ${syncingSb ? 'animate-spin' : ''}`} />
                        <span>Puxar do Supabase</span>
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm('Deseja restaurar e consolidar os dados fiscais oficiais (NFS-e 64 autorizada, NFS-e 63, cliente NITNAVE e agendamento MIC 10) tanto localmente quanto na nuvem?')) return;
                          setSyncingSb(true);
                          setSbSyncFeedback(null);
                          try {
                            storageService.garantirDadosOficiais();
                            const snapshot = storageService.getAllMetadataSnapshot();
                            await supabaseService.pushMetadata(snapshot);
                            if (onRefreshAllData) onRefreshAllData();
                            setLastSyncTime(new Date().toISOString());
                            setSbSyncFeedback({
                              sucesso: true,
                              mensagem: 'Dados oficiais consolidados e salvos na nuvem com sucesso! (NFS-e 64, 63, NITNAVE e Agendamento ativos).',
                            });
                          } catch (err: any) {
                            setSbSyncFeedback({
                              sucesso: false,
                              mensagem: `Erro: ${err.message}`,
                            });
                          } finally {
                            setSyncingSb(false);
                          }
                        }}
                        className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        title="Restaura e consolida as notas reais Nº 64 e 63, cliente NITNAVE e agendamento"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Restaurar Dados Oficiais</span>
                      </button>
                    </div>
                  </div>

                  {sbSyncFeedback && (
                    <div className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                      sbSyncFeedback.sucesso
                        ? 'bg-blue-100 border-blue-300 text-blue-900 font-medium'
                        : 'bg-rose-50 border-rose-300 text-rose-900'
                    }`}>
                      {sbSyncFeedback.sucesso ? (
                        <CheckCircle2 className="w-4 h-4 text-blue-700 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      )}
                      <span>{sbSyncFeedback.mensagem}</span>
                    </div>
                  )}
                </div>

                {/* Guia de Hospedagem na Vercel */}
                <div className="bg-slate-900 text-slate-100 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="font-bold text-xs text-white flex items-center gap-2">
                      <Server className="w-4 h-4 text-sky-400" />
                      <span>Hospedagem na Vercel — Conexão & Persistência</span>
                    </h5>
                    <span className="text-[10px] px-2 py-0.5 bg-sky-950 text-sky-300 border border-sky-800 rounded font-mono">
                      vercel.json & api/index.js configurados
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    O projeto está 100% configurado para a Vercel com roteamento serverless em <code>api/index.js</code> e rewrites em <code>vercel.json</code>. Todos os dados fiscais e cadastros estão centralizados e persistidos no Supabase.
                  </p>

                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-semibold text-slate-200">Variáveis de Ambiente na Vercel (Project Settings &gt; Environment Variables):</span>
                    </div>

                    <div className="font-mono text-[11px] text-blue-400 space-y-1 bg-black/40 p-2.5 rounded border border-slate-800">
                      <div>VITE_SUPABASE_URL=https://gcpvceeaeyeufofntmwc.supabase.co</div>
                      <div>VITE_SUPABASE_ANON_KEY=sb_publishable_INQR2qlr9so3jznxFhIzMA_ccbtG9b3</div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <button
                      type="button"
                      disabled={testingVercel}
                      onClick={handleTestVercel}
                      className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 self-start"
                    >
                      <RefreshCcw className={`w-3.5 h-3.5 ${testingVercel ? 'animate-spin' : ''}`} />
                      <span>{testingVercel ? 'Testando Conexão...' : 'Testar Conexão Vercel & Supabase'}</span>
                    </button>

                    <span className="text-[11px] text-slate-400">
                      Valida as rotas /api/* e a leitura do Supabase
                    </span>
                  </div>

                  {vercelDiag && (
                    <div className={`p-3 rounded-lg border text-xs space-y-2 ${
                      vercelDiag.success
                        ? 'bg-sky-950/80 border-sky-700 text-sky-200'
                        : 'bg-rose-950/80 border-rose-700 text-rose-200'
                    }`}>
                      <div className="font-bold flex items-center gap-1.5">
                        {vercelDiag.success ? (
                          <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        )}
                        <span>{vercelDiag.success ? 'Conexão Estabelecida com Sucesso!' : 'Falha no Teste de Conexão'}</span>
                      </div>

                      {vercelDiag.supabase && (
                        <div className="space-y-1.5 pt-1 text-slate-300">
                          <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                            <div>Ambiente: <strong>{vercelDiag.platform}</strong></div>
                            <div>Supabase: <strong className="text-emerald-400">Conectado (200 OK)</strong></div>
                            <div>Total de Notas: <strong className="text-white">{vercelDiag.supabase.totalNotas}</strong></div>
                            <div>Clientes: <strong className="text-white">{vercelDiag.supabase.totalClientes}</strong></div>
                            <div>Agendamentos: <strong className="text-white">{vercelDiag.supabase.totalAgendamentos}</strong></div>
                            <div>Empresa: <strong className="text-white">{vercelDiag.supabase.prestador}</strong></div>
                          </div>

                          {Array.isArray(vercelDiag.supabase.notas) && vercelDiag.supabase.notas.length > 0 && (
                            <div className="pt-1.5 border-t border-slate-800">
                              <span className="text-[10px] text-slate-400 font-semibold block mb-1">Notas Fiscais Armazenadas na Nuvem:</span>
                              <div className="flex flex-wrap gap-1.5">
                                {vercelDiag.supabase.notas.map((n: any, idx: number) => (
                                  <span key={idx} className="px-2 py-0.5 rounded bg-blue-900/60 border border-blue-700 text-[10.5px] font-mono text-blue-200">
                                    NFS-e Nº {n.numero} ({n.status})
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {Array.isArray(vercelDiag.supabase.clientes) && vercelDiag.supabase.clientes.length > 0 && (
                            <div className="pt-1">
                              <span className="text-[10px] text-slate-400 font-semibold block">Cliente Cadastrado:</span>
                              <span className="text-[10.5px] font-mono text-emerald-300">
                                {vercelDiag.supabase.clientes.join(', ')}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                      {vercelDiag.error && (
                        <p className="text-rose-300 font-mono text-[11px]">{vercelDiag.error}</p>
                      )}
                    </div>
                  )}
              </div>

              {/* Schema SQL Opcional para o Supabase */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <span>Schema SQL Oficial do Supabase (Opcional)</span>
                    </h5>
                    <p className="text-[11px] text-slate-500">
                      O app opera de forma 100% isolada utilizando a tabela exclusiva <code>autonfse_metadata</code> no Supabase.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const sql = supabaseService.getSqlSchemaScript();
                      navigator.clipboard.writeText(sql);
                      setCopiedSql(true);
                      setTimeout(() => setCopiedSql(false), 2500);
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer shrink-0 shadow-2xs"
                  >
                    {copiedSql ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-blue-600" />
                        <span className="text-blue-700">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar SQL</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="max-h-28 overflow-y-auto bg-slate-900 text-slate-300 font-mono text-[10.5px] p-2.5 rounded-lg border border-slate-800">
                  <pre>{supabaseService.getSqlSchemaScript()}</pre>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: LOGS DO ROBÔ */}
          {activeTab === 'LOGS' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <span>Auditoria e Histórico de Transmissões do Robô</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      isRobotActive ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {isRobotActive ? 'Automação Ativa' : 'Robô Pausado'}
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Registros detalhados de cada transmissão enviada à Notaas, chaves geradas e e-mails entregues.
                  </p>
                </div>

                {onClearLogs && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Deseja limpar todos os registros de logs?')) {
                        onClearLogs();
                      }
                    }}
                    className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-300 rounded-lg flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Limpar Logs</span>
                  </button>
                )}
              </div>

              {/* Filtro de Logs */}
              <div className="flex flex-wrap gap-1">
                {[
                  { id: 'ALL', label: 'Todos' },
                  { id: 'EMISSAO_NFSE', label: 'NFS-e (Notaas)' },
                  { id: 'EMAIL', label: 'Disparo de E-mails' },
                  { id: 'AGENDAMENTO', label: 'Agendamentos' },
                  { id: 'SISTEMA', label: 'Sistema' },
                ].map((cat) => (
                  <button
                    type="button"
                    key={cat.id}
                    onClick={() => setLogFilter(cat.id)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                      logFilter === cat.id
                        ? 'bg-slate-900 text-white font-semibold'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Feed de Logs */}
              <div className="bg-slate-950 text-slate-200 rounded-xl border border-slate-800 p-3.5 font-mono text-[11px] shadow-inner max-h-[380px] overflow-y-auto space-y-2.5">
                {logs.filter((l) => logFilter === 'ALL' || l.tipo === logFilter).length === 0 ? (
                  <div className="text-center py-8 text-slate-500 font-sans text-xs">
                    Nenhum registro de log para o filtro selecionado.
                  </div>
                ) : (
                  logs
                    .filter((l) => logFilter === 'ALL' || l.tipo === logFilter)
                    .map((log) => {
                      const isSuccess = log.nivel === 'SUCESSO';
                      const isWarn = log.nivel === 'AVISO';
                      const isErr = log.nivel === 'ERRO';

                      return (
                        <div
                          key={log.id}
                          className="border-b border-slate-800/80 pb-2 last:border-0 hover:bg-slate-900/50 p-1 rounded"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`font-bold ${
                                  isSuccess
                                    ? 'text-blue-400'
                                    : isWarn
                                    ? 'text-amber-400'
                                    : isErr
                                    ? 'text-rose-400'
                                    : 'text-cyan-400'
                                }`}
                              >
                                [{log.tipo}]
                              </span>
                              <span className="text-slate-500 font-mono">
                                {formatDateTime(log.timestamp)}
                              </span>
                            </div>

                            {log.referenciaId && (
                              <span className="text-[10px] text-slate-500 bg-slate-900 px-1.5 py-0.2 rounded border border-slate-800 font-mono">
                                Ref: {log.referenciaId}
                              </span>
                            )}
                          </div>

                          <div className="mt-1 text-slate-200 text-xs font-sans leading-relaxed break-words">
                            {log.mensagem}
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          )}

          {/* Feedback alert */}
          {savedAlert && (
            <div className="bg-blue-50 text-blue-800 p-2.5 rounded-lg border border-blue-200 flex items-center gap-2">
              <Check className="w-4 h-4 text-blue-600" />
              <span>Configurações salvas com sucesso!</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (confirm('Deseja recarregar todos os dados diretamente do Supabase?')) {
                    onResetSampleData();
                  }
                }}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1.5 cursor-pointer"
                title="Recarregar dados oficiais do Supabase"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                <span>Recarregar do Supabase</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Salvar Configurações</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
