import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar, Clock, DollarSign, FileText, Mail, Check, Sparkles } from 'lucide-react';
import { ProgramacaoAgendamento, TomadorCliente, ServicoItem } from '../types/nfse';
import { formatDynamicDescription } from '../utils/periodHelper';
import { parseMultipleEmails } from '../utils/emailHelper';
import { renderTemplateWithContext } from '../utils/templateHelper';
import { TemplateTagsHelper } from './TemplateTagsHelper';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (agd: ProgramacaoAgendamento) => void;
  scheduleToEdit: ProgramacaoAgendamento | null;
  clientes: TomadorCliente[];
  servicos: ServicoItem[];
  onOpenNewClient: () => void;
}

export const ScheduleModal: React.FC<ScheduleModalProps> = ({
  isOpen,
  onClose,
  onSave,
  scheduleToEdit,
  clientes,
  servicos,
  onOpenNewClient,
}) => {
  const [titulo, setTitulo] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [servicoDescricao, setServicoDescricao] = useState('');
  const [codigoTributacaoNacional, setCodigoTributacaoNacional] = useState('01.07.01');
  const [itemLC116, setItemLC116] = useState('1.07');
  const [valorServico, setValorServico] = useState<number>(3500);
  const [aliquotaIss, setAliquotaIss] = useState<number>(2.0);
  const [issRetido, setIssRetido] = useState(false);
  const [reterImpostosFederais, setReterImpostosFederais] = useState(false);
  const [informacoesComplementares, setInformacoesComplementares] = useState(
    'Documento emitido por ME ou EPP optante pelo Simples Nacional.'
  );

  const [tipoRecorrencia, setTipoRecorrencia] = useState<'MENSAL' | 'QUINZENAL' | 'SEMANAL' | 'UNICA'>('MENSAL');
  const [diaDoMes, setDiaDoMes] = useState<number>(5);
  const [horarioExecucao, setHorarioExecucao] = useState('08:00');
  const [dataProximaExecucao, setDataProximaExecucao] = useState(
    new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  );
  const [dataTermino, setDataTermino] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [enviarEmailAutomatico, setEnviarEmailAutomatico] = useState(true);
  const [emailsDestinatarios, setEmailsDestinatarios] = useState('');
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
    if (scheduleToEdit) {
      setTitulo(scheduleToEdit.titulo);
      setClienteId(scheduleToEdit.clienteId);
      const cFound = clientes.find((c) => c.id === scheduleToEdit.clienteId);
      setEmailsDestinatarios(scheduleToEdit.emailsDestinatarios || cFound?.email || '');
      setServicoDescricao(scheduleToEdit.servicoDescricao);
      setCodigoTributacaoNacional(scheduleToEdit.codigoTributacaoNacional);
      setItemLC116(scheduleToEdit.itemLC116);
      setValorServico(scheduleToEdit.valorServico);
      setAliquotaIss(scheduleToEdit.aliquotaIss);
      setIssRetido(scheduleToEdit.issRetido);
      setReterImpostosFederais(scheduleToEdit.reterImpostosFederais);
      setInformacoesComplementares(scheduleToEdit.informacoesComplementares);
      setTipoRecorrencia(scheduleToEdit.tipoRecorrencia);
      setDiaDoMes(scheduleToEdit.diaDoMes);
      setHorarioExecucao(scheduleToEdit.horarioExecucao);
      setDataProximaExecucao(scheduleToEdit.dataProximaExecucao);
      setDataTermino(scheduleToEdit.dataTermino || '');
      setAtivo(scheduleToEdit.ativo);
      setEnviarEmailAutomatico(scheduleToEdit.enviarEmailAutomatico);
    } else {
      setTitulo('');
      const defaultClient = clientes[0];
      setClienteId(defaultClient?.id || '');
      setEmailsDestinatarios(defaultClient?.email || '');
      const srv0 = servicos[0];
      setServicoDescricao(srv0 ? formatDynamicDescription(srv0.descricaoPadrao, new Date()) : '');
      setCodigoTributacaoNacional(srv0?.codigoTributacaoNacional || '99.01.01');
      setItemLC116(srv0?.codigoItemLC116 || '99.01');
      setValorServico(srv0?.valorPadrao || 3900);
      setAliquotaIss(srv0?.aliquotaIss ?? 0.0);
      setIssRetido(false);
      setReterImpostosFederais(false);
      setInformacoesComplementares(
        srv0?.codigoTributacaoNacional === '99.01.01'
          ? 'EMPRESA OPTANTE PELO SIMPLES NACIONAL. OPERAÇÃO FORA DO CAMPO DE INCIDÊNCIA DO ISSQN (LOCAÇÃO DE BENS MÓVEIS CONFORME SÚMULA VINCULANTE 31 DO STF).'
          : 'Documento emitido por ME ou EPP optante pelo Simples Nacional.'
      );
      setTipoRecorrencia('MENSAL');
      setDiaDoMes(5);
      setHorarioExecucao('08:00');
      // Próxima data padrão: dia 5 do próximo mês
      const nextDate = new Date();
      nextDate.setDate(5);
      if (nextDate.getTime() < Date.now()) {
        nextDate.setMonth(nextDate.getMonth() + 1);
      }
      setDataProximaExecucao(nextDate.toISOString().slice(0, 10));
      setDataTermino('');
      setAtivo(true);
      setEnviarEmailAutomatico(true);
    }
  }, [scheduleToEdit, isOpen, clientes, servicos]);

  if (!isOpen) return null;

  const handleSelectPredefinedService = (srvId: string) => {
    const srv = servicos.find((s) => s.id === srvId);
    if (srv) {
      setServicoDescricao(formatDynamicDescription(srv.descricaoPadrao, new Date()));
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
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteId) {
      alert('Selecione um cliente tomador para o agendamento.');
      return;
    }
    if (!titulo.trim()) {
      alert('Informe um título identificador para o agendamento.');
      return;
    }

    const payload: ProgramacaoAgendamento = {
      id: scheduleToEdit ? scheduleToEdit.id : `agd-${Date.now()}`,
      titulo: titulo.trim(),
      clienteId,
      servicoDescricao,
      codigoTributacaoNacional,
      itemLC116,
      valorServico: Number(valorServico),
      aliquotaIss: Number(aliquotaIss),
      issRetido,
      reterImpostosFederais,
      informacoesComplementares,
      tipoRecorrencia,
      diaDoMes: Number(diaDoMes),
      horarioExecucao,
      dataProximaExecucao,
      dataTermino: dataTermino.trim() ? dataTermino.trim() : undefined,
      ativo,
      enviarEmailAutomatico,
      emailsDestinatarios: emailsDestinatarios.trim() || undefined,
      totalEmitidas: scheduleToEdit ? scheduleToEdit.totalEmitidas : 0,
      criadoEm: scheduleToEdit ? scheduleToEdit.criadoEm : new Date().toISOString(),
    };

    onSave(payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {scheduleToEdit ? 'Editar Programação de NFS-e' : 'Programar Emissão Automática'}
            </h3>
            <p className="text-xs text-slate-500">
              A nota será gerada no Portal Nacional da Receita Federal e enviada por E-mail e WhatsApp
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-4 text-xs">
          {/* Identificação */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Título do Contrato / Regra:
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Mensalidade TI Nexus Digital"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white text-slate-900"
              />
            </div>

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
                    setEmailsDestinatarios(found.email);
                  }
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white text-slate-900 text-xs"
              >
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.razaoSocial} ({c.email})
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
                  placeholder="financeiro@empresa.com, fiscal@empresa.com, preposto@empresa.com"
                  value={emailsDestinatarios}
                  onChange={(e) => setEmailsDestinatarios(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-mono text-slate-900 focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Carregado do cadastro do tomador. Você pode adicionar ou alterar os e-mails destinatários desta programação.
                </span>

                {parseMultipleEmails(emailsDestinatarios).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {parseMultipleEmails(emailsDestinatarios).map((em, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 border border-blue-200 text-blue-800 rounded text-[10px] font-mono"
                      >
                        <Check className="w-2.5 h-2.5 text-blue-600" />
                        <span>{em}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Modelos rápidos de Serviço */}
          <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>Preencher com Modelo de Serviço:</span>
              </span>
              <span className="text-[10px] text-blue-700 font-semibold bg-blue-100 px-2 py-0.5 rounded-full">
                Clique para selecionar
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

          {/* Discriminação dos Serviços */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
              <label className="block font-semibold text-slate-700">
                Discriminação dos Serviços (aparecerá no DANFSE):
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
                valorServico: Number(valorServico),
                aliquotaIss: Number(aliquotaIss),
                issRetido,
                codigoTributacaoNacional,
                itemLC116,
                numeroNfse: '64',
                numeroDps: '21',
                serieDps: '1608',
                dataCompetencia: new Date().toISOString().slice(0, 7),
              }}
              previewTitle="Pré-visualização da discriminação para as emissões deste agendamento:"
              targetFieldLabel="discriminação do serviço"
            />
          </div>

          {/* Códigos Fiscais CGNFSE e Valores */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Código Trib. Nacional:
              </label>
              <input
                type="text"
                required
                value={codigoTributacaoNacional}
                onChange={(e) => setCodigoTributacaoNacional(e.target.value)}
                placeholder="Ex: 01.07.01"
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
                placeholder="Ex: 1.07"
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

          {/* Retenções */}
          <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={issRetido}
                onChange={(e) => setIssRetido(e.target.checked)}
                className="rounded text-blue-600 focus:ring-0"
              />
              <span className="text-slate-800 font-medium">ISS Retido pelo Tomador</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={reterImpostosFederais}
                onChange={(e) => setReterImpostosFederais(e.target.checked)}
                className="rounded text-blue-600 focus:ring-0"
              />
              <span className="text-slate-800 font-medium">
                Reter Impostos Federais (PIS, COFINS, IRRF, CSLL)
              </span>
            </label>
          </div>

          {/* Regras de Recorrência e Agendamento */}
          <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-200 space-y-3">
            <h4 className="font-bold text-blue-950 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-700" />
              <span>Programação de Recorrência & Horário</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Recorrência:</label>
                <select
                  value={tipoRecorrencia}
                  onChange={(e) =>
                    setTipoRecorrencia(e.target.value as 'MENSAL' | 'QUINZENAL' | 'SEMANAL' | 'UNICA')
                  }
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900"
                >
                  <option value="MENSAL">Mensal</option>
                  <option value="QUINZENAL">A cada 15 dias</option>
                  <option value="SEMANAL">Semanal</option>
                  <option value="UNICA">Emissão Única</option>
                </select>
              </div>

              {tipoRecorrencia === 'MENSAL' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Dia do Mês:</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={diaDoMes}
                    onChange={(e) => setDiaDoMes(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-slate-900"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Horário de Disparo (Horário de Brasília):
                </label>
                <input
                  type="time"
                  required
                  value={horarioExecucao}
                  onChange={(e) => setHorarioExecucao(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-slate-900"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Fuso de Brasília (BRT / UTC-3)</span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Próxima Emissão:</label>
                <input
                  type="date"
                  required
                  value={dataProximaExecucao}
                  onChange={(e) => setDataProximaExecucao(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Data de Término:</span>
                  <span className="text-[10px] text-slate-400 font-normal">Opcional</span>
                </label>
                <input
                  type="date"
                  value={dataTermino}
                  onChange={(e) => setDataTermino(e.target.value)}
                  placeholder="dd/mm/aaaa"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-slate-900"
                />
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Fim do contrato. Emite alertas de 60 e 30 dias.
                </span>
              </div>
            </div>
          </div>

          {/* Automações pós-emissão */}
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
            <h4 className="font-bold text-slate-900">Automações Pós-Emissão pelo Robô:</h4>

            <div className="space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enviarEmailAutomatico}
                  onChange={(e) => setEnviarEmailAutomatico(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-0"
                />
                <span className="text-slate-800 font-medium flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  <span>Enviar automaticamente por E-mail com DANFSE (PDF) e XML oficial anexados</span>
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-0"
                />
                <span className="text-slate-900 font-semibold">
                  Manter esta regra de agendamento ativa
                </span>
              </label>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Salvar Agendamento</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
