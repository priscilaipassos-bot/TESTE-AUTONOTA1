import React, { useState } from 'react';
import {
  FileText,
  FileDown,
  Search,
  Download,
  Mail,
  Printer,
  CheckCircle2,
  XCircle,
  Eye,
  AlertOctagon,
  AlertTriangle,
  Copy,
  Check,
  Plus,
  Clock,
  RefreshCw,
  X,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { NfseDocument } from '../types/nfse';
import { storageService } from '../services/storageService';
import { AutomationRunner } from '../services/automationRunner';
import { applyNotaasXmlToDocument } from '../utils/notaasXmlParser';
import {
  formatCurrencyBRL,
  formatDateTime,
  formatCnpj,
  formatCpf,
  formatChaveAcesso,
} from '../utils/formatters';
import { parseMultipleEmails } from '../utils/emailHelper';

interface InvoicesListProps {
  notas: NfseDocument[];
  onSelectNota: (nota: NfseDocument) => void;
  onCancelNota: (id: string, motivo: string, codigoMotivo?: string) => Promise<any> | void;
  onResendEmail: (nota: NfseDocument) => void;
  onEmitNow: () => void;
  onReemitirNota?: (nota: NfseDocument, customDps?: string, customSerie?: string) => Promise<{ sucesso: boolean; nota?: NfseDocument; erro?: string }>;
}

export const InvoicesList: React.FC<InvoicesListProps> = ({
  notas,
  onSelectNota,
  onCancelNota,
  onResendEmail,
  onEmitNow,
  onReemitirNota,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'AUTORIZADA' | 'PROCESSANDO' | 'CANCELADA'>('ALL');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [checkingStatusId, setCheckingStatusId] = useState<string | null>(null);

  // Estados do Modal Oficial de Cancelamento
  const [notaParaCancelar, setNotaParaCancelar] = useState<NfseDocument | null>(null);
  const [codigoMotivoCancelamento, setCodigoMotivoCancelamento] = useState<string>('1');
  const [motivoCancelamento, setMotivoCancelamento] = useState<string>('');
  const [cancelando, setCancelando] = useState<boolean>(false);
  const [cancelResult, setCancelResult] = useState<{ sucesso: boolean; mensagem: string } | null>(null);

  // Estados do Modal de Reemissão para o Notaas
  const [notaParaReemitir, setNotaParaReemitir] = useState<NfseDocument | null>(null);
  const [reemitDps, setReemitDps] = useState<string>('');
  const [reemitSerie, setReemitSerie] = useState<string>('1608');
  const [reemitindo, setReemitindo] = useState<boolean>(false);
  const [reemitResult, setReemitResult] = useState<{ sucesso: boolean; mensagem: string } | null>(null);

  const handleOpenReemitModal = (nota: NfseDocument, e: React.MouseEvent) => {
    e.stopPropagation();
    const prestador = storageService.getPrestador();
    setNotaParaReemitir(nota);
    setReemitDps(storageService.getNextNumeroDps());
    setReemitSerie(prestador.serieDps || '1608');
    setReemitResult(null);
  };

  const handleConfirmReemit = async () => {
    if (!notaParaReemitir) return;
    setReemitindo(true);
    setReemitResult(null);
    try {
      if (onReemitirNota) {
        const res = await onReemitirNota(notaParaReemitir, reemitDps.trim(), reemitSerie.trim());
        if (res.sucesso) {
          setReemitResult({
            sucesso: true,
            mensagem: `NFS-e Nº ${res.nota?.numero || notaParaReemitir.numero} retransmitida com sucesso ao Notaas! (Aviso: E-mail não enviado automaticamente).`
          });
        } else {
          setReemitResult({
            sucesso: false,
            mensagem: res.erro || 'Falha na transmissão ao Notaas.'
          });
        }
      }
    } catch (err: any) {
      setReemitResult({
        sucesso: false,
        mensagem: `Erro na reemissão: ${err.message || 'Falha de comunicação'}`
      });
    } finally {
      setReemitindo(false);
    }
  };

  const filtered = (notas || []).filter((n) => {
    if (!n) return false;
    const num = String(n.numero || '');
    const chave = String(n.chaveAcesso || '');
    const tomadorNome = String(n.tomador?.razaoSocial || n.tomador?.nomeContato || '');
    const tomadorDoc = String(n.tomador?.documento || '');
    const term = (searchTerm || '').trim().toLowerCase();

    if (term) {
      const matchesSearch =
        num.toLowerCase().includes(term) ||
        chave.toLowerCase().includes(term) ||
        tomadorNome.toLowerCase().includes(term) ||
        tomadorDoc.toLowerCase().includes(term);

      if (!matchesSearch) return false;
    }

    if (statusFilter === 'AUTORIZADA') return n.status === 'AUTORIZADA';
    if (statusFilter === 'PROCESSANDO') return n.status === 'PROCESSANDO';
    if (statusFilter === 'CANCELADA') return n.status === 'CANCELADA';
    return true;
  });

  const handleCheckInvoiceStatus = async (nota: NfseDocument, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!nota.notaasId) {
      alert('Esta nota não possui ID de rastreamento no Notaas.');
      return;
    }

    setCheckingStatusId(nota.id);
    try {
      const prestador = storageService.getPrestador();
      const apiKey = prestador.apiKeyNotas || '';
      const res = await fetch(`/api/notaas/invoice-status/${nota.notaasId}`, {
        headers: { 'x-api-key': apiKey },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao consultar status');
      }

      const statusRetorno = data.data?.status || data.status;
      if (statusRetorno === 'authorized' || statusRetorno === 'emitted' || statusRetorno === 'issued') {
        const numAutorizado = String(data.data?.numero || data.data?.nfeNumero || data.dadosXml?.numero || nota.numero);
        let updated: NfseDocument = {
          ...nota,
          status: 'AUTORIZADA' as const,
          numero: numAutorizado,
          chaveAcesso: data.data?.chave || data.data?.chaveAcesso || data.dadosXml?.chaveAcesso || nota.chaveAcesso,
          linkDanfse: data.data?.pdf || data.data?.pdfUrl || nota.linkDanfse,
          linkXml: data.data?.xml || data.data?.xmlUrl || nota.linkXml,
          notaasStatus: statusRetorno,
          transmissaoReal: true,
        };

        if (data.xmlConteudo) {
          updated = applyNotaasXmlToDocument(updated, data.xmlConteudo);
        }

        storageService.updateNota(updated);
        alert(`✅ NFS-e Nº ${updated.numero} AUTORIZADA com sucesso! Dados sincronizados a partir do XML oficial do Notaas.`);
        if (!updated.emailEnviado) {
          onResendEmail(updated);
        }
      } else if (statusRetorno === 'error' || data.data?.errorMessage) {
        const errDesc = data.data?.errorMessage || 'Rejeição na emissão';
        const updated = {
          ...nota,
          status: 'ERRO' as const,
          notaasStatus: 'error',
          rejeicaoSefaz: { codigo: data.data?.errorCode || 'ERR', mensagem: errDesc },
        };
        storageService.updateNota(updated);
        alert(`⚠️ Retorno da SEFAZ: ${errDesc}`);
      } else {
        alert(`ℹ️ A nota continua em processamento na SEFAZ (Status: ${statusRetorno}). Aguarde a autorização.`);
      }
    } catch (err: any) {
      alert(`Erro na consulta: ${err.message}`);
    } finally {
      setCheckingStatusId(null);
    }
  };

  const [syncingXmlId, setSyncingXmlId] = useState<string | null>(null);

  const handleSyncXml = async (notaItem: NfseDocument, e: React.MouseEvent) => {
    e.stopPropagation();
    setSyncingXmlId(notaItem.id);
    try {
      const res = await AutomationRunner.sincronizarNotaComNotaasXml(notaItem);
      if (res.sucesso && res.nota) {
        alert(`✅ Dados da NFS-e Nº ${res.nota.numero} sincronizados com sucesso a partir do XML oficial do Notaas! Chave: ${res.nota.chaveAcesso}`);
      } else {
        alert(`⚠️ ${res.erro || 'Não foi possível sincronizar o XML do Notaas.'}`);
      }
    } catch (err: any) {
      alert(`Erro ao sincronizar XML: ${err.message}`);
    } finally {
      setSyncingXmlId(null);
    }
  };

  const handleCopyKey = (chave: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(chave);
    setCopiedKey(chave);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDownloadXml = (nota: NfseDocument, e: React.MouseEvent) => {
    e.stopPropagation();
    const xml = nota.xmlConteudo || '<?xml version="1.0" encoding="UTF-8"?><NFSe/>';
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NFSe_${nota.numero}_Notaas.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = async (nota: NfseDocument, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
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
      const a = document.createElement('a');
      a.href = url;
      a.download = `DANFSE_${nota.numero || 'Nacional'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Erro ao baixar DANFSE em PDF: ${err.message}`);
    }
  };

  const handlePromptCancel = (nota: NfseDocument, e: React.MouseEvent) => {
    e.stopPropagation();
    const motivo = prompt(
      `Confirma o cancelamento da NFS-e Nº ${nota.numero} no Notaas?\nInforme a justificativa:`
    );
    if (motivo && motivo.trim().length >= 5) {
      onCancelNota(nota.id, motivo.trim());
    } else if (motivo !== null) {
      alert('A justificativa deve ter no mínimo 5 caracteres.');
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            Histórico de Notas Fiscais Emitidas
          </h2>
          <p className="text-xs text-slate-500">
            Consulte o DANFSE oficial, baixe o arquivo XML assinado ou reenvie por e-mail com 1 clique.
          </p>
        </div>

        <button
          onClick={onEmitNow}
          className="w-full sm:w-auto justify-center px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Emitir Nova NFS-e</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por número, tomador ou CNPJ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-900"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg overflow-x-auto max-w-full">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-2.5 sm:px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Todas ({notas.length})
          </button>
          <button
            onClick={() => setStatusFilter('AUTORIZADA')}
            className={`px-2.5 sm:px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
              statusFilter === 'AUTORIZADA'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Autorizadas ({notas.filter((n) => n.status === 'AUTORIZADA').length})
          </button>
          <button
            onClick={() => setStatusFilter('PROCESSANDO')}
            className={`px-2.5 sm:px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
              statusFilter === 'PROCESSANDO'
                ? 'bg-white text-amber-800 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-amber-800'
            }`}
          >
            Em Processamento ({notas.filter((n) => n.status === 'PROCESSANDO').length})
          </button>
          <button
            onClick={() => setStatusFilter('CANCELADA')}
            className={`px-2.5 sm:px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
              statusFilter === 'CANCELADA'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Canceladas ({notas.filter((n) => n.status === 'CANCELADA').length})
          </button>
        </div>
      </div>

      {/* Mobile Card List (visível em telas < md) */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-xs">
            Nenhuma nota fiscal encontrada.
          </div>
        ) : (
          filtered.map((nota) => {
            const docFormatado =
              nota.tomador.tipoInscricao === 'CNPJ'
                ? formatCnpj(nota.tomador.documento)
                : formatCpf(nota.tomador.documento);

            return (
              <div
                key={nota.id}
                onClick={() => onSelectNota(nota)}
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3 cursor-pointer hover:border-slate-300 transition-colors"
              >
                {/* Topo do card */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-950 text-sm">
                        NFS-e Nº {nota.numero}
                      </span>
                      {nota.transmissaoReal ? (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-semibold bg-blue-100 text-blue-800 border border-blue-300">
                          Notaas Oficial
                        </span>
                      ) : null}
                      {nota.rejeicaoSefaz ? (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-300"
                          title={`Rejeição SEFAZ: [${nota.rejeicaoSefaz.codigo}] ${nota.rejeicaoSefaz.mensagem}`}
                        >
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          <span>Rejeição {nota.rejeicaoSefaz.codigo}</span>
                        </span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                            nota.status === 'AUTORIZADA'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {nota.status === 'AUTORIZADA' ? (
                            <CheckCircle2 className="w-3 h-3 text-blue-600" />
                          ) : (
                            <XCircle className="w-3 h-3 text-rose-600" />
                          )}
                          <span>{nota.status}</span>
                        </span>
                      )}
                    </div>

                    <div className="font-semibold text-slate-900 text-xs truncate mt-1">
                      {nota.tomador.razaoSocial}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      {docFormatado}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono font-bold text-slate-950 text-sm">
                      {formatCurrencyBRL(nota.impostos.valorLiquido)}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {formatDateTime(nota.dataEmissao)}
                    </div>
                  </div>
                </div>

                {/* Chave de Acesso */}
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-center justify-between gap-2 text-[10px] font-mono text-slate-500">
                  <span className="truncate">Chave: {formatChaveAcesso(nota.chaveAcesso)}</span>
                  <button
                    type="button"
                    onClick={(e) => handleCopyKey(nota.chaveAcesso, e)}
                    className="text-slate-400 hover:text-blue-700 shrink-0 p-1"
                    title="Copiar chave"
                  >
                    {copiedKey === nota.chaveAcesso ? (
                      <Check className="w-3 h-3 text-blue-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>

                {/* Ações Mobile */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                  <span
                    className={`text-[10px] font-medium flex items-center gap-1 ${
                      nota.emailStatus === 'ENVIADO'
                        ? 'text-blue-700'
                        : nota.emailStatus === 'ERRO'
                        ? 'text-rose-600'
                        : 'text-amber-600'
                    }`}
                  >
                    <Mail className="w-3 h-3" />
                    <span>
                      {nota.emailStatus === 'ENVIADO'
                        ? 'E-mail Entregue'
                        : nota.emailStatus === 'ERRO'
                        ? 'E-mail Falhou'
                        : 'E-mail Pendente'}
                    </span>
                  </span>

                  <div className="flex items-center gap-1">
                    {nota.notaasId && (
                      <button
                        type="button"
                        onClick={(e) => handleCheckInvoiceStatus(nota, e)}
                        className="p-1.5 text-slate-600 hover:text-amber-700 bg-amber-50 rounded-md"
                        title="Consultar retorno da nota na API Notaas / SEFAZ"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${
                            checkingStatusId === nota.id ? 'animate-spin text-amber-600' : ''
                          }`}
                        />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectNota(nota);
                      }}
                      className="px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-800 rounded-md hover:bg-blue-100 transition-colors flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Ver DANFSE</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleDownloadPdf(nota, e)}
                      className="p-1.5 text-slate-600 hover:text-blue-700 bg-slate-100 rounded-md"
                      title="Baixar DANFSE em PDF"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onResendEmail(nota);
                      }}
                      className="p-1.5 text-slate-600 hover:text-blue-700 bg-slate-100 rounded-md"
                      title="Reenviar E-mail com DANFSE (PDF) e XML"
                    >
                      <Mail className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleDownloadXml(nota, e)}
                      className="p-1.5 text-slate-600 hover:text-slate-950 bg-slate-100 rounded-md"
                      title="Baixar XML"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    {(nota.notaasId || nota.linkXml) && (
                      <button
                        type="button"
                        onClick={(e) => handleSyncXml(nota, e)}
                        className="p-1.5 text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors border border-emerald-200"
                        title="Puxar dados oficiais do XML emitido pelo Notaas"
                      >
                        <Sparkles
                          className={`w-3.5 h-3.5 ${
                            syncingXmlId === nota.id ? 'animate-spin text-emerald-700' : ''
                          }`}
                        />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => handleOpenReemitModal(nota, e)}
                      className="p-1.5 text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 rounded-md transition-colors border border-amber-200"
                      title="Reemitir no Notaas (Apenas envia ao Notaas, não envia e-mail)"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Table of Invoices (desktop view) */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">NFS-e / Chave de Acesso</th>
                <th className="py-3 px-4">Tomador do Serviço</th>
                <th className="py-3 px-4">Emissão & Competência</th>
                <th className="py-3 px-4 text-right">Valor Líquido</th>
                <th className="py-3 px-4 text-center">Envio por E-mail</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Nenhuma nota fiscal encontrada.
                  </td>
                </tr>
              ) : (
                filtered.map((nota) => {
                  const docFormatado =
                    nota.tomador.tipoInscricao === 'CNPJ'
                      ? formatCnpj(nota.tomador.documento)
                      : formatCpf(nota.tomador.documento);

                  return (
                    <tr
                      key={nota.id}
                      onClick={() => onSelectNota(nota)}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                    >
                      {/* Número & Chave */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-950 text-xs">
                            NFS-e Nº {nota.numero}
                          </span>
                          {nota.transmissaoReal && (
                            <span className="text-[9px] bg-blue-100 text-blue-800 border border-blue-300 px-1 py-0.2 rounded font-semibold font-sans">
                              Notaas
                            </span>
                          )}
                          <button
                            onClick={(e) => handleCopyKey(nota.chaveAcesso, e)}
                            className="text-[10px] text-slate-400 hover:text-blue-700 flex items-center gap-0.5"
                            title="Copiar chave de acesso de 50 dígitos"
                          >
                            {copiedKey === nota.chaveAcesso ? (
                              <Check className="w-3 h-3 text-blue-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        <div className="font-mono text-[10px] text-slate-400 truncate max-w-[210px] mt-0.5">
                          {formatChaveAcesso(nota.chaveAcesso)}
                        </div>
                      </td>

                      {/* Tomador */}
                      <td className="py-3.5 px-4 max-w-[240px]">
                        <div className="font-semibold text-slate-900 truncate">
                          {nota.tomador.razaoSocial}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {docFormatado}
                        </div>
                      </td>

                      {/* Emissão */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="text-slate-800 font-medium">
                          {formatDateTime(nota.dataEmissao)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Comp. {nota.dataCompetencia}
                        </div>
                      </td>

                      {/* Valor */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="font-mono font-bold text-slate-950">
                          {formatCurrencyBRL(nota.impostos.valorLiquido)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Bruto: {formatCurrencyBRL(nota.impostos.valorServicos)}
                        </div>
                      </td>

                      {/* Envio por E-mail */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium ${
                            nota.emailEnviado
                              ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                              : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                          }`}
                          title={`Destinatários: ${nota.emailDestinatario || nota.tomador.email}`}
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span>
                            {nota.emailEnviado ? 'Entregue' : 'Pendente'}
                            {parseMultipleEmails(nota.emailDestinatario || nota.tomador.email).length > 1
                              ? ` (${parseMultipleEmails(nota.emailDestinatario || nota.tomador.email).length})`
                              : ''}
                          </span>
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {nota.rejeicaoSefaz ? (
                          <div className="inline-flex flex-col items-center">
                            <span
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-900 border border-amber-300"
                              title={`SEFAZ [${nota.rejeicaoSefaz.codigo}]: ${nota.rejeicaoSefaz.mensagem}`}
                            >
                              <AlertTriangle className="w-3 h-3 text-amber-700" />
                              <span>Rejeição {nota.rejeicaoSefaz.codigo}</span>
                            </span>
                            <span className="text-[9px] text-amber-700 max-w-[130px] truncate mt-0.5" title={nota.rejeicaoSefaz.mensagem}>
                              {nota.rejeicaoSefaz.mensagem}
                            </span>
                          </div>
                        ) : nota.status === 'PROCESSANDO' ? (
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800 border border-amber-300"
                            title="Nota fiscal transmitida para a API. Em processamento na prefeitura/SEFAZ."
                          >
                            <Clock className="w-3 h-3 text-amber-600 animate-spin" />
                            <span>Processando</span>
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${
                              nota.status === 'AUTORIZADA'
                                ? 'bg-blue-100/80 text-blue-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {nota.status === 'AUTORIZADA' ? (
                              <CheckCircle2 className="w-3 h-3 text-blue-600" />
                            ) : (
                              <XCircle className="w-3 h-3 text-rose-600" />
                            )}
                            <span>{nota.status}</span>
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {nota.notaasId && (
                            <button
                              onClick={(e) => handleCheckInvoiceStatus(nota, e)}
                              className="p-1.5 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded-md transition-colors"
                              title="Consultar retorno da nota na API Notaas / SEFAZ"
                            >
                              <RefreshCw
                                className={`w-4 h-4 ${
                                  checkingStatusId === nota.id ? 'animate-spin text-amber-600' : ''
                                }`}
                              />
                            </button>
                          )}

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectNota(nota);
                            }}
                            className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-slate-100 rounded-md transition-colors"
                            title="Visualizar DANFSE oficial"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={(e) => handleDownloadPdf(nota, e)}
                            className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-slate-100 rounded-md transition-colors"
                            title="Baixar DANFSE em PDF oficial"
                          >
                            <FileDown className="w-4 h-4" />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onResendEmail(nota);
                            }}
                            className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-slate-100 rounded-md transition-colors"
                            title="Reenviar e-mail fiscal com DANFSE (PDF) e XML anexados"
                          >
                            <Mail className="w-4 h-4" />
                          </button>

                          <button
                            onClick={(e) => handleDownloadXml(nota, e)}
                            className="p-1.5 text-slate-600 hover:text-slate-950 hover:bg-slate-100 rounded-md transition-colors"
                            title="Baixar XML oficial assinado"
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          {(nota.notaasId || nota.linkXml) && (
                            <button
                              onClick={(e) => handleSyncXml(nota, e)}
                              className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-md transition-colors cursor-pointer"
                              title="Puxar dados oficiais do XML emitido pelo Notaas"
                            >
                              <Sparkles
                                className={`w-4 h-4 ${
                                  syncingXmlId === nota.id ? 'animate-spin text-emerald-700' : ''
                                }`}
                              />
                            </button>
                          )}

                          <button
                            onClick={(e) => handleOpenReemitModal(nota, e)}
                            className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-md transition-colors cursor-pointer"
                            title="Reemitir no Notaas (Apenas envia ao Notaas, não envia e-mail)"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>

                          {nota.status === 'AUTORIZADA' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setNotaParaCancelar(nota);
                                setCodigoMotivoCancelamento('1');
                                setMotivoCancelamento('');
                                setCancelResult(null);
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                              title="Cancelar NFS-e no Notaas e Receita Federal"
                            >
                              <AlertOctagon className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Oficial de Cancelamento */}
      {notaParaCancelar && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-rose-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 text-rose-300" />
                <div>
                  <h3 className="font-bold text-sm">Cancelar NFS-e Nacional Nº {notaParaCancelar.numero}</h3>
                  <p className="text-[11px] text-rose-200">Homologação de Evento de Cancelamento Oficial</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNotaParaCancelar(null)}
                className="text-rose-200 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-xs">
              {/* Alerta de Responsabilidade Fiscal */}
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-950 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Atenção: Cancelamento Fiscal na Receita Federal</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-900">
                  Ao confirmar, o sistema enviará a solicitação de cancelamento para a API do <strong>Notaas</strong> e registrará o Evento de Cancelamento no <strong>Portal Nacional da NFS-e (Receita Federal)</strong>.
                </p>
                <p className="text-[10.5px] text-slate-600">
                  <em>Regra Federal:</em> O cancelamento só é homologado pela Receita se a nota estiver dentro do prazo regulamentar do município e antes do recolhimento do imposto do Simples Nacional (DAS).
                </p>
              </div>

              {/* Detalhes da Nota */}
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px]">
                <div>
                  <span className="text-slate-500 block">Tomador:</span>
                  <span className="font-semibold text-slate-900">{notaParaCancelar.tomador.razaoSocial}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Valor dos Serviços:</span>
                  <span className="font-semibold text-slate-900">{formatCurrencyBRL(notaParaCancelar.impostos.valorServicos)}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500 block">Chave de Acesso:</span>
                  <span className="font-mono text-[10px] text-slate-700 break-all">{notaParaCancelar.chaveAcesso}</span>
                </div>
              </div>

              {/* Formulário de Cancelamento */}
              {!cancelResult ? (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!motivoCancelamento || motivoCancelamento.trim().length < 15) {
                      alert('A Receita Federal exige uma justificativa com no mínimo 15 caracteres.');
                      return;
                    }

                    setCancelando(true);
                    try {
                      const res = await onCancelNota(
                        notaParaCancelar.id,
                        motivoCancelamento.trim(),
                        codigoMotivoCancelamento
                      );
                      if (res) {
                        setCancelResult({
                          sucesso: res.sucesso,
                          mensagem: res.mensagem || 'Cancelamento processado com sucesso.',
                        });
                      } else {
                        setCancelResult({
                          sucesso: true,
                          mensagem: `NFS-e Nº ${notaParaCancelar.numero} cancelada com sucesso.`,
                        });
                      }
                    } catch (err: any) {
                      setCancelResult({
                        sucesso: false,
                        mensagem: `Erro ao cancelar: ${err.message}`,
                      });
                    } finally {
                      setCancelando(false);
                    }
                  }}
                  className="space-y-3"
                >
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Código do Motivo (Padrão SNNFSE):
                    </label>
                    <select
                      value={codigoMotivoCancelamento}
                      onChange={(e) => setCodigoMotivoCancelamento(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs"
                    >
                      <option value="1">1 - Erro na emissão / dados incorretos da nota</option>
                      <option value="2">2 - Serviço não prestado / contrato rescindido</option>
                      <option value="3">3 - Duplicidade da NFS-e</option>
                      <option value="9">9 - Outros motivos legais</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Justificativa detalhada do cancelamento:</span>
                      <span className={`text-[10px] ${motivoCancelamento.length >= 15 ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {motivoCancelamento.length}/15 caracteres mín.
                      </span>
                    </label>
                    <textarea
                      rows={3}
                      value={motivoCancelamento}
                      onChange={(e) => setMotivoCancelamento(e.target.value)}
                      placeholder="Ex: Nota emitida com erro no valor do serviço conforme solicitação do cliente..."
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs"
                      required
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                    <button
                      type="button"
                      disabled={cancelando}
                      onClick={() => setNotaParaCancelar(null)}
                      className="px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    >
                      Voltar / Desistir
                    </button>
                    <button
                      type="submit"
                      disabled={cancelando || motivoCancelamento.trim().length < 15}
                      className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-lg transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <AlertOctagon className={`w-3.5 h-3.5 ${cancelando ? 'animate-spin' : ''}`} />
                      <span>{cancelando ? 'Transmitindo à Receita...' : 'Confirmar Cancelamento Oficial'}</span>
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div
                    className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
                      cancelResult.sucesso
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                        : 'bg-rose-50 border-rose-300 text-rose-950'
                    }`}
                  >
                    {cancelResult.sucesso ? (
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <span className="leading-relaxed font-medium">{cancelResult.mensagem}</span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-700 space-y-1">
                    <span className="font-semibold block text-slate-900">Acompanhamento e Portais Oficiais:</span>
                    <p>Você pode conferir o status atualizado da nota a qualquer momento nos portais:</p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <a
                        href="https://platform.notaas.com.br"
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-700 hover:underline flex items-center gap-1 font-medium"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Painel Notaas (platform.notaas.com.br)</span>
                      </a>
                      <span className="text-slate-300">&bull;</span>
                      <a
                        href="https://www.nfse.gov.br/EmissorNacional"
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-700 hover:underline flex items-center gap-1 font-medium"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Portal Nacional da NFS-e (Receita Federal)</span>
                      </a>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setNotaParaCancelar(null)}
                      className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Oficial de Reemissão para o Notaas */}
      {notaParaReemitir && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-amber-600 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-amber-200" />
                <div>
                  <h3 className="font-bold text-sm">Reemitir NFS-e Nº {notaParaReemitir.numero} no Notaas</h3>
                  <p className="text-[11px] text-amber-100">Transmissão Direta para platform.notaas.com.br</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNotaParaReemitir(null)}
                className="text-amber-200 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-xs">
              {/* Aviso Explícito Obrigatório Solicitado pelo Usuário */}
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-950 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Aviso Importante sobre a Reemissão</span>
                </div>
                <p className="text-[11.5px] leading-relaxed text-amber-900 font-medium">
                  A reemissão <strong>apenas envia os dados fiscais para a API Notaas</strong> (Receita Federal / prefeitura).
                </p>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  ⚠️ <strong>O E-MAIL NÃO SERÁ ENVIADO AUTOMATICAMENTE</strong> ao tomador. Caso deseje enviar a nota ao cliente após a autorização, utilize o botão <em>"Reenviar E-mail"</em> na listagem de notas.
                </p>
              </div>

              {/* Detalhes da Nota Fiscal */}
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px]">
                <div>
                  <span className="text-slate-500 block">Tomador:</span>
                  <span className="font-semibold text-slate-900">{notaParaReemitir.tomador.razaoSocial}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Valor dos Serviços:</span>
                  <span className="font-semibold text-slate-900">{formatCurrencyBRL(notaParaReemitir.impostos.valorServicos)}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500 block">Discriminação:</span>
                  <span className="text-slate-700 line-clamp-2">{notaParaReemitir.servico.descricao}</span>
                </div>
              </div>

              {/* Ajuste de DPS para a reemissão */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-blue-50/50 border border-blue-200 rounded-lg">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Número da DPS:
                  </label>
                  <input
                    type="number"
                    value={reemitDps}
                    onChange={(e) => setReemitDps(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-mono font-bold text-slate-900 focus:ring-1 focus:ring-blue-500"
                    placeholder="Ex: 21"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Próxima DPS sequencial</span>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Série da DPS:
                  </label>
                  <input
                    type="text"
                    value={reemitSerie}
                    onChange={(e) => setReemitSerie(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-mono font-bold text-slate-900 focus:ring-1 focus:ring-blue-500"
                    placeholder="1608"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Série oficial</span>
                </div>
              </div>

              {/* Resultado da Reemissão se concluída */}
              {reemitResult && (
                <div
                  className={`p-3 rounded-lg border text-xs font-medium flex items-start gap-2 ${
                    reemitResult.sucesso
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : 'bg-rose-50 border-rose-300 text-rose-900'
                  }`}
                >
                  {reemitResult.sucesso ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <span>{reemitResult.mensagem}</span>
                    {reemitResult.sucesso && (
                      <p className="text-[11px] text-emerald-800 font-normal">
                        Lembre-se: O e-mail não foi enviado automaticamente. Você pode dispará-lo quando desejar clicando no ícone de e-mail.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Ações */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setNotaParaReemitir(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-md font-medium cursor-pointer"
                >
                  {reemitResult?.sucesso ? 'Fechar' : 'Cancelar'}
                </button>
                {!reemitResult?.sucesso && (
                  <button
                    type="button"
                    disabled={reemitindo || !reemitDps.trim()}
                    onClick={handleConfirmReemit}
                    className="px-4 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-md shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${reemitindo ? 'animate-spin' : ''}`} />
                    <span>{reemitindo ? 'Transmitindo ao Notaas...' : 'Confirmar Reemissão (Sem E-mail)'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
