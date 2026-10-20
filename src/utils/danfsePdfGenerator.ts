import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { buildNfseConsultaUrl } from './qrCodeHelper';

export async function generateDanfsePdfBuffer(nota: any): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      // 1. Gera o QR Code oficial que remete diretamente à Consulta Pública da NFS-e
      // preenchendo automaticamente o Número da Nota, Chave de Acesso, CNPJ e Código de Verificação
      const chaveLimpa = String(nota.chaveAcesso || '').replace(/\D/g, '');
      const qrTarget = buildNfseConsultaUrl(nota);

      let qrBuffer: Buffer;
      try {
        qrBuffer = await QRCode.toBuffer(qrTarget, {
          width: 200,
          margin: 0,
          color: { dark: '#000000', light: '#ffffff' },
        });
      } catch (qrErr) {
        console.warn('Erro ao gerar QR Code para o PDF:', qrErr);
        qrBuffer = Buffer.from([]);
      }

      // 2. Configura o documento PDF em formato A4 com margens precisas
      const doc = new PDFDocument({
        size: 'A4',
        margin: 18,
        info: {
          Title: `DANFSE_${nota.numero || 'Nacional'}.pdf`,
          Author: nota.prestador?.razaoSocial || 'PRISCILA I PASSOS LTDA',
          Subject: `DANFSe v2.0 - Documento Auxiliar da NFS-e Nº ${nota.numero || ''}`,
          Keywords: 'NFSe, DANFSE, Receita Federal, Portal Nacional NFS-e',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const leftMargin = 18;
      const rightMargin = 595.28 - 18;
      const contentWidth = rightMargin - leftMargin; // ~559.28 pt

      // Formatadores
      const fmtBRL = (val: number | undefined) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0);

      const fmtDoc = (docStr: string | undefined) => {
        const clean = String(docStr || '').replace(/\D/g, '');
        if (clean.length === 14) {
          return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
        }
        if (clean.length === 11) {
          return clean.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
        }
        return docStr || '-';
      };

      const fmtDataHora = (dataStr: string | undefined) => {
        if (!dataStr) return '-';
        try {
          const d = new Date(dataStr);
          if (isNaN(d.getTime())) return dataStr;
          const dia = String(d.getDate()).padStart(2, '0');
          const mes = String(d.getMonth() + 1).padStart(2, '0');
          const ano = d.getFullYear();
          const hora = String(d.getHours()).padStart(2, '0');
          const min = String(d.getMinutes()).padStart(2, '0');
          const seg = String(d.getSeconds()).padStart(2, '0');
          return `${dia}/${mes}/${ano} ${hora}:${min}:${seg}`;
        } catch {
          return dataStr;
        }
      };

      const fmtData = (dataStr: string | undefined) => {
        if (!dataStr) return '-';
        if (/^\d{4}-\d{2}$/.test(dataStr)) {
          const [ano, mes] = dataStr.split('-');
          return `01/${mes}/${ano}`;
        }
        try {
          const d = new Date(dataStr);
          if (isNaN(d.getTime())) return dataStr;
          const dia = String(d.getDate()).padStart(2, '0');
          const mes = String(d.getMonth() + 1).padStart(2, '0');
          const ano = d.getFullYear();
          return `${dia}/${mes}/${ano}`;
        } catch {
          return dataStr;
        }
      };

      let y = 18;

      // ==========================================
      // 1. CABEÇALHO OFICIAL: NFSe LOGO + DANFSe v2.0 + AMBIENTE
      // ==========================================
      doc.lineWidth(0.8).strokeColor('#000000');
      doc.rect(leftMargin, y, contentWidth, 38).stroke();

      // Divisórias internas do topo
      doc.moveTo(leftMargin + 130, y).lineTo(leftMargin + 130, y + 38).stroke();
      doc.moveTo(rightMargin - 110, y).lineTo(rightMargin - 110, y + 38).stroke();

      // Coluna 1: Logo NFSe
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#0d9488')
        .text('NFSe', leftMargin + 8, y + 6);
      doc.fontSize(7).font('Helvetica').fillColor('#475569')
        .text('Nota Fiscal de\nServiço eletrônica', leftMargin + 56, y + 9, { lineGap: 0 });

      // Coluna 2: Título DANFSe v2.0
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000')
        .text('DANFSe v2.0', leftMargin + 130, y + 8, { width: contentWidth - 240, align: 'center' });
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#000000')
        .text('Documento Auxiliar da NFS-e', leftMargin + 130, y + 21, { width: contentWidth - 240, align: 'center' });

      // Coluna 3: Ambiente Gerador e Tipo
      const ambTipo = nota.prestador?.ambienteEmissao === 'PRODUCAO' ? '1' : '2';
      doc.fontSize(6.5).font('Helvetica').fillColor('#000000')
        .text('Ambiente Gerador: 2', rightMargin - 105, y + 10);
      doc.fontSize(6.5).font('Helvetica').fillColor('#000000')
        .text(`Tipo de Ambiente: ${ambTipo}`, rightMargin - 105, y + 21);

      y += 38;

      // ==========================================
      // 2. CHAVE DE ACESSO, METADADOS E QR CODE
      // ==========================================
      const boxChaveH = 82;
      doc.rect(leftMargin, y, contentWidth, boxChaveH).stroke();

      // Linha vertical separando o QR Code (largura ~110pt à direita)
      const qrBoxLeft = rightMargin - 105;
      doc.moveTo(qrBoxLeft, y).lineTo(qrBoxLeft, y + boxChaveH).stroke();

      // Chave de Acesso
      doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#000000')
        .text('CHAVE DE ACESSO DA NFS-e', leftMargin + 6, y + 5);
      doc.fontSize(8).font('Courier-Bold').fillColor('#000000')
        .text(chaveLimpa || '31062002246874965000104000000000006026092597441541', leftMargin + 6, y + 14, { width: qrBoxLeft - leftMargin - 12 });

      // Linha divisória horizontal interna
      doc.moveTo(leftMargin, y + 26).lineTo(qrBoxLeft, y + 26).stroke();

      // Grade de 3 colunas de metadados
      const colW = (qrBoxLeft - leftMargin) / 3;
      const r1Y = y + 29;
      const r2Y = y + 46;
      const r3Y = y + 64;

      // Coluna 1
      doc.fontSize(6.5).font('Helvetica-Bold').text('NÚMERO DA NFS-e', leftMargin + 6, r1Y);
      doc.fontSize(7.5).font('Helvetica').text(String(nota.numero || '-'), leftMargin + 6, r1Y + 8);

      doc.fontSize(6.5).font('Helvetica-Bold').text('NÚMERO DA DPS', leftMargin + 6, r2Y);
      doc.fontSize(7.5).font('Helvetica').text(String(nota.dpsNumero || nota.numero?.slice(-9) || '17'), leftMargin + 6, r2Y + 8);

      doc.fontSize(6.5).font('Helvetica-Bold').text('EMITENTE DA NFS-e', leftMargin + 6, r3Y);
      doc.fontSize(7.5).font('Helvetica').text('Prestador', leftMargin + 6, r3Y + 8);

      // Coluna 2
      const c2X = leftMargin + colW + 4;
      doc.fontSize(6.5).font('Helvetica-Bold').text('COMPETÊNCIA DA NFS-e', c2X, r1Y);
      doc.fontSize(7.5).font('Helvetica').text(fmtData(nota.dataCompetencia || nota.dataEmissao), c2X, r1Y + 8);

      doc.fontSize(6.5).font('Helvetica-Bold').text('SÉRIE DA DPS', c2X, r2Y);
      doc.fontSize(7.5).font('Helvetica').text(String(nota.dpsSerie || '70000'), c2X, r2Y + 8);

      doc.fontSize(6.5).font('Helvetica-Bold').text('SITUAÇÃO DA NFS-e', c2X, r3Y);
      doc.fontSize(7.5).font('Helvetica').text(nota.status === 'CANCELADA' ? 'NFS-e Cancelada' : 'NFS-e Gerada', c2X, r3Y + 8);

      // Coluna 3
      const c3X = leftMargin + (colW * 2) + 4;
      doc.fontSize(6.5).font('Helvetica-Bold').text('DATA E HORA DA EMISSÃO DA NFS-e', c3X, r1Y);
      doc.fontSize(7.5).font('Helvetica').text(fmtDataHora(nota.dataEmissao), c3X, r1Y + 8);

      doc.fontSize(6.5).font('Helvetica-Bold').text('DATA E HORA DA EMISSÃO DA DPS', c3X, r2Y);
      doc.fontSize(7.5).font('Helvetica').text(fmtDataHora(nota.dataEmissao), c3X, r2Y + 8);

      doc.fontSize(6.5).font('Helvetica-Bold').text('FINALIDADE', c3X, r3Y);
      doc.fontSize(7.5).font('Helvetica').text('-', c3X, r3Y + 8);

      // QR Code Box à direita
      if (qrBuffer && qrBuffer.length > 0) {
        try {
          doc.image(qrBuffer, qrBoxLeft + 27, y + 4, { width: 52, height: 52 });
        } catch {}
      }
      doc.fontSize(5.1).font('Helvetica').fillColor('#000000')
        .text(
          `Aponte a câmera para o QR Code para consultar a autenticidade e preencher a Chave de Acesso no portal público`,
          qrBoxLeft + 4,
          y + 57,
          { width: 98, align: 'center', lineGap: 0.8 }
        );

      y += boxChaveH;

      // ==========================================
      // 3. PRESTADOR / FORNECEDOR
      // ==========================================
      const boxPrestH = 68;
      doc.rect(leftMargin, y, contentWidth, boxPrestH).stroke();

      // Cabeçalho da seção
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#000000')
        .text('PRESTADOR / FORNECEDOR', leftMargin + 6, y + 4);
      doc.fontSize(6.5).font('Helvetica-Bold').text('CNPJ / CPF / NIF', leftMargin + 190, y + 4);
      doc.fontSize(6.5).font('Helvetica-Bold').text('Indicador Municipal (Inscrição)', leftMargin + 340, y + 4);
      doc.fontSize(6.5).font('Helvetica-Bold').text('Telefone', leftMargin + 465, y + 4);

      // Valores linha 1
      doc.fontSize(7).font('Helvetica').text(fmtDoc(nota.prestador?.cnpj || '46874965000104'), leftMargin + 190, y + 12);
      doc.fontSize(7).font('Helvetica').text(nota.prestador?.inscricaoMunicipal || '-', leftMargin + 340, y + 12);
      doc.fontSize(7).font('Helvetica').text(nota.prestador?.telefone ? `(${nota.prestador.telefone.slice(0, 2)}) ${nota.prestador.telefone.slice(2, 7)}-${nota.prestador.telefone.slice(7)}` : '(31) 99813-1413', leftMargin + 465, y + 12);

      // Linha 2
      doc.fontSize(6.5).font('Helvetica-Bold').text('Nome / Nome Empresarial', leftMargin + 6, y + 20);
      doc.fontSize(6.5).font('Helvetica-Bold').text('Município / Sigla UF', leftMargin + 340, y + 20);
      doc.fontSize(6.5).font('Helvetica-Bold').text('Código IBGE / CEP', leftMargin + 465, y + 20);

      doc.fontSize(7.5).font('Helvetica-Bold').text(String(nota.prestador?.razaoSocial || 'PRISCILA I PASSOS LTDA'), leftMargin + 6, y + 28);
      doc.fontSize(7).font('Helvetica').text(`${nota.prestador?.endereco?.municipio || 'Belo Horizonte'} / ${nota.prestador?.endereco?.uf || 'MG'}`, leftMargin + 340, y + 28);
      doc.fontSize(7).font('Helvetica').text(`${nota.prestador?.endereco?.codigoMunicipio || '31.06200'} / ${nota.prestador?.endereco?.cep || '30.628-015'}`, leftMargin + 465, y + 28);

      // Linha 3
      doc.fontSize(6.5).font('Helvetica-Bold').text('Endereço', leftMargin + 6, y + 36);
      doc.fontSize(6.5).font('Helvetica-Bold').text('E-mail', leftMargin + 340, y + 36);

      const endPrest = `${nota.prestador?.endereco?.logradouro || 'RUA W DOIS'}, ${nota.prestador?.endereco?.numero || '143'}, ${nota.prestador?.endereco?.bairro || 'PONGELUPE (BARREIRO)'}`;
      doc.fontSize(7).font('Helvetica').text(endPrest.toUpperCase(), leftMargin + 6, y + 44, { width: 325 });
      doc.fontSize(7).font('Helvetica').text(nota.prestador?.email || 'priscilapassos.job@gmail.com', leftMargin + 340, y + 44);

      // Linha 4 (Simples Nacional)
      doc.fontSize(6.5).font('Helvetica-Bold').text('Simples Nacional na Data de Competência', leftMargin + 6, y + 52);
      doc.fontSize(6.5).font('Helvetica-Bold').text('Regime de Apuração Tributária pelo SN', leftMargin + 190, y + 52);

      doc.fontSize(6.5).font('Helvetica').text('Optante - Microempresa ou Empresa de Pequeno Porte (ME/EPP)', leftMargin + 6, y + 59, { width: 180 });
      doc.fontSize(6.5).font('Helvetica').text('Regime de apuração dos tributos federais e municipal pelo Simples Nacional', leftMargin + 190, y + 59, { width: 350 });

      y += boxPrestH;

      // ==========================================
      // 4. TOMADOR / ADQUIRENTE
      // ==========================================
      const boxTomH = 68;
      doc.rect(leftMargin, y, contentWidth, boxTomH).stroke();

      // Cabeçalho da seção
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#000000')
        .text('TOMADOR / ADQUIRENTE', leftMargin + 6, y + 4);
      doc.fontSize(6.5).font('Helvetica-Bold').text('CNPJ / CPF / NIF', leftMargin + 190, y + 4);
      doc.fontSize(6.5).font('Helvetica-Bold').text('Indicador Municipal (Inscrição)', leftMargin + 340, y + 4);
      doc.fontSize(6.5).font('Helvetica-Bold').text('Telefone', leftMargin + 465, y + 4);

      // Valores linha 1
      doc.fontSize(7).font('Helvetica').text(fmtDoc(nota.tomador?.documento), leftMargin + 190, y + 12);
      doc.fontSize(7).font('Helvetica').text(nota.tomador?.inscricaoMunicipal || '-', leftMargin + 340, y + 12);
      doc.fontSize(7).font('Helvetica').text(nota.tomador?.telefone || '-', leftMargin + 465, y + 12);

      // Linha 2
      doc.fontSize(6.5).font('Helvetica-Bold').text('Nome / Nome Empresarial', leftMargin + 6, y + 20);
      doc.fontSize(6.5).font('Helvetica-Bold').text('Município / Sigla UF', leftMargin + 340, y + 20);
      doc.fontSize(6.5).font('Helvetica-Bold').text('Código IBGE / CEP', leftMargin + 465, y + 20);

      doc.fontSize(7.5).font('Helvetica-Bold').text(String(nota.tomador?.razaoSocial || nota.tomador?.nome || '-'), leftMargin + 6, y + 28);
      doc.fontSize(7).font('Helvetica').text(`${nota.tomador?.endereco?.municipio || '-'} / ${nota.tomador?.endereco?.uf || '-'}`, leftMargin + 340, y + 28);
      doc.fontSize(7).font('Helvetica').text(`${nota.tomador?.endereco?.codigoMunicipio || '-'} / ${nota.tomador?.endereco?.cep || '-'}`, leftMargin + 465, y + 28);

      // Linha 3
      doc.fontSize(6.5).font('Helvetica-Bold').text('Endereço', leftMargin + 6, y + 36);
      doc.fontSize(6.5).font('Helvetica-Bold').text('E-mail', leftMargin + 340, y + 36);

      const endTom = `${nota.tomador?.endereco?.logradouro || ''}, ${nota.tomador?.endereco?.numero || 'S/N'} ${nota.tomador?.endereco?.complemento || ''}, ${nota.tomador?.endereco?.bairro || ''}`;
      doc.fontSize(7).font('Helvetica').text(endTom.toUpperCase(), leftMargin + 6, y + 44, { width: 325 });
      doc.fontSize(7).font('Helvetica').text(nota.tomador?.email || '-', leftMargin + 340, y + 44);

      // Linhas informativas oficiais da NFS-e Nacional
      doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#1e293b')
        .text('DESTINATÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e', leftMargin + 190, y + 53);
      doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#1e293b')
        .text('INTERMEDIÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e', leftMargin + 190, y + 60);

      y += boxTomH;

      // ==========================================
      // 5. SERVIÇO PRESTADO
      // ==========================================
      const boxServH = 68;
      doc.rect(leftMargin, y, contentWidth, boxServH).stroke();

      doc.fontSize(7).font('Helvetica-Bold').fillColor('#000000')
        .text('SERVIÇO PRESTADO', leftMargin + 6, y + 4);
      doc.fontSize(6.5).font('Helvetica-Bold').text('Código de Tributação Nacional/Municipal', leftMargin + 190, y + 4);
      doc.fontSize(6.5).font('Helvetica-Bold').text('Código da NBS', leftMargin + 340, y + 4);
      doc.fontSize(6.5).font('Helvetica-Bold').text('Local da Prestação / Sigla UF / País', leftMargin + 430, y + 4);

      doc.fontSize(7).font('Helvetica').text(`${nota.servico?.codigoTributacaoNacional || '99.01.01'} / -`, leftMargin + 190, y + 12);
      doc.fontSize(7).font('Helvetica').text('-', leftMargin + 340, y + 12);
      doc.fontSize(7).font('Helvetica').text(`${nota.servico?.localPrestacaoMunicipio || nota.tomador?.endereco?.municipio || 'Araucária'} / ${nota.servico?.localPrestacaoUf || nota.tomador?.endereco?.uf || 'PR'} / -`, leftMargin + 430, y + 12);

      // Subtítulo do status da incidência
      const subIncid = (nota.servico?.operacaoNaoSujeitaIss || nota.servico?.codigoTributacaoNacional === '99.01.01' || Number(nota.impostos?.aliquotaIss) === 0)
        ? 'Serviços sem a incidência de ISSQN e ICMS'
        : 'Operação tributável no município';
      doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#000000')
        .text(subIncid, leftMargin + 6, y + 20);

      doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#000000')
        .text('Descrição do Serviço', leftMargin + 6, y + 28);

      doc.fontSize(7).font('Helvetica').fillColor('#000000')
        .text(String(nota.servico?.descricao || 'Prestação de serviços'), leftMargin + 6, y + 36, {
          width: contentWidth - 12,
          lineGap: 1.2,
        });

      y += boxServH;

      // ==========================================
      // 6. TRIBUTAÇÃO MUNICIPAL (ISSQN)
      // ==========================================
      const boxMunH = 13;
      doc.rect(leftMargin, y, contentWidth, boxMunH).stroke();
      const txtTribMun = (nota.servico?.operacaoNaoSujeitaIss || nota.servico?.codigoTributacaoNacional === '99.01.01' || Number(nota.impostos?.aliquotaIss) === 0)
        ? 'TRIBUTAÇÃO MUNICIPAL (ISSQN) - OPERAÇÃO NÃO SUJEITA AO ISSQN'
        : `TRIBUTAÇÃO MUNICIPAL (ISSQN) - OPERAÇÃO TRIBUTÁVEL (ALÍQUOTA: ${Number(nota.impostos?.aliquotaIss || 2).toFixed(2)}%)`;
      doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#000000')
        .text(txtTribMun, leftMargin + 6, y + 3.5);

      y += boxMunH;

      // ==========================================
      // 7. TRIBUTAÇÃO FEDERAL (EXCETO CBS)
      // ==========================================
      const boxFedH = 34;
      doc.rect(leftMargin, y, contentWidth, boxFedH).stroke();

      doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#000000')
        .text('TRIBUTAÇÃO FEDERAL (EXCETO CBS)', leftMargin + 6, y + 4);

      doc.fontSize(6.5).font('Helvetica-Bold').text('IRRF', leftMargin + 190, y + 4);
      doc.fontSize(6.5).font('Helvetica-Bold').text('Contribuição Previdenciária - Retida', leftMargin + 310, y + 4);
      doc.fontSize(6.5).font('Helvetica-Bold').text('Contribuições Sociais - Retidas', leftMargin + 440, y + 4);

      doc.fontSize(7).font('Helvetica').text(nota.impostos?.valorIr ? fmtBRL(nota.impostos.valorIr) : '-', leftMargin + 190, y + 11);
      doc.fontSize(7).font('Helvetica').text(nota.impostos?.valorInss ? fmtBRL(nota.impostos.valorInss) : '-', leftMargin + 310, y + 11);
      doc.fontSize(7).font('Helvetica').text(nota.impostos?.totalRetencoes ? fmtBRL(nota.impostos.totalRetencoes) : '-', leftMargin + 440, y + 11);

      // Linha 2
      doc.fontSize(6.5).font('Helvetica-Bold').text('PIS - Débito Apuração Própria', leftMargin + 6, y + 19);
      doc.fontSize(6.5).font('Helvetica-Bold').text('COFINS - Débito Apuração Própria', leftMargin + 190, y + 19);
      doc.fontSize(6.5).font('Helvetica-Bold').text('Descrição Contrib. Sociais - Retidas', leftMargin + 340, y + 19);

      doc.fontSize(7).font('Helvetica').text(nota.impostos?.valorPis ? fmtBRL(nota.impostos.valorPis) : '-', leftMargin + 6, y + 26);
      doc.fontSize(7).font('Helvetica').text(nota.impostos?.valorCofins ? fmtBRL(nota.impostos.valorCofins) : '-', leftMargin + 190, y + 26);
      doc.fontSize(7).font('Helvetica').text('0 - PIS/COFINS/CSLL Não Retidos', leftMargin + 340, y + 26);

      y += boxFedH;

      // ==========================================
      // 8. TRIBUTAÇÃO IBS/CBS (CAMPOS REFORMA TRIBUTÁRIA v2.0)
      // ==========================================
      const boxIbsH = 82;
      doc.rect(leftMargin, y, contentWidth, boxIbsH).stroke();

      doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#000000')
        .text('TRIBUTAÇÃO IBS/CBS', leftMargin + 6, y + 3);

      doc.fontSize(6.5).font('Helvetica-Bold').text('CST / cClassTrib', leftMargin + 190, y + 3);
      doc.fontSize(6.5).font('Helvetica-Bold').text('Indicador de Operação / Código IBGE Incidência / Município Incidência / Sigla UF', leftMargin + 310, y + 3);

      doc.fontSize(7).font('Helvetica').text('- / -', leftMargin + 190, y + 10);
      doc.fontSize(7).font('Helvetica').text('- / - / - / -', leftMargin + 310, y + 10);

      // Linha 2
      doc.fontSize(6.5).font('Helvetica-Bold').text('Exclusões e Reduções da Base de Cálculo', leftMargin + 6, y + 18);
      doc.fontSize(6.5).font('Helvetica-Bold').text('Base de Cálculo Após Exclusões e Reduções', leftMargin + 190, y + 18);
      doc.fontSize(6.5).font('Helvetica-Bold').text('Red. Alíquota IBS / Red. Alíquota CBS', leftMargin + 340, y + 18);
      doc.fontSize(6.5).font('Helvetica-Bold').text('Alíquota - IBS UF / IBS Mun', leftMargin + 465, y + 18);

      doc.fontSize(7).font('Helvetica').text('R$ 0,00', leftMargin + 6, y + 25);
      doc.fontSize(7).font('Helvetica').text('-', leftMargin + 190, y + 25);
      doc.fontSize(7).font('Helvetica').text('- / - / -', leftMargin + 340, y + 25);
      doc.fontSize(7).font('Helvetica').text('- / -', leftMargin + 465, y + 25);

      // Linha 3
      doc.fontSize(6.5).font('Helvetica-Bold').text('Alíq. Efetiva Municipal - IBS', leftMargin + 6, y + 33);
      doc.fontSize(6.5).font('Helvetica-Bold').text('Valor Apurado Municipal - IBS', leftMargin + 190, y + 33);
      doc.fontSize(6.5).font('Helvetica-Bold').text('Alíq. Efetiva Estadual - IBS', leftMargin + 340, y + 33);
      doc.fontSize(6.5).font('Helvetica-Bold').text('Valor Apurado Estadual - IBS', leftMargin + 465, y + 33);

      doc.fontSize(7).font('Helvetica').text('-', leftMargin + 6, y + 40);
      doc.fontSize(7).font('Helvetica').text('-', leftMargin + 190, y + 40);
      doc.fontSize(7).font('Helvetica').text('-', leftMargin + 340, y + 40);
      doc.fontSize(7).font('Helvetica').text('-', leftMargin + 465, y + 40);

      // Linha 4
      doc.fontSize(6.5).font('Helvetica-Bold').text('Valor Total Apurado - IBS', leftMargin + 6, y + 48);
      doc.fontSize(6.5).font('Helvetica-Bold').text('Alíquota - CBS', leftMargin + 190, y + 48);
      doc.fontSize(6.5).font('Helvetica-Bold').text('Alíquota Efetiva - CBS', leftMargin + 340, y + 48);
      doc.fontSize(6.5).font('Helvetica-Bold').text('Valor Total Apurado - CBS', leftMargin + 465, y + 48);

      doc.fontSize(7).font('Helvetica').text('-', leftMargin + 6, y + 55);
      doc.fontSize(7).font('Helvetica').text('-', leftMargin + 190, y + 55);
      doc.fontSize(7).font('Helvetica').text('-', leftMargin + 340, y + 55);
      doc.fontSize(7).font('Helvetica').text('-', leftMargin + 465, y + 55);

      y += boxIbsH;

      // ==========================================
      // 9. VALOR TOTAL DA NFS-e / VALORES DA OPERAÇÃO
      // ==========================================
      const boxValH = 46;
      doc.rect(leftMargin, y, contentWidth, boxValH).stroke();

      const valorTotalNota = Number(nota.impostos?.valorServicos) || Number(nota.servico?.valor) || 0;
      const valorLiqNota = Number(nota.impostos?.valorLiquido) || valorTotalNota;

      doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#000000')
        .text('VALOR TOTAL DA NFS-e', leftMargin + 6, y + 4);
      doc.fontSize(6.5).font('Helvetica-Bold').text('VALOR DA OPERAÇÃO / SERVIÇO', leftMargin + 190, y + 4);
      doc.fontSize(6.5).font('Helvetica-Bold').text('Desconto Incondicionado', leftMargin + 340, y + 4);
      doc.fontSize(6.5).font('Helvetica-Bold').text('Desconto Condicionado', leftMargin + 465, y + 4);

      doc.fontSize(8.5).font('Helvetica-Bold').text(fmtBRL(valorTotalNota), leftMargin + 190, y + 12);
      doc.fontSize(7.5).font('Helvetica').text('-', leftMargin + 340, y + 12);
      doc.fontSize(7.5).font('Helvetica').text('-', leftMargin + 465, y + 12);

      // Linha 2
      doc.fontSize(6.5).font('Helvetica-Bold').text('Total das Retenções (ISSQN / Federais)', leftMargin + 6, y + 24);
      doc.fontSize(6.5).font('Helvetica-Bold').text('VALOR LÍQUIDO DA NFS-e', leftMargin + 190, y + 24);
      doc.fontSize(6.5).font('Helvetica-Bold').text('Total do IBS/CBS', leftMargin + 340, y + 24);
      doc.fontSize(6.5).font('Helvetica-Bold').text('VALOR LÍQUIDO DA NFS-e + IBS/CBS', leftMargin + 440, y + 24);

      doc.fontSize(7.5).font('Helvetica').text(nota.impostos?.totalRetencoes ? fmtBRL(nota.impostos.totalRetencoes) : '-', leftMargin + 6, y + 33);
      doc.fontSize(8.5).font('Helvetica-Bold').text(fmtBRL(valorLiqNota), leftMargin + 190, y + 33);
      doc.fontSize(7.5).font('Helvetica').text('R$ 0,00', leftMargin + 340, y + 33);
      doc.fontSize(8.5).font('Helvetica-Bold').text(fmtBRL(valorLiqNota), leftMargin + 440, y + 33);

      y += boxValH;

      // ==========================================
      // 10. INFORMAÇÕES COMPLEMENTARES
      // ==========================================
      const boxInfH = 34;
      doc.rect(leftMargin, y, contentWidth, boxInfH).stroke();

      doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#000000')
        .text('INFORMAÇÕES COMPLEMENTARES', leftMargin + 6, y + 3.5);

      const textoTribs = 'Totais aproximados dos Tributos cfe. Lei nº 12.741/2012: Federais: -; Estaduais: -; Municipais: -;';
      doc.fontSize(6.5).font('Helvetica').fillColor('#000000')
        .text(textoTribs, leftMargin + 6, y + 12);

      if (nota.informacoesComplementares) {
        doc.fontSize(6.5).font('Helvetica').fillColor('#000000')
          .text(String(nota.informacoesComplementares), leftMargin + 6, y + 21, { width: contentWidth - 12 });
      }

      y += boxInfH + 4;

      // ==========================================
      // 11. CANHOTO DE PROTOCOLO E CIENTIFICAÇÃO NO RODAPÉ
      // ==========================================
      const canhotoH = 32;
      doc.rect(leftMargin, y, contentWidth, canhotoH).stroke();

      doc.moveTo(leftMargin + 140, y).lineTo(leftMargin + 140, y + canhotoH).stroke();
      doc.moveTo(leftMargin + 320, y).lineTo(leftMargin + 320, y + canhotoH).stroke();

      doc.fontSize(6).font('Helvetica-Bold').fillColor('#000000')
        .text('DATA CIENTIFICAÇÃO:', leftMargin + 4, y + 4);

      doc.fontSize(6).font('Helvetica-Bold').fillColor('#000000')
        .text('IDENTIFICAÇÃO E ASSINATURA', leftMargin + 144, y + 4);

      doc.fontSize(6).font('Helvetica-Bold').fillColor('#000000')
        .text('N° NFS-e / CHAVE NFS-e', leftMargin + 324, y + 4);

      doc.fontSize(7.5).font('Courier-Bold').fillColor('#000000')
        .text(`${nota.numero || '60'} / ${chaveLimpa}`, leftMargin + 324, y + 14, { width: rightMargin - leftMargin - 328 });

      // Finaliza o documento PDF
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
