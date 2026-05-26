import { XMLParser } from 'fast-xml-parser';
import type { EmitResult, CancelResult, QueryResult } from './types.js';

const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false });

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
  // Query response: nfse.nf directly (no <retorno> wrapper)
  const direct = retorno['nfse'] as Record<string, unknown> | undefined;
  if (direct?.['nf']) return direct['nf'] as Record<string, unknown>;
  // Emit/other responses: retorno.nfse.nf
  const r = (retorno['retorno'] ?? retorno) as Record<string, unknown>;
  const nfse = r['nfse'] as Record<string, unknown>;
  return (nfse?.['nf'] ?? {}) as Record<string, unknown>;
}

const DEBUG = process.env['NFSE_DEBUG'] === 'true';

function debugParsed(label: string, parsed: unknown): void {
  if (DEBUG) process.stderr.write(`[mcp-ipm] ${label}: ${JSON.stringify(parsed, null, 2)}\n`);
}

function assertSuccess(xml: string): Record<string, unknown> {
  const parsed = parse(xml);
  debugParsed('parsed XML object', parsed);
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
  const parsed = parse(xml);
  debugParsed('parsed XML object', parsed);

  // Query success: direct <nfse><nf> structure (no <retorno><mensagem>)
  const nfseRoot = parsed['nfse'] as Record<string, unknown> | undefined;
  if (!nfseRoot?.['nf']) {
    const { codigo, descricao } = getMensagem(parsed);
    throw new Error(`IPM [${codigo}]: ${descricao}`);
  }

  const nf = nfseRoot['nf'] as Record<string, unknown>;
  const tomador = (nfseRoot['tomador'] ?? {}) as Record<string, unknown>;
  const itensRoot = nfseRoot['itens'] as Record<string, unknown> | undefined;
  const listaRaw = itensRoot?.['lista'];
  const lista = (Array.isArray(listaRaw) ? listaRaw[0] : (listaRaw ?? {})) as Record<string, unknown>;

  return {
    numero_nfse: String(nf['numero_nfse'] ?? ''),
    serie_nfse: String(nf['serie_nfse'] ?? ''),
    cod_verificador: String(nf['cod_verificador_autenticidade'] ?? ''),
    chave_acesso_nacional: String(nf['chave_acesso_nfse_nacional'] ?? ''),
    data_emissao: String(nf['data_nfse'] ?? ''),
    hora_emissao: String(nf['hora_nfse'] ?? ''),
    situacao: String(nf['situacao_descricao_nfse'] ?? nf['situacao'] ?? ''),
    valor_total: String(nf['valor_total'] ?? ''),
    valor_desconto: String(nf['valor_desconto'] ?? '0,00'),
    link_nfse: String(nf['link_nfse'] ?? ''),
    tomador_nome: String(tomador['nome_razao_social'] ?? ''),
    tomador_cpfcnpj: String(tomador['cpfcnpj'] ?? ''),
    tomador_email: String(tomador['email'] ?? ''),
    discriminacao: String(lista['descritivo'] ?? ''),
    codigo_atividade: String(lista['codigo_atividade'] ?? ''),
  };
}
