import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { IpmClient } from './ipm/client.js';
import { registerEmitirNfse } from './tools/emit.js';
import { registerCancelarNfse } from './tools/cancel.js';
import { registerConsultarNfse } from './tools/query.js';
import { registerDownloadPdf } from './tools/pdf.js';

async function main(): Promise<void> {
  const config = loadConfig();

  if (!config.sslVerify) {
    process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
  }

  const client = new IpmClient(config);

  const server = new McpServer({
    name: 'mcp-ipm',
    version: '1.0.0',
  });

  registerEmitirNfse(server, client, config);
  registerCancelarNfse(server, client, config);
  registerConsultarNfse(server, client, config);
  registerDownloadPdf(server, client, config);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
