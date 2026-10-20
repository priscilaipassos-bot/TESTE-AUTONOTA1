export type RegimeTributario = 'MEI' | 'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL';

export type StatusNfse = 'AUTORIZADA' | 'PROCESSANDO' | 'ERRO' | 'CANCELADA' | 'AGENDADA';

export type RecorrenciaTipo = 'MENSAL' | 'QUINZENAL' | 'SEMANAL' | 'UNICA';

export interface PrestadorConfig {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  inscricaoMunicipal: string;
  regimeTributario: RegimeTributario;
  simplesNacional: boolean;
  aliquotaSimples?: number; // %
  email: string;
  telefone: string;
  endereco: {
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    codigoMunicipio: string; // IBGE (ex: 3550308 para SP)
    municipio: string;
    uf: string;
    cep: string;
  };
  ambienteEmissao: 'PRODUCAO' | 'HOMOLOGACAO';
  apiKeyNotas?: string; // Token de API da Notaas (ntaas_*)
  empresaIdNotas?: string; // ID da Empresa no Notaas (opcional)
  serieDps?: string; // Série da DPS (ex: '1608')
  proximoNumeroDps?: number; // Próximo número sequencial da DPS (ex: 21)
  proximoNumeroNfse?: number; // Próximo número sequencial oficial da NFS-e (ex: 64)
  urlConsultaNfse?: string; // URL do portal de consulta pública com suporte a preenchimento automático
  metodoAutenticacao?: 'API_KEY' | 'CERTIFICADO_A1';
  provedorFiscal?: 'NOTAS_ENOTAS';
}

export interface TomadorCliente {
  id: string;
  tipoInscricao: 'CNPJ' | 'CPF';
  documento: string; // formatado ou limpo
  razaoSocial: string;
  nomeContato: string;
  email: string; // Pode conter múltiplos e-mails separados por vírgula (Ex: financeiro@..., fiscal@...)
  emails?: string[]; // Lista normalizada de e-mails
  telefone?: string; // Telefone de contato
  inscricaoMunicipal?: string;
  endereco: {
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    codigoMunicipio?: string; // Código IBGE (ex: 3106705 para Betim)
    municipio: string;
    uf: string;
    cep: string;
  };
}

export interface ServicoItem {
  id: string;
  codigoTributacaoNacional: string; // Ex: 99.01.01 ou 01.07.01
  codigoItemLC116: string; // Ex: 99.01 ou 1.07
  cnae: string; // Ex: 7739-0/99 ou 6202-3/00
  descricaoPadrao: string;
  aliquotaIss: number; // % (ex: 0.0 para operação não sujeita a ISSQN)
  issRetido: boolean;
  operacaoNaoSujeitaIss?: boolean; // Operação fora do campo de incidência do ISSQN
  valorPadrao: number;
}

export interface ImpostosCalculados {
  valorServicos: number;
  valorDeducoes: number;
  descontoIncondicionado: number;
  descontoCondicionado: number;
  baseCalculo: number;
  aliquotaIss: number;
  valorIss: number;
  issRetido: boolean;
  aliquotaPis: number;
  valorPis: number;
  aliquotaCofins: number;
  valorCofins: number;
  aliquotaInss: number;
  valorInss: number;
  aliquotaIr: number;
  valorIr: number;
  aliquotaCsll: number;
  valorCsll: number;
  totalRetencoes: number;
  valorLiquido: number;
}

export interface NfseDocument {
  id: string;
  numero: string; // ex: 202600000042
  serie: string; // ex: 900 (Padrão Nacional)
  dpsNumero: string;
  dpsSerie: string;
  chaveAcesso: string; // 50 dígitos
  codigoVerificacao: string; // 9 caracteres alfanuméricos
  dataEmissao: string; // ISO
  dataCompetencia: string; // AAAA-MM
  status: StatusNfse;
  mensagemRetorno?: string;
  
  prestador: PrestadorConfig;
  tomador: TomadorCliente;
  
  servico: {
    codigoTributacaoNacional: string;
    itemLC116: string;
    cnae: string;
    descricao: string;
    localPrestacaoMunicipio?: string;
    localPrestacaoUf?: string;
    localPrestacaoIbge?: string;
    operacaoNaoSujeitaIss?: boolean;
  };
  
  impostos: ImpostosCalculados;
  informacoesComplementares?: string;

  // Notificações
  emailEnviado: boolean;
  emailDataEnvio?: string;
  emailDestinatario?: string;
  emailStatus: 'ENVIADO' | 'PENDENTE' | 'ERRO';

  xmlConteudo?: string;
  linkDanfse?: string; // Link direto do DANFSE PDF gerado pelo eNotas / Receita Federal
  linkXml?: string; // Link do XML oficial gerado pelo eNotas / Receita Federal
  transmissaoReal?: boolean;
  provedorTransmissao?: string;
  notaasId?: string;
  notaasStatus?: string;
  rejeicaoSefaz?: { codigo: string; mensagem: string };
  origemAgendamentoId?: string;
}

export interface ProgramacaoAgendamento {
  id: string;
  titulo: string;
  clienteId: string;
  servicoDescricao: string;
  codigoTributacaoNacional: string;
  itemLC116: string;
  valorServico: number;
  aliquotaIss: number;
  issRetido: boolean;
  reterImpostosFederais: boolean;
  informacoesComplementares: string;

  // Recorrência
  tipoRecorrencia: RecorrenciaTipo;
  diaDoMes: number; // 1 a 31
  horarioExecucao: string; // "08:00"
  dataProximaExecucao: string; // ISO ou YYYY-MM-DD
  dataTermino?: string; // YYYY-MM-DD (Data final do contrato/agendamento)
  dataUltimaExecucao?: string;
  ativo: boolean;

  // Automações pós-emissão
  enviarEmailAutomatico: boolean;
  emailsDestinatarios?: string; // Múltiplos e-mails específicos para este agendamento (separados por vírgula)

  // Metadados
  totalEmitidas: number;
  criadoEm: string;
}

export interface EmailConfig {
  provedor: 'SMTP' | 'RESEND' | 'SENDGRID' | 'SIMULADO';
  servidorSmtp: string;
  porta: number;
  usuario: string;
  senhaApp?: string; // Senha de Aplicativo do Gmail (16 letras) ou senha SMTP
  remetenteNome: string;
  remetenteEmail: string;
  enviarCopiaOculta?: string;
  assuntoTemplate: string;
  corpoTemplate: string;
}

export interface AutomationLogEntry {
  id: string;
  timestamp: string;
  tipo: 'AGENDAMENTO' | 'EMISSAO_NFSE' | 'EMAIL' | 'SISTEMA';
  nivel: 'INFO' | 'SUCESSO' | 'AVISO' | 'ERRO';
  mensagem: string;
  detalhes?: string;
  referenciaId?: string;
}
