import { XMLParser } from 'fast-xml-parser';
import type { EmitResult, CancelResult, QueryResult } from './types.js';

const parser = new XMLParser({ ignoreAttributes: false });

function parse(xml: string): Record<string, unknown> {
  return parser.parse(xml) as Record<string, unknown>;
}

function getMensagem(retorno: Record<string, unknown>): { codigo: string; descricao: string } {
  const r = (retorno['retorno'] ?? retorno) as Record<string, unknown>;
  const m = r['mensagem'] as Record<string, unknown>;
  const codigoRaw = m?.['codigo'];
  // Ensure codigo is padded to 3 digits (e.g., 0 -> "000", 99 -> "099")
  const codigo = String(codigoRaw).padStart(3, '0');
  return {
    codigo,
    descricao: String(m?.['descricao'] ?? ''),
  };
}

function getNf(retorno: Record<string, unknown>): Record<string, unknown> {
  const r = (retorno['retorno'] ?? retorno) as Record<string, unknown>;
  const nfse = r['nfse'] as Record<string, unknown>;
  return (nfse?.['nf'] ?? {}) as Record<string, unknown>;
}

function assertSuccess(xml: string): Record<string, unknown> {
  const parsed = parse(xml);
  const { codigo, descricao } = getMensagem(parsed);
  if (codigo !== '000') {
    throw new Error(`IPM [${codigo}]: ${descricao}`);
  }
  return parsed;
}

export function parseEmitResponse(xml: string): EmitResult {
  const parsed = assertSuccess(xml);
  const nf = getNf(parsed);
  return {
    numero_nfse: String(nf['numero_nfse'] ?? ''),
    serie_nfse: String(nf['serie_nfse'] ?? ''),
    cod_verificador: String(nf['cod_verificador_autenticidade'] ?? ''),
    data_emissao: String(nf['data_nfse'] ?? ''),
    hora_emissao: String(nf['hora_nfse'] ?? ''),
    situacao: String(nf['situacao'] ?? ''),
    link_nfse: String(nf['link_nfse'] ?? ''),
  };
}

export function parseCancelResponse(xml: string): CancelResult {
  const parsed = parse(xml);
  const { codigo, descricao } = getMensagem(parsed);
  return {
    sucesso: codigo === '000',
    mensagem: descricao,
  };
}

export function parseQueryResponse(xml: string): QueryResult {
  if (xml.trim() === 'Nenhuma nota fiscal encontrada.') {
    throw new Error('Nenhuma nota fiscal encontrada.');
  }
  const parsed = assertSuccess(xml);
  const nf = getNf(parsed);
  return {
    numero_nfse: String(nf['numero_nfse'] ?? ''),
    serie_nfse: String(nf['serie_nfse'] ?? ''),
    cod_verificador: String(nf['cod_verificador_autenticidade'] ?? ''),
    situacao: String(nf['situacao'] ?? ''),
    valor_total: String(nf['valor_total'] ?? ''),
    data_emissao: String(nf['data_nfse'] ?? ''),
    link_nfse: String(nf['link_nfse'] ?? ''),
  };
}
