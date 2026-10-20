import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Play,
  Pause,
  Trash2,
  Edit2,
  Copy,
  Mail,
  Search,
  CheckCircle2,
  AlertCircle,
  Zap,
  AlertTriangle,
  X,
  FileText,
} from 'lucide-react';
import { ProgramacaoAgendamento, TomadorCliente } from '../types/nfse';
import { formatCurrencyBRL, formatDate } from '../utils/formatters';
import { getVencimentoInfo } from '../utils/expirationHelper';
import { parseMultipleEmails } from '../utils/emailHelper';

interface SchedulesListProps {
  agendamentos: ProgramacaoAgendamento[];
  clientes: TomadorCliente[];
  onNewSchedule: () => void;
  onEditSchedule: (agd: ProgramacaoAgendamento) => void;
  onDuplicateSchedule: (agd: ProgramacaoAgendamento) => void;
  onToggleSchedule: (id: string) => void;
  onDeleteSchedule: (id: string) => void;
  onExecuteNow: (agd: ProgramacaoAgendamento) => void;
}

export const SchedulesList: React.FC<SchedulesListProps> = ({
  agendamentos,
  clientes,
  onNewSchedule,
  onEditSchedule,
  onDuplicateSchedule,
  onToggleSchedule,
  onDeleteSchedule,
  onExecuteNow,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'PAUSED'>('ALL');
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [scheduleToDelete, setScheduleToDelete] = useState<ProgramacaoAgendamento | null>(null);

  const filtered = agendamentos.filter((a) => {
    const cliente = clientes.find((c) => c.id === a.clienteId);
    const matchesSearch =
      a.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.servicoDescricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cliente && cliente.razaoSocial.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterStatus === 'ACTIVE') return a.ativo;
    if (filterStatus === 'PAUSED') return !a.ativo;
    return true;
  });

  const handleRunNow = async (agd: ProgramacaoAgendamento) => {
    setExecutingId(agd.id);
    try {
      await onExecuteNow(agd);
    } finally {
      setExecutingId(null);
    }
  };

  const handleConfirmDelete = () => {
    if (scheduleToDelete) {
      onDeleteSchedule(scheduleToDelete.id);
      setScheduleToDelete(null);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header and Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            Programação & Emissões Automáticas
          </h2>
          <p className="text-xs text-slate-500">
            Regras de recorrência automática no Portal Nacional com envio por E-mail (PDF + XML).
          </p>
        </div>

        <button
          onClick={onNewSchedule}
          className="w-full sm:w-auto justify-center px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Agendamento</span>
        </button>
      </div>

      {/* Search and Segmented Filters */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por cliente, título ou serviço..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-900"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg overflow-x-auto max-w-full">
          <button
            onClick={() => setFilterStatus('ALL')}
            className={`px-2.5 sm:px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
              filterStatus === 'ALL'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Todos ({agendamentos.length})
          </button>
          <button
            onClick={() => setFilterStatus('ACTIVE')}
            className={`px-2.5 sm:px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
              filterStatus === 'ACTIVE'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Ativos ({agendamentos.filter((a) => a.ativo).length})
          </button>
          <button
            onClick={() => setFilterStatus('PAUSED')}
            className={`px-2.5 sm:px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
              filterStatus === 'PAUSED'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pausados ({agendamentos.filter((a) => !a.ativo).length})
          </button>
        </div>
      </div>

      {/* Mobile Card View (visível apenas em telas menores < md) */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-xs">
            Nenhum agendamento encontrado para o filtro selecionado.
          </div>
        ) : (
          filtered.map((agd) => {
            const cliente = clientes.find((c) => c.id === agd.clienteId);
            const isRunningThis = executingId === agd.id;
            const vencInfo = getVencimentoInfo(agd.dataTermino);

            return (
              <div
                key={agd.id}
                className={`bg-white rounded-xl border p-4 shadow-2xs space-y-3 transition-colors ${
                  !agd.ativo ? 'border-slate-200 opacity-70 bg-slate-50/50' : 'border-slate-200'
                }`}
              >
                {/* Cabeçalho do Card Mobile */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-900 text-sm truncate flex items-center gap-1.5 flex-wrap">
                      <span>{agd.titulo}</span>
                      {!agd.ativo && (
                        <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-mono font-normal">
                          Pausado
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-600 font-medium truncate mt-0.5">
                      {cliente?.razaoSocial || 'Cliente não vinculado'}
                    </div>
                  </div>

                  <span className="font-mono font-bold text-slate-950 text-sm whitespace-nowrap">
                    {formatCurrencyBRL(agd.valorServico)}
                  </span>
                </div>

                {/* Detalhes de Recorrência e Término */}
                <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Recorrência:</span>
                    <span className="font-medium text-slate-800 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {agd.tipoRecorrencia === 'MENSAL'
                        ? `Todo dia ${agd.diaDoMes}`
                        : agd.tipoRecorrencia === 'QUINZENAL'
                        ? '15 dias'
                        : agd.tipoRecorrencia === 'SEMANAL'
                        ? 'Semanal'
                        : 'Única'}
                    </span>
                    <span className="text-slate-500 font-mono text-[10px] block mt-0.5">
                      Próx: {formatDate(agd.dataProximaExecucao)}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px]">Término / Validade:</span>
                    {agd.dataTermino ? (
                      <div>
                        <span className="font-mono text-slate-800 text-[11px] font-semibold block">
                          {formatDate(agd.dataTermino)}
                        </span>
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] border mt-0.5 ${vencInfo.badgeClass}`}>
                          {vencInfo.label}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">Indeterminado</span>
                    )}
                  </div>
                </div>

                {/* Linha de Status e Ações */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                  {/* Alternar Ativo/Pausar */}
                  <button
                    type="button"
                    onClick={() => onToggleSchedule(agd.id)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border ${
                      agd.ativo
                        ? 'bg-blue-50 text-blue-800 border-blue-300'
                        : 'bg-amber-50 text-amber-800 border-amber-300'
                    }`}
                  >
                    {agd.ativo ? (
                      <>
                        <Pause className="w-3.5 h-3.5 text-blue-700" />
                        <span>Pausar</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 text-amber-700" />
                        <span>Reativar</span>
                      </>
                    )}
                  </button>

                  {/* Ações Rápidas */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleRunNow(agd)}
                      disabled={isRunningThis}
                      className="px-2.5 py-1 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors flex items-center gap-1 shadow-2xs cursor-pointer disabled:opacity-50"
                      title="Emitir agora"
                    >
                      <Zap className={`w-3 h-3 ${isRunningThis ? 'animate-bounce' : ''}`} />
                      <span>{isRunningThis ? 'Emitindo...' : 'Emitir'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onDuplicateSchedule(agd)}
                      className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                      title="Duplicar"
                    >
                      <Copy className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => onEditSchedule(agd)}
                      className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setScheduleToDelete(agd)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Table View (oculto em mobile, visível md:block) */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">Contrato / Cliente</th>
                <th className="py-3 px-4">Recorrência & Execução</th>
                <th className="py-3 px-4">Término / Validade</th>
                <th className="py-3 px-4 text-right">Valor do Serviço</th>
                <th className="py-3 px-4 text-center">Envio E-mail</th>
                <th className="py-3 px-4 text-center">Status / Ação</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Nenhum agendamento encontrado para o filtro selecionado.
                  </td>
                </tr>
              ) : (
                filtered.map((agd) => {
                  const cliente = clientes.find((c) => c.id === agd.clienteId);
                  const isRunningThis = executingId === agd.id;
                  const vencInfo = getVencimentoInfo(agd.dataTermino);

                  return (
                    <tr
                      key={agd.id}
                      className={`hover:bg-slate-50/60 transition-colors group ${
                        !agd.ativo ? 'opacity-65 bg-slate-50/30' : ''
                      }`}
                    >
                      {/* Cliente & Titulo */}
                      <td className="py-3.5 px-4 max-w-[260px]">
                        <div className="font-semibold text-slate-900 truncate flex items-center gap-1.5">
                          <span>{agd.titulo}</span>
                          {!agd.ativo && (
                            <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-mono">
                              Pausado
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {cliente?.razaoSocial || 'Cliente não vinculado'}
                        </div>
                        <div className="text-[10px] text-blue-700 truncate font-mono mt-0.5 flex items-center gap-1" title={agd.emailsDestinatarios || cliente?.email}>
                          <Mail className="w-2.5 h-2.5 shrink-0" />
                          <span>
                            {parseMultipleEmails(agd.emailsDestinatarios || cliente?.email).length > 1
                              ? `${parseMultipleEmails(agd.emailsDestinatarios || cliente?.email).length} e-mails destinatários`
                              : (agd.emailsDestinatarios || cliente?.email || 'Sem e-mail')}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center justify-between gap-1">
                          <span>cTribNac: {agd.codigoTributacaoNacional}</span>
                          {agd.servicoDescricao && (agd.servicoDescricao.includes('{') || agd.servicoDescricao.toLowerCase().includes('período')) && (
                            <span className="text-[9px] bg-blue-50 text-blue-700 border border-blue-200 px-1 rounded font-sans font-medium" title="Usa tags dinâmicas atualizadas mensalmente">
                              Tags Ativas
                            </span>
                          )}
                        </div>
                        {agd.servicoDescricao && (
                          <div
                            className="text-[10px] text-slate-500 font-mono mt-0.5 truncate flex items-center gap-1 max-w-[240px]"
                            title={`Discriminação do serviço:\n${agd.servicoDescricao}`}
                          >
                            <FileText className="w-2.5 h-2.5 shrink-0 text-slate-400" />
                            <span className="truncate">{agd.servicoDescricao}</span>
                          </div>
                        )}
                      </td>

                      {/* Recorrência */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-medium text-slate-800">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {agd.tipoRecorrencia === 'MENSAL'
                              ? `Mensal todo dia ${agd.diaDoMes}`
                              : agd.tipoRecorrencia === 'QUINZENAL'
                              ? 'A cada 15 dias'
                              : agd.tipoRecorrencia === 'SEMANAL'
                              ? 'Semanal'
                              : 'Emissão Única Agendada'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 font-mono">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>Horário: <strong>{agd.horarioExecucao}</strong> (Brasília)</span>
                          <span aria-hidden="true">·</span>
                          <span className="text-blue-700 font-semibold">
                            Próxima: {formatDate(agd.dataProximaExecucao)}
                          </span>
                        </div>
                      </td>

                      {/* Término e Status do Contrato */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {agd.dataTermino ? (
                          <div className="space-y-1">
                            <div className="font-mono text-slate-800 text-[11px] font-semibold">
                              {formatDate(agd.dataTermino)}
                            </div>
                            <div>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border ${vencInfo.badgeClass}`}
                              >
                                {vencInfo.status === 'CRITICO' || vencInfo.status === 'VENCIDO' ? (
                                  <AlertCircle className="w-3 h-3 shrink-0" />
                                ) : vencInfo.status === 'ALERTA' ? (
                                  <AlertTriangle className="w-3 h-3 shrink-0" />
                                ) : null}
                                <span>{vencInfo.label}</span>
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">
                            Indeterminado
                          </span>
                        )}
                      </td>

                      {/* Valor */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="font-mono font-bold text-slate-900">
                          {formatCurrencyBRL(agd.valorServico)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          ISS: {agd.aliquotaIss.toFixed(1)}% {agd.issRetido ? '(Retido)' : ''}
                        </div>
                      </td>

                      {/* Automações Ativas */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium ${
                            agd.enviarEmailAutomatico
                              ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}
                          title={
                            agd.enviarEmailAutomatico
                              ? 'Envio automático de DANFSE e XML por e-mail ativado'
                              : 'Envio por e-mail desativado'
                          }
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span>{agd.enviarEmailAutomatico ? 'Automático' : 'Desativado'}</span>
                        </span>
                        <div className="text-[10px] text-slate-400 mt-1 font-mono">
                          {agd.totalEmitidas} {agd.totalEmitidas === 1 ? 'emitida' : 'emitidas'}
                        </div>
                      </td>

                      {/* Status / Botão de Pausar e Reativar */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onToggleSchedule(agd.id)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border shadow-2xs cursor-pointer ${
                            agd.ativo
                              ? 'bg-blue-50 text-blue-800 border-blue-300 hover:bg-amber-50 hover:text-amber-900 hover:border-amber-300'
                              : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-blue-50 hover:text-blue-800 hover:border-blue-300'
                          }`}
                          title={agd.ativo ? 'Clique para pausar este agendamento' : 'Clique para reativar este agendamento'}
                        >
                          {agd.ativo ? (
                            <>
                              <Pause className="w-3.5 h-3.5 text-blue-700" />
                              <span>Ativo (Pausar)</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5 text-amber-700" />
                              <span>Pausado (Reativar)</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleRunNow(agd)}
                            disabled={isRunningThis}
                            className="px-2.5 py-1 text-[11px] font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors flex items-center gap-1 shadow-2xs cursor-pointer disabled:opacity-50"
                            title="Disparar emissão da NFS-e agora e notificar por e-mail"
                          >
                            <Zap className={`w-3 h-3 ${isRunningThis ? 'animate-bounce' : ''}`} />
                            <span>{isRunningThis ? 'Transmitindo...' : 'Emitir Agora'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onDuplicateSchedule(agd)}
                            className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                            title="Duplicar este agendamento"
                            aria-label="Duplicar agendamento"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onEditSchedule(agd)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                            title="Editar agendamento"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setScheduleToDelete(agd)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                            title="Excluir agendamento"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      {/* Modal de Confirmação de Exclusão (In-App Modal em vez de window.confirm) */}
      {scheduleToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-900">
                  Excluir Agendamento?
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Tem certeza que deseja excluir permanentemente o agendamento{' '}
                  <strong className="text-slate-900 font-semibold break-words">
                    "{scheduleToDelete.titulo}"
                  </strong>
                  ? Esta regra de emissão automática será removida.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setScheduleToDelete(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setScheduleToDelete(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sim, Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
