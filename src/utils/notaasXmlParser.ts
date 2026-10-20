import { NfseDocument, ImpostosCalculados } from '../types/nfse';

/**
 * Utilitário Oficial para extração e parsing do XML gerado pelo Notaas / Receita Federal / SEFAZ / Prefeitura.
 * Garante que todos os dados enviados por e-mail e exibidos no DANFSE em PDF correspondam
 * exatamente aos valores oficiais emitidos e autorizados.
 */

// Extrai o conteúdo interno de uma tag XML ignorando namespaces e atributos
function extractXmlTag(xml: string, tagNames: string[]): string | undefined {
  if (!xml) return undefined;
  for (const tag of tagNames) {
    // Procura por <tag>, <prefix:tag>, <tag attr="..."> com suporte a quebras de linha e CDATA
    const regex = new RegExp(`<(?:[\\w\\d_-]+:)?${tag}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w\\d_-]+:)?${tag}>`, 'i');
    const match = xml.match(regex);
    if (match && match[1] !== undefined) {
      let val = match[1].trim();
      // Remove wrapper CDATA se existir
      const cdataMatch = val.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/i);
      if (cdataMatch) {
        val = cdataMatch[1].trim();
      }
      return val;
    }
  }
  return undefined;
}

// Extrai valor numérico de tag XML
function extractXmlNumber(xml: string, tagNames: string[]): number | undefined {
  const val = extractXmlTag(xml, tagNames);
  if (!val) return undefined;
  // Converte 1234,56 ou 1234.56
  const clean = val.replace(/\s/g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? undefined : num;
}

// Extrai atributo XML
function extractXmlAttr(xml: string, tagName: string, attrName: string): string | undefined {
  if (!xml) return undefined;
  const regex = new RegExp(`<(?:[\\w\\d_-]+:)?${tagName}[^>]*\\b${attrName}=["']([^"']+)["'][^>]*>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : undefined;
}

export interface ParsedNotaasXmlData {
  chaveAcesso?: string;
  numero?: string;
  codigoVerificacao?: string;
  dataEmissao?: string;
  dataCompetencia?: string;
  dpsNumero?: string;
  dpsSerie?: string;
  prestador?: {
    cnpj?: string;
    razaoSocial?: string;
    nomeFantasia?: string;
    inscricaoMunicipal?: string;
    telefone?: string;
    email?: string;
    endereco?: {
      logradouro?: string;
      numero?: string;
      complemento?: string;
      bairro?: string;
      codigoMunicipio?: string;
      municipio?: string;
      uf?: string;
      cep?: string;
    };
  };
  tomador?: {
    documento?: string;
    tipoInscricao?: 'CNPJ' | 'CPF';
    razaoSocial?: string;
    nomeContato?: string;
    email?: string;
    telefone?: string;
    inscricaoMunicipal?: string;
    endereco?: {
      logradouro?: string;
      numero?: string;
      complemento?: string;
      bairro?: string;
      codigoMunicipio?: string;
      municipio?: string;
      uf?: string;
      cep?: string;
    };
  };
  servico?: {
    descricao?: string;
    codigoTributacaoNacional?: string;
    itemLC116?: string;
    cnae?: string;
    localPrestacaoMunicipio?: string;
    localPrestacaoUf?: string;
    localPrestacaoIbge?: string;
    operacaoNaoSujeitaIss?: boolean;
  };
  impostos?: Partial<ImpostosCalculados>;
  informacoesComplementares?: string;
}

/**
 * Analisa e extrai os campos oficiais de um XML emitido via Notaas / Padrão Nacional / ABRASF.
 */
export function parseNotaasNfseXml(xmlContent: string): ParsedNotaasXmlData {
  const result: ParsedNotaasXmlData = {};
  if (!xmlContent || typeof xmlContent !== 'string') {
    return result;
  }

  // 1. CHAVE DE ACESSO (50 dígitos ou 44 dígitos)
  let chave = extractXmlTag(xmlContent, ['chNFSe', 'chaveAcesso', 'chave', 'ChaveAcesso', 'chDFe']);
  if (!chave) {
    // Tenta no atributo Id="NFS..."
    const idVal = extractXmlAttr(xmlContent, 'infNFSe', 'Id') || extractXmlAttr(xmlContent, 'InfNfse', 'Id');
    if (idVal) {
      chave = idVal.replace(/^NFS/i, '');
    }
  }
  if (!chave) {
    // Procura padrão de 50 dígitos no XML
    const match50 = xmlContent.match(/\b(\d{50})\b/);
    if (match50) {
      chave = match50[1];
    }
  }
  if (chave) {
    result.chaveAcesso = chave.replace(/\D/g, '');
  }

  // 2. NÚMERO DA NFS-E
  const numeroStr = extractXmlTag(xmlContent, [
    'nNFSe',
    'Numero',
    'numero',
    'nNfse',
    'numeroNfe',
    'nNFSeEmitida',
    'numNfse',
    'numeroNota',
  ]);
  if (numeroStr) {
    result.numero = numeroStr.trim();
  }

  // 3. CÓDIGO DE VERIFICAÇÃO
  const codVerif = extractXmlTag(xmlContent, [
    'cVerif',
    'codigoVerificacao',
    'CodigoVerificacao',
    'cVerifNfse',
    'codVerificacao',
  ]);
  if (codVerif) {
    result.codigoVerificacao = codVerif.trim();
  }

  // 4. DATA E HORA DE EMISSÃO
  const dtEmi = extractXmlTag(xmlContent, ['dhEmi', 'DataEmissao', 'dataEmissao', 'dEmi']);
  if (dtEmi) {
    result.dataEmissao = dtEmi.trim();
  }

  // 5. DATA DE COMPETÊNCIA
  const dtComp = extractXmlTag(xmlContent, ['dCompet', 'Competencia', 'dataCompetencia', 'competencia']);
  if (dtComp) {
    result.dataCompetencia = dtComp.trim().slice(0, 7);
  }

  // 6. DPS / RPS NÚMERO E SÉRIE
  const dpsNum = extractXmlTag(xmlContent, ['nDPS', 'NumeroDps', 'nutil', 'NumeroRps']);
  const dpsSerie = extractXmlTag(xmlContent, ['sDPS', 'SerieDps', 'SerieRps', 'serieDps']);
  if (dpsNum) result.dpsNumero = dpsNum.trim();
  if (dpsSerie) result.dpsSerie = dpsSerie.trim();

  // 7. PRESTADOR
  const emitBloco = extractXmlTag(xmlContent, ['emit', 'PrestadorServico', 'prestador', 'Prestador']) || xmlContent;
  const emitCnpj = extractXmlTag(emitBloco, ['CNPJ', 'Cnpj', 'cnpj']);
  const emitRazao = extractXmlTag(emitBloco, ['xNome', 'RazaoSocial', 'razaoSocial']);
  const emitFantasia = extractXmlTag(emitBloco, ['xFant', 'NomeFantasia', 'nomeFantasia']);
  const emitIm = extractXmlTag(emitBloco, ['IM', 'InscricaoMunicipal', 'inscricaoMunicipal']);
  const emitFone = extractXmlTag(emitBloco, ['fone', 'Telefone', 'telefone']);
  const emitEmail = extractXmlTag(emitBloco, ['email', 'Email']);

  const emitLgr = extractXmlTag(emitBloco, ['xLgr', 'Endereco', 'logradouro', 'Logradouro']);
  const emitNro = extractXmlTag(emitBloco, ['nro', 'Numero', 'numero']);
  const emitBairro = extractXmlTag(emitBloco, ['xBairro', 'Bairro', 'bairro']);
  const emitMun = extractXmlTag(emitBloco, ['xMun', 'Municipio', 'cidade', 'municipio']);
  const emitUf = extractXmlTag(emitBloco, ['UF', 'uf', 'Estado']);
  const emitCep = extractXmlTag(emitBloco, ['CEP', 'cep']);
  const emitCodMun = extractXmlTag(emitBloco, ['cMun', 'CodigoMunicipio', 'codigoIbge']);

  if (emitCnpj || emitRazao) {
    result.prestador = {
      cnpj: emitCnpj ? emitCnpj.replace(/\D/g, '') : undefined,
      razaoSocial: emitRazao,
      nomeFantasia: emitFantasia,
      inscricaoMunicipal: emitIm,
      telefone: emitFone ? emitFone.replace(/\D/g, '') : undefined,
      email: emitEmail,
      endereco: {
        logradouro: emitLgr,
        numero: emitNro,
        bairro: emitBairro,
        codigoMunicipio: emitCodMun,
        municipio: emitMun,
        uf: emitUf,
        cep: emitCep ? emitCep.replace(/\D/g, '') : undefined,
      },
    };
  }

  // 8. TOMADOR
  const tomaBloco = extractXmlTag(xmlContent, ['toma', 'TomadorServico', 'tomador', 'Tomador']) || '';
  const tomaCnpj = extractXmlTag(tomaBloco, ['CNPJ', 'Cnpj', 'cnpj']);
  const tomaCpf = extractXmlTag(tomaBloco, ['CPF', 'Cpf', 'cpf']);
  const tomaDoc = tomaCnpj || tomaCpf;
  const tomaRazao = extractXmlTag(tomaBloco, ['xNome', 'RazaoSocial', 'razaoSocial', 'nome']);
  const tomaEmail = extractXmlTag(tomaBloco, ['email', 'Email']);
  const tomaFone = extractXmlTag(tomaBloco, ['fone', 'Telefone', 'telefone']);
  const tomaIm = extractXmlTag(tomaBloco, ['IM', 'InscricaoMunicipal', 'inscricaoMunicipal']);

  const tomaLgr = extractXmlTag(tomaBloco, ['xLgr', 'Endereco', 'logradouro', 'Logradouro']);
  const tomaNro = extractXmlTag(tomaBloco, ['nro', 'Numero', 'numero']);
  const tomaBairro = extractXmlTag(tomaBloco, ['xBairro', 'Bairro', 'bairro']);
  const tomaMun = extractXmlTag(tomaBloco, ['xMun', 'Municipio', 'cidade', 'municipio']);
  const tomaUf = extractXmlTag(tomaBloco, ['UF', 'uf', 'Estado']);
  const tomaCep = extractXmlTag(tomaBloco, ['CEP', 'cep']);
  const tomaCodMun = extractXmlTag(tomaBloco, ['cMun', 'CodigoMunicipio', 'codigoIbge']);

  if (tomaDoc || tomaRazao) {
    result.tomador = {
      documento: tomaDoc ? tomaDoc.replace(/\D/g, '') : undefined,
      tipoInscricao: tomaCnpj ? 'CNPJ' : 'CPF',
      razaoSocial: tomaRazao,
      nomeContato: tomaRazao,
      email: tomaEmail,
      telefone: tomaFone ? tomaFone.replace(/\D/g, '') : undefined,
      inscricaoMunicipal: tomaIm,
      endereco: {
        logradouro: tomaLgr,
        numero: tomaNro,
        bairro: tomaBairro,
        codigoMunicipio: tomaCodMun,
        municipio: tomaMun,
        uf: tomaUf,
        cep: tomaCep ? tomaCep.replace(/\D/g, '') : undefined,
      },
    };
  }

  // 9. SERVIÇO PRESTADO
  const servBloco = extractXmlTag(xmlContent, ['serv', 'Servico', 'servico']) || xmlContent;
  const servDesc = extractXmlTag(servBloco, [
    'xDescServ',
    'Discriminacao',
    'discriminacao',
    'xServ',
    'Descricao',
    'descricao',
  ]);
  const cTribNac = extractXmlTag(servBloco, ['cTribNac', 'codigoTributacaoNacional']);
  const itemLc = extractXmlTag(servBloco, ['itemLc116', 'ItemListaServico', 'cTribMun']);
  const cnae = extractXmlTag(servBloco, ['cnae', 'CNAE']);
  const locMun = extractXmlTag(servBloco, ['cLocPrestacao', 'MunicipioPrestacaoServico', 'xLocPrestacao']);

  if (servDesc || cTribNac || itemLc) {
    result.servico = {
      descricao: servDesc,
      codigoTributacaoNacional: cTribNac,
      itemLC116: itemLc,
      cnae: cnae,
      localPrestacaoMunicipio: locMun,
      operacaoNaoSujeitaIss: cTribNac === '99.01.01',
    };
  }

  // 10. VALORES E IMPOSTOS CALCULADOS
  const valBloco = extractXmlTag(xmlContent, ['valores', 'Valores', 'valoresServico']) || xmlContent;
  const vServ = extractXmlNumber(valBloco, ['vServ', 'ValorServicos', 'valorServicos', 'valor']);
  const pAliq = extractXmlNumber(valBloco, ['pAliq', 'Aliquota', 'aliquotaIss', 'aliquota']);
  const vIss = extractXmlNumber(valBloco, ['vISSQN', 'ValorIss', 'valorIss', 'vIss']);
  const tpRet = extractXmlTag(valBloco, ['tpRetISSQN', 'IssRetido', 'issRetido']);
  const issRetidoBool = tpRet === '1' || tpRet === 'true' || tpRet === 'S';

  const vPis = extractXmlNumber(valBloco, ['vPis', 'ValorPis', 'valorPis']) || 0;
  const vCofins = extractXmlNumber(valBloco, ['vCofins', 'ValorCofins', 'valorCofins']) || 0;
  const vInss = extractXmlNumber(valBloco, ['vInss', 'ValorInss', 'valorInss']) || 0;
  const vIr = extractXmlNumber(valBloco, ['vIR', 'vIr', 'ValorIr', 'valorIr']) || 0;
  const vCsll = extractXmlNumber(valBloco, ['vCsll', 'ValorCsll', 'valorCsll']) || 0;
  const vLiq = extractXmlNumber(valBloco, ['vLiq', 'ValorLiquidoNfse', 'valorLiquido']);
  const vDed = extractXmlNumber(valBloco, ['vDeducao', 'ValorDeducoes']) || 0;
  const descIncond = extractXmlNumber(valBloco, ['vDescIncond', 'DescontoIncondicionado']) || 0;
  const descCond = extractXmlNumber(valBloco, ['vDescCond', 'DescontoCondicionado']) || 0;

  if (vServ !== undefined) {
    const totalRet = (issRetidoBool ? (vIss || 0) : 0) + vPis + vCofins + vInss + vIr + vCsll;
    const liquidoFinal = vLiq !== undefined ? vLiq : Math.max(0, vServ - totalRet - descIncond);

    result.impostos = {
      valorServicos: vServ,
      valorDeducoes: vDed,
      descontoIncondicionado: descIncond,
      descontoCondicionado: descCond,
      baseCalculo: Math.max(0, vServ - vDed - descIncond),
      aliquotaIss: pAliq || 0,
      valorIss: vIss || 0,
      issRetido: issRetidoBool,
      aliquotaPis: 0,
      valorPis: vPis,
      aliquotaCofins: 0,
      valorCofins: vCofins,
      aliquotaInss: 0,
      valorInss: vInss,
      aliquotaIr: 0,
      valorIr: vIr,
      aliquotaCsll: 0,
      valorCsll: vCsll,
      totalRetencoes: totalRet,
      valorLiquido: liquidoFinal,
    };
  }

  // 11. INFORMAÇÕES COMPLEMENTARES
  const infAdic = extractXmlTag(xmlContent, [
    'infAdic',
    'OutrasInformacoes',
    'outrasInformacoes',
    'informacoesComplementares',
    'xInfAdic',
  ]);
  if (infAdic) {
    result.informacoesComplementares = infAdic;
  }

  return result;
}

/**
 * Mescla e atualiza os campos de um documento NFS-e existente utilizando rigorosamente
 * os dados extraídos do XML oficial retornado pelo Notaas.
 */
export function applyNotaasXmlToDocument(nota: NfseDocument, xmlContent: string): NfseDocument {
  if (!xmlContent || typeof xmlContent !== 'string') {
    return nota;
  }

  const parsed = parseNotaasNfseXml(xmlContent);

  const updated: NfseDocument = {
    ...nota,
    xmlConteudo: xmlContent,
    transmissaoReal: true,
    provedorTransmissao: 'NOTAAS_OFICIAL',
  };

  if (parsed.chaveAcesso) updated.chaveAcesso = parsed.chaveAcesso;
  if (parsed.numero) updated.numero = parsed.numero;
  if (parsed.codigoVerificacao) updated.codigoVerificacao = parsed.codigoVerificacao;
  if (parsed.dataEmissao) updated.dataEmissao = parsed.dataEmissao;
  if (parsed.dataCompetencia) updated.dataCompetencia = parsed.dataCompetencia;
  if (parsed.dpsNumero) updated.dpsNumero = parsed.dpsNumero;
  if (parsed.dpsSerie) updated.dpsSerie = parsed.dpsSerie;

  if (parsed.prestador) {
    updated.prestador = {
      ...updated.prestador,
      ...parsed.prestador,
      cnpj: parsed.prestador.cnpj || updated.prestador.cnpj,
      razaoSocial: parsed.prestador.razaoSocial || updated.prestador.razaoSocial,
      endereco: {
        ...updated.prestador.endereco,
        ...(parsed.prestador.endereco || {}),
      },
    };
  }

  if (parsed.tomador) {
    updated.tomador = {
      ...updated.tomador,
      ...parsed.tomador,
      documento: parsed.tomador.documento || updated.tomador.documento,
      razaoSocial: parsed.tomador.razaoSocial || updated.tomador.razaoSocial,
      endereco: {
        ...updated.tomador.endereco,
        ...(parsed.tomador.endereco || {}),
      },
    };
  }

  if (parsed.servico) {
    updated.servico = {
      ...updated.servico,
      descricao: parsed.servico.descricao || updated.servico.descricao,
      codigoTributacaoNacional: parsed.servico.codigoTributacaoNacional || updated.servico.codigoTributacaoNacional,
      itemLC116: parsed.servico.itemLC116 || updated.servico.itemLC116,
      cnae: parsed.servico.cnae || updated.servico.cnae,
    };
  }

  if (parsed.impostos) {
    updated.impostos = {
      ...updated.impostos,
      ...parsed.impostos,
    };
  }

  if (parsed.informacoesComplementares) {
    updated.informacoesComplementares = parsed.informacoesComplementares;
  }

  return updated;
}
