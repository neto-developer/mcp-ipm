export interface IpmConfig {
  user: string;
  pass: string;
  cadastro: string;
  cidade: string;
  baseUrl: string;
  pdfUrl: string;
  testMode: boolean;
  sslVerify: boolean;
  debug: boolean;
  logDir: string;
  httpPort?: number;
  httpToken?: string;
  externalUrl?: string;
}

export interface Parcela {
  numero: number;
  valor: number;
  data_vencimento: string; // dd/mm/yyyy
}

export interface IbsCbs {
  finNFSe: string;
  indFinal: string;
  cIndOp: string;
  tpOper: string;
  CST: string;
  cClassTrib: string;
}

export interface PisCofins {
  cst: string;
  base_calculo: number;
  aliquota_pis: number;
  aliquota_cofins: number;
}

export interface EmitInput {
  valor_total: number;
  discriminacao: string;
  codigo_atividade: string;
  codigo_item_lista_servico: string;
  tomador_cpfcnpj: string;
  tomador_tipo: 'F' | 'J';
  tomador_razao_social: string;
  tomador_email: string;
  tomador_nome_fantasia?: string;
  tomador_ie?: string;
  tomador_cidade_tom?: string;
  tomador_logradouro?: string;
  tomador_numero?: string;
  tomador_complemento?: string;
  tomador_bairro?: string;
  tomador_cep?: string;
  tomador_uf?: string;
  tomador_ponto_referencia?: string;
  tomador_ddd_fone?: string;
  tomador_fone?: string;
  tomador_ddd_fone_comercial?: string;
  tomador_fone_comercial?: string;
  codigo_nbs?: string;
  aliquota_iss?: number;
  situacao_tributaria?: string;
  valor_tributavel?: number;
  valor_deducao?: number;
  valor_issrf?: number;
  tributa_municipio_prestador?: 'S' | 'N';
  tributa_municipio_tomador?: 'S' | 'N';
  valor_desconto_incondicional?: number;
  observacao_nf?: string;
  tipo_pagamento?: string;
  parcelas?: Parcela[];
  ibscbs?: IbsCbs;
  pis_cofins?: PisCofins;
}

export interface CancelInput {
  numero: string;
  serie: string;
  observacao: string;
}

export interface QueryByAuthInput {
  codigo_autenticidade: string;
}

export interface QueryByNumberInput {
  numero: string;
  serie: string;
}

export type QueryInput = QueryByAuthInput | QueryByNumberInput;

export interface PdfInput {
  numero: string;
  serie_codigo?: string;
  serie_tipo?: string;
}

export interface EmitResult {
  numero_nfse: string;
  serie_nfse: string;
  link_nfse: string;
  cod_verificador: string;
  data_emissao: string;
  hora_emissao: string;
  situacao: string;
}

export interface CancelResult {
  sucesso: boolean;
  mensagem: string;
}

export interface QueryResult {
  numero_nfse: string;
  serie_nfse: string;
  cod_verificador: string;
  chave_acesso_nacional: string;
  data_emissao: string;
  hora_emissao: string;
  situacao: string;
  valor_total: string;
  valor_desconto: string;
  link_nfse: string;
  tomador_nome: string;
  tomador_cpfcnpj: string;
  tomador_email: string;
  discriminacao: string;
  codigo_atividade: string;
  xml_local?: string;
}

