import { NfseDocument, TomadorCliente, PrestadorConfig, ImpostosCalculados } from '../types/nfse';
import { formatCurrencyBRL, formatCnpj, formatCpf } from './formatters';
import { getBrasiliaDateTime } from './brasiliaTime';

export interface TemplateContext {
  nota?: Partial<NfseDocument>;
  cliente?: Partial<TomadorCliente>;
  prestador?: Partial<PrestadorConfig>;
  servicoDescricao?: string;
  codigoTributacaoNacional?: string;
  itemLC116?: string;
  cnae?: string;
  valorServico?: number;
  aliquotaIss?: number;
  issRetido?: boolean;
  impostos?: Partial<ImpostosCalculados>;
  numeroNfse?: string | number;
  numeroDps?: string | number;
  serieDps?: string;
  chaveAcesso?: string;
  codigoVerificacao?: string;
  dataEmissao?: string | Date;
  dataCompetencia?: string; // YYYY-MM
  targetDate?: Date;
}

const MESES_EXTENSO = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

/**
 * Retorna as informações de competência e período mensal
 */
export function getPeriodInfo(baseDate?: Date | string) {
  let dateObj: Date;
  if (!baseDate) {
    dateObj = new Date();
  } else if (typeof baseDate === 'string' && /^\d{4}-\d{2}$/.test(baseDate)) {
    const [y, m] = baseDate.split('-').map(Number);
    dateObj = new Date(y, m - 1, 15);
  } else {
    dateObj = new Date(baseDate);
    if (isNaN(dateObj.getTime())) {
      dateObj = new Date();
    }
  }

  // Fuso horário de Brasília
  const bNow = getBrasiliaDateTime(dateObj);
  const ano = bNow.ano;
  const mesNum = bNow.mes; // 1-12
  const mesExtenso = MESES_EXTENSO[mesNum - 1] || String(mesNum);
  const mesDuasCasas = String(mesNum).padStart(2, '0');

  // Último dia do mês atual
  const ultimoDiaNum = new Date(ano, mesNum, 0).getDate();
  const ultimoDiaStr = String(ultimoDiaNum).padStart(2, '0');

  // Mês anterior (para empresas que faturam serviços do mês anterior)
  const mesAnteriorNum = mesNum === 1 ? 12 : mesNum - 1;
  const anoAnterior = mesNum === 1 ? ano - 1 : ano;
  const mesAnteriorExtenso = MESES_EXTENSO[mesAnteriorNum - 1] || String(mesAnteriorNum);
  const mesAnteriorDuasCasas = String(mesAnteriorNum).padStart(2, '0');
  const ultimoDiaMesAnteriorNum = new Date(anoAnterior, mesAnteriorNum, 0).getDate();
  const ultimoDiaMesAnteriorStr = String(ultimoDiaMesAnteriorNum).padStart(2, '0');

  return {
    ano: String(ano),
    mes: mesDuasCasas,
    mesExtenso,
    mesCompetencia: `${mesExtenso}/${ano}`,
    diaInicio: '01',
    diaFim: ultimoDiaStr,
    periodo: `01 a ${ultimoDiaStr}/${mesDuasCasas}/${ano}`,
    periodoCompleto: `01/${mesDuasCasas}/${ano} a ${ultimoDiaStr}/${mesDuasCasas}/${ano}`,
    periodoComPrefixo: `Período 01 a ${ultimoDiaStr}/${mesDuasCasas}/${ano}`,
    // Mês anterior
    anoAnterior: String(anoAnterior),
    mesAnterior: mesAnteriorDuasCasas,
    mesAnteriorExtenso,
    mesCompetenciaAnterior: `${mesAnteriorExtenso}/${anoAnterior}`,
    periodoMesAnterior: `01 a ${ultimoDiaMesAnteriorStr}/${mesAnteriorDuasCasas}/${anoAnterior}`,
  };
}

/**
 * Renderiza qualquer texto ou modelo substituindo tags dinâmicas como:
 * {cliente}, {razao_social_cliente}, {cnpj_cliente}, {mes_competencia}, {periodo},
 * {valor_total}, {valor_liquido}, {numero_nfse}, {numero_dps}, etc.
 *
 * Utiliza callbacks com .replace(regex, () => value) para evitar interpretação acidental
 * de caracteres especiais como '$' nos valores monetários (Ex: R$ 3.900,00).
 */
export function renderTemplateWithContext(template: string, ctx: TemplateContext): string {
  if (!template || typeof template !== 'string') return '';

  const nota = ctx.nota;
  const cliente = ctx.cliente || nota?.tomador;
  const prestador = ctx.prestador || nota?.prestador;
  const impostos = ctx.impostos || nota?.impostos;

  const dataBase = ctx.targetDate || (ctx.dataCompetencia ? ctx.dataCompetencia : (nota?.dataCompetencia || new Date()));
  const periodInfo = getPeriodInfo(dataBase);

  // Data e hora de emissão no Horário de Brasília
  const bNow = getBrasiliaDateTime(ctx.dataEmissao ? new Date(ctx.dataEmissao) : (nota?.dataEmissao ? new Date(nota.dataEmissao) : new Date()));
  const dataEmissaoFormatada = `${String(bNow.dia).padStart(2, '0')}/${String(bNow.mes).padStart(2, '0')}/${bNow.ano}`;
  const horaEmissaoFormatada = bNow.horaStr;

  // Documento do Tomador
  const docBruto = cliente?.documento || '';
  const docLimpo = docBruto.replace(/\D/g, '');
  const docFormatado =
    docLimpo.length === 14
      ? formatCnpj(docLimpo)
      : docLimpo.length === 11
      ? formatCpf(docLimpo)
      : docBruto;

  // Documento do Prestador
  const docPrestadorBruto = prestador?.cnpj || '46874965000104';
  const docPrestadorLimpo = docPrestadorBruto.replace(/\D/g, '');
  const docPrestadorFormatado =
    docPrestadorLimpo.length === 14 ? formatCnpj(docPrestadorLimpo) : docPrestadorBruto;

  // Valores
  const valorServ = ctx.valorServico ?? impostos?.valorServicos ?? nota?.impostos?.valorServicos ?? 0;
  const valorLiq = impostos?.valorLiquido ?? nota?.impostos?.valorLiquido ?? valorServ;
  const aliquota = ctx.aliquotaIss ?? impostos?.aliquotaIss ?? nota?.impostos?.aliquotaIss ?? 0;
  const valorIss = impostos?.valorIss ?? nota?.impostos?.valorIss ?? 0;
  const issRetidoVal = ctx.issRetido ?? impostos?.issRetido ?? (nota?.servico as any)?.issRetido ?? false;

  // Códigos fiscais
  const codTribNac = ctx.codigoTributacaoNacional || nota?.servico?.codigoTributacaoNacional || '99.01.01';
  const itemLC = ctx.itemLC116 || nota?.servico?.itemLC116 || '99.01';
  const cnaeCode = ctx.cnae || nota?.servico?.cnae || (codTribNac === '99.01.01' ? '7739-0/99' : '6202-3/00');

  // Números fiscais
  const numNfse = String(ctx.numeroNfse ?? nota?.numero ?? '');
  const numDps = String(ctx.numeroDps ?? nota?.dpsNumero ?? nota?.numero ?? '');
  const serieDps = String(ctx.serieDps ?? nota?.dpsSerie ?? nota?.serie ?? prestador?.serieDps ?? '1608');
  const chave = String(ctx.chaveAcesso ?? nota?.chaveAcesso ?? '');
  const codVerif = String(ctx.codigoVerificacao ?? nota?.codigoVerificacao ?? '');

  // Descrição do serviço
  const descServ = ctx.servicoDescricao || nota?.servico?.descricao || 'Prestação de Serviços';

  let rendered = template;

  // 1. Substitui padrões comuns de período com datas fixas (ex: "Período 01 a 30/09/2026")
  const periodRegex = /Per[ií]odo\s*[:]?\s*(?:de\s*)?\d{1,2}(?:\/\d{1,2}(?:\/\d{2,4})?)?\s*(?:a|à|até)\s*\d{1,2}(?:\/\d{1,2}\/\d{2,4}|\/[^\s,;]+)?/i;
  if (periodRegex.test(rendered)) {
    rendered = rendered.replace(periodRegex, () => periodInfo.periodoComPrefixo);
  }

  // 2. Tags do Tomador / Cliente
  rendered = rendered
    .replace(/\{(?:razao_social_cliente|nome_cliente|cliente|tomador|razao_social_tomador)\}/gi, () => cliente?.razaoSocial || '')
    .replace(/\{(?:cnpj_cliente|cpf_cnpj_cliente|documento_cliente|cnpj_tomador|cpf_tomador)\}/gi, () => docFormatado)
    .replace(/\{(?:cnpj_cliente_limpo|documento_cliente_limpo)\}/gi, () => docLimpo)
    .replace(/\{(?:email_cliente|email_tomador)\}/gi, () => cliente?.email || '')
    .replace(/\{(?:telefone_cliente|telefone_tomador)\}/gi, () => cliente?.telefone || '')
    .replace(/\{(?:municipio_cliente|cidade_cliente)\}/gi, () => cliente?.endereco?.municipio || '')
    .replace(/\{(?:uf_cliente)\}/gi, () => cliente?.endereco?.uf || '')
    .replace(/\{(?:nome_contato|contato_cliente)\}/gi, () => cliente?.nomeContato || '');

  // 3. Tags de Competência e Período Atual
  rendered = rendered
    .replace(/\{mes_competencia\}/gi, () => periodInfo.mesCompetencia)
    .replace(/\{mes_extenso\}/gi, () => periodInfo.mesExtenso)
    .replace(/\{mes\}/gi, () => periodInfo.mes)
    .replace(/\{ano\}/gi, () => periodInfo.ano)
    .replace(/\{periodo\}/gi, () => periodInfo.periodo)
    .replace(/\{periodo_completo\}/gi, () => periodInfo.periodoCompleto)
    .replace(/\{periodo_com_prefixo\}/gi, () => periodInfo.periodoComPrefixo)
    .replace(/\{dia_inicio_mes\}/gi, () => periodInfo.diaInicio)
    .replace(/\{(?:dia_fim_mes|ultimo_dia_mes)\}/gi, () => periodInfo.diaFim);

  // 4. Tags de Competência e Período Anterior (para faturamento mês vencido)
  rendered = rendered
    .replace(/\{mes_competencia_anterior\}/gi, () => periodInfo.mesCompetenciaAnterior)
    .replace(/\{mes_anterior_extenso\}/gi, () => periodInfo.mesAnteriorExtenso)
    .replace(/\{mes_anterior\}/gi, () => periodInfo.mesAnterior)
    .replace(/\{ano_anterior\}/gi, () => periodInfo.anoAnterior)
    .replace(/\{periodo_mes_anterior\}/gi, () => periodInfo.periodoMesAnterior);

  // 5. Tags de Emissão e Data/Hora Oficial de Brasília
  rendered = rendered
    .replace(/\{data_emissao\}/gi, () => dataEmissaoFormatada)
    .replace(/\{hora_emissao\}/gi, () => horaEmissaoFormatada)
    .replace(/\{data_hora_emissao\}/gi, () => `${dataEmissaoFormatada} às ${horaEmissaoFormatada}`);

  // 6. Tags de Identificação Fiscal (NFS-e, DPS, Chave Nacional)
  rendered = rendered
    .replace(/\{(?:numero_nfse|numero_nota|numero)\}/gi, () => numNfse)
    .replace(/\{(?:numero_dps|dps)\}/gi, () => numDps)
    .replace(/\{(?:serie_dps|serie)\}/gi, () => serieDps)
    .replace(/\{(?:chave_acesso|chave)\}/gi, () => chave)
    .replace(/\{codigo_verificacao\}/gi, () => codVerif)
    .replace(/\{(?:codigo_tributacao|codigo_tributacao_nacional)\}/gi, () => codTribNac)
    .replace(/\{item_lc116\}/gi, () => itemLC)
    .replace(/\{cnae\}/gi, () => cnaeCode);

  // 7. Tags de Valores Financeiros
  rendered = rendered
    .replace(/\{(?:valor_total|valor_bruto|valor_servico|valor_servicos|valor)\}/gi, () => formatCurrencyBRL(valorServ))
    .replace(/\{valor_liquido\}/gi, () => formatCurrencyBRL(valorLiq))
    .replace(/\{aliquota_iss\}/gi, () => `${aliquota.toFixed(2).replace('.', ',')}%`)
    .replace(/\{valor_iss\}/gi, () => formatCurrencyBRL(valorIss))
    .replace(/\{iss_retido\}/gi, () => (issRetidoVal ? 'Sim' : 'Não'));

  // 8. Tags do Prestador (Empresa Emissora)
  rendered = rendered
    .replace(/\{cnpj_prestador\}/gi, () => docPrestadorFormatado)
    .replace(/\{cnpj_prestador_limpo\}/gi, () => docPrestadorLimpo)
    .replace(/\{(?:razao_prestador|nome_prestador|razao_social_prestador)\}/gi, () => prestador?.razaoSocial || 'PRISCILA I PASSOS LTDA')
    .replace(/\{email_prestador\}/gi, () => prestador?.email || 'priscilapassos.job@gmail.com')
    .replace(/\{telefone_prestador\}/gi, () => prestador?.telefone || '(31) 99813-1413')
    .replace(/\{(?:municipio_prestador|cidade_prestador)\}/gi, () => prestador?.endereco?.municipio || 'Betim')
    .replace(/\{uf_prestador\}/gi, () => prestador?.endereco?.uf || 'MG');

  // 9. Tags de Discriminação de Serviços (quando usado no template de e-mail)
  rendered = rendered
    .replace(/\{(?:descricao_servico|descricao|discriminacao_servicos|discriminacao|servico)\}/gi, () => descServ);

  return rendered;
}

export interface TemplateTagDefinition {
  tag: string;
  label: string;
  example: string;
  category: 'Datas e Período' | 'Cliente' | 'NFS-e / Fiscal' | 'Valores' | 'Prestador' | 'Serviço';
  description?: string;
}

/**
 * Lista completa de todas as tags dinâmicas disponíveis no sistema,
 * válidas tanto para a Discriminação dos Serviços quanto para o Modelo de Disparo de E-mail.
 */
export const AVAILABLE_TEMPLATE_TAGS: TemplateTagDefinition[] = [
  // Datas e Período
  {
    tag: '{mes_competencia}',
    label: 'Mês/Ano Competência',
    example: 'Outubro/2026',
    category: 'Datas e Período',
    description: 'Nome por extenso do mês e o ano da competência',
  },
  {
    tag: '{periodo}',
    label: 'Período do Mês',
    example: '01 a 31/10/2026',
    category: 'Datas e Período',
    description: 'Do primeiro ao último dia do mês no formato DD a DD/MM/AAAA',
  },
  {
    tag: '{periodo_completo}',
    label: 'Período Completo',
    example: '01/10/2026 a 31/10/2026',
    category: 'Datas e Período',
    description: 'Período com datas completas DD/MM/AAAA a DD/MM/AAAA',
  },
  {
    tag: '{mes_extenso}',
    label: 'Mês por Extenso',
    example: 'Outubro',
    category: 'Datas e Período',
    description: 'Apenas o nome do mês da competência',
  },
  {
    tag: '{mes}',
    label: 'Mês (01-12)',
    example: '10',
    category: 'Datas e Período',
    description: 'Número do mês com dois dígitos',
  },
  {
    tag: '{ano}',
    label: 'Ano (AAAA)',
    example: '2026',
    category: 'Datas e Período',
    description: 'Ano da competência com quatro dígitos',
  },
  {
    tag: '{mes_competencia_anterior}',
    label: 'Mês Anterior (Competência)',
    example: 'Setembro/2026',
    category: 'Datas e Período',
    description: 'Ideal para serviços faturados no mês seguinte ao da execução',
  },
  {
    tag: '{periodo_mes_anterior}',
    label: 'Período do Mês Anterior',
    example: '01 a 30/09/2026',
    category: 'Datas e Período',
    description: 'Período do primeiro ao último dia do mês anterior',
  },
  {
    tag: '{data_emissao}',
    label: 'Data de Emissão',
    example: '01/10/2026',
    category: 'Datas e Período',
    description: 'Data oficial da emissão no fuso horário de Brasília',
  },
  {
    tag: '{hora_emissao}',
    label: 'Hora de Emissão',
    example: '09:00',
    category: 'Datas e Período',
    description: 'Horário do disparo no fuso horário de Brasília',
  },

  // Cliente / Tomador
  {
    tag: '{razao_social_cliente}',
    label: 'Razão Social do Cliente',
    example: 'NITNAVE SERVICOS NAVAIS LTDA',
    category: 'Cliente',
    description: 'Nome empresarial cadastrado do tomador do serviço',
  },
  {
    tag: '{cnpj_cliente}',
    label: 'CNPJ/CPF Formatado',
    example: '00.000.000/0001-91',
    category: 'Cliente',
    description: 'Documento do cliente com pontuação oficial',
  },
  {
    tag: '{cnpj_cliente_limpo}',
    label: 'CNPJ/CPF sem pontuação',
    example: '00000000000191',
    category: 'Cliente',
    description: 'Documento apenas com dígitos numéricos',
  },
  {
    tag: '{email_cliente}',
    label: 'E-mail do Cliente',
    example: 'fiscal@nitnave.com.br',
    category: 'Cliente',
    description: 'Endereço de e-mail cadastrado do cliente',
  },
  {
    tag: '{municipio_cliente}',
    label: 'Cidade do Cliente',
    example: 'Niterói',
    category: 'Cliente',
    description: 'Município do tomador',
  },
  {
    tag: '{uf_cliente}',
    label: 'UF do Cliente',
    example: 'RJ',
    category: 'Cliente',
    description: 'Sigla do Estado do tomador',
  },
  {
    tag: '{nome_contato}',
    label: 'Nome do Contato',
    example: 'Roberto Ramos',
    category: 'Cliente',
    description: 'Pessoa de contato no cliente',
  },

  // NFS-e / Fiscal
  {
    tag: '{numero_nfse}',
    label: 'Número da NFS-e',
    example: '64',
    category: 'NFS-e / Fiscal',
    description: 'Número oficial gerado da Nota Fiscal',
  },
  {
    tag: '{numero_dps}',
    label: 'Número da DPS',
    example: '21',
    category: 'NFS-e / Fiscal',
    description: 'Número sequencial da Declaração Prévia de Serviço',
  },
  {
    tag: '{serie_dps}',
    label: 'Série da DPS',
    example: '1608',
    category: 'NFS-e / Fiscal',
    description: 'Série da DPS utilizada na transmissão',
  },
  {
    tag: '{chave_acesso}',
    label: 'Chave de Acesso Nacional',
    example: '3106200468749650001045590000000000010000000064',
    category: 'NFS-e / Fiscal',
    description: 'Chave única de 50 dígitos do padrão da Receita Federal',
  },
  {
    tag: '{codigo_verificacao}',
    label: 'Código de Verificação',
    example: 'A7B8C9D0',
    category: 'NFS-e / Fiscal',
    description: 'Código de autenticidade para validação no portal',
  },
  {
    tag: '{codigo_tributacao}',
    label: 'Cód. Tributação Nacional',
    example: '99.01.01',
    category: 'NFS-e / Fiscal',
    description: 'Classificação do serviço no padrão federal',
  },

  // Valores Financeiros
  {
    tag: '{valor_total}',
    label: 'Valor Total do Serviço',
    example: 'R$ 3.900,00',
    category: 'Valores',
    description: 'Valor bruto contratado dos serviços',
  },
  {
    tag: '{valor_liquido}',
    label: 'Valor Líquido a Receber',
    example: 'R$ 3.900,00',
    category: 'Valores',
    description: 'Valor total deduzido de retenções',
  },
  {
    tag: '{aliquota_iss}',
    label: 'Alíquota de ISS',
    example: '2,00%',
    category: 'Valores',
    description: 'Percentual de alíquota do município',
  },
  {
    tag: '{valor_iss}',
    label: 'Valor do ISS',
    example: 'R$ 78,00',
    category: 'Valores',
    description: 'Valor em reais do imposto municipal calculado',
  },

  // Prestador (Emissor)
  {
    tag: '{razao_prestador}',
    label: 'Razão Social do Prestador',
    example: 'PRISCILA I PASSOS LTDA',
    category: 'Prestador',
    description: 'Nome da sua empresa emissora',
  },
  {
    tag: '{cnpj_prestador}',
    label: 'CNPJ do Prestador',
    example: '46.874.965/0001-04',
    category: 'Prestador',
    description: 'CNPJ da sua empresa emissora',
  },
  {
    tag: '{email_prestador}',
    label: 'E-mail do Prestador',
    example: 'priscilapassos.job@gmail.com',
    category: 'Prestador',
    description: 'E-mail configurado do remetente',
  },

  // Serviço (para uso no e-mail)
  {
    tag: '{descricao_servico}',
    label: 'Discriminação do Serviço',
    example: 'Locação de Aparelho de medição de dureza MIC 10...',
    category: 'Serviço',
    description: 'Texto completo da discriminação que constará no DANFSE',
  },
];
