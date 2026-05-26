import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { IpmClient } from '../ipm/client.js';
import { buildQueryByAuthXml, buildQueryByNumberXml } from '../ipm/xml-builder.js';
import { parseQueryResponse } from '../ipm/xml-parser.js';
import type { IpmConfig } from '../ipm/types.js';

export function registerConsultarNfse(server: McpServer, client: IpmClient, config: IpmConfig): void {
  server.tool(
    'consultar_nfse',
    'Consulta uma NFS-e por codigo de autenticidade OU por numero + serie. Fornecer codigo_autenticidade usa Modo A; fornecer numero + serie usa Modo B.',
    {
      codigo_autenticidade: z.string().optional().describe('Modo A: codigo de autenticidade da NFS-e'),
      numero: z.string().optional().describe('Modo B: numero da NFS-e'),
      serie: z.string().optional().describe('Modo B: serie da NFS-e (default: 1)'),
    },
    async (params) => {
      let xml: string;

      if (params.codigo_autenticidade) {
        xml = buildQueryByAuthXml(params.codigo_autenticidade, config);
      } else if (params.numero) {
        xml = buildQueryByNumberXml(params.numero, params.serie ?? '1', config);
      } else {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ error: 'Fornecer codigo_autenticidade (Modo A) ou numero (Modo B)' }),
          }],
          isError: true,
        };
      }

      const responseXml = await client.postXmlWithRetry(xml);
      const result = parseQueryResponse(responseXml);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
