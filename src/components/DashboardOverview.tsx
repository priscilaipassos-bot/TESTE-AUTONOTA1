import React from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Send,
  AlertTriangle,
  AlertCircle,
  Play,
  Pause,
  ArrowRight,
  ShieldCheck,
  FileCheck2,
  ExternalLink,
  Mail,
  FileCode,
  Plus,
} from 'lucide-react';
import { NfseDocument, ProgramacaoAgendamento, TomadorCliente } from '../types/nfse';
import { formatCurrencyBRL, formatDate, formatCnpj, formatCpf } from '../utils/formatters';
import { getVencimentoInfo } from '../utils/expirationHelper';

interface DashboardOverviewProps {
  notas: NfseDocument[];
  agendamentos: ProgramacaoAgendamento[];
  clientes: TomadorCliente[];
  isRobotActive: boolean;
  onToggleRobot: () => void;
  onSelectNota: (nota: NfseDocument) => void;
  onViewSchedules: () => void;
  onViewInvoices: () => void;
  onNewSchedule: () => void;
  onEmitNow: () => void;
  onExecuteScheduleNow: (agd: ProgramacaoAgendamento) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  notas,
  agendamentos,
  clientes,
  isRobotActive,
  onToggleRobot,
  onSelectNota,
  onViewSchedules,
  onViewInvoices,
  onNewSchedule,
  onEmitNow,
  onExecuteScheduleNow,
}) => {
  // Cálculos do Mês Atual
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const notasDoMes = (notas || []).filter(
    (n) => (n.dataCompetencia === currentMonthKey || (n.dataEmissao && n.dataEmissao.startsWith(currentMonthKey))) && n.status === 'AUTORIZADA'
  );
  const totalFaturadoMes = notasDoMes.length > 0
    ? notasDoMes.reduce((acc, curr) => acc + (curr.impostos?.valorServicos || 0), 0)
    : (notas || []).filter((n) => n.status === 'AUTORIZADA').reduce((acc, curr) => acc + (curr.impostos?.valorServicos || 0), 0);

  // Considerar para a fila de próximas apenas agendamentos ativos E cujo término não esteja vencido
  const agendamentosVigentes = agendamentos.filter((a) => {
    if (!a.ativo) return false;
    const info = getVencimentoInfo(a.dataTermino);
    // Se estiver vencido (status === 'VENCIDO'), NÃO aparece na Visão Geral
    if (info.status === 'VENCIDO') return false;
    return true;
  });

  const totalAutorizadas = notas.filter((n) => n.status === 'AUTORIZADA').length;

  // Próximas programações vigentes ordenadas pela data
  const proximosAgendamentos = [...agendamentosVigentes].sort(
    (a, b) => new Date(a.dataProximaExecucao).getTime() - new Date(b.dataProximaExecucao).getTime()
  );

  // Agendamentos em estado crítico (1 a 30 dias para vencer, excluindo os já vencidos)
  const agendamentosCriticos = agendamentos.filter((a) => {
    const info = getVencimentoInfo(a.dataTermino);
    return info.status === 'CRITICO';
  });

  // Agendamentos em alerta (31 a 60 dias para vencer)
  const agendamentosAlerta = agendamentos.filter((a) => {
    const info = getVencimentoInfo(a.dataTermino);
    return info.status === 'ALERTA';
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Alerta de Contratos Próximos do Fim na Visão Geral (Sinalização Amarela e Vermelha - Apenas vigentes a vencer) */}
      {(agendamentosCriticos.length > 0 || agendamentosAlerta.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {agendamentosCriticos.length > 0 && (
            <div className="bg-rose-50/90 border border-rose-300 rounded-xl p-3 sm:p-3.5 flex items-start justify-between gap-3 shadow-2xs">
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-rose-200 text-rose-800 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertCircle className="w-4 h-4 text-rose-700" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-rose-950 flex items-center gap-1.5 flex-wrap">
                    <span>{agendamentosCriticos.length} agendamento(s) encerrando em até 30 dias</span>
                    <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping inline-block" />
                  </h4>
                  <p className="text-[11px] text-rose-800 mt-0.5">
                    Contratos próximos da data de término estipulada:
                  </p>
                  <ul className="mt-1 space-y-0.5 text-[11px] text-rose-900 font-medium">
                    {agendamentosCriticos.map((a) => {
                      const v = getVencimentoInfo(a.dataTermino);
                      return (
                        <li key={a.id} className="flex items-center gap-1.5 truncate">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                          <span className="truncate">{a.titulo}</span>
                          <span className="font-mono text-[10px] bg-rose-200/80 px-1.5 py-0.2 rounded font-semibold text-rose-900 shrink-0">
                            {v.label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
              <button
                onClick={onViewSchedules}
                className="text-xs font-semibold text-rose-800 hover:text-rose-950 underline shrink-0 cursor-pointer"
              >
                Gerenciar
              </button>
            </div>
          )}

          {agendamentosAlerta.length > 0 && (
            <div className="bg-amber-50/90 border border-amber-300 rounded-xl p-3 sm:p-3.5 flex items-start justify-between gap-3 shadow-2xs">
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-amber-200 text-amber-900 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="w-4 h-4 text-amber-800" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-amber-950 flex items-center gap-1.5 flex-wrap">
                    <span>{agendamentosAlerta.length} agendamento(s) encerrando entre 31 e 60 dias</span>
                  </h4>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Contratos com término próximo para acompanhamento:
                  </p>
                  <ul className="mt-1 space-y-0.5 text-[11px] text-amber-950 font-medium">
                    {agendamentosAlerta.map((a) => {
                      const v = getVencimentoInfo(a.dataTermino);
                      return (
                        <li key={a.id} className="flex items-center gap-1.5 truncate">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                          <span className="truncate">{a.titulo}</span>
                          <span className="font-mono text-[10px] bg-amber-200/80 px-1.5 py-0.2 rounded font-semibold text-amber-900 shrink-0">
                            {v.label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
              <button
                onClick={onViewSchedules}
                className="text-xs font-semibold text-amber-900 hover:text-amber-950 underline shrink-0 cursor-pointer"
              >
                Ver todos
              </button>
            </div>
          )}
        </div>
      )}

      {/* Metrics Grid - Totalmente Responsivo em Telas Pequenas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1 */}
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Faturamento Mês</span>
            <span className="hidden sm:inline font-mono text-[11px] text-slate-400">Comp. {currentMonthKey}</span>
          </div>
          <div className="mt-1.5 sm:mt-2 text-lg sm:text-xl font-bold text-slate-900 font-mono tracking-tight truncate">
            {formatCurrencyBRL(totalFaturadoMes)}
          </div>
          <div className="mt-1 text-[10px] sm:text-[11px] text-slate-500 truncate">
            {notasDoMes.length} {notasDoMes.length === 1 ? 'nota emitida' : 'notas emitidas'}
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Agendamentos</span>
            <span className="font-mono text-[10px] sm:text-[11px] text-blue-600 font-semibold">Ativos</span>
          </div>
          <div className="mt-1.5 sm:mt-2 text-lg sm:text-xl font-bold text-slate-900 font-mono tracking-tight">
            {agendamentosVigentes.length}{' '}
            <span className="text-xs font-normal text-slate-500">
              de {agendamentos.length}
            </span>
          </div>
          <div className="mt-1 text-[10px] sm:text-[11px] text-slate-500 truncate">
            Vigentes e programados
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Notas Autorizadas</span>
            <span className="text-[10px] sm:text-[11px] text-blue-600 font-semibold hidden sm:inline">Portal RFB</span>
          </div>
          <div className="mt-1.5 sm:mt-2 text-lg sm:text-xl font-bold text-slate-900 font-mono tracking-tight">
            {totalAutorizadas}
          </div>
          <div className="mt-1 text-[10px] sm:text-[11px] text-slate-500 truncate">
            Padrão Nacional CGNFSE
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Envios por E-mail</span>
            <span className="text-[10px] sm:text-[11px] text-blue-600 font-semibold hidden sm:inline">100% Entregues</span>
          </div>
          <div className="mt-1.5 sm:mt-2 text-lg sm:text-xl font-bold text-slate-900 font-mono tracking-tight">
            {totalAutorizadas}
          </div>
          <div className="mt-1 text-[10px] sm:text-[11px] text-slate-500 truncate">
            PDF + XML anexados
          </div>
        </div>
      </div>

      {/* Main Content Layout: Upcoming Schedules & Recent Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        {/* Left Col: Upcoming Automated Schedules (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
          <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                Próximas Emissões Programadas
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500">
                Fila de notas vigentes para disparo automático
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onNewSchedule}
                className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800 bg-blue-50 px-2.5 py-1 rounded-md cursor-pointer border border-blue-200"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo</span>
              </button>
              <button
                onClick={onViewSchedules}
                className="text-xs font-semibold text-slate-700 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
              >
                <span>Ver todos ({agendamentos.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            {proximosAgendamentos.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                Nenhuma emissão programada no momento.{' '}
                <button
                  onClick={onNewSchedule}
                  className="text-blue-700 font-semibold underline ml-1 cursor-pointer"
                >
                  Cadastrar agendamento
                </button>
              </div>
            ) : (
              proximosAgendamentos.slice(0, 5).map((agd) => {
                const cliente = clientes.find((c) => c.id === agd.clienteId);
                const vencInfo = getVencimentoInfo(agd.dataTermino);

                return (
                  <div
                    key={agd.id}
                    className={`p-3.5 sm:p-4 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-l-4 ${
                      vencInfo.status === 'CRITICO'
                        ? 'border-l-rose-500 bg-rose-50/20'
                        : vencInfo.status === 'ALERTA'
                        ? 'border-l-amber-400 bg-amber-50/20'
                        : 'border-l-blue-500/40'
                    }`}
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 sm:gap-2 text-xs flex-wrap">
                        <span className="font-semibold text-slate-900 truncate">
                          {cliente?.razaoSocial || 'Cliente não identificado'}
                        </span>
                        <span aria-hidden="true" className="text-slate-300 hidden sm:inline">
                          ·
                        </span>
                        <span className="text-slate-500 font-mono text-[11px] whitespace-nowrap">
                          Dia {agd.diaDoMes} ({agd.horarioExecucao})
                        </span>
                        {/* Sinalizador de Vencimento de Contrato (Apenas alertas de 60 e 30 dias) */}
                        {agd.dataTermino && vencInfo.status !== 'NORMAL' && (
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold border ${vencInfo.badgeClass}`}
                          >
                            {vencInfo.status === 'CRITICO' ? (
                              <AlertCircle className="w-3 h-3 text-rose-700 shrink-0" />
                            ) : (
                              <AlertTriangle className="w-3 h-3 text-amber-700 shrink-0" />
                            )}
                            <span>{vencInfo.label}</span>
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-600 line-clamp-1">
                        {agd.servicoDescricao}
                      </div>

                      <div className="flex items-center gap-2 sm:gap-3 text-[11px] text-slate-400 pt-0.5 flex-wrap">
                        <span className="text-slate-900 font-semibold font-mono">
                          {formatCurrencyBRL(agd.valorServico)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="text-blue-800 font-medium">
                          Próxima: {formatDate(agd.dataProximaExecucao)}
                        </span>
                        {agd.dataTermino && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono text-slate-600">
                              Término: {formatDate(agd.dataTermino)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <span className="text-[10px] text-blue-700 font-medium sm:hidden">
                        Auto E-mail (PDF + XML)
                      </span>
                      <button
                        onClick={() => onExecuteScheduleNow(agd)}
                        className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors cursor-pointer shadow-2xs"
                        title="Antecipar e emitir agora esta nota com envio automático de E-mail"
                      >
                        Emitir Agora
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Col: Recent Invoices Issued (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
          <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                Últimas Notas Emitidas
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500">
                Visualização do DANFSE e status de envio
              </p>
            </div>
            <button
              onClick={onViewInvoices}
              className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer"
            >
              <span>Ver histórico</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            {notas.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                Nenhuma nota emitida ainda.{' '}
                <button
                  onClick={onEmitNow}
                  className="text-blue-700 font-semibold underline ml-1 cursor-pointer"
                >
                  Emitir primeira NFS-e
                </button>
              </div>
            ) : (
              notas.slice(0, 5).map((nota) => (
                <div
                  key={nota.id}
                  onClick={() => onSelectNota(nota)}
                  className="p-3 sm:p-3.5 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3 cursor-pointer group"
                >
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-slate-900 group-hover:text-blue-700 transition-colors">
                        NFS-e Nº {nota.numero}
                      </span>
                      <span className="px-1.5 py-0.2 bg-blue-50 text-blue-700 font-medium rounded text-[10px] border border-blue-200">
                        Autorizada
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 truncate">
                      {nota.tomador.razaoSocial}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2">
                      <span>{formatDate(nota.dataEmissao)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono font-medium text-slate-700">
                        {formatCurrencyBRL(nota.impostos.valorServicos)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className="p-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs"
                      title="E-mail com DANFSE e XML Entregue ao Tomador"
                    >
                      <Mail className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
