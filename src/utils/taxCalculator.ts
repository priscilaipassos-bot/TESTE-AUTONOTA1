import { ImpostosCalculados, PrestadorConfig } from '../types/nfse';

export function calculateTaxes(
  valorServico: number,
  aliquotaIss: number,
  issRetido: boolean,
  prestador: PrestadorConfig,
  reterFederais: boolean = false
): ImpostosCalculados {
  const valorDeducoes = 0;
  const descontoIncondicionado = 0;
  const descontoCondicionado = 0;
  const baseCalculo = valorServico - valorDeducoes - descontoIncondicionado;

  let valorIss = 0;
  if (prestador.regimeTributario === 'MEI') {
    // MEI não tem destaque de ISS nem retenções na NFS-e Nacional
    valorIss = 0;
    aliquotaIss = 0;
  } else {
    valorIss = Number(((baseCalculo * aliquotaIss) / 100).toFixed(2));
  }

  // Impostos Federais
  let aliquotaPis = 0;
  let valorPis = 0;
  let aliquotaCofins = 0;
  let valorCofins = 0;
  let aliquotaCsll = 0;
  let valorCsll = 0;
  let aliquotaIr = 0;
  let valorIr = 0;
  let aliquotaInss = 0;
  let valorInss = 0;

  if (prestador.regimeTributario === 'LUCRO_PRESUMIDO' || prestador.regimeTributario === 'LUCRO_REAL' || reterFederais) {
    aliquotaPis = 0.65;
    aliquotaCofins = 3.00;
    aliquotaCsll = 1.00;
    aliquotaIr = 1.50;

    valorPis = Number(((baseCalculo * aliquotaPis) / 100).toFixed(2));
    valorCofins = Number(((baseCalculo * aliquotaCofins) / 100).toFixed(2));
    valorCsll = Number(((baseCalculo * aliquotaCsll) / 100).toFixed(2));
    valorIr = Number(((baseCalculo * aliquotaIr) / 100).toFixed(2));
  }

  const retencoesFederais = valorPis + valorCofins + valorCsll + valorIr + valorInss;
  const retencaoIss = issRetido ? valorIss : 0;
  const totalRetencoes = Number((retencaoIss + retencoesFederais).toFixed(2));
  const valorLiquido = Number((valorServico - totalRetencoes).toFixed(2));

  return {
    valorServicos: valorServico,
    valorDeducoes,
    descontoIncondicionado,
    descontoCondicionado,
    baseCalculo,
    aliquotaIss,
    valorIss,
    issRetido,
    aliquotaPis,
    valorPis,
    aliquotaCofins,
    valorCofins,
    aliquotaInss,
    valorInss,
    aliquotaIr,
    valorIr,
    aliquotaCsll,
    valorCsll,
    totalRetencoes,
    valorLiquido,
  };
}
