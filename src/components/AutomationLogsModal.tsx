import React, { useState } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
  Trash2,
  RefreshCw,
  Clock,
  Terminal,
} from 'lucide-react';
import { AutomationLogEntry } from '../types/nfse';
import { formatDateTime } from '../utils/formatters';

interface AutomationLogsModalProps {
  logs: AutomationLogEntry[];
  onClearLogs: () => void;
  onRefresh: () => void;
  isRobotActive: boolean;
}

export const AutomationLogsModal: React.FC<AutomationLogsModalProps> = ({
  logs,
  onClearLogs,
  onRefresh,
  isRobotActive,
}) => {
  const [filterType, setFilterType] = useState<string>('ALL');

  const filtered = logs.filter((l) => {
    if (filterType === 'ALL') return true;
    return l.tipo === filterType;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold tracking-tight text-slate-900">
              Registros e Auditoria do Robô (Logs em Tempo Real)
            </h2>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono ${
                isRobotActive
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {isRobotActive ? 'Robô Operante' : 'Robô Pausado'}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Acompanhe a fila de execução, transmissões da DPS para o Portal Federal e disparos de
            e-mail com DANFSE (PDF) e XML anexados.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>Atualizar</span>
          </button>

          <button
            onClick={() => {
              if (confirm('Deseja limpar todos os registros de logs?')) {
                onClearLogs();
              }
            }}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Limpar Logs</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap gap-1">
        {['ALL', 'EMISSAO_NFSE', 'EMAIL', 'AGENDAMENTO', 'SISTEMA'].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterType(cat)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              filterType === cat
                ? 'bg-slate-900 text-white font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {cat === 'ALL'
              ? 'Todos os Eventos'
              : cat === 'EMISSAO_NFSE'
              ? 'Emissões NFS-e (Receita Federal)'
              : cat === 'EMAIL'
              ? 'Disparos E-mail'
              : cat === 'AGENDAMENTO'
              ? 'Gatilhos de Agendamento'
              : 'Sistema & Robô'}
          </button>
        ))}
      </div>

      {/* Log Feed */}
      <div className="bg-slate-950 text-slate-200 rounded-xl border border-slate-800 p-4 font-mono text-xs shadow-lg max-h-[600px] overflow-y-auto space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-slate-500 font-sans text-xs">
            Nenhum evento registrado no período.
          </div>
        ) : (
          filtered.map((log) => {
            const isSuccess = log.nivel === 'SUCESSO';
            const isWarn = log.nivel === 'AVISO';
            const isErr = log.nivel === 'ERRO';

            return (
              <div
                key={log.id}
                className="border-b border-slate-800/60 pb-2.5 last:border-0 hover:bg-slate-900/50 p-1 rounded transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                  <div className="flex items-center gap-2">
                    {isSuccess && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    )}
                    {isWarn && (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    )}
                    {isErr && <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                    {!isSuccess && !isWarn && !isErr && (
                      <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    )}

                    <span
                      className={`font-semibold ${
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
                    <span className="text-[10px] text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                      Ref: {log.referenciaId}
                    </span>
                  )}
                </div>

                <div className="mt-1 text-slate-300 pl-5 text-[11.5px] leading-relaxed break-words font-sans">
                  {log.mensagem}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
