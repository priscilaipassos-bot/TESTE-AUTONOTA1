import {
  NfseDocument,
  ProgramacaoAgendamento,
  TomadorCliente,
  PrestadorConfig,
  EmailConfig,
  StatusNfse,
} from '../types/nfse';
import { storageService } from './storageService';
import { calculateTaxes } from '../utils/taxCalculator';
import {
  generateChaveAcessoNacional,
  generateCodigoVerificacao,
  buildOfficialXmlNacional,
} from '../utils/nfseGenerator';
import { formatCurrencyBRL } from '../utils/formatters';
import { formatDynamicDescription } from '../utils/periodHelper';
import { parseMultipleEmails } from '../utils/emailHelper';
import { renderTemplateWithContext } from '../utils/templateHelper';
import { getBrasiliaDateTime, BrasiliaDateTime } from '../utils/brasiliaTime';
import { parseNotaasNfseXml, applyNotaasXmlToDocument } from '../utils/notaasXmlParser';

export { getBrasiliaDateTime };
export type { BrasiliaDateTime };

export interface EmitResult {
  sucesso: boolean;
  nota?: NfseDocument;
  erro?: string;
  emailEnviado?: boolean;
}

export class AutomationRunner {
  // Prepara e emite uma NFS-e a partir de um agendamento ou emissão direta
  static async emitirNfse(
    cliente: TomadorCliente,
    servicoDescricao: string,
    codigoTributacaoNacional: string,
    itemLC116: string,
    valorServico: number,
    aliquotaIss: number,
    issRetido: boolean,
    reterImpostosFederais: boolean,
    informacoesComplementares: string,
    agendamentoOrigem?: ProgramacaoAgendamento,
    enviarEmail: boolean = true,
    customNumeroDps?: string,
    customSerieDps?: string
  ): Promise<EmitResult> {
    const prestador = storageService.getPrestador();
    const emailConfig = storageService.getEmailConfig();

    const timestampInicio = new Date().toISOString();
    let numDps = customNumeroDps ? String(customNumeroDps).trim() : storageService.getNextNumeroDps();
    let serieDps = customSerieDps ? String(customSerieDps).trim() : (prestador.serieDps || '1608');
    const nfseEsperada = storageService.getNextNumeroNfse();

    // 1. Verificação obrigatória da Chave Notaas (REGRA: Todos os dados fiscais devem tramitar oficialmente pelo Notaas)
    const apiKeyNotaas = (prestador.apiKeyNotas || '').trim();
    const usandoNotaas = Boolean(apiKeyNotaas.length > 0);

    if (!usandoNotaas) {
      const msgErro = 'Chave de API do Notaas (ntaas_*) não está configurada! Nenhum dado foi transmitido ao Notaas e o e-mail NÃO foi disparado ao cliente. Acesse Configurações > Integração Notaas e cadastre sua chave de API para habilitar a emissão oficial.';
      storageService.addLog({
        id: `log-${Date.now()}-notaas-missing`,
        timestamp: timestampInicio,
        tipo: 'EMISSAO_NFSE',
        nivel: 'ERRO',
        mensagem: msgErro,
      });
      return {
        sucesso: false,
        erro: msgErro,
      };
    }

    storageService.addLog({
      id: `log-${Date.now()}-1`,
      timestamp: timestampInicio,
      tipo: 'EMISSAO_NFSE',
      nivel: 'INFO',
      mensagem: `Iniciando transmissão via API Notaas (platform.notaas.com.br) para o tomador ${cliente.razaoSocial} (DPS Nº ${numDps} Série ${serieDps})...`,
    });

    // 2. Cálculo dos Impostos Oficiais
    let impostos = calculateTaxes(
      valorServico,
      aliquotaIss,
      issRetido,
      prestador,
      reterImpostosFederais
    );

    const competenciaData = new Date();
    const competenciaStr = `${competenciaData.getFullYear()}-${String(
      competenciaData.getMonth() + 1
    ).padStart(2, '0')}`;

    // Substitui e processa dinamicamente todas as tags na discriminação dos serviços ({mes_competencia}, {periodo}, {cliente}, etc.)
    let descricaoComTagsAtualizada = renderTemplateWithContext(servicoDescricao, {
      cliente,
      prestador,
      valorServico,
      aliquotaIss,
      impostos,
      numeroNfse: nfseEsperada,
      numeroDps: numDps,
      serieDps: serieDps,
      dataCompetencia: competenciaStr,
      targetDate: competenciaData,
    });

    // Substitui também nas informações complementares caso contenham tags
    const infoComplementarAtualizada = renderTemplateWithContext(informacoesComplementares, {
      cliente,
      prestador,
      valorServico,
      aliquotaIss,
      impostos,
      numeroNfse: nfseEsperada,
      numeroDps: numDps,
      serieDps: serieDps,
      dataCompetencia: competenciaStr,
      targetDate: competenciaData,
    });

    let numeroNfseFinal = nfseEsperada;
    let chaveAcessoFinal = generateChaveAcessoNacional(
      prestador.endereco.codigoMunicipio,
      prestador.cnpj,
      numeroNfseFinal
    );
    let codigoVerificacaoFinal = generateCodigoVerificacao();
    let linkDanfsePdf: string | undefined = undefined;
    let linkXmlOficial: string | undefined = undefined;
    let xmlConteudoFinal: string | undefined = undefined;
    let transmissaoRealizada = false;
    let provedorUtilizado = 'LOCAL_SIMULADO';

    let notaasIdGravado: string | undefined;
    let notaasStatusGravado: string | undefined;
    let rejeicaoSefazGravada: { codigo: string; mensagem: string } | undefined;
    let notaasConfirmada = false;

    // 3. SE O TOKEN DA NOTAAS / ENOTAS ESTIVER CONFIGURADO, TRANSMITE DE FATO PARA A API REAL
    if (usandoNotaas) {
      try {
        const payload = {
          apiKey: prestador.apiKeyNotas,
          empresaId: prestador.empresaIdNotas,
          prestador,
          tomador: cliente,
          servico: {
            codigoTributacaoNacional,
            codigoTributacaoMunicipal: '001',
            itemLC116,
            cnae: codigoTributacaoNacional === '99.01.01' ? '7739-0/99' : '6202-3/00',
            descricao: descricaoComTagsAtualizada,
            valor: valorServico,
            aliquotaIss,
          },
          impostos,
          informacoesComplementares: infoComplementarAtualizada,
          numeroDps: Number(numDps),
          serieDps: String(serieDps),
          numero: Number(numDps),
          serie: String(serieDps),
          dps: {
            numero: Number(numDps),
            serie: String(serieDps),
          },
          idExterno: `dps-${Date.now()}-${numDps}`,
        };

        console.log("=== DADOS REAIS ENVIADOS AO NOTAAS ===");
        console.log("numeroDps:", payload.numeroDps);
        console.log("serieDps:", payload.serieDps);
        console.log("Payload Completo:", JSON.stringify(payload, null, 2));

        const respNotaas = await fetch('/api/notaas/emitir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const respText = await respNotaas.text();
        let dataNotaas: any = null;
        try {
          dataNotaas = JSON.parse(respText);
        } catch {
          dataNotaas = null;
        }

        notaasConfirmada = false;

        if (respNotaas.ok && dataNotaas?.success) {
          transmissaoRealizada = true;
          provedorUtilizado = 'NOTAAS_OFICIAL';
          notaasIdGravado = dataNotaas.nfeId;
          notaasStatusGravado = dataNotaas.statusNotaas || dataNotaas.status;

          if (dataNotaas.rejeicaoSefaz) {
            rejeicaoSefazGravada = dataNotaas.rejeicaoSefaz;
            informacoesComplementares = `${informacoesComplementares || ''}\n[Rejeição SEFAZ no Notaas: ${dataNotaas.rejeicaoSefaz.codigo} - ${dataNotaas.rejeicaoSefaz.mensagem}]`.trim();
          }

          if (dataNotaas.numero) {
            numeroNfseFinal = String(dataNotaas.numero);
          }
          if (dataNotaas.chaveAcesso) {
            chaveAcessoFinal = dataNotaas.chaveAcesso;
          }
          if (dataNotaas.codigoVerificacao) {
            codigoVerificacaoFinal = dataNotaas.codigoVerificacao;
          }
          if (dataNotaas.linkDownloadPdf) {
            linkDanfsePdf = dataNotaas.linkDownloadPdf;
          }
          if (dataNotaas.linkDownloadXml) {
            linkXmlOficial = dataNotaas.linkDownloadXml;
          }

          // Se a resposta já trouxe o XML oficial do Notaas
          if (dataNotaas.xmlConteudo) {
            xmlConteudoFinal = dataNotaas.xmlConteudo;
          }

          // Extração e sincronização dos dados do XML retornado pelo Notaas
          let dadosDoXml: any = dataNotaas.dadosXml;
          if (!dadosDoXml && xmlConteudoFinal) {
            dadosDoXml = parseNotaasNfseXml(xmlConteudoFinal);
          }

          // Caso ainda não tenha o XML em texto, tenta baixar via /api/notaas/fetch-xml
          if (!xmlConteudoFinal && (dataNotaas.nfeId || linkXmlOficial)) {
            try {
              const fetchXmlRes = await fetch('/api/notaas/fetch-xml', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  invoiceId: dataNotaas.nfeId,
                  xmlUrl: linkXmlOficial,
                  apiKey: prestador.apiKeyNotas,
                }),
              });
              if (fetchXmlRes.ok) {
                const xmlData = await fetchXmlRes.json();
                if (xmlData.success && xmlData.xmlConteudo) {
                  xmlConteudoFinal = xmlData.xmlConteudo;
                  dadosDoXml = xmlData.dadosXml || parseNotaasNfseXml(xmlData.xmlConteudo);
                }
              }
            } catch (eXmlFetch) {
              console.warn('[AutomationRunner] Falha ao sincronizar XML via fetch-xml:', eXmlFetch);
            }
          }

          // Aplica dados oficiais extraídos diretamente do XML do Notaas
          if (dadosDoXml) {
            if (dadosDoXml.numero) numeroNfseFinal = String(dadosDoXml.numero);
            if (dadosDoXml.chaveAcesso) chaveAcessoFinal = String(dadosDoXml.chaveAcesso).replace(/\D/g, '');
            if (dadosDoXml.codigoVerificacao) codigoVerificacaoFinal = String(dadosDoXml.codigoVerificacao).trim();
            if (dadosDoXml.dpsNumero) numDps = String(dadosDoXml.dpsNumero);
            if (dadosDoXml.dpsSerie) serieDps = String(dadosDoXml.dpsSerie);
            if (dadosDoXml.impostos) {
              impostos = { ...impostos, ...dadosDoXml.impostos };
            }
            if (dadosDoXml.servico?.descricao) {
              descricaoComTagsAtualizada = dadosDoXml.servico.descricao;
            }
          }

          const isAutorizadaNoNotaas = Boolean(
            dataNotaas.autorizada ||
            dataNotaas.status === 'AUTORIZADA' ||
            dataNotaas.statusNotaas === 'issued' ||
            dataNotaas.statusNotaas === 'authorized' ||
            dataNotaas.statusNotaas === 'emitted' ||
            (dataNotaas.chaveAcesso && dataNotaas.linkDownloadPdf)
          );

          if (dataNotaas.rejeicaoSefaz || dataNotaas.status === 'ERRO' || dataNotaas.statusNotaas === 'error') {
            notaasConfirmada = false;
            storageService.addLog({
              id: `log-${Date.now()}-notaas-rej`,
              timestamp: new Date().toISOString(),
              tipo: 'EMISSAO_NFSE',
              nivel: 'AVISO',
              mensagem: `Nota enviada ao Notaas (ID: ${dataNotaas.nfeId}), mas devolveu pendência da Receita: [${dataNotaas.rejeicaoSefaz?.codigo || 'ERRO'}] ${dataNotaas.rejeicaoSefaz?.mensagem || 'Erro retornado pela SEFAZ'}`,
              referenciaId: dataNotaas.nfeId,
            });
          } else if (isAutorizadaNoNotaas) {
            notaasConfirmada = true;
            storageService.addLog({
              id: `log-${Date.now()}-notaas-ok`,
              timestamp: new Date().toISOString(),
              tipo: 'EMISSAO_NFSE',
              nivel: 'SUCESSO',
              mensagem: `NFS-e Nº ${numeroNfseFinal} confirmada e autorizada com sucesso pela API Notaas! Chave: ${chaveAcessoFinal}`,
              referenciaId: dataNotaas.nfeId,
            });
          } else {
            notaasConfirmada = false;
            storageService.addLog({
              id: `log-${Date.now()}-notaas-proc`,
              timestamp: new Date().toISOString(),
              tipo: 'EMISSAO_NFSE',
              nivel: 'INFO',
              mensagem: `NFS-e transmitida à API Notaas (ID: ${dataNotaas.nfeId}). A nota está em processamento na prefeitura/SEFAZ. O e-mail SÓ SERÁ ENVIADO após confirmação oficial da emissão pelo Notaas.`,
              referenciaId: dataNotaas.nfeId,
            });
          }
        } else {
          const erroMsg = dataNotaas?.error || dataNotaas?.message || (respNotaas.status === 404 ? 'Endpoint /api/notaas/emitir não encontrado (404) no servidor.' : `Erro HTTP ${respNotaas.status} retornado pelo servidor Notaas.`);
          storageService.addLog({
            id: `log-${Date.now()}-notaas-err`,
            timestamp: new Date().toISOString(),
            tipo: 'EMISSAO_NFSE',
            nivel: 'ERRO',
            mensagem: `Notaas: ${erroMsg}`,
          });

          return {
            sucesso: false,
            erro: `Falha ao transmitir para o Notaas: ${erroMsg}`,
          };
        }
      } catch (errApi: any) {
        console.error('Erro na chamada à rota da Notaas:', errApi);
        const falhaMsg = `Falha de rede/comunicação com a Notaas: ${errApi.message || 'Erro de conexão'}. A nota não foi emitida.`;
        storageService.addLog({
          id: `log-${Date.now()}-notaas-fail`,
          timestamp: new Date().toISOString(),
          tipo: 'EMISSAO_NFSE',
          nivel: 'ERRO',
          mensagem: falhaMsg,
        });

        return {
          sucesso: false,
          erro: falhaMsg,
        };
      }
    }

    // Determina o status oficial da NFS-e:
    // REGRA DE OURO: Só é AUTORIZADA se houver confirmação oficial pelo Notaas!
    let statusNota: StatusNfse = 'PROCESSANDO';
    if (rejeicaoSefazGravada || (usandoNotaas && notaasStatusGravado === 'error')) {
      statusNota = 'ERRO';
    } else if (notaasConfirmada) {
      statusNota = 'AUTORIZADA';
    } else {
      statusNota = 'PROCESSANDO';
    }

    // 4. Montagem do Documento da NFS-e com resolução final de tags (número final, chave e código)
    const descricaoFinalResolvida = renderTemplateWithContext(descricaoComTagsAtualizada, {
      cliente,
      prestador,
      valorServico,
      aliquotaIss,
      issRetido,
      impostos,
      numeroNfse: numeroNfseFinal,
      numeroDps: numDps,
      serieDps: serieDps,
      chaveAcesso: chaveAcessoFinal,
      codigoVerificacao: codigoVerificacaoFinal,
      dataCompetencia: competenciaStr,
      targetDate: competenciaData,
      codigoTributacaoNacional,
      itemLC116,
    });

    const novaNota: NfseDocument = {
      id: `nfs-${Date.now()}`,
      numero: numeroNfseFinal,
      serie: serieDps,
      dpsNumero: numDps,
      dpsSerie: serieDps,
      chaveAcesso: chaveAcessoFinal,
      codigoVerificacao: codigoVerificacaoFinal,
      dataEmissao: new Date().toISOString(),
      dataCompetencia: competenciaStr,
      status: statusNota,
      prestador,
      tomador: cliente,
      servico: {
        codigoTributacaoNacional,
        itemLC116,
        cnae: codigoTributacaoNacional === '99.01.01' ? '7739-0/99' : '6202-3/00',
        descricao: descricaoFinalResolvida,
        localPrestacaoMunicipio: cliente.endereco.municipio || prestador.endereco.municipio,
        localPrestacaoUf: cliente.endereco.uf || prestador.endereco.uf,
        localPrestacaoIbge: cliente.endereco.codigoMunicipio || prestador.endereco.codigoMunicipio,
        operacaoNaoSujeitaIss: codigoTributacaoNacional === '99.01.01' || aliquotaIss === 0,
      },
      impostos,
      informacoesComplementares: infoComplementarAtualizada,
      emailEnviado: false,
      emailStatus: 'PENDENTE',
      linkDanfse: linkDanfsePdf,
      linkXml: linkXmlOficial,
      transmissaoReal: transmissaoRealizada,
      provedorTransmissao: provedorUtilizado,
      notaasId: notaasIdGravado,
      notaasStatus: notaasStatusGravado,
      rejeicaoSefaz: rejeicaoSefazGravada,
      origemAgendamentoId: agendamentoOrigem ? agendamentoOrigem.id : undefined,
    };

    // Se obteve o XML oficial do Notaas, UTILIZA ELE COMO FONTE ÚNICA DA VERDADE!
    if (xmlConteudoFinal) {
      novaNota.xmlConteudo = xmlConteudoFinal;
      const synced = applyNotaasXmlToDocument(novaNota, xmlConteudoFinal);
      Object.assign(novaNota, synced);
      storageService.addLog({
        id: `log-${Date.now()}-xml-synced`,
        timestamp: new Date().toISOString(),
        tipo: 'EMISSAO_NFSE',
        nivel: 'SUCESSO',
        mensagem: `Dados oficiais da NFS-e Nº ${novaNota.numero} sincronizados diretamente do XML do Notaas (Chave: ${novaNota.chaveAcesso}). O PDF e o XML gerados para o cliente correspondem 100% aos dados do Notaas.`,
        referenciaId: novaNota.id,
      });
    } else {
      novaNota.xmlConteudo = buildOfficialXmlNacional(novaNota);
    }

    // Incrementa os sequenciadores oficiais para as próximas notas seguirem rigorosamente a ordem a partir do valor usado/ajustado:
    const dpsUsadaNum = parseInt(numDps, 10);
    if (!isNaN(dpsUsadaNum) && dpsUsadaNum > 0) {
      storageService.setProximoNumeroDps(dpsUsadaNum + 1);
    }
    const nfseUsadaNum = parseInt(numeroNfseFinal, 10);
    if (!isNaN(nfseUsadaNum) && nfseUsadaNum > 0) {
      storageService.setProximoNumeroNfse(nfseUsadaNum + 1);
    }

    // 5. Log de Sucesso na Emissão
    storageService.addLog({
      id: `log-${Date.now()}-2`,
      timestamp: new Date().toISOString(),
      tipo: 'EMISSAO_NFSE',
      nivel: statusNota === 'AUTORIZADA' ? 'SUCESSO' : 'AVISO',
      mensagem: statusNota === 'AUTORIZADA'
        ? (transmissaoRealizada
            ? `NFS-e Nº ${numeroNfseFinal} autorizada e registrada oficialmente via Notaas! Chave: ${chaveAcessoFinal}`
            : `NFS-e Nº ${numeroNfseFinal} autorizada e gerada no sistema! Chave: ${chaveAcessoFinal}`)
        : `NFS-e Nº ${numeroNfseFinal} em processamento na SEFAZ. Aguardando retorno da prefeitura.`,
      referenciaId: novaNota.id,
    });

    // 6. Envio por E-mail: REGRA ESTRITA DO USUÁRIO
    // 1. "email só deve ser enviado se houver confirmação de emissão pelo notaas"
    // 2. "a reemissão apenas envia para o notaas mas não envia email automaticamente (inclua um aviso disso)"
    if (!enviarEmail) {
      novaNota.emailEnviado = false;
      novaNota.emailStatus = 'PENDENTE';
      storageService.addLog({
        id: `log-${Date.now()}-reemit-notice`,
        timestamp: new Date().toISOString(),
        tipo: 'EMAIL',
        nivel: 'INFO',
        mensagem: `Aviso Importante: E-mail não disparado automaticamente nesta operação (Reemissão enviada apenas para o Notaas). O e-mail com DANFSE (PDF) e XML pode ser enviado manualmente a qualquer momento via botão "Reenviar E-mail".`,
        referenciaId: novaNota.id,
      });
    } else if (enviarEmail && cliente.email) {
      const emailConfig = storageService.getEmailConfig();
      novaNota.emailDestinatario = cliente.email;

      // Extrai e unifica todos os e-mails de destino (do cliente e do agendamento)
      const todosEmailsDestino = Array.from(
        new Set([
          ...parseMultipleEmails(cliente.email),
          ...parseMultipleEmails(agendamentoOrigem?.emailsDestinatarios),
        ])
      );
      const destinatariosFormatados = todosEmailsDestino.join(', ') || cliente.email;
      novaNota.emailDestinatario = destinatariosFormatados;

      // O e-mail SÓ deve ser enviado se houver confirmação de emissão pelo Notaas!
      if (!notaasConfirmada || novaNota.status !== 'AUTORIZADA') {
        novaNota.emailEnviado = false;
        novaNota.emailStatus = 'PENDENTE';
        storageService.addLog({
          id: `log-${Date.now()}-3`,
          timestamp: new Date().toISOString(),
          tipo: 'EMAIL',
          nivel: 'AVISO',
          mensagem: `Envio de e-mail aos destinatários (${destinatariosFormatados}) suspenso: O e-mail SÓ É ENVIADO se houver confirmação oficial de autorização da emissão pelo Notaas. Status atual: ${novaNota.status} (${notaasStatusGravado || 'Em processamento'}).`,
          referenciaId: novaNota.id,
        });
      } else if (novaNota.status === 'AUTORIZADA') {
        // NOTA FISCAL AUTORIZADA E RECEBIDA COM CONFIRMAÇÃO DO NOTAAS!
        if (!emailConfig.senhaApp || !emailConfig.senhaApp.trim()) {
          novaNota.emailEnviado = false;
          novaNota.emailStatus = 'PENDENTE';
          storageService.addLog({
            id: `log-${Date.now()}-3`,
            timestamp: new Date().toISOString(),
            tipo: 'EMAIL',
            nivel: 'AVISO',
            mensagem: `NFS-e Nº ${numeroNfseFinal} autorizada na Receita Federal! O e-mail para [${destinatariosFormatados}] está pendente: cadastre a Senha de App do Gmail (16 letras) em Configurações > Disparo por E-mail.`,
            referenciaId: novaNota.id,
          });
        } else {
          try {
            const corpoRenderizado = this.renderTemplate(emailConfig.corpoTemplate, novaNota);
            const assuntoRenderizado = this.renderTemplate(emailConfig.assuntoTemplate, novaNota);

            const resEmail = await fetch('/api/send-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                servidorSmtp: emailConfig.servidorSmtp,
                porta: emailConfig.porta,
                usuario: emailConfig.usuario,
                senhaApp: emailConfig.senhaApp,
                remetenteNome: emailConfig.remetenteNome,
                remetenteEmail: emailConfig.remetenteEmail,
                destinatario: todosEmailsDestino.length > 0 ? todosEmailsDestino : cliente.email,
                enviarCopiaOculta: emailConfig.enviarCopiaOculta,
                assunto: assuntoRenderizado,
                corpo: corpoRenderizado,
                nota: novaNota, // Backend gera o DANFSE em PDF oficial e o XML anexados automaticamente
              }),
            });

            const dataEmail = await resEmail.json();
            if (resEmail.ok && dataEmail.success) {
              novaNota.emailEnviado = true;
              novaNota.emailDataEnvio = new Date().toISOString();
              novaNota.emailStatus = 'ENVIADO';
              storageService.addLog({
                id: `log-${Date.now()}-3`,
                timestamp: novaNota.emailDataEnvio,
                tipo: 'EMAIL',
                nivel: 'SUCESSO',
                mensagem: `E-mail entregue com sucesso para [${destinatariosFormatados}] com DANFSE (PDF) e XML Nacional anexados via Gmail SMTP.`,
                referenciaId: novaNota.id,
              });
            } else {
              novaNota.emailEnviado = false;
              novaNota.emailStatus = 'ERRO';
              storageService.addLog({
                id: `log-${Date.now()}-3`,
                timestamp: new Date().toISOString(),
                tipo: 'EMAIL',
                nivel: 'AVISO',
                mensagem: `Falha no envio de e-mail para [${destinatariosFormatados}]: ${dataEmail.error || 'Erro SMTP'}. Verifique a Senha de App nas Configurações.`,
                referenciaId: novaNota.id,
              });
            }
          } catch (err: any) {
            console.error('Falha ao disparar e-mail automático via Gmail SMTP:', err);
            novaNota.emailEnviado = false;
            novaNota.emailStatus = 'ERRO';
            storageService.addLog({
              id: `log-${Date.now()}-3`,
              timestamp: new Date().toISOString(),
              tipo: 'EMAIL',
              nivel: 'AVISO',
              mensagem: `Erro de conexão ao enviar e-mail fiscal para [${destinatariosFormatados}]: ${err.message}`,
              referenciaId: novaNota.id,
            });
          }
        }
      }
  }

    // 6. Persistir a nota emitida
    storageService.addNota(novaNota);

    // 7. Se veio de um agendamento, atualizar métricas e próxima data
    if (agendamentoOrigem) {
      agendamentoOrigem.totalEmitidas += 1;
      agendamentoOrigem.dataUltimaExecucao = new Date().toISOString();

      // Calcular próxima data com precisão de calendário no fuso de Brasília
      const baseDataStr = agendamentoOrigem.dataProximaExecucao || getBrasiliaDateTime().dataStr;
      const [anoStr, mesStr, diaStr] = baseDataStr.split('-');
      let ano = parseInt(anoStr, 10) || new Date().getFullYear();
      let mes = parseInt(mesStr, 10) || (new Date().getMonth() + 1);
      let dia = parseInt(diaStr, 10) || (agendamentoOrigem.diaDoMes || 1);

      if (agendamentoOrigem.tipoRecorrencia === 'MENSAL') {
        mes += 1;
        if (mes > 12) {
          mes = 1;
          ano += 1;
        }
        const diaAlvo = agendamentoOrigem.diaDoMes || dia;
        const diasNoMes = new Date(ano, mes, 0).getDate();
        const diaFinal = Math.min(diaAlvo, diasNoMes);
        agendamentoOrigem.dataProximaExecucao = `${ano}-${String(mes).padStart(2, '0')}-${String(diaFinal).padStart(2, '0')}`;
      } else if (agendamentoOrigem.tipoRecorrencia === 'QUINZENAL') {
        const dt = new Date(Date.UTC(ano, mes - 1, dia + 15));
        agendamentoOrigem.dataProximaExecucao = dt.toISOString().slice(0, 10);
      } else if (agendamentoOrigem.tipoRecorrencia === 'SEMANAL') {
        const dt = new Date(Date.UTC(ano, mes - 1, dia + 7));
        agendamentoOrigem.dataProximaExecucao = dt.toISOString().slice(0, 10);
      } else if (agendamentoOrigem.tipoRecorrencia === 'UNICA') {
        agendamentoOrigem.ativo = false; // finalizou
      }

      // Se atingiu a data de término configurada, encerra o agendamento automaticamente
      if (agendamentoOrigem.dataTermino && agendamentoOrigem.dataProximaExecucao > agendamentoOrigem.dataTermino) {
        agendamentoOrigem.ativo = false;
        storageService.addLog({
          id: `log-${Date.now()}-term`,
          timestamp: new Date().toISOString(),
          tipo: 'AGENDAMENTO',
          nivel: 'INFO',
          mensagem: `O agendamento "${agendamentoOrigem.titulo}" atingiu a data final estipulada (${agendamentoOrigem.dataTermino}) e foi encerrado automaticamente.`,
          referenciaId: agendamentoOrigem.id,
        });
      }

      storageService.saveAgendamento(agendamentoOrigem);
    }

    return {
      sucesso: true,
      nota: novaNota,
      emailEnviado: novaNota.emailEnviado,
    };
  }

  // Reemite uma NFS-e transmitindo apenas para o Notaas sem disparo automático de e-mail (com aviso explícito)
  static async reemitirNfse(
    notaOriginal: NfseDocument,
    customNumeroDps?: string,
    customSerieDps?: string
  ): Promise<EmitResult> {
    storageService.addLog({
      id: `log-${Date.now()}-reemit-start`,
      timestamp: new Date().toISOString(),
      tipo: 'EMISSAO_NFSE',
      nivel: 'INFO',
      mensagem: `Iniciando reemissão ao Notaas da NFS-e Nº ${notaOriginal.numero}. AVISO: A reemissão apenas envia para o Notaas mas NÃO envia e-mail automaticamente.`,
      referenciaId: notaOriginal.id,
    });

    const result = await this.emitirNfse(
      notaOriginal.tomador,
      notaOriginal.servico.descricao,
      notaOriginal.servico.codigoTributacaoNacional,
      notaOriginal.servico.itemLC116,
      notaOriginal.impostos.valorServicos,
      notaOriginal.impostos.aliquotaIss,
      notaOriginal.impostos.issRetido,
      false,
      notaOriginal.informacoesComplementares || '',
      undefined,
      false, // enviarEmail = false: estritamente SEM envio automático de e-mail
      customNumeroDps,
      customSerieDps
    );

    return result;
  }

  // Sincroniza e puxa os dados oficiais do XML emitido pelo Notaas para uma nota fiscal existente
  static async sincronizarNotaComNotaasXml(
    nota: NfseDocument
  ): Promise<{ sucesso: boolean; nota?: NfseDocument; erro?: string }> {
    const prestador = storageService.getPrestador();
    const apiKey = prestador.apiKeyNotas;
    if (!apiKey) {
      return { sucesso: false, erro: 'Chave de API do Notaas não configurada.' };
    }

    try {
      const invoiceId = nota.notaasId;
      const xmlUrl = nota.linkXml;

      if (!invoiceId && !xmlUrl) {
        return {
          sucesso: false,
          erro: 'Esta nota não possui ID do Notaas nem URL de XML vinculada para consulta.',
        };
      }

      const res = await fetch('/api/notaas/fetch-xml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId,
          xmlUrl,
          apiKey,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.xmlConteudo) {
        return {
          sucesso: false,
          erro: data.error || 'Não foi possível baixar o XML emitido do Notaas.',
        };
      }

      // Aplica integralmente os dados oficiais do XML
      const notaAtualizada = applyNotaasXmlToDocument(nota, data.xmlConteudo);
      notaAtualizada.status = 'AUTORIZADA';
      notaAtualizada.transmissaoReal = true;
      storageService.saveNota(notaAtualizada);

      storageService.addLog({
        id: `log-${Date.now()}-xml-sync-manual`,
        timestamp: new Date().toISOString(),
        tipo: 'EMISSAO_NFSE',
        nivel: 'SUCESSO',
        mensagem: `NFS-e Nº ${notaAtualizada.numero} sincronizada com sucesso a partir do XML gerado pelo Notaas! (Chave: ${notaAtualizada.chaveAcesso}).`,
        referenciaId: notaAtualizada.id,
      });

      return {
        sucesso: true,
        nota: notaAtualizada,
      };
    } catch (err: any) {
      return {
        sucesso: false,
        erro: `Erro ao sincronizar com Notaas: ${err.message}`,
      };
    }
  }

  // Substitui tags dinâmicas no modelo de mensagem ou discriminação de serviços
  static renderTemplate(template: string, nota: NfseDocument): string {
    return renderTemplateWithContext(template, {
      nota,
      servicoDescricao: nota.servico?.descricao,
      numeroNfse: nota.numero,
      numeroDps: nota.dpsNumero || nota.numero,
      serieDps: nota.dpsSerie || nota.serie || '1608',
      chaveAcesso: nota.chaveAcesso,
      codigoVerificacao: nota.codigoVerificacao,
      valorServico: nota.impostos?.valorServicos,
      aliquotaIss: nota.impostos?.aliquotaIss,
      issRetido: nota.impostos?.issRetido,
      dataCompetencia: nota.dataCompetencia,
      dataEmissao: nota.dataEmissao,
    });
  }

  private static isExecuting = false;

  // Executa uma varredura de agendamentos pendentes respeitando estritamente o Horário de Brasília
  static async checkAndExecuteDueSchedules(): Promise<number> {
    if (!storageService.isRobotActive()) {
      return 0;
    }

    // Não executa se a hidratação dos dados do Supabase ainda não estiver concluída
    if (!storageService.isReady()) {
      return 0;
    }

    if (this.isExecuting) {
      return 0;
    }

    this.isExecuting = true;
    try {
      const brasiliaNow = getBrasiliaDateTime();
      const agendamentos = storageService.getAgendamentos().filter((a) => a.ativo);
      const clientes = storageService.getClientes();
      let executadas = 0;

      for (const agd of agendamentos) {
        const { isDue, motivo } = isScheduleDue(agd, brasiliaNow);

        if (isDue) {
          const cliente = clientes.find((c) => c.id === agd.clienteId);
          if (cliente) {
            storageService.addLog({
              id: `log-${Date.now()}`,
              timestamp: new Date().toISOString(),
              tipo: 'AGENDAMENTO',
              nivel: 'INFO',
              mensagem: `Robô Automático (Horário de Brasília: ${brasiliaNow.horaStr}): Executando agendamento "${agd.titulo}" para ${cliente.razaoSocial} (Programado para ${agd.dataProximaExecucao} às ${agd.horarioExecucao})...`,
              referenciaId: agd.id,
            });

            await this.emitirNfse(
              cliente,
              agd.servicoDescricao,
              agd.codigoTributacaoNacional,
              agd.itemLC116,
              agd.valorServico,
              agd.aliquotaIss,
              agd.issRetido,
              agd.reterImpostosFederais,
              agd.informacoesComplementares,
              agd,
              agd.enviarEmailAutomatico
            );
            executadas++;
          }
        }
      }

      return executadas;
    } finally {
      this.isExecuting = false;
    }
  }
}

/**
 * Avalia se um agendamento atingiu rigorosamente a data e o horário no Horário Oficial de Brasília.
 * - Emissão ÚNICA: Jamais emite mais de uma vez para o mesmo ciclo ou no mesmo dia.
 * - Se já foi emitido hoje no Horário de Brasília: NÃO executa.
 * - Se já existe nota fiscal emitida neste ciclo para este agendamento: NÃO executa.
 * - Se a data for futura em Brasília: NÃO executa.
 * - Se a data for hoje em Brasília mas a hora atual for anterior ao horário configurado: NÃO executa.
 */
export function isScheduleDue(
  agd: ProgramacaoAgendamento,
  brasiliaNow: { dataStr: string; horaStr: string } = getBrasiliaDateTime()
): { isDue: boolean; motivo: string } {
  if (!agd.ativo) {
    return { isDue: false, motivo: 'Agendamento pausado ou desativado.' };
  }

  const { dataStr: dataHoje, horaStr: horaAgora } = brasiliaNow;
  const dataAgendada = (agd.dataProximaExecucao || '').trim();
  const horaAgendada = (agd.horarioExecucao || '08:00').trim();

  if (!dataAgendada) {
    return { isDue: false, motivo: 'Data de execução não configurada.' };
  }

  // 1. Previne reexecução múltipla no mesmo dia (Horário de Brasília)
  if (agd.dataUltimaExecucao) {
    const ultimaExecBrasilia = getBrasiliaDateTime(new Date(agd.dataUltimaExecucao)).dataStr;
    if (ultimaExecBrasilia === dataHoje) {
      return {
        isDue: false,
        motivo: `Agendamento já executado hoje (${dataHoje}) no Horário de Brasília.`,
      };
    }
  }

  // 2. Previne emissão duplicada verificando se já existe nota fiscal para este agendamento no ciclo
  const notas = storageService.getNotas();
  const jaEmitida = notas.find((n) => {
    if (n.status === 'CANCELADA') return false;
    if (n.origemAgendamentoId === agd.id) {
      const dtNf = n.dataEmissao ? getBrasiliaDateTime(new Date(n.dataEmissao)).dataStr : '';
      if (dtNf === dataHoje || dtNf === dataAgendada) return true;
      if (agd.tipoRecorrencia === 'MENSAL') {
        const comp = n.dataCompetencia || (n.dataEmissao ? n.dataEmissao.slice(0, 7) : '');
        if (comp === dataAgendada.slice(0, 7) || comp === dataHoje.slice(0, 7)) return true;
      }
      if (agd.tipoRecorrencia === 'UNICA') return true;
    }
    return false;
  });

  if (jaEmitida) {
    // Se a nota deste mês já foi emitida mas a data ainda estava no passado/hoje, avança a próxima data para o próximo ciclo
    if (dataAgendada <= dataHoje) {
      if (agd.tipoRecorrencia === 'MENSAL') {
        const [anoStr, mesStr, diaStr] = dataAgendada.split('-');
        let ano = parseInt(anoStr, 10) || new Date().getFullYear();
        let mes = parseInt(mesStr, 10) || (new Date().getMonth() + 1);
        const diaAlvo = agd.diaDoMes || parseInt(diaStr, 10) || 1;
        mes += 1;
        if (mes > 12) {
          mes = 1;
          ano += 1;
        }
        const diasNoMes = new Date(ano, mes, 0).getDate();
        const diaFinal = Math.min(diaAlvo, diasNoMes);
        agd.dataProximaExecucao = `${ano}-${String(mes).padStart(2, '0')}-${String(diaFinal).padStart(2, '0')}`;
        agd.dataUltimaExecucao = jaEmitida.dataEmissao || new Date().toISOString();
        storageService.saveAgendamento(agd);
      } else if (agd.tipoRecorrencia === 'UNICA') {
        agd.ativo = false;
        storageService.saveAgendamento(agd);
      }
    }
    return {
      isDue: false,
      motivo: `NFS-e Nº ${jaEmitida.numero} já emitida anteriormente para este agendamento neste ciclo (${dataAgendada}).`,
    };
  }

  // 3. Data agendada é futura em relação a Brasília -> NÃO EXECUTAR
  if (dataAgendada > dataHoje) {
    return {
      isDue: false,
      motivo: `Data agendada (${dataAgendada}) ainda não chegou no Horário de Brasília (hoje é ${dataHoje}).`,
    };
  }

  // 4. Data agendada é exatamente HOJE em Brasília -> EXIGE QUE O HORÁRIO JÁ TENHA SIDO ATINGIDO
  if (dataAgendada === dataHoje) {
    if (horaAgora < horaAgendada) {
      return {
        isDue: false,
        motivo: `Aguardando horário de Brasília: agendado para às ${horaAgendada} (agora são ${horaAgora}).`,
      };
    }
  }

  // 5. Data e horário atingidos em Brasília e nenhuma nota emitida neste ciclo
  return {
    isDue: true,
    motivo: `Horário de Brasília atingido (${dataHoje} ${horaAgora} >= ${dataAgendada} ${horaAgendada}). Emissão única autorizada.`,
  };
}
