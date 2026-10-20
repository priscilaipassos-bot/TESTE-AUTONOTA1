// src/serverApp.ts
import express from "express";
import nodemailer from "nodemailer";

// src/utils/danfsePdfGenerator.ts
import PDFDocument from "pdfkit";
import QRCode from "qrcode";

// src/utils/qrCodeHelper.ts
function buildNfseConsultaUrl(nota, urlCustom) {
  const chaveLimpa = String(nota.chaveAcesso || "").replace(/\D/g, "");
  const numLimpo = String(nota.numero || "").replace(/\D/g, "");
  const cnpjPrestador = String(nota.prestador?.cnpj || "46874965000104").replace(/\D/g, "");
  const codVerif = String(nota.codigoVerificacao || "").trim();
  const dpsNum = String(nota.dpsNumero || "").replace(/\D/g, "");
  const customPortal = urlCustom || nota.prestador?.urlConsultaNfse;
  if (customPortal && customPortal.trim()) {
    const base = customPortal.trim();
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}numero=${numLimpo}&num=${numLimpo}&chv=${chaveLimpa}&cnpj=${cnpjPrestador}&verificacao=${encodeURIComponent(codVerif)}`;
  }
  if (nota.linkDanfse && String(nota.linkDanfse).startsWith("http") && !String(nota.linkDanfse).endsWith(".pdf")) {
    const sep = String(nota.linkDanfse).includes("?") ? "&" : "?";
    return `${nota.linkDanfse}${sep}numero=${numLimpo}&num=${numLimpo}&chv=${chaveLimpa}`;
  }
  return `https://www.nfse.gov.br/consultapublica?chv=${chaveLimpa}&numero=${numLimpo}&num=${numLimpo}&n=${numLimpo}&cnpj=${cnpjPrestador}&codVerif=${encodeURIComponent(codVerif)}&dps=${dpsNum}`;
}

// src/utils/danfsePdfGenerator.ts
async function generateDanfsePdfBuffer(nota) {
  return new Promise(async (resolve, reject) => {
    try {
      const chaveLimpa = String(nota.chaveAcesso || "").replace(/\D/g, "");
      const qrTarget = buildNfseConsultaUrl(nota);
      let qrBuffer;
      try {
        qrBuffer = await QRCode.toBuffer(qrTarget, {
          width: 200,
          margin: 0,
          color: { dark: "#000000", light: "#ffffff" }
        });
      } catch (qrErr) {
        console.warn("Erro ao gerar QR Code para o PDF:", qrErr);
        qrBuffer = Buffer.from([]);
      }
      const doc = new PDFDocument({
        size: "A4",
        margin: 18,
        info: {
          Title: `DANFSE_${nota.numero || "Nacional"}.pdf`,
          Author: nota.prestador?.razaoSocial || "PRISCILA I PASSOS LTDA",
          Subject: `DANFSe v2.0 - Documento Auxiliar da NFS-e N\xBA ${nota.numero || ""}`,
          Keywords: "NFSe, DANFSE, Receita Federal, Portal Nacional NFS-e"
        }
      });
      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err) => reject(err));
      const leftMargin = 18;
      const rightMargin = 595.28 - 18;
      const contentWidth = rightMargin - leftMargin;
      const fmtBRL = (val) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(val) || 0);
      const fmtDoc = (docStr) => {
        const clean = String(docStr || "").replace(/\D/g, "");
        if (clean.length === 14) {
          return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
        }
        if (clean.length === 11) {
          return clean.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
        }
        return docStr || "-";
      };
      const fmtDataHora = (dataStr) => {
        if (!dataStr) return "-";
        try {
          const d = new Date(dataStr);
          if (isNaN(d.getTime())) return dataStr;
          const dia = String(d.getDate()).padStart(2, "0");
          const mes = String(d.getMonth() + 1).padStart(2, "0");
          const ano = d.getFullYear();
          const hora = String(d.getHours()).padStart(2, "0");
          const min = String(d.getMinutes()).padStart(2, "0");
          const seg = String(d.getSeconds()).padStart(2, "0");
          return `${dia}/${mes}/${ano} ${hora}:${min}:${seg}`;
        } catch {
          return dataStr;
        }
      };
      const fmtData = (dataStr) => {
        if (!dataStr) return "-";
        if (/^\d{4}-\d{2}$/.test(dataStr)) {
          const [ano, mes] = dataStr.split("-");
          return `01/${mes}/${ano}`;
        }
        try {
          const d = new Date(dataStr);
          if (isNaN(d.getTime())) return dataStr;
          const dia = String(d.getDate()).padStart(2, "0");
          const mes = String(d.getMonth() + 1).padStart(2, "0");
          const ano = d.getFullYear();
          return `${dia}/${mes}/${ano}`;
        } catch {
          return dataStr;
        }
      };
      let y = 18;
      doc.lineWidth(0.8).strokeColor("#000000");
      doc.rect(leftMargin, y, contentWidth, 38).stroke();
      doc.moveTo(leftMargin + 130, y).lineTo(leftMargin + 130, y + 38).stroke();
      doc.moveTo(rightMargin - 110, y).lineTo(rightMargin - 110, y + 38).stroke();
      doc.fontSize(16).font("Helvetica-Bold").fillColor("#0d9488").text("NFSe", leftMargin + 8, y + 6);
      doc.fontSize(7).font("Helvetica").fillColor("#475569").text("Nota Fiscal de\nServi\xE7o eletr\xF4nica", leftMargin + 56, y + 9, { lineGap: 0 });
      doc.fontSize(11).font("Helvetica-Bold").fillColor("#000000").text("DANFSe v2.0", leftMargin + 130, y + 8, { width: contentWidth - 240, align: "center" });
      doc.fontSize(8.5).font("Helvetica-Bold").fillColor("#000000").text("Documento Auxiliar da NFS-e", leftMargin + 130, y + 21, { width: contentWidth - 240, align: "center" });
      const ambTipo = nota.prestador?.ambienteEmissao === "PRODUCAO" ? "1" : "2";
      doc.fontSize(6.5).font("Helvetica").fillColor("#000000").text("Ambiente Gerador: 2", rightMargin - 105, y + 10);
      doc.fontSize(6.5).font("Helvetica").fillColor("#000000").text(`Tipo de Ambiente: ${ambTipo}`, rightMargin - 105, y + 21);
      y += 38;
      const boxChaveH = 82;
      doc.rect(leftMargin, y, contentWidth, boxChaveH).stroke();
      const qrBoxLeft = rightMargin - 105;
      doc.moveTo(qrBoxLeft, y).lineTo(qrBoxLeft, y + boxChaveH).stroke();
      doc.fontSize(6.5).font("Helvetica-Bold").fillColor("#000000").text("CHAVE DE ACESSO DA NFS-e", leftMargin + 6, y + 5);
      doc.fontSize(8).font("Courier-Bold").fillColor("#000000").text(chaveLimpa || "31062002246874965000104000000000006026092597441541", leftMargin + 6, y + 14, { width: qrBoxLeft - leftMargin - 12 });
      doc.moveTo(leftMargin, y + 26).lineTo(qrBoxLeft, y + 26).stroke();
      const colW = (qrBoxLeft - leftMargin) / 3;
      const r1Y = y + 29;
      const r2Y = y + 46;
      const r3Y = y + 64;
      doc.fontSize(6.5).font("Helvetica-Bold").text("N\xDAMERO DA NFS-e", leftMargin + 6, r1Y);
      doc.fontSize(7.5).font("Helvetica").text(String(nota.numero || "-"), leftMargin + 6, r1Y + 8);
      doc.fontSize(6.5).font("Helvetica-Bold").text("N\xDAMERO DA DPS", leftMargin + 6, r2Y);
      doc.fontSize(7.5).font("Helvetica").text(String(nota.dpsNumero || nota.numero?.slice(-9) || "17"), leftMargin + 6, r2Y + 8);
      doc.fontSize(6.5).font("Helvetica-Bold").text("EMITENTE DA NFS-e", leftMargin + 6, r3Y);
      doc.fontSize(7.5).font("Helvetica").text("Prestador", leftMargin + 6, r3Y + 8);
      const c2X = leftMargin + colW + 4;
      doc.fontSize(6.5).font("Helvetica-Bold").text("COMPET\xCANCIA DA NFS-e", c2X, r1Y);
      doc.fontSize(7.5).font("Helvetica").text(fmtData(nota.dataCompetencia || nota.dataEmissao), c2X, r1Y + 8);
      doc.fontSize(6.5).font("Helvetica-Bold").text("S\xC9RIE DA DPS", c2X, r2Y);
      doc.fontSize(7.5).font("Helvetica").text(String(nota.dpsSerie || "70000"), c2X, r2Y + 8);
      doc.fontSize(6.5).font("Helvetica-Bold").text("SITUA\xC7\xC3O DA NFS-e", c2X, r3Y);
      doc.fontSize(7.5).font("Helvetica").text(nota.status === "CANCELADA" ? "NFS-e Cancelada" : "NFS-e Gerada", c2X, r3Y + 8);
      const c3X = leftMargin + colW * 2 + 4;
      doc.fontSize(6.5).font("Helvetica-Bold").text("DATA E HORA DA EMISS\xC3O DA NFS-e", c3X, r1Y);
      doc.fontSize(7.5).font("Helvetica").text(fmtDataHora(nota.dataEmissao), c3X, r1Y + 8);
      doc.fontSize(6.5).font("Helvetica-Bold").text("DATA E HORA DA EMISS\xC3O DA DPS", c3X, r2Y);
      doc.fontSize(7.5).font("Helvetica").text(fmtDataHora(nota.dataEmissao), c3X, r2Y + 8);
      doc.fontSize(6.5).font("Helvetica-Bold").text("FINALIDADE", c3X, r3Y);
      doc.fontSize(7.5).font("Helvetica").text("-", c3X, r3Y + 8);
      if (qrBuffer && qrBuffer.length > 0) {
        try {
          doc.image(qrBuffer, qrBoxLeft + 27, y + 4, { width: 52, height: 52 });
        } catch {
        }
      }
      doc.fontSize(5.2).font("Helvetica").fillColor("#000000").text(
        `Consulte a autenticidade e preencha a NFS-e N\xBA ${nota.numero || ""} apontando a c\xE2mera para o QR Code acima`,
        qrBoxLeft + 4,
        y + 57,
        { width: 98, align: "center", lineGap: 0.8 }
      );
      y += boxChaveH;
      const boxPrestH = 68;
      doc.rect(leftMargin, y, contentWidth, boxPrestH).stroke();
      doc.fontSize(7).font("Helvetica-Bold").fillColor("#000000").text("PRESTADOR / FORNECEDOR", leftMargin + 6, y + 4);
      doc.fontSize(6.5).font("Helvetica-Bold").text("CNPJ / CPF / NIF", leftMargin + 190, y + 4);
      doc.fontSize(6.5).font("Helvetica-Bold").text("Indicador Municipal (Inscri\xE7\xE3o)", leftMargin + 340, y + 4);
      doc.fontSize(6.5).font("Helvetica-Bold").text("Telefone", leftMargin + 465, y + 4);
      doc.fontSize(7).font("Helvetica").text(fmtDoc(nota.prestador?.cnpj || "46874965000104"), leftMargin + 190, y + 12);
      doc.fontSize(7).font("Helvetica").text(nota.prestador?.inscricaoMunicipal || "-", leftMargin + 340, y + 12);
      doc.fontSize(7).font("Helvetica").text(nota.prestador?.telefone ? `(${nota.prestador.telefone.slice(0, 2)}) ${nota.prestador.telefone.slice(2, 7)}-${nota.prestador.telefone.slice(7)}` : "(31) 99813-1413", leftMargin + 465, y + 12);
      doc.fontSize(6.5).font("Helvetica-Bold").text("Nome / Nome Empresarial", leftMargin + 6, y + 20);
      doc.fontSize(6.5).font("Helvetica-Bold").text("Munic\xEDpio / Sigla UF", leftMargin + 340, y + 20);
      doc.fontSize(6.5).font("Helvetica-Bold").text("C\xF3digo IBGE / CEP", leftMargin + 465, y + 20);
      doc.fontSize(7.5).font("Helvetica-Bold").text(String(nota.prestador?.razaoSocial || "PRISCILA I PASSOS LTDA"), leftMargin + 6, y + 28);
      doc.fontSize(7).font("Helvetica").text(`${nota.prestador?.endereco?.municipio || "Belo Horizonte"} / ${nota.prestador?.endereco?.uf || "MG"}`, leftMargin + 340, y + 28);
      doc.fontSize(7).font("Helvetica").text(`${nota.prestador?.endereco?.codigoMunicipio || "31.06200"} / ${nota.prestador?.endereco?.cep || "30.628-015"}`, leftMargin + 465, y + 28);
      doc.fontSize(6.5).font("Helvetica-Bold").text("Endere\xE7o", leftMargin + 6, y + 36);
      doc.fontSize(6.5).font("Helvetica-Bold").text("E-mail", leftMargin + 340, y + 36);
      const endPrest = `${nota.prestador?.endereco?.logradouro || "RUA W DOIS"}, ${nota.prestador?.endereco?.numero || "143"}, ${nota.prestador?.endereco?.bairro || "PONGELUPE (BARREIRO)"}`;
      doc.fontSize(7).font("Helvetica").text(endPrest.toUpperCase(), leftMargin + 6, y + 44, { width: 325 });
      doc.fontSize(7).font("Helvetica").text(nota.prestador?.email || "priscilapassos.job@gmail.com", leftMargin + 340, y + 44);
      doc.fontSize(6.5).font("Helvetica-Bold").text("Simples Nacional na Data de Compet\xEAncia", leftMargin + 6, y + 52);
      doc.fontSize(6.5).font("Helvetica-Bold").text("Regime de Apura\xE7\xE3o Tribut\xE1ria pelo SN", leftMargin + 190, y + 52);
      doc.fontSize(6.5).font("Helvetica").text("Optante - Microempresa ou Empresa de Pequeno Porte (ME/EPP)", leftMargin + 6, y + 59, { width: 180 });
      doc.fontSize(6.5).font("Helvetica").text("Regime de apura\xE7\xE3o dos tributos federais e municipal pelo Simples Nacional", leftMargin + 190, y + 59, { width: 350 });
      y += boxPrestH;
      const boxTomH = 68;
      doc.rect(leftMargin, y, contentWidth, boxTomH).stroke();
      doc.fontSize(7).font("Helvetica-Bold").fillColor("#000000").text("TOMADOR / ADQUIRENTE", leftMargin + 6, y + 4);
      doc.fontSize(6.5).font("Helvetica-Bold").text("CNPJ / CPF / NIF", leftMargin + 190, y + 4);
      doc.fontSize(6.5).font("Helvetica-Bold").text("Indicador Municipal (Inscri\xE7\xE3o)", leftMargin + 340, y + 4);
      doc.fontSize(6.5).font("Helvetica-Bold").text("Telefone", leftMargin + 465, y + 4);
      doc.fontSize(7).font("Helvetica").text(fmtDoc(nota.tomador?.documento), leftMargin + 190, y + 12);
      doc.fontSize(7).font("Helvetica").text(nota.tomador?.inscricaoMunicipal || "-", leftMargin + 340, y + 12);
      doc.fontSize(7).font("Helvetica").text(nota.tomador?.telefone || "-", leftMargin + 465, y + 12);
      doc.fontSize(6.5).font("Helvetica-Bold").text("Nome / Nome Empresarial", leftMargin + 6, y + 20);
      doc.fontSize(6.5).font("Helvetica-Bold").text("Munic\xEDpio / Sigla UF", leftMargin + 340, y + 20);
      doc.fontSize(6.5).font("Helvetica-Bold").text("C\xF3digo IBGE / CEP", leftMargin + 465, y + 20);
      doc.fontSize(7.5).font("Helvetica-Bold").text(String(nota.tomador?.razaoSocial || nota.tomador?.nome || "-"), leftMargin + 6, y + 28);
      doc.fontSize(7).font("Helvetica").text(`${nota.tomador?.endereco?.municipio || "-"} / ${nota.tomador?.endereco?.uf || "-"}`, leftMargin + 340, y + 28);
      doc.fontSize(7).font("Helvetica").text(`${nota.tomador?.endereco?.codigoMunicipio || "-"} / ${nota.tomador?.endereco?.cep || "-"}`, leftMargin + 465, y + 28);
      doc.fontSize(6.5).font("Helvetica-Bold").text("Endere\xE7o", leftMargin + 6, y + 36);
      doc.fontSize(6.5).font("Helvetica-Bold").text("E-mail", leftMargin + 340, y + 36);
      const endTom = `${nota.tomador?.endereco?.logradouro || ""}, ${nota.tomador?.endereco?.numero || "S/N"} ${nota.tomador?.endereco?.complemento || ""}, ${nota.tomador?.endereco?.bairro || ""}`;
      doc.fontSize(7).font("Helvetica").text(endTom.toUpperCase(), leftMargin + 6, y + 44, { width: 325 });
      doc.fontSize(7).font("Helvetica").text(nota.tomador?.email || "-", leftMargin + 340, y + 44);
      doc.fontSize(6.5).font("Helvetica-Bold").fillColor("#1e293b").text("DESTINAT\xC1RIO DA OPERA\xC7\xC3O N\xC3O IDENTIFICADO NA NFS-e", leftMargin + 190, y + 53);
      doc.fontSize(6.5).font("Helvetica-Bold").fillColor("#1e293b").text("INTERMEDI\xC1RIO DA OPERA\xC7\xC3O N\xC3O IDENTIFICADO NA NFS-e", leftMargin + 190, y + 60);
      y += boxTomH;
      const boxServH = 68;
      doc.rect(leftMargin, y, contentWidth, boxServH).stroke();
      doc.fontSize(7).font("Helvetica-Bold").fillColor("#000000").text("SERVI\xC7O PRESTADO", leftMargin + 6, y + 4);
      doc.fontSize(6.5).font("Helvetica-Bold").text("C\xF3digo de Tributa\xE7\xE3o Nacional/Municipal", leftMargin + 190, y + 4);
      doc.fontSize(6.5).font("Helvetica-Bold").text("C\xF3digo da NBS", leftMargin + 340, y + 4);
      doc.fontSize(6.5).font("Helvetica-Bold").text("Local da Presta\xE7\xE3o / Sigla UF / Pa\xEDs", leftMargin + 430, y + 4);
      doc.fontSize(7).font("Helvetica").text(`${nota.servico?.codigoTributacaoNacional || "99.01.01"} / -`, leftMargin + 190, y + 12);
      doc.fontSize(7).font("Helvetica").text("-", leftMargin + 340, y + 12);
      doc.fontSize(7).font("Helvetica").text(`${nota.servico?.localPrestacaoMunicipio || nota.tomador?.endereco?.municipio || "Arauc\xE1ria"} / ${nota.servico?.localPrestacaoUf || nota.tomador?.endereco?.uf || "PR"} / -`, leftMargin + 430, y + 12);
      const subIncid = nota.servico?.operacaoNaoSujeitaIss || nota.servico?.codigoTributacaoNacional === "99.01.01" || Number(nota.impostos?.aliquotaIss) === 0 ? "Servi\xE7os sem a incid\xEAncia de ISSQN e ICMS" : "Opera\xE7\xE3o tribut\xE1vel no munic\xEDpio";
      doc.fontSize(6.5).font("Helvetica-Bold").fillColor("#000000").text(subIncid, leftMargin + 6, y + 20);
      doc.fontSize(6.5).font("Helvetica-Bold").fillColor("#000000").text("Descri\xE7\xE3o do Servi\xE7o", leftMargin + 6, y + 28);
      doc.fontSize(7).font("Helvetica").fillColor("#000000").text(String(nota.servico?.descricao || "Presta\xE7\xE3o de servi\xE7os"), leftMargin + 6, y + 36, {
        width: contentWidth - 12,
        lineGap: 1.2
      });
      y += boxServH;
      const boxMunH = 13;
      doc.rect(leftMargin, y, contentWidth, boxMunH).stroke();
      const txtTribMun = nota.servico?.operacaoNaoSujeitaIss || nota.servico?.codigoTributacaoNacional === "99.01.01" || Number(nota.impostos?.aliquotaIss) === 0 ? "TRIBUTA\xC7\xC3O MUNICIPAL (ISSQN) - OPERA\xC7\xC3O N\xC3O SUJEITA AO ISSQN" : `TRIBUTA\xC7\xC3O MUNICIPAL (ISSQN) - OPERA\xC7\xC3O TRIBUT\xC1VEL (AL\xCDQUOTA: ${Number(nota.impostos?.aliquotaIss || 2).toFixed(2)}%)`;
      doc.fontSize(6.5).font("Helvetica-Bold").fillColor("#000000").text(txtTribMun, leftMargin + 6, y + 3.5);
      y += boxMunH;
      const boxFedH = 34;
      doc.rect(leftMargin, y, contentWidth, boxFedH).stroke();
      doc.fontSize(6.5).font("Helvetica-Bold").fillColor("#000000").text("TRIBUTA\xC7\xC3O FEDERAL (EXCETO CBS)", leftMargin + 6, y + 4);
      doc.fontSize(6.5).font("Helvetica-Bold").text("IRRF", leftMargin + 190, y + 4);
      doc.fontSize(6.5).font("Helvetica-Bold").text("Contribui\xE7\xE3o Previdenci\xE1ria - Retida", leftMargin + 310, y + 4);
      doc.fontSize(6.5).font("Helvetica-Bold").text("Contribui\xE7\xF5es Sociais - Retidas", leftMargin + 440, y + 4);
      doc.fontSize(7).font("Helvetica").text(nota.impostos?.valorIr ? fmtBRL(nota.impostos.valorIr) : "-", leftMargin + 190, y + 11);
      doc.fontSize(7).font("Helvetica").text(nota.impostos?.valorInss ? fmtBRL(nota.impostos.valorInss) : "-", leftMargin + 310, y + 11);
      doc.fontSize(7).font("Helvetica").text(nota.impostos?.totalRetencoes ? fmtBRL(nota.impostos.totalRetencoes) : "-", leftMargin + 440, y + 11);
      doc.fontSize(6.5).font("Helvetica-Bold").text("PIS - D\xE9bito Apura\xE7\xE3o Pr\xF3pria", leftMargin + 6, y + 19);
      doc.fontSize(6.5).font("Helvetica-Bold").text("COFINS - D\xE9bito Apura\xE7\xE3o Pr\xF3pria", leftMargin + 190, y + 19);
      doc.fontSize(6.5).font("Helvetica-Bold").text("Descri\xE7\xE3o Contrib. Sociais - Retidas", leftMargin + 340, y + 19);
      doc.fontSize(7).font("Helvetica").text(nota.impostos?.valorPis ? fmtBRL(nota.impostos.valorPis) : "-", leftMargin + 6, y + 26);
      doc.fontSize(7).font("Helvetica").text(nota.impostos?.valorCofins ? fmtBRL(nota.impostos.valorCofins) : "-", leftMargin + 190, y + 26);
      doc.fontSize(7).font("Helvetica").text("0 - PIS/COFINS/CSLL N\xE3o Retidos", leftMargin + 340, y + 26);
      y += boxFedH;
      const boxIbsH = 82;
      doc.rect(leftMargin, y, contentWidth, boxIbsH).stroke();
      doc.fontSize(6.5).font("Helvetica-Bold").fillColor("#000000").text("TRIBUTA\xC7\xC3O IBS/CBS", leftMargin + 6, y + 3);
      doc.fontSize(6.5).font("Helvetica-Bold").text("CST / cClassTrib", leftMargin + 190, y + 3);
      doc.fontSize(6.5).font("Helvetica-Bold").text("Indicador de Opera\xE7\xE3o / C\xF3digo IBGE Incid\xEAncia / Munic\xEDpio Incid\xEAncia / Sigla UF", leftMargin + 310, y + 3);
      doc.fontSize(7).font("Helvetica").text("- / -", leftMargin + 190, y + 10);
      doc.fontSize(7).font("Helvetica").text("- / - / - / -", leftMargin + 310, y + 10);
      doc.fontSize(6.5).font("Helvetica-Bold").text("Exclus\xF5es e Redu\xE7\xF5es da Base de C\xE1lculo", leftMargin + 6, y + 18);
      doc.fontSize(6.5).font("Helvetica-Bold").text("Base de C\xE1lculo Ap\xF3s Exclus\xF5es e Redu\xE7\xF5es", leftMargin + 190, y + 18);
      doc.fontSize(6.5).font("Helvetica-Bold").text("Red. Al\xEDquota IBS / Red. Al\xEDquota CBS", leftMargin + 340, y + 18);
      doc.fontSize(6.5).font("Helvetica-Bold").text("Al\xEDquota - IBS UF / IBS Mun", leftMargin + 465, y + 18);
      doc.fontSize(7).font("Helvetica").text("R$ 0,00", leftMargin + 6, y + 25);
      doc.fontSize(7).font("Helvetica").text("-", leftMargin + 190, y + 25);
      doc.fontSize(7).font("Helvetica").text("- / - / -", leftMargin + 340, y + 25);
      doc.fontSize(7).font("Helvetica").text("- / -", leftMargin + 465, y + 25);
      doc.fontSize(6.5).font("Helvetica-Bold").text("Al\xEDq. Efetiva Municipal - IBS", leftMargin + 6, y + 33);
      doc.fontSize(6.5).font("Helvetica-Bold").text("Valor Apurado Municipal - IBS", leftMargin + 190, y + 33);
      doc.fontSize(6.5).font("Helvetica-Bold").text("Al\xEDq. Efetiva Estadual - IBS", leftMargin + 340, y + 33);
      doc.fontSize(6.5).font("Helvetica-Bold").text("Valor Apurado Estadual - IBS", leftMargin + 465, y + 33);
      doc.fontSize(7).font("Helvetica").text("-", leftMargin + 6, y + 40);
      doc.fontSize(7).font("Helvetica").text("-", leftMargin + 190, y + 40);
      doc.fontSize(7).font("Helvetica").text("-", leftMargin + 340, y + 40);
      doc.fontSize(7).font("Helvetica").text("-", leftMargin + 465, y + 40);
      doc.fontSize(6.5).font("Helvetica-Bold").text("Valor Total Apurado - IBS", leftMargin + 6, y + 48);
      doc.fontSize(6.5).font("Helvetica-Bold").text("Al\xEDquota - CBS", leftMargin + 190, y + 48);
      doc.fontSize(6.5).font("Helvetica-Bold").text("Al\xEDquota Efetiva - CBS", leftMargin + 340, y + 48);
      doc.fontSize(6.5).font("Helvetica-Bold").text("Valor Total Apurado - CBS", leftMargin + 465, y + 48);
      doc.fontSize(7).font("Helvetica").text("-", leftMargin + 6, y + 55);
      doc.fontSize(7).font("Helvetica").text("-", leftMargin + 190, y + 55);
      doc.fontSize(7).font("Helvetica").text("-", leftMargin + 340, y + 55);
      doc.fontSize(7).font("Helvetica").text("-", leftMargin + 465, y + 55);
      y += boxIbsH;
      const boxValH = 46;
      doc.rect(leftMargin, y, contentWidth, boxValH).stroke();
      const valorTotalNota = Number(nota.impostos?.valorServicos) || Number(nota.servico?.valor) || 0;
      const valorLiqNota = Number(nota.impostos?.valorLiquido) || valorTotalNota;
      doc.fontSize(6.5).font("Helvetica-Bold").fillColor("#000000").text("VALOR TOTAL DA NFS-e", leftMargin + 6, y + 4);
      doc.fontSize(6.5).font("Helvetica-Bold").text("VALOR DA OPERA\xC7\xC3O / SERVI\xC7O", leftMargin + 190, y + 4);
      doc.fontSize(6.5).font("Helvetica-Bold").text("Desconto Incondicionado", leftMargin + 340, y + 4);
      doc.fontSize(6.5).font("Helvetica-Bold").text("Desconto Condicionado", leftMargin + 465, y + 4);
      doc.fontSize(8.5).font("Helvetica-Bold").text(fmtBRL(valorTotalNota), leftMargin + 190, y + 12);
      doc.fontSize(7.5).font("Helvetica").text("-", leftMargin + 340, y + 12);
      doc.fontSize(7.5).font("Helvetica").text("-", leftMargin + 465, y + 12);
      doc.fontSize(6.5).font("Helvetica-Bold").text("Total das Reten\xE7\xF5es (ISSQN / Federais)", leftMargin + 6, y + 24);
      doc.fontSize(6.5).font("Helvetica-Bold").text("VALOR L\xCDQUIDO DA NFS-e", leftMargin + 190, y + 24);
      doc.fontSize(6.5).font("Helvetica-Bold").text("Total do IBS/CBS", leftMargin + 340, y + 24);
      doc.fontSize(6.5).font("Helvetica-Bold").text("VALOR L\xCDQUIDO DA NFS-e + IBS/CBS", leftMargin + 440, y + 24);
      doc.fontSize(7.5).font("Helvetica").text(nota.impostos?.totalRetencoes ? fmtBRL(nota.impostos.totalRetencoes) : "-", leftMargin + 6, y + 33);
      doc.fontSize(8.5).font("Helvetica-Bold").text(fmtBRL(valorLiqNota), leftMargin + 190, y + 33);
      doc.fontSize(7.5).font("Helvetica").text("R$ 0,00", leftMargin + 340, y + 33);
      doc.fontSize(8.5).font("Helvetica-Bold").text(fmtBRL(valorLiqNota), leftMargin + 440, y + 33);
      y += boxValH;
      const boxInfH = 34;
      doc.rect(leftMargin, y, contentWidth, boxInfH).stroke();
      doc.fontSize(6.5).font("Helvetica-Bold").fillColor("#000000").text("INFORMA\xC7\xD5ES COMPLEMENTARES", leftMargin + 6, y + 3.5);
      const textoTribs = "Totais aproximados dos Tributos cfe. Lei n\xBA 12.741/2012: Federais: -; Estaduais: -; Municipais: -;";
      doc.fontSize(6.5).font("Helvetica").fillColor("#000000").text(textoTribs, leftMargin + 6, y + 12);
      if (nota.informacoesComplementares) {
        doc.fontSize(6.5).font("Helvetica").fillColor("#000000").text(String(nota.informacoesComplementares), leftMargin + 6, y + 21, { width: contentWidth - 12 });
      }
      y += boxInfH + 4;
      const canhotoH = 32;
      doc.rect(leftMargin, y, contentWidth, canhotoH).stroke();
      doc.moveTo(leftMargin + 140, y).lineTo(leftMargin + 140, y + canhotoH).stroke();
      doc.moveTo(leftMargin + 320, y).lineTo(leftMargin + 320, y + canhotoH).stroke();
      doc.fontSize(6).font("Helvetica-Bold").fillColor("#000000").text("DATA CIENTIFICA\xC7\xC3O:", leftMargin + 4, y + 4);
      doc.fontSize(6).font("Helvetica-Bold").fillColor("#000000").text("IDENTIFICA\xC7\xC3O E ASSINATURA", leftMargin + 144, y + 4);
      doc.fontSize(6).font("Helvetica-Bold").fillColor("#000000").text("N\xB0 NFS-e / CHAVE NFS-e", leftMargin + 324, y + 4);
      doc.fontSize(7.5).font("Courier-Bold").fillColor("#000000").text(`${nota.numero || "60"} / ${chaveLimpa}`, leftMargin + 324, y + 14, { width: rightMargin - leftMargin - 328 });
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

// src/serverApp.ts
function createBackendApp() {
  const app2 = express();
  app2.use(express.json({ limit: "15mb" }));
  app2.use((_req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, apikey, x-api-key, X-Requested-With, Accept"
    );
    if (_req.method === "OPTIONS") {
      return res.status(200).end();
    }
    next();
  });
  app2.use((req, _res, next) => {
    if (req.query) {
      const catchAll = req.query.path || req.query.__path;
      if (catchAll) {
        const sub = Array.isArray(catchAll) ? catchAll.join("/") : String(catchAll);
        delete req.query.path;
        delete req.query.__path;
        const queryIdx = (req.url || "").indexOf("?");
        const qs = queryIdx >= 0 ? req.url.slice(queryIdx) : "";
        req.url = "/api/" + sub.replace(/^\//, "") + qs;
      }
    }
    if (req.url && req.url.includes("[...path]")) {
      req.url = req.url.replace(/\/api\/\[\.\.\.path\]/g, "/api").replace(/\/\[\.\.\.path\]/g, "/api");
    }
    if (req.url.startsWith("/@") || req.url.startsWith("/src") || req.url.startsWith("/node_modules") || req.url.includes(".") || req.url === "/") {
      return next();
    }
    if (process.env.VERCEL && !req.url.startsWith("/api")) {
      req.url = "/api" + req.url;
    }
    next();
  });
  const router = express.Router();
  router.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      platform: process.env.VERCEL ? "vercel_serverless" : "node_server",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  router.get("/vercel/status", async (_req, res) => {
    const supabaseUrl = (process.env.VITE_SUPABASE_URL || "https://gcpvceeaeyeufofntmwc.supabase.co").replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_INQR2qlr9so3jznxFhIzMA_ccbtG9b3";
    try {
      const checkRes = await fetch(`${supabaseUrl}/rest/v1/autonfse_metadata?user_id=eq.autonfse_system_metadata&select=user_id,updated_at,data`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` }
      });
      const data = checkRes.ok ? await checkRes.json() : null;
      const metadata = data && data[0]?.data ? data[0].data : null;
      return res.json({
        success: true,
        platform: process.env.VERCEL ? "vercel_serverless" : "node_server",
        vercel: Boolean(process.env.VERCEL),
        supabase: {
          connected: checkRes.ok,
          statusHttp: checkRes.status,
          url: supabaseUrl,
          table: "autonfse_metadata",
          rowKey: "autonfse_system_metadata",
          lastUpdated: data && data[0]?.updated_at,
          totalNotas: metadata?.notas?.length || 0,
          notas: (metadata?.notas || []).map((n) => ({
            numero: n.numero,
            status: n.status,
            tomador: n.tomador?.razaoSocial || n.tomador?.nomeContato,
            valor: n.impostos?.valorServicos
          })),
          totalClientes: metadata?.clientes?.length || 0,
          clientes: (metadata?.clientes || []).map((c) => c.razaoSocial || c.nomeContato),
          totalAgendamentos: metadata?.agendamentos?.length || 0,
          agendamentos: (metadata?.agendamentos || []).map((a) => a.titulo),
          prestador: metadata?.prestador?.razaoSocial || "PRISCILA I PASSOS LTDA"
        },
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: err.message,
        platform: process.env.VERCEL ? "vercel_serverless" : "node_server"
      });
    }
  });
  router.get("/supabase/status", async (_req, res) => {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://gcpvceeaeyeufofntmwc.supabase.co";
      const cleanUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
      const anonKey = process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_INQR2qlr9so3jznxFhIzMA_ccbtG9b3";
      const checkRes = await fetch(`${cleanUrl}/rest/v1/autonfse_metadata?limit=1`, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`
        }
      });
      return res.json({
        success: checkRes.ok,
        statusHttp: checkRes.status,
        url: cleanUrl,
        tabela: "autonfse_metadata",
        mensagem: checkRes.ok ? "Conex\xE3o com Supabase validada com sucesso via backend!" : `Supabase retornou status ${checkRes.status}`
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: `Falha ao testar Supabase: ${err.message}`
      });
    }
  });
  router.get("/metadata", async (_req, res) => {
    const supabaseUrl = (process.env.VITE_SUPABASE_URL || "https://gcpvceeaeyeufofntmwc.supabase.co").replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_INQR2qlr9so3jznxFhIzMA_ccbtG9b3";
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/autonfse_metadata?user_id=eq.autonfse_system_metadata&select=user_id,data,updated_at`, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          Accept: "application/json"
        }
      });
      if (!response.ok) {
        return res.status(response.status).json({ success: false, error: `Supabase status ${response.status}` });
      }
      const rows = await response.json();
      if (Array.isArray(rows) && rows.length > 0 && rows[0]?.data) {
        return res.json({
          success: true,
          data: rows[0].data,
          updated_at: rows[0].updated_at
        });
      }
      return res.json({ success: false, data: null, message: "Nenhum registro encontrado" });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });
  router.post("/metadata", async (req, res) => {
    const supabaseUrl = (process.env.VITE_SUPABASE_URL || "https://gcpvceeaeyeufofntmwc.supabase.co").replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_INQR2qlr9so3jznxFhIzMA_ccbtG9b3";
    try {
      const { data } = req.body;
      if (!data || typeof data !== "object") {
        return res.status(400).json({ success: false, error: "Corpo da requisi\xE7\xE3o inv\xE1lido" });
      }
      const payload = {
        user_id: "autonfse_system_metadata",
        data: {
          ...data,
          lastUpdated: (/* @__PURE__ */ new Date()).toISOString(),
          appVersion: "2.0.0"
        },
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      const response = await fetch(`${supabaseUrl}/rest/v1/autonfse_metadata`, {
        method: "POST",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates"
        },
        body: JSON.stringify(payload)
      });
      if (response.ok || response.status === 201 || response.status === 204) {
        return res.json({ success: true, message: "Metadados persistidos com sucesso!" });
      }
      const errBody = await response.text();
      return res.status(response.status).json({ success: false, error: errBody });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });
  router.post("/danfse/pdf", async (req, res) => {
    try {
      const { nota } = req.body;
      if (!nota) {
        return res.status(400).json({
          success: false,
          error: "Dados da NFS-e n\xE3o informados para gera\xE7\xE3o do PDF."
        });
      }
      console.log(`[PDF] Gerando DANFSE PDF da NFS-e N\xBA ${nota.numero}...`);
      const pdfBuffer = await generateDanfsePdfBuffer(nota);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="DANFSE_${nota.numero || "Nacional"}.pdf"`
      );
      return res.send(pdfBuffer);
    } catch (err) {
      console.error("[PDF] Erro ao gerar DANFSE em PDF:", err);
      return res.status(500).json({
        success: false,
        error: `Erro ao gerar DANFSE em PDF: ${err.message || "Falha interna"}`
      });
    }
  });
  router.post("/send-email", async (req, res) => {
    try {
      const {
        servidorSmtp,
        porta,
        usuario,
        senhaApp,
        remetenteNome,
        remetenteEmail,
        destinatario,
        enviarCopiaOculta,
        copiaOculta,
        bcc,
        assunto,
        corpo,
        anexos,
        nota
      } = req.body;
      let cleanedDestinatarios = [];
      if (Array.isArray(destinatario)) {
        destinatario.forEach((d) => {
          if (typeof d === "string") {
            d.split(/[;,]+/).forEach((item) => {
              const clean = item.trim().toLowerCase();
              if (clean && clean.includes("@") && !cleanedDestinatarios.includes(clean)) {
                cleanedDestinatarios.push(clean);
              }
            });
          }
        });
      } else if (typeof destinatario === "string") {
        destinatario.split(/[;,]+/).forEach((item) => {
          const clean = item.trim().toLowerCase();
          if (clean && clean.includes("@") && !cleanedDestinatarios.includes(clean)) {
            cleanedDestinatarios.push(clean);
          }
        });
      }
      if (cleanedDestinatarios.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Nenhum e-mail de destino v\xE1lido informado. Voc\xEA pode informar um ou mais e-mails separados por v\xEDrgula."
        });
      }
      let cleanedBcc = [];
      const rawBcc = enviarCopiaOculta || copiaOculta || bcc;
      if (rawBcc) {
        if (Array.isArray(rawBcc)) {
          rawBcc.forEach((b) => {
            if (typeof b === "string") {
              b.split(/[;,]+/).forEach((item) => {
                const clean = item.trim().toLowerCase();
                if (clean && clean.includes("@") && !cleanedBcc.includes(clean)) {
                  cleanedBcc.push(clean);
                }
              });
            }
          });
        } else if (typeof rawBcc === "string") {
          rawBcc.split(/[;,]+/).forEach((item) => {
            const clean = item.trim().toLowerCase();
            if (clean && clean.includes("@") && !cleanedBcc.includes(clean)) {
              cleanedBcc.push(clean);
            }
          });
        }
      }
      if (!usuario || !senhaApp || !String(senhaApp).trim()) {
        return res.status(400).json({
          success: false,
          error: "Senha de Aplicativo do Gmail n\xE3o configurada. Abra as Configura\xE7\xF5es (\xEDcone de engrenagem) > Disparo por E-mail e informe a Senha de App de 16 letras gerada na sua Conta Google (myaccount.google.com/apppasswords)."
        });
      }
      const cleanPassword = String(senhaApp).replace(/[\s\-]/g, "").trim().toLowerCase();
      const cleanUser = String(usuario).trim().replace(/@gmail\.co$/i, "@gmail.com");
      const cleanRemetente = String(remetenteEmail || cleanUser).trim().replace(/@gmail\.co$/i, "@gmail.com");
      const host = servidorSmtp ? String(servidorSmtp).trim() : "smtp.gmail.com";
      const isGmail = host.includes("gmail") || cleanUser.includes("@gmail");
      let portNum = Number(porta) || (isGmail ? 465 : 587);
      let secure = portNum === 465;
      if (portNum === 587) {
        secure = false;
      }
      const transporter = nodemailer.createTransport({
        host,
        port: portNum,
        secure,
        auth: {
          user: cleanUser,
          pass: cleanPassword
        },
        tls: {
          rejectUnauthorized: false
        }
      });
      await transporter.verify();
      const attachmentsList = [];
      if (nota) {
        try {
          console.log(`[Email] Gerando e anexando DANFSE (PDF) para NFS-e N\xBA ${nota.numero}...`);
          const pdfBuffer = await generateDanfsePdfBuffer(nota);
          attachmentsList.push({
            filename: `DANFSE_${nota.numero || "Nacional"}.pdf`,
            content: pdfBuffer,
            contentType: "application/pdf"
          });
          console.log(`[Email] DANFSE PDF anexado com sucesso (${pdfBuffer.length} bytes).`);
        } catch (ePdf) {
          console.error("[Email] Aviso: Erro ao gerar DANFSE PDF para anexar:", ePdf);
        }
        if (nota.xmlConteudo) {
          attachmentsList.push({
            filename: `NFSe_${nota.numero || "Nacional"}.xml`,
            content: nota.xmlConteudo,
            contentType: "application/xml"
          });
        }
      }
      if (anexos && Array.isArray(anexos)) {
        for (const a of anexos) {
          const jaExiste = attachmentsList.some((item) => item.filename === a.filename);
          if (!jaExiste) {
            attachmentsList.push({
              filename: a.filename,
              content: a.content,
              encoding: a.encoding || "utf-8",
              contentType: a.contentType
            });
          }
        }
      }
      const mailOptions = {
        from: `"${remetenteNome || "PRISCILA I PASSOS LTDA"}" <${cleanRemetente}>`,
        to: cleanedDestinatarios,
        bcc: cleanedBcc.length > 0 ? cleanedBcc : void 0,
        subject: assunto || "Nota Fiscal de Servi\xE7os Eletr\xF4nica NFS-e Nacional (DANFSE + XML)",
        text: corpo || "Segue em anexo o DANFSE (PDF) e o XML oficial da NFS-e Nacional.",
        html: corpo ? `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; color: #1e293b; line-height: 1.65; max-width: 680px; margin: 0 auto; padding: 15px 0;">
              <div style="font-size: 14px; color: #1e293b; margin-bottom: 20px;">${corpo.replace(/\n/g, "<br>")}</div>
              <div style="margin-top: 20px; padding: 12px 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #0284c7; border-radius: 6px; font-size: 12px; color: #334155;">
                \u{1F4CE} <strong>Documentos Fiscais em Anexo neste E-mail:</strong><br/>
                &bull; <strong>DANFSE (PDF):</strong> Documento Auxiliar Oficial da NFS-e para impress\xE3o ou escritura\xE7\xE3o cont\xE1bil.<br/>
                &bull; <strong>NFSe (XML):</strong> Arquivo XML com padr\xE3o nacional da Receita Federal assinado digitalmente.
              </div>
            </div>` : void 0,
        attachments: attachmentsList
      };
      const info = await transporter.sendMail(mailOptions);
      console.log(`[Email] E-mail entregue com sucesso para [${cleanedDestinatarios.join(", ")}] com ${attachmentsList.length} anexos. ID: ${info.messageId}`);
      return res.json({
        success: true,
        messageId: info.messageId,
        response: info.response,
        destinatarios: cleanedDestinatarios,
        copiaOculta: cleanedBcc,
        anexosEnviados: attachmentsList.map((a) => a.filename)
      });
    } catch (err) {
      console.error("Erro ao enviar e-mail via SMTP:", err);
      let errorMsg = err.message || "Erro de conex\xE3o com o servidor SMTP.";
      if (errorMsg.includes("535") || errorMsg.includes("BadCredentials") || errorMsg.includes("Username and Password not accepted")) {
        errorMsg = 'Erro 535 no Gmail: Usu\xE1rio ou Senha de Aplicativo recusada. No Gmail com verifica\xE7\xE3o em 2 etapas, gere uma "Senha de App" de 16 letras em myaccount.google.com/apppasswords e cole no campo "Senha de App" das Configura\xE7\xF5es.';
      } else if (errorMsg.includes("ECONNREFUSED")) {
        errorMsg = "Servidor SMTP recusou a conex\xE3o. Verifique o endere\xE7o do host e a porta.";
      } else if (errorMsg.includes("ETIMEDOUT")) {
        errorMsg = "Tempo limite esgotado ao tentar alcan\xE7ar o servidor SMTP.";
      }
      return res.status(500).json({
        success: false,
        error: errorMsg
      });
    }
  });
  router.post("/test-email", async (req, res) => {
    try {
      const { servidorSmtp, porta, usuario, senhaApp, remetenteEmail } = req.body;
      if (!usuario || !senhaApp || !String(senhaApp).trim()) {
        return res.status(400).json({
          success: false,
          error: "E-mail de usu\xE1rio ou Senha de Aplicativo n\xE3o informada."
        });
      }
      const cleanUser = String(usuario).trim().replace(/@gmail\.co$/i, "@gmail.com");
      const cleanPassword = String(senhaApp).replace(/[\s\-]/g, "").trim().toLowerCase();
      const cleanRemetente = String(remetenteEmail || cleanUser).trim().replace(/@gmail\.co$/i, "@gmail.com");
      const host = servidorSmtp ? String(servidorSmtp).trim() : "smtp.gmail.com";
      const isGmail = host.includes("gmail") || cleanUser.includes("@gmail");
      let portNum = Number(porta) || (isGmail ? 465 : 587);
      let secure = portNum === 465;
      const transporter = nodemailer.createTransport({
        host,
        port: portNum,
        secure,
        auth: {
          user: cleanUser,
          pass: cleanPassword
        },
        tls: {
          rejectUnauthorized: false
        }
      });
      await transporter.verify();
      await transporter.sendMail({
        from: `"AutoNFS-e Nacional" <${cleanRemetente}>`,
        to: cleanUser,
        subject: "\u2705 AutoNFS-e: Conex\xE3o Gmail SMTP Conectada com Sucesso!",
        text: `Ol\xE1!

Este \xE9 um e-mail de teste confirmando que a sua integra\xE7\xE3o de e-mail (${cleanUser}) est\xE1 100% configurada e conectada ao Gmail.

Suas pr\xF3ximas notas fiscais autorizadas ser\xE3o enviadas automaticamente para os clientes com DANFSE (PDF) e XML anexados.

Atenciosamente,
AutoNFS-e Nacional`
      });
      return res.status(200).json({
        success: true,
        message: `Conex\xE3o SMTP validada com sucesso! Um e-mail de teste foi enviado para ${cleanUser}.`
      });
    } catch (err) {
      console.error("[Email Test] Erro:", err);
      let errorMsg = err.message || "Falha de conex\xE3o SMTP";
      if (errorMsg.includes("535") || errorMsg.includes("BadCredentials") || errorMsg.includes("Username and Password not accepted")) {
        errorMsg = 'Erro 535 no Gmail: Usu\xE1rio ou Senha de Aplicativo recusada. Certifique-se de usar o e-mail completo com @gmail.com e de gerar a "Senha de App" de 16 letras em myaccount.google.com/apppasswords.';
      }
      return res.status(400).json({
        success: false,
        error: errorMsg
      });
    }
  });
  router.post("/notaas/test-connection", async (req, res) => {
    try {
      const apiKey = req.body?.apiKey;
      const cleanToken = String(apiKey || process.env.VITE_NOTAAS_API_KEY || process.env.NOTAAS_API_KEY || "ntaas_zo987DbmrHkCL6iMGLVvR3lvQP6Sr9ix").trim();
      if (!cleanToken) {
        return res.status(400).json({
          success: false,
          statusHttp: 400,
          message: "Chave de API / Token da Notaas n\xE3o foi informada.",
          error: "Chave de API / Token da Notaas n\xE3o foi informada."
        });
      }
      const testRes = await fetch("https://platform.notaas.com.br/api/v1/emitir", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "x-api-key": cleanToken
        },
        body: JSON.stringify({
          tipo: "nfse",
          ambiente: "sandbox",
          referencia: `test-${Date.now()}`,
          probe: true
        })
      });
      const responseText = await testRes.text();
      let responseJson = null;
      try {
        responseJson = JSON.parse(responseText);
      } catch {
      }
      if (testRes.status === 401 || responseJson?.error?.includes("API key inv\xE1lida") || responseJson?.error?.includes("API key obrigat\xF3ria")) {
        return res.status(401).json({
          success: false,
          statusHttp: 401,
          message: responseJson?.error || "Chave de API n\xE3o autorizada (401) no Notaas. Verifique se o token foi copiado completo do painel platform.notaas.com.br (prefixo ntaas_*).",
          error: responseJson?.error || "Chave de API n\xE3o autorizada (401) no Notaas.",
          detalhes: "Verifique se a chave foi copiada completa do painel platform.notaas.com.br (prefixo ntaas_*).",
          diagnostico: `POST /api/v1/emitir: HTTP ${testRes.status}`
        });
      }
      if (testRes.status === 403) {
        return res.status(403).json({
          success: false,
          statusHttp: 403,
          message: "Acesso negado (403) pelos servidores da Notaas. Verifique as permiss\xF5es da sua conta.",
          error: "Acesso negado (403) pelos servidores da Notaas.",
          diagnostico: `POST /api/v1/emitir: HTTP 403`
        });
      }
      if (!testRes.ok && testRes.status >= 500) {
        return res.status(502).json({
          success: false,
          statusHttp: testRes.status,
          message: `Servidores da Notaas retornaram instabilidade tempor\xE1ria (HTTP ${testRes.status}). Tente novamente em instantes.`,
          error: `Erro no servidor Notaas: HTTP ${testRes.status}`,
          diagnostico: `platform.notaas.com.br: HTTP ${testRes.status}`
        });
      }
      return res.json({
        success: true,
        origem: "NOTAAS_PLATFORM",
        statusHttp: testRes.status,
        message: "Chave de API Notaas (ntaas_) autenticada com sucesso no endpoint oficial!",
        mensagem: "Chave de API Notaas (ntaas_) autenticada com sucesso no endpoint oficial!",
        diagnostico: `platform.notaas.com.br: HTTP ${testRes.status} (Autenticado)`
      });
    } catch (err) {
      console.error("Erro ao testar API Notaas no servidor:", err);
      return res.status(500).json({
        success: false,
        statusHttp: 500,
        message: `Falha de conex\xE3o com os servidores da Notaas: ${err.message || "Falha de comunica\xE7\xE3o"}`,
        error: `Erro ao comunicar com a Notaas: ${err.message || "Falha de rede."}`
      });
    }
  });
  router.get("/notaas/invoice-status/:invoiceId", async (req, res) => {
    try {
      const apiKey = req.headers["x-api-key"] || req.query.apiKey;
      const { invoiceId } = req.params;
      if (!apiKey || !invoiceId) {
        return res.status(400).json({
          success: false,
          error: "Chave de API e ID da NFS-e s\xE3o obrigat\xF3rios."
        });
      }
      const cleanToken = String(apiKey).trim();
      const statusRes = await fetch(`https://platform.notaas.com.br/api/v1/invoices/${invoiceId}/status`, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "x-api-key": cleanToken
        }
      });
      const dataStatus = await statusRes.json();
      return res.json({
        success: statusRes.ok,
        statusHttp: statusRes.status,
        data: dataStatus
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: `Erro ao consultar status no Notaas: ${err.message}`
      });
    }
  });
  router.post("/notaas/emitir", async (req, res) => {
    try {
      const {
        apiKey,
        prestador,
        tomador,
        servico,
        impostos,
        informacoesComplementares,
        idExterno,
        numeroDps,
        serieDps,
        numero,
        serie,
        empresaId
      } = req.body;
      const cleanToken = String(apiKey || prestador?.apiKeyNotas || process.env.VITE_NOTAAS_API_KEY || process.env.NOTAAS_API_KEY || "ntaas_zo987DbmrHkCL6iMGLVvR3lvQP6Sr9ix").trim();
      if (!cleanToken) {
        return res.status(400).json({
          success: false,
          error: "Chave de API / Token da Notaas n\xE3o configurada. Abra as Configura\xE7\xF5es e informe sua chave ntaas_*."
        });
      }
      const tomadorCpfCnpj = String(tomador?.documento || "").replace(/\D/g, "");
      const isCnpj = tomadorCpfCnpj.length === 14;
      const prestadorCnpj = String(prestador?.cnpj || "46874965000104").replace(/\D/g, "");
      const valorTotal = Number(impostos?.valorServicos) || Number(servico?.valor) || 0;
      const aliquota = Number(impostos?.aliquotaIss) || Number(servico?.aliquotaIss) || Number(servico?.aliquota) || 2;
      const descServico = servico?.descricao || "Presta\xE7\xE3o de servi\xE7os";
      const codTribNac = String(servico?.codigoTributacaoNacional || "99.01.01").trim();
      let codTribMun = "001";
      if (servico?.codigoTributacaoMunicipal && /^\d{3}$|^\d{9}$/.test(String(servico.codigoTributacaoMunicipal).trim())) {
        codTribMun = String(servico.codigoTributacaoMunicipal).trim();
      }
      const numDpsCalculado = Number(numeroDps ?? numero ?? req.body?.dps?.numero ?? 18);
      const serieDpsCalculada = String(serieDps ?? serie ?? req.body?.dps?.serie ?? prestador?.serieDps ?? "1608").trim();
      const payloadNotaas = {
        tipo: "nfse",
        ambiente: prestador?.ambienteEmissao === "PRODUCAO" ? "producao" : "sandbox",
        referencia: idExterno || `dps-${Date.now()}`,
        numero: numDpsCalculado,
        serie: serieDpsCalculada,
        numeroDps: numDpsCalculado,
        serieDps: serieDpsCalculada,
        dps: {
          numero: numDpsCalculado,
          serie: serieDpsCalculada
        },
        valor: valorTotal,
        descricao: descServico,
        discriminacao: descServico,
        codigoTributacaoNacional: codTribNac,
        itemLc116: servico?.itemLC116 || servico?.itemListaServico || "1.07",
        aliquotaIss: aliquota,
        issRetido: Boolean(impostos?.issRetido),
        empresaId: empresaId || prestador?.empresaIdNotas || void 0,
        prestador: {
          cnpj: prestadorCnpj,
          razaoSocial: prestador?.razaoSocial || "PRISCILA I PASSOS LTDA",
          inscricaoMunicipal: prestador?.inscricaoMunicipal || void 0
        },
        tomador: {
          tipo: isCnpj ? "PJ" : "PF",
          tipoPessoa: isCnpj ? "PJ" : "PF",
          documento: tomadorCpfCnpj,
          cpfCnpj: tomadorCpfCnpj,
          cpf_cnpj: tomadorCpfCnpj,
          razaoSocial: tomador?.razaoSocial || tomador?.nome || "Tomador",
          nome: tomador?.razaoSocial || tomador?.nome || "Tomador",
          email: tomador?.email || "",
          telefone: tomador?.telefone ? String(tomador.telefone).replace(/\D/g, "") : void 0,
          endereco: {
            logradouro: tomador?.endereco?.logradouro || "",
            numero: tomador?.endereco?.numero || "S/N",
            complemento: tomador?.endereco?.complemento || "",
            bairro: tomador?.endereco?.bairro || "",
            cidade: tomador?.endereco?.municipio || "Belo Horizonte",
            municipio: tomador?.endereco?.municipio || "Belo Horizonte",
            uf: tomador?.endereco?.uf || "MG",
            cep: String(tomador?.endereco?.cep || "").replace(/\D/g, ""),
            codigoMunicipio: tomador?.endereco?.codigoMunicipio || "3106200",
            codigoIbge: tomador?.endereco?.codigoMunicipio || "3106200"
          }
        },
        servico: {
          discriminacao: descServico,
          descricao: descServico,
          valor: valorTotal,
          valorServicos: valorTotal,
          valorTotal,
          aliquota,
          aliquotaIss: aliquota,
          issRetido: Boolean(impostos?.issRetido),
          codigoTributacaoMunicipal: codTribMun,
          codigoTributacaoNacional: codTribNac,
          itemListaServico: servico?.itemLC116 || servico?.itemListaServico || "1.07",
          itemLc116: servico?.itemLC116 || servico?.itemListaServico || "1.07",
          cnae: servico?.cnae || void 0
        },
        valores: {
          total: valorTotal,
          servicos: valorTotal,
          aliquotaIss: aliquota,
          iss: Number(impostos?.valorIss) || valorTotal * (aliquota / 100),
          valorLiquido: Number(impostos?.valorLiquido) || valorTotal
        },
        observacoes: informacoesComplementares || "Documento emitido via Notaas."
      };
      console.log("=== DADOS REAIS ENVIADOS AO NOTAAS ===");
      console.log("numeroDps:", payloadNotaas.numeroDps);
      console.log("serieDps:", payloadNotaas.serieDps);
      console.log("Payload Completo:", JSON.stringify(payloadNotaas, null, 2));
      const resNotaas = await fetch("https://platform.notaas.com.br/api/v1/emitir", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "x-api-key": cleanToken
        },
        body: JSON.stringify(payloadNotaas)
      });
      const responseBody = await resNotaas.text();
      let dataPlat = {};
      try {
        dataPlat = JSON.parse(responseBody);
      } catch {
      }
      if (resNotaas.ok || resNotaas.status === 200 || resNotaas.status === 201 || resNotaas.status === 202) {
        const invoiceId = dataPlat?.invoiceId || dataPlat?.id || dataPlat?.notaFiscalId || `notaas-${Date.now()}`;
        let statusFinal = dataPlat?.status || "queued";
        let dadosStatus = dataPlat;
        let erroSefazMsg = dataPlat?.errorMessage || "";
        let erroSefazCode = dataPlat?.errorCode || "";
        if (dataPlat?.queued || statusFinal === "queued" || statusFinal === "processing") {
          console.log(`[Notaas] Nota enfileirada no Notaas (ID: ${invoiceId}). Aguardando retorno da prefeitura/SEFAZ...`);
          const maxTentativas = 8;
          for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
            await new Promise((resolve) => setTimeout(resolve, 2e3));
            try {
              const checkRes = await fetch(`https://platform.notaas.com.br/api/v1/invoices/${invoiceId}/status`, {
                method: "GET",
                headers: {
                  "Accept": "application/json",
                  "x-api-key": cleanToken
                }
              });
              if (checkRes.ok) {
                dadosStatus = await checkRes.json();
                statusFinal = dadosStatus?.status || statusFinal;
                console.log(`[Notaas] Polling tentativa ${tentativa}/${maxTentativas}: status = ${statusFinal}`);
                if (dadosStatus?.errorMessage) {
                  erroSefazMsg = dadosStatus.errorMessage;
                  erroSefazCode = dadosStatus.errorCode || "";
                } else if (Array.isArray(dadosStatus?.errors) && dadosStatus.errors.length > 0) {
                  erroSefazMsg = dadosStatus.errors[0]?.Descricao || dadosStatus.errors[0]?.mensagem || "Rejei\xE7\xE3o SEFAZ";
                  erroSefazCode = dadosStatus.errors[0]?.Codigo || dadosStatus.errors[0]?.codigo || "";
                }
                if (statusFinal === "issued" || statusFinal === "authorized" || statusFinal === "emitted" || statusFinal === "error" || erroSefazMsg || dadosStatus?.chNFSe || dadosStatus?.pdfUrl) {
                  break;
                }
              }
            } catch (ePoll) {
              console.warn(`[Notaas] Falha no polling tentativa ${tentativa}:`, ePoll);
            }
          }
        }
        const chave = dadosStatus?.chNFSe || dadosStatus?.chave || dadosStatus?.chaveAcesso || dataPlat?.chNFSe || dataPlat?.chave;
        const pdf = dadosStatus?.pdfUrl || dadosStatus?.pdf || dadosStatus?.linkPdf || dataPlat?.pdfUrl || dataPlat?.pdf;
        const xml = dadosStatus?.xmlUrl || dadosStatus?.xml || dadosStatus?.linkXml || dataPlat?.xmlUrl || dataPlat?.xml;
        const codVerif = dadosStatus?.codigoVerificacao || dadosStatus?.verificacao || dataPlat?.codigoVerificacao;
        let numeroFinal = dadosStatus?.numero || dataPlat?.numero;
        if (!numeroFinal && dadosStatus?.numeroNfe) {
          const match = String(dadosStatus.numeroNfe).match(/0+(\d{1,9})\d{10}$/);
          if (match) {
            numeroFinal = match[1];
          } else {
            const cleanNum = String(dadosStatus.numeroNfe).replace(/\D/g, "");
            if (cleanNum.length <= 9 && cleanNum.length > 0) numeroFinal = cleanNum;
          }
        }
        if (!numeroFinal && chave) {
          const matchChave = String(chave).match(/0+(\d{1,9})\d{10}$/);
          if (matchChave) numeroFinal = matchChave[1];
        }
        const autorizada = (statusFinal === "issued" || statusFinal === "authorized" || statusFinal === "emitted" || Boolean(dadosStatus?.chNFSe || dadosStatus?.pdfUrl)) && !erroSefazMsg && statusFinal !== "error";
        const erro = statusFinal === "error" || Boolean(erroSefazMsg);
        const processando = !autorizada && !erro;
        return res.json({
          success: true,
          statusHttp: resNotaas.status,
          provedor: "NOTAAS_PLATFORM",
          nfeId: invoiceId,
          autorizada,
          processando,
          status: autorizada ? "AUTORIZADA" : erro ? "ERRO" : "PROCESSANDO",
          statusNotaas: statusFinal,
          rejeicaoSefaz: erroSefazMsg ? { codigo: erroSefazCode, mensagem: erroSefazMsg } : void 0,
          numero: numeroFinal ? String(numeroFinal) : void 0,
          chaveAcesso: chave,
          codigoVerificacao: codVerif,
          linkDownloadPdf: pdf,
          linkDownloadXml: xml,
          mensagem: erroSefazMsg ? `Nota recebida pelo Notaas (ID: ${invoiceId}), mas rejeitada pela SEFAZ: [${erroSefazCode}] ${erroSefazMsg}` : autorizada ? `NFS-e N\xBA ${numeroFinal || ""} autorizada e confirmada com sucesso pela API Notaas!` : `NFS-e registrada no Notaas (ID: ${invoiceId}) e em processamento na prefeitura/SEFAZ.`,
          dadosRetorno: dadosStatus
        });
      }
      const errorMsg = dataPlat?.error || dataPlat?.mensagem || dataPlat?.message || responseBody || "Erro na emiss\xE3o no Notaas";
      console.error(`[Notaas] Erro da API Notaas (HTTP ${resNotaas.status}):`, errorMsg);
      return res.status(resNotaas.status || 400).json({
        success: false,
        statusHttp: resNotaas.status,
        error: errorMsg,
        detalhes: dataPlat,
        respostaBruta: responseBody
      });
    } catch (err) {
      console.error("[Notaas] Erro geral ao contatar Notaas:", err);
      return res.status(500).json({
        success: false,
        error: `Erro de conex\xE3o com o Notaas: ${err.message || "Falha de comunica\xE7\xE3o"}`
      });
    }
  });
  router.post("/notaas/cancelar", async (req, res) => {
    try {
      const { invoiceId, chaveAcesso, numero, motivo, codigoMotivo, apiKey, prestador } = req.body || {};
      const cleanToken = (apiKey || prestador?.apiKeyNotas || process.env.VITE_NOTAAS_API_KEY || process.env.NOTAAS_API_KEY || "").trim();
      if (!cleanToken) {
        return res.status(400).json({
          success: false,
          error: "Chave de API do Notaas n\xE3o configurada. Informe a API Key nas Configura\xE7\xF5es."
        });
      }
      const motivoTexto = (motivo || "Cancelamento solicitado pelo emitente").trim();
      const codMotivo = Number(codigoMotivo) || 1;
      if (invoiceId && !invoiceId.startsWith("dps-") && !invoiceId.startsWith("nfs-")) {
        try {
          console.log(`[Notaas Cancel] Enviando requisi\xE7\xE3o de cancelamento da nota ID ${invoiceId}...`);
          const resCancel = await fetch(`https://platform.notaas.com.br/api/v1/invoices/${invoiceId}/cancel`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json",
              "x-api-key": cleanToken
            },
            body: JSON.stringify({
              motivo: motivoTexto,
              codigoMotivo: codMotivo,
              justificativa: motivoTexto
            })
          });
          const respText = await resCancel.text();
          let respData = {};
          try {
            respData = JSON.parse(respText);
          } catch {
          }
          if (resCancel.ok || resCancel.status === 200 || resCancel.status === 202) {
            return res.status(200).json({
              success: true,
              canceladaNotaas: true,
              message: `NFS-e N\xBA ${numero || ""} cancelada com sucesso no Notaas e comunicada \xE0 Receita Federal.`,
              detalhes: respData
            });
          } else {
            const errMsg = respData?.error || respData?.message || respText || `HTTP ${resCancel.status}`;
            return res.status(resCancel.status || 400).json({
              success: false,
              canceladaNotaas: false,
              error: `Notaas retornou erro ao cancelar: ${errMsg}`,
              detalhes: respData
            });
          }
        } catch (eReq) {
          console.error("[Notaas Cancel] Falha de comunica\xE7\xE3o:", eReq);
          return res.status(500).json({
            success: false,
            canceladaNotaas: false,
            error: `Falha de rede ao conectar com Notaas: ${eReq.message}`
          });
        }
      }
      return res.status(200).json({
        success: true,
        canceladaNotaas: false,
        message: "Nota cancelada no sistema local. Como a nota n\xE3o possui ID no Notaas, verifique o cancelamento no Portal Nacional da NFS-e (nfse.gov.br)."
      });
    } catch (err) {
      console.error("[Notaas Cancel] Erro geral:", err);
      return res.status(500).json({
        success: false,
        error: `Erro ao processar cancelamento: ${err.message}`
      });
    }
  });
  app2.use("/api", router);
  app2.use("/", router);
  return app2;
}

// src/apiEntry.ts
var app = createBackendApp();
var apiEntry_default = app;
export {
  apiEntry_default as default
};
