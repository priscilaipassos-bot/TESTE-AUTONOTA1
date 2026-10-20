/**
 * Utilitário para ajuste dinâmico do período e de tags na discriminação do serviço
 */
import { renderTemplateWithContext, getPeriodInfo } from './templateHelper';

export function getLastDayOfMonth(year: number, monthIndex0: number): number {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

export function formatMonthYearPeriod(date: Date = new Date()): {
  diaInicio: string;
  diaFim: string;
  mes: string;
  ano: string;
  periodoStr: string;
} {
  const p = getPeriodInfo(date);
  return {
    diaInicio: p.diaInicio,
    diaFim: p.diaFim,
    mes: p.mes,
    ano: p.ano,
    periodoStr: p.periodoComPrefixo,
  };
}

/**
 * Substitui tags dinâmicas e o período com base na data da emissão
 */
export function formatDynamicDescription(
  descricaoOriginal: string,
  targetDate: Date = new Date()
): string {
  if (!descricaoOriginal) return '';

  // Renderiza com todas as tags dinâmicas suportadas pelo sistema
  return renderTemplateWithContext(descricaoOriginal, {
    targetDate,
  });
}
