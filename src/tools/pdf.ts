import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { IpmClient } from '../ipm/client.js';
import type { IpmConfig } from '../ipm/types.js';

export function registerDownloadPdf(server: McpServer, client: IpmClient, config: IpmConfig): void {
  server.tool(
    'download_pdf',
    'Faz download do PDF de uma NFS-e. Retorna PDF em base64.',
    {
      numero: z.string().min(1).describe('Numero da NFS-e'),
      serie_codigo: z.string().optional().describe('Codigo da serie'),
      serie_tipo: z.string().optional().describe('Tipo da serie'),
    },
    async (params) => {
      const body: Record<string, string> = {
        'Prestador.cadastro': config.cadastro,
        numero: params.numero,
      };
      if (params.serie_codigo) body['Serie.codigo'] = params.serie_codigo;
      if (params.serie_tipo) body['Serie.tipo'] = params.serie_tipo;

      const pdfBuffer = await client.postJson(body);
      const result = {
        pdf_base64: pdfBuffer.toString('base64'),
        filename: `nfse-${params.numero}.pdf`,
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
