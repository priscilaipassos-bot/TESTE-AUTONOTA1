import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles, CheckCircle2, Loader2, FileText, Mail } from 'lucide-react';
import { TomadorCliente, ServicoItem, NfseDocument, PrestadorConfig } from '../types/nfse';
import { AutomationRunner } from '../services/automationRunner';
import { storageService } from '../services/storageService';
import { formatDynamicDescription } from '../utils/periodHelper';
import { parseMultipleEmails } from '../utils/emailHelper';
import { renderTemplateWithContext } from '../utils/templateHelper';
import { TemplateTagsHelper } from './TemplateTagsHelper';
import { Settings, ShieldCheck, KeyRound } from 'lucide-react';

interface EmitNowModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientes: TomadorCliente[];
  servicos: ServicoItem[];
  prestador: PrestadorConfig;
  onOpenNewClient: () => void;
  onOpenSettings: () => void;
  onNotaEmitida: (nota: NfseDocument) => void;
}

export const EmitNowModal: React.FC<EmitNowModalProps> = ({
  isOpen,
  onClose,
  clientes,
  servicos,
  prestador,
  onOpenNewClient,
  onOpenSettings,
  onNotaEmitida,
}) => {
  const [clienteId, setClienteId] = useState('');
  const [servicoDescricao, setServicoDescricao] = useState('');
  const [codigoTributacaoNacional, setCodigoTributacaoNacional] = useState('99.01.01');
  const [itemLC116, setItemLC116] = useState('99.01');
  const [valorServico, setValorServico] = useState<number>(3900);
  const [aliquotaIss, setAliquotaIss] = useState<number>(0.0);
  const [issRetido, setIssRetido] = useState(false);
  const [reterImpostosFederais, setReterImpostosFederais] = useState(false);
  const [informacoesComplementares, setInformacoesComplementares] = useState(
    'EMPRESA OPTANTE PELO SIMPLES NACIONAL. OPERAÇÃO FORA DO CAMPO DE INCIDÊNCIA DO ISSQN (LOCAÇÃO DE BENS MÓVEIS CONFORME SÚMULA VINCULANTE 31 DO STF).'
  );

  const [enviarEmail, setEnviarEmail] = useState(true);
  const [emailDestinatarios, setEmailDestinatarios] = useState('');
  const [numeroDps, setNumeroDps] = useState(() => storageService.getNextNumeroDps() || '21');
  const [serieDps, setSerieDps] = useState(() => prestador.serieDps || '1608');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stepMessage, setStepMessage] = useState('');

  const prevOpenRef = useRef(false);
  const descricaoTextareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInsertTag = (tag: string) => {
    const el = descricaoTextareaRef.current;
    if (el) {
      const start = el.selectionStart || 0;
      const end = el.selectionEnd || 0;
      const before = servicoDescricao.substring(0, start);
      const after = servicoDescricao.substring(end);
      const newText = `${before}${tag}${after}`;
      setServicoDescricao(newText);
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + tag.length, start + tag.length);
      }, 50);
    } else {
      setServicoDescricao((prev) => (prev ? `${prev} ${tag}` : tag));
    }
  };

  useEffect(() => {
    // APENAS inicializa quando o modal abrir pela primeira vez (transição de false -> true)
    // NUNCA reseta enquanto o usuário estiver digitando no formulário!
    if (isOpen && !prevOpenRef.current) {
      setNumeroDps(storageService.getNextNumeroDps() || '21');
      setSerieDps(prestador.serieDps || '1608');
      if (clientes.length > 0 && (!clienteId || !clientes.some((c) => c.id === clienteId))) {
        setClienteId(clientes[0].id);
        setEmailDestinatarios(clientes[0].email || '');
      }
      if (servicos.length > 0 && !servicoDescricao) {
        const srv = servicos[0];
        const descDin = formatDynamicDescription(srv.descricaoPadrao, new Date());
        setServicoDescricao(descDin);
        setCodigoTributacaoNacional(srv.codigoTributacaoNacional);
        setItemLC116(srv.codigoItemLC116);
        setValorServico(srv.valorPadrao);
        setAliquotaIss(srv.aliquotaIss);
        if (srv.codigoTributacaoNacional === '99.01.01') {
          setInformacoesComplementares(
            'EMPRESA OPTANTE PELO SIMPLES NACIONAL. OPERAÇÃO FORA DO CAMPO DE INCIDÊNCIA DO ISSQN (LOCAÇÃO DE BENS MÓVEIS CONFORME SÚMULA VINCULANTE 31 DO STF).'
          );
        }
      }
    }
    prevOpenRef.current = isOpen;
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectPredefinedService = (srvId: string) => {
    const srv = servicos.find((s) => s.id === srvId);
    if (srv) {
      const descDin = formatDynamicDescription(srv.descricaoPadrao, new Date());
      setServicoDescricao(descDin);
      setCodigoTributacaoNacional(srv.codigoTributacaoNacional);
      setItemLC116(srv.codigoItemLC116);
      setValorServico(srv.valorPadrao);
      setAliquotaIss(srv.aliquotaIss);
      if (srv.codigoTributacaoNacional === '99.01.01') {
        setInformacoesComplementares(
          'EMPRESA OPTANTE PELO SIMPLES NACIONAL. OPERAÇÃO FORA DO CAMPO DE INCIDÊNCIA DO ISSQN (LOCAÇÃO DE BENS MÓVEIS CONFORME SÚMULA VINCULANTE 31 DO STF).'
        );
      } else {
        setInformacoesComplementares('Documento emitido nos termos da Lei Complementar nº 123/2006 (Simples Nacional).');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cliente = clientes.find((c) => c.id === clienteId);
    if (!cliente) {
      alert('Selecione um cliente tomador válido.');
      return;
    }

    setIsSubmitting(true);
    setStepMessage('1. Preparando dados fiscais da NFS-e...');

    try {
      await new Promise((r) => setTimeout(r, 300));
      setStepMessage('2. Transmitindo via API Notaas (platform.notaas.com.br)...');

      const clienteComEmails = {
        ...cliente,
        email: emailDestinatarios.trim() || cliente.email,
      };

      const result = await AutomationRunner.emitirNfse(
        clienteComEmails,
        servicoDescricao,
        codigoTributacaoNacional,
        itemLC116,
        valorServico,
        aliquotaIss,
        issRetido,
        reterImpostosFederais,
        informacoesComplementares,
        undefined,
        enviarEmail,
        numeroDps.trim(),
        serieDps.trim()
      );

      if (result.sucesso && result.nota) {
        setStepMessage('3. NFS-e Autorizada! Enviando E-mail com DANFSE (PDF) e XML...');
        await new Promise((r) => setTimeout(r, 400));
        onNotaEmitida(result.nota);
        onClose();
      } else {
        alert(result.erro || 'Erro ao emitir nota.');
      }
    } catch (err: any) {
      alert(`Falha na transmissão: ${err?.message || err}`);
    } finally {
      setIsSubmitting(false);
      setStepMessage('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Emissão Imediata via Notaas</span>
              <span className="text-[10px] font-mono bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-semibold">
                API Notaas
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Transmite a nota oficial através do Notaas e envia o DANFSE (PDF) e XML por E-mail ao cliente
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-4 text-xs">
          {/* Status da Conexão Fiscal */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
              <div>
                <span className="font-semibold text-slate-800 block text-[11px]">
                  Canal Fiscal: {prestador.apiKeyNotas ? '🚀 Notaas API Ativo' : '⚠️ Chave Notaas Pendente'}
                </span>
                <span className="text-[10px] text-slate-500">
                  {prestador.apiKeyNotas
                    ? `Chave Notaas configurada (${prestador.apiKeyNotas.substring(0, 10)}...). Transmissão direta para platform.notaas.com.br`
                    : 'Atenção: Configure sua chave Notaas (ntaas_*) nas Configurações para emissão direta.'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenSettings}
              className="px-2.5 py-1 text-[10.5px] font-semibold text-blue-800 bg-blue-50 border border-blue-300 rounded hover:bg-blue-100 flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <Settings className="w-3 h-3 text-blue-700" />
              <span>Configurar</span>
            </button>
          </div>

          {/* Cliente Selection */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-700">Cliente:</label>
              <button
                type="button"
                onClick={onOpenNewClient}
                className="text-blue-700 hover:underline font-medium text-[11px]"
              >
                + Novo Cliente
              </button>
            </div>
            <select
              required
              value={clienteId}
              onChange={(e) => {
                const newId = e.target.value;
                setClienteId(newId);
                const found = clientes.find((c) => c.id === newId);
                if (found) {
                  setEmailDestinatarios(found.email);
                }
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white text-slate-900 text-xs"
            >
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.razaoSocial} — {c.email}
                </option>
              ))}
            </select>

            {/* Múltiplos e-mails de envio da nota */}
            <div className="mt-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-600" />
                  <span>E-mails para Envio da NFS-e (permite múltiplos):</span>
                </label>
                <span className="text-[10.5px] text-blue-700 font-medium">
                  Separar por vírgula (,) ou ponto e vírgula (;)
                </span>
              </div>
              <input
                type="text"
                required
                placeholder="preposto@empresa.com, financeiro@empresa.com, fiscal@empresa.com"
                value={emailDestinatarios}
                onChange={(e) => setEmailDestinatarios(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-mono text-slate-900 focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Carregado do tomador selecionado. Você pode acrescentar ou alterar os e-mails para esta emissão.
              </span>

              {parseMultipleEmails(emailDestinatarios).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {parseMultipleEmails(emailDestinatarios).map((em, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 border border-blue-200 text-blue-800 rounded text-[10px] font-mono"
                    >
                      <CheckCircle2 className="w-2.5 h-2.5 text-blue-600" />
                      <span>{em}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Modelos de Serviço */}
          <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>Modelos de Serviço Pré-definidos:</span>
              </span>
              <span className="text-[10px] text-blue-700 font-semibold bg-blue-100 px-2 py-0.5 rounded-full">
                Clique para preencher tudo
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {servicos.map((srv) => {
                const isSelected = codigoTributacaoNacional === srv.codigoTributacaoNacional;
                const isNac99 = srv.codigoTributacaoNacional === '99.01.01';
                return (
                  <button
                    type="button"
                    key={srv.id}
                    onClick={() => handleSelectPredefinedService(srv.id)}
                    className={`text-left p-2.5 rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : isNac99
                        ? 'bg-white border-blue-300 text-slate-800 hover:border-blue-500 hover:bg-blue-50'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono font-bold text-xs mb-1">
                      <span>{srv.codigoTributacaoNacional}</span>
                      <span className={`text-[10px] font-sans px-1.5 py-0.2 rounded font-medium ${
                        isSelected ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {isNac99 ? 'Isento ISS (Locação)' : `ISS ${srv.aliquotaIss}%`}
                      </span>
                    </div>
                    <div className={`text-[11px] line-clamp-2 ${isSelected ? 'text-blue-50' : 'text-slate-600'}`}>
                      {srv.descricaoPadrao}
                    </div>
                    <div className={`mt-1 font-semibold text-[11px] ${isSelected ? 'text-white' : 'text-blue-700'}`}>
                      R$ {srv.valorPadrao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Discriminação */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
              <label className="block font-semibold text-slate-700">
                Discriminação dos Serviços Prestados (aparecerá no DANFSE):
              </label>
              <span className="text-[10px] text-blue-700 font-medium bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full flex items-center gap-1 self-start sm:self-auto">
                <Sparkles className="w-3 h-3 text-blue-600" />
                Permite tags dinâmicas e atualiza o período a cada mês
              </span>
            </div>
            <textarea
              ref={descricaoTextareaRef}
              rows={3}
              required
              value={servicoDescricao}
              onChange={(e) => setServicoDescricao(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white text-slate-900 font-mono text-[11px]"
              placeholder="Ex: Locação de bens móveis referente ao {mes_competencia} ({periodo}) para {razao_social_cliente}."
            />

            <TemplateTagsHelper
              onInsertTag={handleInsertTag}
              previewText={servicoDescricao}
              previewContext={{
                cliente: clientes.find((c) => c.id === clienteId),
                prestador,
                valorServico: Number(valorServico),
                aliquotaIss: Number(aliquotaIss),
                issRetido,
                codigoTributacaoNacional,
                itemLC116,
                numeroNfse: storageService.getNextNumeroNfse() || '64',
                numeroDps: numeroDps || '21',
                serieDps: serieDps || '1608',
                dataCompetencia: new Date().toISOString().slice(0, 7),
              }}
              previewTitle="Pré-visualização da discriminação para esta emissão:"
              targetFieldLabel="discriminação do serviço"
            />
          </div>

          {/* Códigos Fiscais e Valores */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">cTribNac (Nacional):</label>
              <input
                type="text"
                required
                value={codigoTributacaoNacional}
                onChange={(e) => setCodigoTributacaoNacional(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-900 text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Item LC 116/03:</label>
              <input
                type="text"
                required
                value={itemLC116}
                onChange={(e) => setItemLC116(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-900 text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Valor do Serviço (R$):</label>
              <input
                type="number"
                step="0.01"
                min="1"
                required
                value={valorServico}
                onChange={(e) => setValorServico(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-900 text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Alíquota ISS (%):</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="5"
                required
                value={aliquotaIss}
                onChange={(e) => setAliquotaIss(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-900 text-xs"
              />
            </div>
          </div>

          {/* Automações de Disparo */}
          <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-200 space-y-2">
            <h4 className="font-bold text-blue-950">Ação Automática Pós-Emissão:</h4>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enviarEmail}
                  onChange={(e) => setEnviarEmail(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-0"
                />
                <span className="text-slate-800 font-medium flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-600" />
                  <span>Enviar por E-mail ao cliente com DANFSE em PDF e XML Nacional anexados</span>
                </span>
              </label>
            </div>
          </div>

          {/* Identificação Sequencial da DPS (Receita Federal) */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="font-semibold text-slate-800 block text-xs">
                Declaração de Prestação de Serviços (DPS):
              </span>
              <span className="text-[10.5px] text-slate-500">
                Sequencial único transmitido à Receita Federal (evita a rejeição E0014 de DPS duplicada).
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-semibold text-slate-600">DPS Nº:</span>
                <input
                  type="number"
                  value={numeroDps}
                  onChange={(e) => setNumeroDps(e.target.value)}
                  className="w-20 px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-xs text-slate-900 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-semibold text-slate-600">Série:</span>
                <input
                  type="text"
                  value={serieDps}
                  onChange={(e) => setSerieDps(e.target.value)}
                  className="w-16 px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-xs text-slate-900 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-1 pl-1">
                <span className="text-[11px] font-semibold text-slate-600">Próx. NFS-e:</span>
                <span className="px-2 py-1 bg-blue-50 border border-blue-200 rounded font-mono font-bold text-xs text-blue-900" title="Número oficial sequencial da Nota Fiscal">
                  {storageService.getNextNumeroNfse()}
                </span>
              </div>
            </div>
          </div>

          {/* Loading status progress if submitting */}
          {isSubmitting && (
            <div className="bg-slate-900 text-white p-3.5 rounded-lg flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
              <div className="text-xs">
                <div className="font-semibold text-blue-300">
                  Processando Emissão via Notaas...
                </div>
                <div className="text-slate-400 font-mono text-[11px]">{stepMessage}</div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Emitindo...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Transmitir NFS-e Agora</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
