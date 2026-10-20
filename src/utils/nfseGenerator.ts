import { NfseDocument, PrestadorConfig, TomadorCliente, ImpostosCalculados } from '../types/nfse';

// Calculates modulo 11 check digit for Brazilian fiscal keys
function calculateModulo11(chave49: string): string {
  let soma = 0;
  let peso = 2;
  for (let i = chave49.length - 1; i >= 0; i--) {
    soma += parseInt(chave49[i], 10) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const dv = 11 - resto;
  if (dv === 0 || dv >= 10) return '1';
  return String(dv);
}

export function generateChaveAcessoNacional(
  ibge: string,
  cnpjPrestador: string,
  numeroNfse: string
): string {
  const cMun = (ibge.replace(/\D/g, '') || '3550308').padStart(7, '0').slice(0, 7);
  const tpAmb = '1'; // 1=Produção
  const cnpj = cnpjPrestador.replace(/\D/g, '').padStart(14, '0').slice(0, 14);
  const modelo = '69'; // 69 = NFS-e Padrão Nacional
  const serie = '900';
  const nNfse = numeroNfse.replace(/\D/g, '').padStart(13, '0').slice(0, 13);
  const tpEmis = '1'; // Normal
  const cNF = Math.floor(10000000 + Math.random() * 90000000).toString(); // 8 dígitos aleatórios

  const chave49 = `${cMun}${tpAmb}${cnpj}${modelo}${serie}${nNfse}${tpEmis}${cNF}`;
  const dv = calculateModulo11(chave49);
  return `${chave49}${dv}`;
}

export function generateCodigoVerificacao(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let res = '';
  for (let i = 0; i < 9; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
    if (i === 2 || i === 5) res += '-';
  }
  return res;
}

export function buildOfficialXmlNacional(nfse: NfseDocument): string {
  const dateFormatted = new Date(nfse.dataEmissao).toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">
  <infNFSe Id="NFS${nfse.chaveAcesso}">
    <xLocEmi>${nfse.prestador.endereco.municipio}</xLocEmi>
    <xLocPrestacao>${nfse.prestador.endereco.municipio}</xLocPrestacao>
    <nNFSe>${nfse.numero}</nNFSe>
    <cVerif>${nfse.codigoVerificacao}</cVerif>
    <dhEmi>${dateFormatted}</dhEmi>
    <dCompet>${nfse.dataCompetencia}</dCompet>
    <tpAmb>${nfse.prestador.ambienteEmissao === 'PRODUCAO' ? '1' : '2'}</tpAmb>
    <tpEmis>1</tpEmis>
    <procEmi>0</procEmi>
    <verProc>AutoNFS-e 2.4.0</verProc>

    <emit>
      <CNPJ>${nfse.prestador.cnpj.replace(/\D/g, '')}</CNPJ>
      <xNome>${escapeXml(nfse.prestador.razaoSocial)}</xNome>
      <xFant>${escapeXml(nfse.prestador.nomeFantasia || nfse.prestador.razaoSocial)}</xFant>
      <IM>${nfse.prestador.inscricaoMunicipal}</IM>
      <enderEmit>
        <xLgr>${escapeXml(nfse.prestador.endereco.logradouro)}</xLgr>
        <nro>${escapeXml(nfse.prestador.endereco.numero)}</nro>
        <xBairro>${escapeXml(nfse.prestador.endereco.bairro)}</xBairro>
        <cMun>${nfse.prestador.endereco.codigoMunicipio}</cMun>
        <xMun>${escapeXml(nfse.prestador.endereco.municipio)}</xMun>
        <UF>${nfse.prestador.endereco.uf}</UF>
        <CEP>${nfse.prestador.endereco.cep.replace(/\D/g, '')}</CEP>
      </enderEmit>
      <regTrib>
        <opSimpNac>${nfse.prestador.regimeTributario === 'MEI' ? '1' : nfse.prestador.regimeTributario === 'SIMPLES_NACIONAL' ? '2' : '3'}</opSimpNac>
        <regEspTrib>0</regEspTrib>
      </regTrib>
    </emit>

    <toma>
      <${nfse.tomador.tipoInscricao}>${nfse.tomador.documento.replace(/\D/g, '')}</${nfse.tomador.tipoInscricao}>
      <xNome>${escapeXml(nfse.tomador.razaoSocial)}</xNome>
      <enderToma>
        <xLgr>${escapeXml(nfse.tomador.endereco.logradouro)}</xLgr>
        <nro>${escapeXml(nfse.tomador.endereco.numero)}</nro>
        <xBairro>${escapeXml(nfse.tomador.endereco.bairro)}</xBairro>
        <xMun>${escapeXml(nfse.tomador.endereco.municipio)}</xMun>
        <UF>${nfse.tomador.endereco.uf}</UF>
        <CEP>${nfse.tomador.endereco.cep.replace(/\D/g, '')}</CEP>
      </enderToma>
      <email>${escapeXml(nfse.tomador.email)}</email>
      <fone>${escapeXml((nfse.tomador.telefone || '').replace(/\D/g, ''))}</fone>
    </toma>

    <serv>
      <locPrest>
        <cLocPrestacao>${nfse.servico.localPrestacaoIbge || nfse.prestador.endereco.codigoMunicipio}</cLocPrestacao>
      </locPrest>
      <cServ>
        <cTribNac>${nfse.servico.codigoTributacaoNacional}</cTribNac>
        <cLocIncid>${nfse.prestador.endereco.codigoMunicipio}</cLocIncid>
        <xDescServ>${escapeXml(nfse.servico.descricao)}</xDescServ>
      </cServ>
    </serv>

    <valores>
      <vServPrest>
        <vServ>${nfse.impostos.valorServicos.toFixed(2)}</vServ>
      </vServPrest>
      <tribMun>
        <tribISSQN>${nfse.servico.operacaoNaoSujeitaIss || nfse.impostos.aliquotaIss === 0 ? '4' : '1'}</tribISSQN>
        <pAliq>${nfse.impostos.aliquotaIss.toFixed(2)}</pAliq>
        <vISSQN>${nfse.impostos.valorIss.toFixed(2)}</vISSQN>
        <tpRetISSQN>${nfse.impostos.issRetido ? '1' : '2'}</tpRetISSQN>
      </tribMun>
      <tribFed>
        <pAliqPis>${nfse.impostos.aliquotaPis.toFixed(2)}</pAliqPis>
        <vPis>${nfse.impostos.valorPis.toFixed(2)}</vPis>
        <pAliqCofins>${nfse.impostos.aliquotaCofins.toFixed(2)}</pAliqCofins>
        <vCofins>${nfse.impostos.valorCofins.toFixed(2)}</vCofins>
        <pAliqCsll>${nfse.impostos.aliquotaCsll.toFixed(2)}</pAliqCsll>
        <vCsll>${nfse.impostos.valorCsll.toFixed(2)}</vCsll>
        <pAliqIR>${nfse.impostos.aliquotaIr.toFixed(2)}</pAliqIR>
        <vIR>${nfse.impostos.valorIr.toFixed(2)}</vIR>
      </tribFed>
      <vLiq>${nfse.impostos.valorLiquido.toFixed(2)}</vLiq>
    </valores>
  </infNFSe>
  <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
    <SignedInfo>
      <CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
      <SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
      <Reference URI="#NFS${nfse.chaveAcesso}">
        <DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
        <DigestValue>${btoa(nfse.chaveAcesso).slice(0, 32)}</DigestValue>
      </Reference>
    </SignedInfo>
    <SignatureValue>MEQCIDv9X...AssinaturaCertificadoDigitalA1ReceitaFederalNacional==</SignatureValue>
  </Signature>
</NFSe>`;
}

function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
