import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { IpmClient } from '../ipm/client.js';
import { buildCancelXml } from '../ipm/xml-builder.js';
import { parseCancelResponse } from '../ipm/xml-parser.js';
import type { IpmConfig } from '../ipm/types.js';

export function registerCancelarNfse(server: McpServer, client: IpmClient, config: IpmConfig): void {
  server.tool(
    'cancelar_nfse',
    'Cancela uma NFS-e emitida no sistema IPM',
    {
      numero: z.string().min(1).describe('Numero da NFS-e'),
      serie: z.string().min(1).describe('Serie da NFS-e'),
      observacao: z.string().min(1).describe('Motivo do cancelamento'),
    },
    async (params) => {
      const xml = buildCancelXml(
        { numero: params.numero, serie: params.serie, observacao: params.observacao },
        config,
      );
      const responseXml = await client.postXmlWithRetry(xml);
      const result = parseCancelResponse(responseXml);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
