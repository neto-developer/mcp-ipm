import { v4 as uuidv4 } from 'uuid';
import type { EmitInput, CancelInput, IpmConfig } from './types.js';

function ipmDecimal(value: number, decimals = 2): string {
  return value.toFixed(decimals).replace('.', ',');
}

function tag(name: string, value: string | undefined | null): string {
  return `<${name}>${value ?? ''}</${name}>`;
}

function xmlHeader(): string {
  return '<?xml version="1.0" encoding="ISO-8859-1"?>';
}

export function buildEmitXml(input: EmitInput, config: IpmConfig): string {
  const id = config.testMode
    ? `TESTE_${uuidv4()}_${Date.now()}`
    : uuidv4();

  const valorTotal = ipmDecimal(input.valor_total);
  const valorTributavel = ipmDecimal(input.valor_tributavel ?? input.valor_total);
  const aliquota = ipmDecimal(input.aliquota_iss ?? 5, 4);
  const deducao = ipmDecimal(input.valor_deducao ?? 0);
  const issrf = ipmDecimal(input.valor_issrf ?? 0);
  const desconto = ipmDecimal(input.valor_desconto_incondicional ?? 0);
  const tribPrestador = input.tributa_municipio_prestador ?? 'S';
  const tribTomador = input.tributa_municipio_tomador ?? 'N';

  const testeTag = config.testMode ? '<nfse_teste>1</nfse_teste>' : '';

  const pagamento = input.parcelas?.length
    ? `<forma_pagamento>
    ${tag('tipo_pagamento', input.tipo_pagamento ?? '2')}
    <parcelas>
      ${input.parcelas.map(p => `<parcela>
        ${tag('numero', String(p.numero))}
        ${tag('valor', ipmDecimal(p.valor))}
        ${tag('data_vencimento', p.data_vencimento)}
      </parcela>`).join('\n      ')}
    </parcelas>
  </forma_pagamento>`
    : '';

  const ibscbs = input.ibscbs
    ? `<IBSCBS>
    ${tag('finNFSe', input.ibscbs.finNFSe)}
    ${tag('indFinal', input.ibscbs.indFinal)}
    ${tag('cIndOp', input.ibscbs.cIndOp)}
    ${tag('tpOper', input.ibscbs.tpOper)}
    <valores><trib><gIBSCBS>
      ${tag('CST', input.ibscbs.CST)}
      ${tag('cClassTrib', input.ibscbs.cClassTrib)}
    </gIBSCBS></trib></valores>
  </IBSCBS>`
    : '';

  const pisCofins = input.pis_cofins
    ? `<pis_cofins>
    ${tag('cst', input.pis_cofins.cst)}
    ${tag('base_calculo', ipmDecimal(input.pis_cofins.base_calculo))}
    ${tag('aliquota_pis', ipmDecimal(input.pis_cofins.aliquota_pis, 4))}
    ${tag('aliquota_cofins', ipmDecimal(input.pis_cofins.aliquota_cofins, 4))}
  </pis_cofins>`
    : '';

  return `${xmlHeader()}
<nfse>
  ${testeTag}
  ${tag('identificador', id)}
  <nf>
    ${tag('valor_total', valorTotal)}
    ${tag('observacao', input.observacao_nf ?? '')}
  </nf>
  <prestador>
    ${tag('cpfcnpj', config.user)}
    ${tag('cidade', config.cidade)}
  </prestador>
  <tomador>
    ${tag('tipo', input.tomador_tipo)}
    ${tag('cpfcnpj', input.tomador_cpfcnpj)}
    ${tag('ie', input.tomador_ie ?? '')}
    ${tag('nome_razao_social', input.tomador_razao_social)}
    ${tag('sobrenome_nome_fantasia', input.tomador_nome_fantasia ?? '')}
    ${tag('logradouro', input.tomador_logradouro ?? '')}
    ${tag('numero_residencia', input.tomador_numero ?? '')}
    ${tag('complemento', input.tomador_complemento ?? '')}
    ${tag('ponto_referencia', input.tomador_ponto_referencia ?? '')}
    ${tag('bairro', input.tomador_bairro ?? '')}
    ${tag('cidade', input.tomador_cidade_tom ?? '')}
    ${tag('cep', input.tomador_cep ?? '')}
    ${tag('email', input.tomador_email)}
    ${tag('ddd_fone_comercial', input.tomador_ddd_fone_comercial ?? '')}
    ${tag('fone_comercial', input.tomador_fone_comercial ?? '')}
    ${tag('ddd_fone_residencial', input.tomador_ddd_fone ?? '')}
    ${tag('fone_residencial', input.tomador_fone ?? '')}
    ${tag('ddd_fax', '')}
    ${tag('fone_fax', '')}
  </tomador>
  <itens>
    <lista>
      ${tag('codigo_local_prestacao_servico', config.cidade)}
      ${tag('codigo_atividade', input.codigo_atividade)}
      ${tag('codigo_item_lista_servico', input.codigo_item_lista_servico)}
      ${tag('codigo_nbs', input.codigo_nbs ?? '')}
      ${tag('descritivo', input.discriminacao)}
      ${tag('aliquota_item_lista_servico', aliquota)}
      ${tag('situacao_tributaria', input.situacao_tributaria ?? '0')}
      ${tag('valor_tributavel', valorTributavel)}
      ${tag('valor_deducao', deducao)}
      ${tag('valor_issrf', issrf)}
      ${tag('tributa_municipio_prestador', tribPrestador)}
      ${tag('tributa_municipio_tomador', tribTomador)}
      ${tag('valor_desconto_incondicional', desconto)}
    </lista>
  </itens>
  ${pagamento}
  ${ibscbs}
  ${pisCofins}
</nfse>`;
}

export function buildCancelXml(input: CancelInput, config: IpmConfig): string {
  return `${xmlHeader()}
<nfse>
  <nf>
    ${tag('numero', input.numero)}
    ${tag('situacao', 'C')}
    ${tag('observacao', input.observacao)}
  </nf>
  <prestador>
    ${tag('cpfcnpj', config.user)}
    ${tag('cidade', config.cidade)}
  </prestador>
</nfse>`;
}

export function buildQueryByAuthXml(codigoAutenticidade: string, _config: IpmConfig): string {
  return `${xmlHeader()}
<nfse>
  <pesquisa>
    ${tag('codigo_autenticidade', codigoAutenticidade)}
  </pesquisa>
</nfse>`;
}

export function buildQueryByNumberXml(numero: string, serie: string, config: IpmConfig): string {
  return `${xmlHeader()}
<nfse>
  <pesquisa>
    ${tag('numero', numero)}
    ${tag('serie_nfse', serie)}
    ${tag('cadastro', config.cadastro)}
  </pesquisa>
</nfse>`;
}
