import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { IpmClient } from '../ipm/client.js';
import { buildNfseFilename } from '../ipm/naming.js';
import { buildQueryByNumberXml } from '../ipm/xml-builder.js';
import { parseQueryResponse } from '../ipm/xml-parser.js';
import type { IpmConfig } from '../ipm/types.js';

export function registerDownloadPdf(server: McpServer, client: IpmClient, config: IpmConfig): void {
  server.tool(
    'download_pdf',
    'Faz download do PDF de uma NFS-e. Em modo HTTP retorna link público para download; em modo local retorna o caminho do arquivo.',
    {
      numero: z.string().min(1).describe('Numero da NFS-e'),
      serie: z.string().optional().describe('Serie da NFS-e (default: 1)'),
      serie_codigo: z.string().optional().describe('Codigo da serie para o servico PDF'),
      serie_tipo: z.string().optional().describe('Tipo da serie para o servico PDF'),
    },
    async (params) => {
      let tomadorNome: string | undefined;
      let dataEmissao: string | undefined;
      try {
        const queryXml = buildQueryByNumberXml(params.numero, params.serie ?? '1', config);
        const queryRes = await client.postXmlWithRetry(queryXml, `nfse_${params.numero}_meta`);
        const meta = parseQueryResponse(queryRes);
        tomadorNome = meta.tomador_nome;
        dataEmissao = meta.data_emissao;
      } catch {
        // naming falls back to NFS-e{numero}.pdf
      }

      const body: Record<string, string> = {
        'Prestador.cadastro': config.cadastro,
        numero: params.numero,
      };
      if (params.serie_codigo) body['Serie.codigo'] = params.serie_codigo;
      if (params.serie_tipo) body['Serie.tipo'] = params.serie_tipo;

      const pdfBuffer = await client.postJson(body, `nfse_${params.numero}`);
      const filename = buildNfseFilename(params.numero, 'pdf', dataEmissao, tomadorNome);

      if (config.externalUrl && config.dataDir) {
        const downloadsDir = join(config.dataDir, 'downloads');
        mkdirSync(downloadsDir, { recursive: true });
        writeFileSync(join(downloadsDir, filename), pdfBuffer);
        const pdf_url = `${config.externalUrl}/downloads/${encodeURIComponent(filename)}`;
        return {
          content: [{ type: 'text', text: JSON.stringify({ pdf_url, pdf_filename: filename }, null, 2) }],
        };
      }

      const pdf_local = client.saveDocument(filename, pdfBuffer) ?? filename;
      return {
        content: [{ type: 'text', text: JSON.stringify({ pdf_local }, null, 2) }],
      };
    },
  );
}
