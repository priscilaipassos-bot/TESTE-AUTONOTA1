import { ProgramacaoAgendamento } from '../types/nfse';

export interface VencimentoInfo {
  diasRestantes: number | null;
  status: 'VENCIDO' | 'CRITICO' | 'ALERTA' | 'NORMAL' | 'SEM_DATA';
  label: string;
  badgeClass: string;
  cardBorderClass: string;
}

/**
 * Calcula a proximidade do término do contrato/agendamento:
 * - CRITICO (Vermelho): até 30 dias restantes (1 a 30 dias) ou vencido (<= 0)
 * - ALERTA (Amarelo): entre 31 e 60 dias restantes
 * - NORMAL (Verde/Neutro): mais de 60 dias
 * - SEM_DATA: Contrato por tempo indeterminado
 */
export function getVencimentoInfo(dataTermino?: string): VencimentoInfo {
  if (!dataTermino) {
    return {
      diasRestantes: null,
      status: 'SEM_DATA',
      label: 'Indeterminado',
      badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
      cardBorderClass: 'border-slate-200',
    };
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const [ano, mes, dia] = dataTermino.split('-').map(Number);
  const dataFinal = new Date(ano, mes - 1, dia);
  dataFinal.setHours(0, 0, 0, 0);

  const diffTime = dataFinal.getTime() - hoje.getTime();
  const diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diasRestantes < 0) {
    return {
      diasRestantes,
      status: 'VENCIDO',
      label: `Vencido há ${Math.abs(diasRestantes)} dias`,
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
      cardBorderClass: 'border-rose-400 bg-rose-50/20',
    };
  }

  if (diasRestantes <= 30) {
    return {
      diasRestantes,
      status: 'CRITICO',
      label: diasRestantes === 0 ? 'Encerra hoje' : `Encerra em ${diasRestantes} dia(s)`,
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 font-semibold animate-pulse',
      cardBorderClass: 'border-rose-400 bg-rose-50/30',
    };
  }

  if (diasRestantes <= 60) {
    return {
      diasRestantes,
      status: 'ALERTA',
      label: `Encerra em ${diasRestantes} dias`,
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 font-semibold',
      cardBorderClass: 'border-amber-400 bg-amber-50/30',
    };
  }

  return {
    diasRestantes,
    status: 'NORMAL',
    label: `Vigente (${diasRestantes} dias)`,
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    cardBorderClass: 'border-slate-200',
  };
}
