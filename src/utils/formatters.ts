export function formatCnpj(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return cnpj;
  return digits.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5'
  );
}

export function formatCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return digits.replace(
    /^(\d{3})(\d{3})(\d{3})(\d{2})$/,
    '$1.$2.$3-$4'
  );
}

export function formatDocumento(doc: string): string {
  const digits = doc.replace(/\D/g, '');
  if (digits.length === 14) return formatCnpj(doc);
  if (digits.length === 11) return formatCpf(doc);
  return doc;
}

export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  // DDI 55 + DDD (2) + 9 dígitos = 13
  if (digits.startsWith('55') && digits.length === 13) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  // DDD (2) + 9 dígitos = 11
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  // DDD (2) + 8 dígitos = 10
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

export function cleanPhoneForWhatsApp(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (!digits.startsWith('55')) {
    digits = '55' + digits;
  }
  return digits;
}

export function formatChaveAcesso(chave: string): string {
  const digits = chave.replace(/\D/g, '');
  if (digits.length !== 50) return chave;
  // Format into blocks of 4 or official 50-digit federal blocks
  return digits.replace(
    /(\d{7})(\d{2})(\d{14})(\d{2})(\d{3})(\d{11})(\d{1})(\d{9})(\d{1})/,
    '$1 $2 $3 $4 $5 $6 $7 $8 $9'
  );
}

export function formatDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return isoString;
  }
}

export function formatDate(dateString: string): string {
  try {
    const d = new Date(dateString.includes('T') ? dateString : `${dateString}T00:00:00`);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateString;
  }
}
