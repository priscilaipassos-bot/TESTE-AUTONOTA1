/**
 * Utilitário Oficial para geração da URL do QR Code de Consulta Pública da NFS-e
 * O QR Code remete ao site oficial de consulta da Nota Fiscal e já preenche automaticamente
 * a Chave de Acesso (50 dígitos) da NFS-e, permitindo conferência e autenticidade imediatas.
 */

export function buildNfseConsultaUrl(nota: any, urlCustom?: string): string {
  const chaveLimpa = String(nota?.chaveAcesso || '').replace(/\D/g, '');
  const numLimpo = String(nota?.numero || '').replace(/\D/g, '');
  const cnpjPrestador = String(nota?.prestador?.cnpj || '46874965000104').replace(/\D/g, '');
  const codVerif = String(nota?.codigoVerificacao || '').trim();
  const dpsNum = String(nota?.dpsNumero || '').replace(/\D/g, '');

  // 1. Caso o prestador ou prefeitura tenha configurado uma URL específica de consulta pública
  const customPortal = urlCustom || nota?.prestador?.urlConsultaNfse;
  if (customPortal && customPortal.trim()) {
    const base = customPortal.trim();
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}chv=${chaveLimpa}&chave=${chaveLimpa}&chaveAcesso=${chaveLimpa}&numero=${numLimpo}&num=${numLimpo}&cnpj=${cnpjPrestador}&codVerif=${encodeURIComponent(codVerif)}&verificacao=${encodeURIComponent(codVerif)}`;
  }

  // 2. Se a plataforma Notaas forneceu um link de consulta pública web direto (que não seja arquivo binário .pdf ou .xml)
  if (nota?.linkConsulta && String(nota.linkConsulta).startsWith('http')) {
    const base = String(nota.linkConsulta).trim();
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}chv=${chaveLimpa}&chave=${chaveLimpa}&chaveAcesso=${chaveLimpa}&numero=${numLimpo}`;
  }

  // 3. Padrão Oficial do Portal Nacional da NFS-e (Receita Federal do Brasil / Serpro):
  // URL Oficial: https://www.nfse.gov.br/consultapublica
  // A query string preenche os parâmetros de chave de acesso de 50 dígitos para preenchimento imediato no site:
  // - chv: Parâmetro oficial do Serpro / Receita Federal para preenchimento da chave de acesso
  // - chave: Alias padrão para consulta pública
  // - chaveAcesso: Alias adicional
  // - numero: Número da NFS-e
  // - cnpj: CNPJ do prestador emissor
  // - codVerif: Código de verificação de autenticidade
  // - dps: Número da Declaração de Prestação de Serviços (DPS)
  const params = new URLSearchParams();
  if (chaveLimpa) {
    params.set('chv', chaveLimpa);
    params.set('chave', chaveLimpa);
    params.set('chaveAcesso', chaveLimpa);
  }
  if (numLimpo) {
    params.set('numero', numLimpo);
    params.set('num', numLimpo);
    params.set('n', numLimpo);
  }
  if (cnpjPrestador) {
    params.set('cnpj', cnpjPrestador);
  }
  if (codVerif) {
    params.set('codVerif', codVerif);
    params.set('verificacao', codVerif);
  }
  if (dpsNum) {
    params.set('dps', dpsNum);
  }

  return `https://www.nfse.gov.br/consultapublica?${params.toString()}`;
}
