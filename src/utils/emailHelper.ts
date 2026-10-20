/**
 * Utilitários para tratamento e validação de múltiplos e-mails de destinatários
 */

/**
 * Valida o formato básico de um e-mail
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const clean = email.trim();
  // Regex padrão RFC 5322 simplificado
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(
    clean
  );
}

/**
 * Extrai e normaliza múltiplos e-mails a partir de uma string ou array.
 * Aceita separadores como vírgula (,), ponto e vírgula (;), espaços ou quebras de linha.
 */
export function parseMultipleEmails(input: string | string[] | undefined | null): string[] {
  if (!input) return [];

  const rawList: string[] = [];
  if (Array.isArray(input)) {
    input.forEach((item) => {
      if (typeof item === 'string') {
        item.split(/[;, \n\r\t]+/).forEach((p) => rawList.push(p));
      }
    });
  } else if (typeof input === 'string') {
    input.split(/[;, \n\r\t]+/).forEach((p) => rawList.push(p));
  }

  const uniqueValid: string[] = [];
  for (const item of rawList) {
    const clean = item.trim().toLowerCase();
    if (clean && clean.includes('@') && !uniqueValid.includes(clean)) {
      uniqueValid.push(clean);
    }
  }

  return uniqueValid;
}

/**
 * Junta uma lista de múltiplos e-mails em string separada por vírgula e espaço
 */
export function joinEmails(emails: string | string[] | undefined | null): string {
  const parsed = parseMultipleEmails(emails);
  return parsed.join(', ');
}
