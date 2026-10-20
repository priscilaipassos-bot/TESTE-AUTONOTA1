/**
 * Utilitário de Fuso Horário Oficial de Brasília (America/Sao_Paulo, UTC-3)
 */

export interface BrasiliaDateTime {
  dataStr: string; // YYYY-MM-DD
  horaStr: string; // HH:mm
  ano: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  formatada: string;
}

/**
 * Retorna data e hora atuais ou de uma data específica estritamente no Horário Oficial de Brasília
 */
export function getBrasiliaDateTime(date: Date = new Date()): BrasiliaDateTime {
  const dateObj = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();

  const dtfDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dataStr = dtfDate.format(dateObj); // 'YYYY-MM-DD'
  const [ano, mes, dia] = dataStr.split('-').map(Number);

  const dtfTime = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const horaStr = dtfTime.format(dateObj); // 'HH:mm'
  const [hora, minuto] = horaStr.split(':').map(Number);

  return {
    dataStr,
    horaStr,
    ano,
    mes,
    dia,
    hora,
    minuto,
    formatada: `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano} ${horaStr}`,
  };
}
