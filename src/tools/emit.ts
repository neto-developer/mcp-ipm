import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { IpmClient } from '../ipm/client.js';
import { buildEmitXml } from '../ipm/xml-builder.js';
import { parseEmitResponse } from '../ipm/xml-parser.js';
import type { IpmConfig } from '../ipm/types.js';

const parcelaSchema = z.object({
  numero: z.number().int().positive(),
  valor: z.number().positive(),
  data_vencimento: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'formato dd/mm/yyyy'),
});

const ibscbsSchema = z.object({
  finNFSe: z.string(),
  indFinal: z.string(),
  cIndOp: z.string(),
  tpOper: z.string(),
  CST: z.string(),
  cClassTrib: z.string(),
});

const pisCofinsSchema = z.object({
  cst: z.string(),
  base_calculo: z.number().nonnegative(),
  aliquota_pis: z.number().nonnegative(),
  aliquota_cofins: z.number().nonnegative(),
});

export const emitirNfseSchema = {
  valor_total: z.number().positive().describe('Valor total do servico em reais'),
  discriminacao: z.string().min(1).describe('Descricao do servico prestado'),
  codigo_atividade: z.string().min(1).describe('Codigo de atividade IPM (ex: 101401)'),
  codigo_item_lista_servico: z.string().min(1).describe('Codigo LC 116/2003 (ex: 140101)'),
  tomador_cpfcnpj: z.string().min(11).max(14).describe('CPF ou CNPJ do tomador (somente digitos)'),
  tomador_tipo: z.enum(['F', 'J']).describe('F = pessoa fisica, J = juridica'),
  tomador_razao_social: z.string().min(1).describe('Razao social ou nome completo em maiusculas'),
  tomador_email: z.string().email().describe('E-mail do tomador'),
  tomador_nome_fantasia: z.string().optional(),
  tomador_ie: z.string().optional().describe('Inscricao estadual'),
  tomador_cidade_tom: z.string().optional().describe('Codigo TOM da cidade do tomador'),
  tomador_logradouro: z.string().optional(),
  tomador_numero: z.string().optional(),
  tomador_complemento: z.string().optional(),
  tomador_bairro: z.string().optional(),
  tomador_cep: z.string().optional().describe('CEP somente digitos'),
  tomador_uf: z.string().length(2).optional(),
  tomador_ponto_referencia: z.string().optional(),
  tomador_ddd_fone: z.string().optional(),
  tomador_fone: z.string().optional(),
  tomador_ddd_fone_comercial: z.string().optional(),
  tomador_fone_comercial: z.string().optional(),
  codigo_nbs: z.string().optional().describe('Nomenclatura Brasileira de Servicos (NTE-122)'),
  aliquota_iss: z.number().nonnegative().optional().describe('Percentual ISS (default 5.0)'),
  situacao_tributaria: z.string().optional().describe('Codigo situacao tributaria (default 0)'),
  valor_tributavel: z.number().nonnegative().optional().describe('Default = valor_total'),
  valor_deducao: z.number().nonnegative().optional(),
  valor_issrf: z.number().nonnegative().optional().describe('ISS retido na fonte'),
  tributa_municipio_prestador: z.enum(['S', 'N']).optional().describe('Default S'),
  tributa_municipio_tomador: z.enum(['S', 'N']).optional().describe('Default N'),
  valor_desconto_incondicional: z.number().nonnegative().optional(),
  observacao_nf: z.string().optional().describe('Observacoes/dados bancarios'),
  tipo_pagamento: z.string().optional().describe('Default 2 (a prazo)'),
  parcelas: z.array(parcelaSchema).optional(),
  ibscbs: ibscbsSchema.optional().describe('Reforma Tributaria IBS/CBS (NTE-122, opcional)'),
  pis_cofins: pisCofinsSchema.optional(),
};

export function registerEmitirNfse(server: McpServer, client: IpmClient, config: IpmConfig): void {
  server.tool(
    'emitir_nfse',
    'Emite uma NFS-e no sistema IPM Atende.Net',
    emitirNfseSchema,
    async (params) => {
      const xml = buildEmitXml(params as Parameters<typeof buildEmitXml>[0], config);
      const responseXml = await client.postXmlWithRetry(xml, 'emitir');
      const result = parseEmitResponse(responseXml);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
