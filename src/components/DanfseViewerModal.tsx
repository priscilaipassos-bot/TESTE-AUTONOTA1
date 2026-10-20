import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import {
  X,
  Printer,
  Download,
  FileDown,
  Mail,
  Copy,
  Check,
  Building2,
  FileText,
  AlertCircle,
  AlertTriangle,
  ExternalLink,
  Send,
  RefreshCcw,
  Sparkles,
} from 'lucide-react';
import { NfseDocument } from '../types/nfse';
import { AutomationRunner } from '../services/automationRunner';
import { storageService } from '../services/storageService';
import {
  formatCnpj,
  formatCpf,
  formatCurrencyBRL,
  formatDateTime,
  formatChaveAcesso,
  formatPhoneNumber,
} from '../utils/formatters';
import { parseMultipleEmails } from '../utils/emailHelper';
import { buildNfseConsultaUrl } from '../utils/qrCodeHelper';

interface DanfseViewerModalProps {
  nota: NfseDocument | null;
  onClose: () => void;
  onResendEmail?: (
    nota: NfseDocument,
    customEmail?: string
  ) => Promise<{ sucesso: boolean; erro?: string } | void>;
  onNotaAtualizada?: (nota: NfseDocument) => void;
}

export const DanfseViewerModal: React.FC<DanfseViewerModalProps> = ({
  nota: initialNota,
  onClose,
  onResendEmail,
  onNotaAtualizada,
}) => {
  const [nota, setNota] = useState<NfseDocument | null>(initialNota);
  const [reemitDpsNum, setReemitDpsNum] = useState<string>(() => storageService.getNextNumeroDps() || '21');
  const [reemitSerie, setReemitSerie] = useState<string>(() => storageService.getPrestador().serieDps || '1608');
  const [reemitting, setReemitting] = useState(false);
  const [reemitError, setReemitError] = useState<string | null>(null);
  const [reemitSuccess, setReemitSuccess] = useState<string | null>(null);
  const [showReemitPanel, setShowReemitPanel] = useState(false);

  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [consultaUrl, setConsultaUrl] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [showEmailPanel, setShowEmailPanel] = useState(false);
  const [destinatarioEmail, setDestinatarioEmail] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailResult, setEmailResult] = useState<{
    sucesso: boolean;
    mensagem: string;
  } | null>(null);
  const [syncingXml, setSyncingXml] = useState(false);
  const [xmlSyncFeedback, setXmlSyncFeedback] = useState<{ sucesso: boolean; mensagem: string } | null>(null);

  const handleSyncWithNotaasXml = async () => {
    if (!nota) return;
    setSyncingXml(true);
    setXmlSyncFeedback(null);
    try {
      const res = await AutomationRunner.sincronizarNotaComNotaasXml(nota);
      if (res.sucesso && res.nota) {
        setNota(res.nota);
        if (onNotaAtualizada) {
          onNotaAtualizada(res.nota);
        }
        setXmlSyncFeedback({
          sucesso: true,
          mensagem: `Dados atualizados com sucesso a partir do XML oficial do Notaas (NFS-e Nº ${res.nota.numero}, Chave: ${res.nota.chaveAcesso}). O PDF gerado e o XML estão 100% alinhados.`,
        });
      } else {
        setXmlSyncFeedback({
          sucesso: false,
          mensagem: res.erro || 'Não foi possível sincronizar o XML com o Notaas.',
        });
      }
    } catch (err: any) {
      setXmlSyncFeedback({
        sucesso: false,
        mensagem: `Erro ao obter XML do Notaas: ${err.message || 'Falha de comunicação'}`,
      });
    } finally {
      setSyncingXml(false);
    }
  };

  const lastNotaIdRef = useRef<string | null>(null);

  useEffect(() => {
    setNota(initialNota);
    // APENAS inicializa quando for uma nota diferente recém-aberta
    // NUNCA sobrescreve se o usuário já estiver digitando nos campos!
    if (initialNota && initialNota.id !== lastNotaIdRef.current) {
      lastNotaIdRef.current = initialNota.id;
      const prestador = storageService.getPrestador();
      setReemitDpsNum(storageService.getNextNumeroNfse() || '18');
      setReemitSerie(prestador.serieDps || '1608');
      setDestinatarioEmail(initialNota.emailDestinatario || initialNota.tomador.email || '');
    }
    setReemitError(null);
    setReemitSuccess(null);
  }, [initialNota]);

  const handleReemitirComNovoDps = async () => {
    if (!nota) return;
    setReemitting(true);
    setReemitError(null);
    setReemitSuccess(null);

    try {
      // REGRA DO USUÁRIO: Reemissão apenas envia para o Notaas mas NÃO envia e-mail automaticamente!
      const result = await AutomationRunner.reemitirNfse(
        nota,
        reemitDpsNum.trim(),
        reemitSerie.trim()
      );

      if (result.sucesso && result.nota) {
        storageService.setProximoNumeroDps(Number(reemitDpsNum) + 1);
        setNota(result.nota);
        if (onNotaAtualizada) {
          onNotaAtualizada(result.nota);
        }
        setReemitSuccess(`NFS-e Nº ${result.nota.numero} transmitida com sucesso ao Notaas com a DPS Nº ${reemitDpsNum}! (Aviso: E-mail não enviado automaticamente).`);
      } else {
        setReemitError(result.erro || 'Falha ao retransmitir para o Notaas.');
      }
    } catch (err: any) {
      setReemitError(`Erro na reemissão: ${err.message || 'Falha de comunicação'}`);
    } finally {
      setReemitting(false);
    }
  };

  useEffect(() => {
    if (!nota) return;
    setDestinatarioEmail(nota.tomador.email || 'priscilaipassos@gmail.com');
    setEmailResult(null);
    setShowEmailPanel(false);

    const publicUrl = buildNfseConsultaUrl(nota);
    setConsultaUrl(publicUrl);

    QRCode.toDataURL(
      publicUrl,
      {
        width: 140,
        margin: 0,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      },
      (err, url) => {
        if (!err && url) {
          setQrCodeDataUrl(url);
        }
      }
    );
  }, [nota]);

  if (!nota) return null;

  const handleCopyKey = () => {
    navigator.clipboard.writeText(nota.chaveAcesso);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true);
      const res = await fetch('/api/danfse/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nota }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Falha ao gerar arquivo PDF');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `DANFSE_${nota.numero || 'Nacional'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`Erro ao baixar DANFSE em PDF: ${e.message}`);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadXml = () => {
    const xmlContent = nota.xmlConteudo || '<?xml version="1.0" encoding="UTF-8"?><NFSe/>';
    const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `NFSe_${nota.numero}_Nacional.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSendEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailsParsed = parseMultipleEmails(destinatarioEmail);
    if (emailsParsed.length === 0) {
      setEmailResult({
        sucesso: false,
        mensagem: 'Por favor, informe ao menos um endereço de e-mail válido.',
      });
      return;
    }

    setSendingEmail(true);
    setEmailResult(null);

    const destinatariosFormatados = emailsParsed.join(', ');

    try {
      if (onResendEmail) {
        const res = await onResendEmail(nota, destinatariosFormatados);
        if (res && res.sucesso === false) {
          setEmailResult({
            sucesso: false,
            mensagem:
              res.erro ||
              'Falha ao disparar e-mail. Verifique a Senha de Aplicativo do Gmail nas Configurações.',
          });
        } else {
          setEmailResult({
            sucesso: true,
            mensagem: `✅ E-mail com DANFSE (PDF) e XML entregue com sucesso para [${destinatariosFormatados}]!`,
          });
        }
      }
    } catch (err: any) {
      setEmailResult({
        sucesso: false,
        mensagem: `Erro ao enviar e-mail: ${err.message}`,
      });
    } finally {
      setSendingEmail(false);
    }
  };

  const prestadorDoc =
    nota.prestador.cnpj.length === 14
      ? formatCnpj(nota.prestador.cnpj)
      : nota.prestador.cnpj;
  const tomadorDoc =
    nota.tomador.tipoInscricao === 'CNPJ'
      ? formatCnpj(nota.tomador.documento)
      : formatCpf(nota.tomador.documento);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header Toolbar (no-print) */}
        <div className="no-print bg-slate-900 text-white px-3 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-semibold tracking-wide">
                DANFSE - NFS-e Nacional
              </h2>
              <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                <span>Nº {nota.numero}</span>
                <span aria-hidden="true">·</span>
                <span className="text-blue-400 font-semibold">{nota.status}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
            {/* Botão Baixar PDF Direto */}
            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
              title="Baixar arquivo DANFSE em PDF oficial"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>{downloadingPdf ? 'Gerando...' : 'Baixar PDF'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-2.5 sm:px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Imprimir DANFSE em folha A4"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>

            <button
              onClick={handleDownloadXml}
              className="px-2.5 sm:px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Baixar XML oficial assinado"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Baixar XML</span>
              <span className="sm:hidden">XML</span>
            </button>

            <button
              onClick={() => setShowEmailPanel(!showEmailPanel)}
              className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
                showEmailPanel
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
              }`}
              title="Disparar ou reenviar por e-mail com DANFSE (PDF) e XML"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Enviar por E-mail</span>
            </button>

            {/* Botão para sincronizar dados do XML do Notaas */}
            {(nota.notaasId || nota.linkXml) && (
              <button
                onClick={handleSyncWithNotaasXml}
                disabled={syncingXml}
                className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                title="Puxar o XML oficial gerado pelo Notaas para atualizar o DANFSE, PDF e dados com 100% de exatidão"
              >
                <Sparkles className={`w-3.5 h-3.5 ${syncingXml ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{syncingXml ? 'Puxando XML...' : 'Puxar Dados XML Notaas'}</span>
                <span className="sm:hidden">{syncingXml ? 'XML...' : 'XML Notaas'}</span>
              </button>
            )}

            <button
              onClick={() => {
                setShowReemitPanel(!showReemitPanel);
                if (!showReemitPanel) setShowEmailPanel(false);
              }}
              className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
                showReemitPanel
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30'
              }`}
              title="Reemitir NFS-e para o Notaas (Apenas envia ao Notaas, não envia e-mail)"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
              <span>Reemitir no Notaas</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
              aria-label="Fechar visualizador"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Painel de Reemissão para o Notaas (com Aviso Obrigatório) */}
        {showReemitPanel && (
          <div className="no-print bg-amber-50 border-b border-amber-200 px-4 py-3.5 text-xs text-amber-950 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-amber-900">
                  Reemissão Direta para a API Notaas (platform.notaas.com.br)
                </div>
                <p className="text-[11.5px] leading-relaxed text-amber-900">
                  ⚠️ <strong>AVISO IMPORTANTE:</strong> A reemissão <strong>apenas envia os dados fiscais para o Notaas</strong> (Receita Federal / prefeitura). <strong>O E-MAIL NÃO SERÁ ENVIADO AUTOMATICAMENTE</strong> ao cliente. Após a autorização, você poderá enviá-lo quando desejar pelo botão "Enviar por E-mail".
                </p>
              </div>
            </div>

            {reemitSuccess && (
              <div className="p-2.5 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded font-semibold text-xs flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{reemitSuccess}</span>
              </div>
            )}

            {reemitError && (
              <div className="p-2.5 bg-rose-100 border border-rose-300 text-rose-900 rounded font-medium text-xs flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{reemitError}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <div className="flex items-center gap-1.5">
                <label className="font-semibold text-amber-950 text-xs">DPS Nº:</label>
                <input
                  type="number"
                  value={reemitDpsNum}
                  onChange={(e) => setReemitDpsNum(e.target.value)}
                  className="w-20 px-2 py-1 bg-white border border-amber-300 rounded text-xs font-mono font-bold text-slate-900 focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="font-semibold text-amber-950 text-xs">Série:</label>
                <input
                  type="text"
                  value={reemitSerie}
                  onChange={(e) => setReemitSerie(e.target.value)}
                  className="w-16 px-2 py-1 bg-white border border-amber-300 rounded text-xs font-mono font-bold text-slate-900 focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <button
                type="button"
                disabled={reemitting || !reemitDpsNum}
                onClick={handleReemitirComNovoDps}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCcw className={`w-3.5 h-3.5 ${reemitting ? 'animate-spin' : ''}`} />
                <span>{reemitting ? 'Transmitindo ao Notaas...' : `Confirmar Reemissão ao Notaas (DPS Nº ${reemitDpsNum})`}</span>
              </button>
            </div>
          </div>
        )}

        {/* Painel Interativo de Envio por E-mail */}
        {showEmailPanel && (
          <div className="no-print bg-slate-800 border-b border-slate-700 px-4 py-3 text-white">
            <form onSubmit={handleSendEmailSubmit} className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-sky-400" />
                  <span>Enviar NFS-e por E-mail (anexa DANFSE em PDF + XML assinado):</span>
                </span>
                <button
                  type="button"
                  onClick={() => setDestinatarioEmail('priscilaipassos@gmail.com')}
                  className="text-[11px] text-sky-300 hover:text-white underline cursor-pointer self-start sm:self-auto"
                >
                  Usar meu e-mail: priscilaipassos@gmail.com
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={destinatarioEmail}
                  onChange={(e) => setDestinatarioEmail(e.target.value)}
                  placeholder="email1@empresa.com, email2@empresa.com"
                  className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-600 rounded-md text-xs text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 font-mono"
                  required
                />
                <button
                  type="submit"
                  disabled={sendingEmail}
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{sendingEmail ? 'Enviando com PDF...' : 'Disparar E-mail'}</span>
                </button>
              </div>

              <div className="flex items-center justify-between text-[10.5px] text-slate-400">
                <span>Pode informar múltiplos e-mails separados por vírgula (,) ou ponto e vírgula (;).</span>
                {parseMultipleEmails(destinatarioEmail).length > 0 && (
                  <span className="text-sky-300 font-medium">
                    {parseMultipleEmails(destinatarioEmail).length} destinatário(s) reconhecido(s)
                  </span>
                )}
              </div>

              {parseMultipleEmails(destinatarioEmail).length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {parseMultipleEmails(destinatarioEmail).map((em, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-700/80 border border-slate-600 text-sky-200 rounded text-[10px] font-mono"
                    >
                      <Mail className="w-2.5 h-2.5 text-sky-400" />
                      <span>{em}</span>
                    </span>
                  ))}
                </div>
              )}

              {emailResult && (
                <div
                  className={`mt-2 p-2 rounded-md text-xs flex items-center gap-2 ${
                    emailResult.sucesso
                      ? 'bg-blue-950/80 text-blue-200 border border-blue-700'
                      : 'bg-rose-950/80 text-rose-200 border border-rose-700'
                  }`}
                >
                  {emailResult.sucesso ? (
                    <Check className="w-4 h-4 text-blue-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span>{emailResult.mensagem}</span>
                </div>
              )}
            </form>
          </div>
        )}

        {/* Banner de Feedback de Sincronização do XML do Notaas */}
        {xmlSyncFeedback && (
          <div
            className={`no-print px-4 py-2.5 text-xs flex items-center justify-between gap-2 border-b ${
              xmlSyncFeedback.sucesso
                ? 'bg-emerald-50 text-emerald-950 border-emerald-300'
                : 'bg-rose-50 text-rose-950 border-rose-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {xmlSyncFeedback.sucesso ? (
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{xmlSyncFeedback.mensagem}</span>
            </div>
            <button
              onClick={() => setXmlSyncFeedback(null)}
              className="text-slate-500 hover:text-slate-800 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Banner de Rejeição SEFAZ no Notaas */}
        {nota.rejeicaoSefaz && (
          <div className="no-print bg-amber-50 border-b border-amber-300 text-amber-950 px-4 py-3 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-amber-900">
                  Rejeição da Receita Federal / SEFAZ no Notaas: [{nota.rejeicaoSefaz.codigo}]
                </div>
                <div className="text-amber-800 text-[11px] mt-0.5">
                  {nota.rejeicaoSefaz.mensagem}
                </div>
                {nota.rejeicaoSefaz.codigo === 'E0120' && (
                  <div className="mt-1 text-[11px] font-medium text-amber-900 bg-amber-100/70 p-1.5 rounded border border-amber-300/60">
                    💡 <strong>Como corrigir:</strong> No painel <strong>platform.notaas.com.br</strong> &gt; Empresa / Prestador, apague a <em>Inscrição Municipal</em> (deixe em branco) e salve.
                  </div>
                )}
                {(nota.rejeicaoSefaz.codigo === 'HTTP_503' || nota.rejeicaoSefaz.mensagem?.includes('503') || nota.rejeicaoSefaz.mensagem?.includes('unavailable')) && (
                  <div className="mt-2 text-[11px] text-blue-950 bg-blue-50/90 p-3 rounded-lg border border-blue-300 space-y-2">
                    <div className="font-bold flex items-center gap-1.5 text-blue-900">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      <span>Instabilidade Temporária no SNNFSE (Sistema Nacional da NFS-e / Receita Federal):</span>
                    </div>
                    <p className="leading-relaxed text-slate-700">
                      Os servidores federais do <strong>SNNFSE (Receita Federal / SERPRO)</strong> retornaram <strong>HTTP 503: The service is unavailable</strong>. Isso é uma sobrecarga transitória nos servidores governamentais da Receita Federal. Seus dados fiscais (DPS Nº {reemitDpsNum}, Série {reemitSerie}) foram recebidos com sucesso pelo Notaas e <strong>a DPS Nº {reemitDpsNum} NÃO foi consumida</strong>.
                    </p>

                    {reemitSuccess && (
                      <div className="p-2 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded font-semibold text-xs flex items-center gap-1.5">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{reemitSuccess}</span>
                      </div>
                    )}

                    {reemitError && (
                      <div className="p-2 bg-rose-100 border border-rose-300 text-rose-900 rounded font-medium text-xs flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>{reemitError}</span>
                      </div>
                    )}

                    <div className="pt-1 flex flex-wrap items-center gap-2 bg-white p-2.5 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-1.5">
                        <label className="font-semibold text-slate-800 text-xs">DPS Nº:</label>
                        <input
                          type="number"
                          value={reemitDpsNum}
                          onChange={(e) => setReemitDpsNum(e.target.value)}
                          className="w-20 px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono font-bold text-slate-900 focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <label className="font-semibold text-slate-800 text-xs">Série:</label>
                        <input
                          type="text"
                          value={reemitSerie}
                          onChange={(e) => setReemitSerie(e.target.value)}
                          className="w-16 px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono font-bold text-slate-900 focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={reemitting || !reemitDpsNum}
                        onClick={handleReemitirComNovoDps}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCcw className={`w-3.5 h-3.5 ${reemitting ? 'animate-spin' : ''}`} />
                        <span>{reemitting ? 'Retransmitindo à Receita...' : `🔄 Tentar Novamente Agora (Reenviar DPS Nº ${reemitDpsNum})`}</span>
                      </button>
                    </div>
                  </div>
                )}
                {nota.rejeicaoSefaz.codigo === 'E0014' && (
                  <div className="mt-2 text-[11px] text-amber-950 bg-amber-100/90 p-3 rounded-lg border border-amber-300 space-y-2">
                    <div className="font-bold flex items-center gap-1.5 text-amber-900">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span>Solução Imediata para o Erro E0014 (DPS já existente na Receita Federal):</span>
                    </div>
                    <p className="leading-relaxed text-amber-900">
                      Sua última DPS emitida foi a <strong>Nº 17</strong> (Série <strong>1608</strong>). A próxima declaração oficial a ser transmitida para a Receita Federal é a <strong>DPS Nº 18</strong> com a Série <strong>1608</strong>.
                    </p>

                    {reemitSuccess && (
                      <div className="p-2 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded font-semibold text-xs flex items-center gap-1.5">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{reemitSuccess}</span>
                      </div>
                    )}

                    {reemitError && (
                      <div className="p-2 bg-rose-100 border border-rose-300 text-rose-900 rounded font-medium text-xs flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>{reemitError}</span>
                      </div>
                    )}

                    <div className="pt-1 flex flex-wrap items-center gap-2 bg-white/90 p-2.5 rounded-lg border border-amber-300/80">
                      <div className="flex items-center gap-1.5">
                        <label className="font-semibold text-amber-950 text-xs">Nova DPS Nº:</label>
                        <input
                          type="number"
                          value={reemitDpsNum}
                          onChange={(e) => setReemitDpsNum(e.target.value)}
                          className="w-20 px-2 py-1 bg-white border border-amber-400 rounded text-xs font-mono font-bold text-slate-900 focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <label className="font-semibold text-amber-950 text-xs">Série:</label>
                        <input
                          type="text"
                          value={reemitSerie}
                          onChange={(e) => setReemitSerie(e.target.value)}
                          className="w-16 px-2 py-1 bg-white border border-amber-400 rounded text-xs font-mono font-bold text-slate-900 focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={reemitting || !reemitDpsNum}
                        onClick={handleReemitirComNovoDps}
                        className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCcw className={`w-3.5 h-3.5 ${reemitting ? 'animate-spin' : ''}`} />
                        <span>{reemitting ? 'Transmitindo à Receita...' : `Corrigir e Reemitir Agora (DPS Nº ${reemitDpsNum})`}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {nota.notaasId && (
              <span className="font-mono text-[10px] text-amber-800 bg-white/70 px-2 py-1 rounded border border-amber-300 shrink-0">
                ID Notaas: {nota.notaasId.slice(0, 8)}...
              </span>
            )}
          </div>
        )}

        {/* Notaas Official Links Notification Bar */}
        {(nota.linkDanfse || nota.linkXml || nota.transmissaoReal) && !nota.rejeicaoSefaz && (
          <div className="no-print bg-blue-950 text-blue-100 px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2 border-b border-blue-800">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span className="font-semibold text-white">
                Nota transmitida oficialmente via Notaas / eNotas (Autorizada RFB)
              </span>
            </div>
            <div className="flex items-center gap-2">
              {nota.linkDanfse && (
                <a
                  href={nota.linkDanfse}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 bg-blue-700 hover:bg-blue-600 text-white rounded text-[11px] font-medium flex items-center gap-1 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Abrir PDF Notaas</span>
                </a>
              )}
              {nota.linkXml && (
                <a
                  href={nota.linkXml}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-medium flex items-center gap-1 transition-colors"
                >
                  <Download className="w-3 h-3" />
                  <span>Download XML Oficial</span>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Email Status Bar */}
        {nota.status === 'AUTORIZADA' && !nota.emailEnviado && !showEmailPanel && (
          <div className="no-print bg-amber-50 text-amber-900 border-b border-amber-200 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span>
                <strong>E-mail pendente de envio para o cliente ({nota.tomador.email || 'preposto.regap@nitnave.com'}):</strong> Configure a Senha de App do Gmail nas Configurações ou clique para enviar manualmente.
              </span>
            </div>
            <button
              onClick={() => setShowEmailPanel(true)}
              className="px-2.5 py-1 bg-amber-700 hover:bg-amber-800 text-white rounded text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Send className="w-3 h-3" />
              <span>Enviar E-mail Agora</span>
            </button>
          </div>
        )}

        {nota.emailEnviado && (
          <div className="no-print bg-emerald-50 text-emerald-900 border-b border-emerald-200 px-4 py-1.5 text-xs flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>
              E-mail com DANFSE (PDF) e XML entregue com sucesso para <strong>{nota.emailDestinatario || nota.tomador.email}</strong> {nota.emailDataEnvio ? `em ${new Date(nota.emailDataEnvio).toLocaleString('pt-BR')}` : ''}.
            </span>
          </div>
        )}

        {/* Document Content Scroll Area */}
        <div className="overflow-y-auto p-4 sm:p-8 bg-slate-100 flex justify-center">
          {/* Printable DANFSE Layout Box */}
          <div
            id="danfse-print-area"
            className="bg-white text-slate-900 border border-slate-400 shadow-sm w-full max-w-[800px] text-[11px] leading-tight select-text"
          >
            {/* Header: Republica Federativa do Brasil / CGNFSE */}
            <div className="border-b-2 border-slate-900 p-3 grid grid-cols-12 gap-2 items-center bg-slate-50">
              <div className="col-span-2 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full border-2 border-slate-800 flex items-center justify-center bg-white shadow-xs">
                  <span className="font-serif font-bold text-xs text-slate-800 tracking-tighter">
                    BRASIL
                  </span>
                </div>
                <span className="text-[9px] font-semibold text-slate-700 mt-1 uppercase leading-none">
                  Receita Federal
                </span>
              </div>

              <div className="col-span-7 text-center">
                <h1 className="font-bold text-sm tracking-tight uppercase text-slate-950">
                  DANFSE v2.0 - Documento Auxiliar da NFS-e
                </h1>
                <p className="text-[10px] font-medium text-slate-700 uppercase">
                  Nota Fiscal de Serviços Eletrônica Padrão Nacional
                </p>
                <p className="text-[9px] text-slate-500 italic mt-0.5">
                  Emitida nos termos do art. 3º da Resolução CGSN nº 169/2022 e Sistema Nacional da NFS-e
                </p>
              </div>

              <div className="col-span-3 border-l border-slate-300 pl-2 text-[10px] space-y-1">
                <div>
                  <span className="font-bold block text-slate-600 uppercase text-[9px]">
                    Número da NFS-e:
                  </span>
                  <span className="font-mono font-bold text-xs text-slate-950">
                    {nota.numero}
                  </span>
                </div>
                <div>
                  <span className="font-bold block text-slate-600 uppercase text-[9px]">
                    Competência:
                  </span>
                  <span className="font-mono font-semibold text-slate-800">
                    {nota.dataCompetencia}
                  </span>
                </div>
                <div>
                  <span className="font-bold block text-slate-600 uppercase text-[9px]">
                    Data/Hora Emissão:
                  </span>
                  <span className="font-mono text-slate-800">
                    {formatDateTime(nota.dataEmissao)}
                  </span>
                </div>
              </div>
            </div>

            {/* Chave de Acesso & QR Code */}
            <div className="border-b border-slate-400 p-2.5 grid grid-cols-12 gap-3 items-center bg-white">
              <div className="col-span-9 space-y-1.5">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[9px] uppercase tracking-wider text-slate-600">
                      Chave de Acesso da NFS-e Nacional (50 dígitos)
                    </span>
                    <button
                      onClick={handleCopyKey}
                      className="no-print text-[10px] text-blue-700 hover:text-blue-900 font-medium flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey ? (
                        <>
                          <Check className="w-3 h-3 text-blue-600" />
                          <span>Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copiar Chave</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="font-mono font-bold text-[11px] bg-slate-50 border border-slate-300 p-1.5 rounded-xs tracking-wider text-slate-900 select-all">
                    {formatChaveAcesso(nota.chaveAcesso)}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div className="border border-slate-200 p-1 bg-slate-50">
                    <span className="text-[9px] text-slate-500 font-bold block">
                      Código de Verificação:
                    </span>
                    <span className="font-mono font-bold text-slate-900">
                      {nota.codigoVerificacao}
                    </span>
                  </div>
                  <div className="border border-slate-200 p-1 bg-slate-50">
                    <span className="text-[9px] text-slate-500 font-bold block">
                      Número da DPS:
                    </span>
                    <span className="font-mono text-slate-900">
                      {nota.dpsNumero} / Série {nota.dpsSerie}
                    </span>
                  </div>
                  <div className="border border-slate-200 p-1 bg-slate-50">
                    <span className="text-[9px] text-slate-500 font-bold block">
                      Ambiente de Emissão:
                    </span>
                    <span className="font-semibold text-blue-700">
                      {nota.prestador.ambienteEmissao === 'PRODUCAO'
                        ? '1 - Produção Nacional'
                        : '2 - Homologação'}
                    </span>
                  </div>
                </div>
              </div>

              {/* QR Code */}
              <div className="col-span-3 flex flex-col items-center justify-center border-l border-slate-200 pl-2">
                {qrCodeDataUrl ? (
                  <img
                    src={qrCodeDataUrl}
                    alt="QR Code Consulta Pública NFS-e Nacional"
                    className="w-24 h-24 border border-slate-300 p-0.5 bg-white shadow-2xs"
                  />
                ) : (
                  <div className="w-24 h-24 border border-slate-200 bg-slate-100 flex items-center justify-center text-[9px] text-slate-400">
                    Gerando QR...
                  </div>
                )}
                {consultaUrl && (
                  <a
                    href={consultaUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="no-print mt-1.5 px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-850 border border-blue-300 rounded text-[9px] font-semibold flex items-center gap-1 transition-colors text-center"
                    title={`Abrir consulta pública oficial com a Chave de Acesso (${nota.chaveAcesso}) preenchida automaticamente`}
                  >
                    <span>Consultar Chave de Acesso</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
                <span className="text-[7.5px] text-slate-500 text-center mt-1 uppercase font-medium leading-tight">
                  QR Code oficial: leitura preenche a Chave de Acesso no portal público
                </span>
              </div>
            </div>

            {/* PRESTADOR DE SERVIÇOS */}
            <div className="border-b border-slate-400">
              <div className="bg-slate-200 px-2 py-1 font-bold text-[10px] uppercase text-slate-900 tracking-wider">
                Prestador de Serviços
              </div>
              <div className="p-2 space-y-1 bg-white">
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-8">
                    <span className="text-slate-500 text-[9px] block">Razão Social:</span>
                    <span className="font-bold text-slate-900">{nota.prestador.razaoSocial}</span>
                  </div>
                  <div className="col-span-4">
                    <span className="text-slate-500 text-[9px] block">CNPJ / CPF:</span>
                    <span className="font-mono font-bold text-slate-900">{prestadorDoc}</span>
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-2 text-[10px]">
                  <div className="col-span-4">
                    <span className="text-slate-500 text-[9px] block">Inscrição Municipal:</span>
                    <span className="font-mono text-slate-800">
                      {nota.prestador.inscricaoMunicipal || 'Isento'}
                    </span>
                  </div>
                  <div className="col-span-4">
                    <span className="text-slate-500 text-[9px] block">Município / UF:</span>
                    <span className="text-slate-800">
                      {nota.prestador.endereco.municipio} - {nota.prestador.endereco.uf} (IBGE:{' '}
                      {nota.prestador.endereco.codigoMunicipio})
                    </span>
                  </div>
                  <div className="col-span-4">
                    <span className="text-slate-500 text-[9px] block">Regime Tributário:</span>
                    <span className="font-semibold text-slate-800">
                      {nota.prestador.regimeTributario === 'MEI'
                        ? 'MEI - Microempreendedor Individual'
                        : nota.prestador.regimeTributario === 'SIMPLES_NACIONAL'
                        ? 'Simples Nacional (ME / EPP)'
                        : 'Lucro Presumido / Real'}
                    </span>
                  </div>
                </div>

                <div className="text-[10px] text-slate-600">
                  <span className="text-slate-500 text-[9px] block">Endereço:</span>
                  <span>
                    {nota.prestador.endereco.logradouro}, {nota.prestador.endereco.numero}{' '}
                    {nota.prestador.endereco.complemento || ''} - {nota.prestador.endereco.bairro} -
                    CEP: {nota.prestador.endereco.cep}
                  </span>
                </div>
              </div>
            </div>

            {/* TOMADOR DE SERVIÇOS */}
            <div className="border-b border-slate-400">
              <div className="bg-slate-200 px-2 py-1 font-bold text-[10px] uppercase text-slate-900 tracking-wider">
                Tomador de Serviços
              </div>
              <div className="p-2 space-y-1 bg-white">
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-8">
                    <span className="text-slate-500 text-[9px] block">Nome / Razão Social:</span>
                    <span className="font-bold text-slate-900">{nota.tomador.razaoSocial}</span>
                  </div>
                  <div className="col-span-4">
                    <span className="text-slate-500 text-[9px] block">
                      {nota.tomador.tipoInscricao}:
                    </span>
                    <span className="font-mono font-bold text-slate-900">{tomadorDoc}</span>
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-2 text-[10px]">
                  <div className="col-span-6">
                    <span className="text-slate-500 text-[9px] block">E-mail:</span>
                    <span className="text-slate-800">{nota.tomador.email}</span>
                  </div>
                  <div className="col-span-6">
                    <span className="text-slate-500 text-[9px] block">Telefone:</span>
                    <span className="font-mono text-slate-800">{nota.tomador.telefone || '-'}</span>
                  </div>
                </div>

                <div className="text-[10px] text-slate-600">
                  <span className="text-slate-500 text-[9px] block">Endereço:</span>
                  <span>
                    {nota.tomador.endereco.logradouro}, {nota.tomador.endereco.numero}{' '}
                    {nota.tomador.endereco.complemento || ''} - {nota.tomador.endereco.bairro} -{' '}
                    {nota.tomador.endereco.municipio}/{nota.tomador.endereco.uf} - CEP:{' '}
                    {nota.tomador.endereco.cep}
                  </span>
                </div>
              </div>
            </div>

            {/* DISCRIMINAÇÃO DOS SERVIÇOS */}
            <div className="border-b border-slate-400">
              <div className="bg-slate-200 px-2 py-1 font-bold text-[10px] uppercase text-slate-900 tracking-wider">
                Discriminação dos Serviços Prestados
              </div>
              <div className="p-2 bg-white space-y-2">
                <div className="p-2 bg-slate-50 border border-slate-200 rounded-xs font-mono text-[10.5px] leading-relaxed text-slate-800 whitespace-pre-wrap min-h-[70px]">
                  {nota.servico.descricao}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[9.5px] border-t border-slate-200 pt-1.5 text-slate-600">
                  <div>
                    <span className="font-semibold block text-slate-800">
                      Cód. Tributação Nacional:
                    </span>
                    <span className="font-mono font-bold text-slate-900">
                      {nota.servico.codigoTributacaoNacional}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold block text-slate-800">Item LC 116/2003:</span>
                    <span className="font-mono text-slate-900">{nota.servico.itemLC116}</span>
                  </div>
                  <div>
                    <span className="font-semibold block text-slate-800">CNAE:</span>
                    <span className="font-mono text-slate-900">{nota.servico.cnae}</span>
                  </div>
                  <div>
                    <span className="font-semibold block text-slate-800">Local da Prestação:</span>
                    <span className="text-slate-900 font-medium">
                      {nota.servico.localPrestacaoMunicipio || nota.tomador.endereco.municipio} - {nota.servico.localPrestacaoUf || nota.tomador.endereco.uf}
                    </span>
                  </div>
                </div>

                {/* Status Tributário do Serviço */}
                <div className="bg-slate-50 border border-slate-200 p-1.5 rounded-xs text-[9px] flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-600">Tributação do ISSQN: </span>
                    <span className="font-bold text-slate-900">
                      {nota.servico.operacaoNaoSujeitaIss || nota.impostos.aliquotaIss === 0
                        ? 'Operação não sujeita ao ISSQN (Locação de bens móveis / Imunidade / Não incidência)'
                        : 'Operação tributável no município'}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-600">Município de Incidência: </span>
                    <span className="font-medium text-slate-800">
                      {nota.prestador.endereco.municipio}/{nota.prestador.endereco.uf} (IBGE: {nota.prestador.endereco.codigoMunicipio})
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* VALORES E RETENÇÕES TRIBUTÁRIAS */}
            <div className="border-b border-slate-400">
              <div className="bg-slate-200 px-2 py-1 font-bold text-[10px] uppercase text-slate-900 tracking-wider">
                Detalhamento dos Valores e Tributos (R$)
              </div>
              <div className="p-2 bg-white">
                <table className="w-full text-[10px] border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 text-[9px] uppercase">
                      <th className="p-1 border-r border-slate-300 text-left">Valor Serviços</th>
                      <th className="p-1 border-r border-slate-300 text-left">Deduções</th>
                      <th className="p-1 border-r border-slate-300 text-left">Desconto Incond.</th>
                      <th className="p-1 border-r border-slate-300 text-left">Base de Cálculo</th>
                      <th className="p-1 border-r border-slate-300 text-left">Alíquota ISS</th>
                      <th className="p-1 border-r border-slate-300 text-left">Valor do ISSQN</th>
                      <th className="p-1 text-left">ISSQN Retido?</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    <tr className="border-b border-slate-200">
                      <td className="p-1 border-r border-slate-300 font-bold text-slate-950">
                        {formatCurrencyBRL(nota.impostos.valorServicos)}
                      </td>
                      <td className="p-1 border-r border-slate-300 text-slate-600">
                        {formatCurrencyBRL(nota.impostos.valorDeducoes)}
                      </td>
                      <td className="p-1 border-r border-slate-300 text-slate-600">
                        {formatCurrencyBRL(nota.impostos.descontoIncondicionado)}
                      </td>
                      <td className="p-1 border-r border-slate-300 text-slate-900 font-semibold">
                        {formatCurrencyBRL(nota.impostos.baseCalculo)}
                      </td>
                      <td className="p-1 border-r border-slate-300 text-slate-800">
                        {nota.impostos.aliquotaIss.toFixed(2)}%
                      </td>
                      <td className="p-1 border-r border-slate-300 text-slate-900 font-semibold">
                        {formatCurrencyBRL(nota.impostos.valorIss)}
                      </td>
                      <td className="p-1 font-semibold text-slate-800">
                        {nota.impostos.issRetido ? 'SIM (Retido)' : 'NÃO (Devido Prestador)'}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Retenções Federais */}
                <div className="mt-2 grid grid-cols-6 gap-1 border border-slate-300 p-1.5 bg-slate-50 text-[9.5px]">
                  <div>
                    <span className="text-[8.5px] text-slate-500 block">PIS (0,65%):</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {formatCurrencyBRL(nota.impostos.valorPis)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[8.5px] text-slate-500 block">COFINS (3%):</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {formatCurrencyBRL(nota.impostos.valorCofins)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[8.5px] text-slate-500 block">INSS:</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {formatCurrencyBRL(nota.impostos.valorInss)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[8.5px] text-slate-500 block">IRRF (1,5%):</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {formatCurrencyBRL(nota.impostos.valorIr)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[8.5px] text-slate-500 block">CSLL (1%):</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {formatCurrencyBRL(nota.impostos.valorCsll)}
                    </span>
                  </div>
                  <div className="bg-slate-200/80 p-1 text-right">
                    <span className="text-[8.5px] text-slate-600 block uppercase font-bold">
                      Total Retenções:
                    </span>
                    <span className="font-mono font-bold text-rose-700">
                      {formatCurrencyBRL(nota.impostos.totalRetencoes)}
                    </span>
                  </div>
                </div>

                {/* Destaque Valor Líquido */}
                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 flex items-center justify-between">
                  <span className="font-bold text-xs uppercase text-blue-950">
                    Valor Líquido da NFS-e Nacional:
                  </span>
                  <span className="font-mono font-bold text-base text-blue-800">
                    {formatCurrencyBRL(nota.impostos.valorLiquido)}
                  </span>
                </div>
              </div>
            </div>

            {/* INFORMAÇÕES COMPLEMENTARES */}
            <div className="p-2 bg-white text-[9.5px] space-y-1">
              <span className="font-bold uppercase text-[9px] text-slate-700 block">
                Outras Informações / Base Legal:
              </span>
              <p className="text-slate-700 leading-snug">
                {nota.informacoesComplementares ||
                  'Documento emitido nos termos da Lei Complementar nº 123/2006. Tributação conforme Simples Nacional.'}
              </p>
              <div className="text-[8px] text-slate-400 pt-1 border-t border-slate-100 flex items-center justify-between">
                <span>
                  Sistema AutoNFS-e Federal · Integrado à API do Portal Nacional da NFS-e (Receita
                  Federal do Brasil)
                </span>
                <span>Página 1 de 1</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer (no-print) */}
        <div className="no-print bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span>
              E-mail do Tomador:{' '}
              <strong className="text-slate-800">{nota.tomador.email}</strong> (
              <span className="text-blue-700 font-medium">
                {nota.emailStatus === 'ENVIADO' ? 'Enviado com DANFSE & XML' : 'Pendente'}
              </span>
              )
            </span>
            {nota.tomador.telefone && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  Telefone de Contato:{' '}
                  <strong className="text-slate-800">{formatPhoneNumber(nota.tomador.telefone)}</strong>
                </span>
              </>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-md font-medium transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
