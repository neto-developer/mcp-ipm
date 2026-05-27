import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express, { type Request, type Response, type NextFunction } from 'express';
import { loadConfig } from './config.js';
import { IpmClient } from './ipm/client.js';
import { IpmLogger } from './ipm/logger.js';
import { registerEmitirNfse } from './tools/emit.js';
import { registerCancelarNfse } from './tools/cancel.js';
import { registerConsultarNfse } from './tools/query.js';
import { registerDownloadPdf } from './tools/pdf.js';
import type { IpmConfig } from './ipm/types.js';

function buildServer(client: IpmClient, logger: IpmLogger | null, config: IpmConfig): McpServer {
  const server = new McpServer({ name: 'mcp-ipm', version: '1.0.0' });
  registerEmitirNfse(server, client, config);
  registerCancelarNfse(server, client, config);
  registerConsultarNfse(server, client, config);
  registerDownloadPdf(server, client, config);
  return server;
}

async function main(): Promise<void> {
  const config = loadConfig();

  if (!config.sslVerify) {
    process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
  }

  const logger = config.logDir ? new IpmLogger(config.logDir) : null;
  const client = new IpmClient(config, logger);

  if (config.httpPort) {
    const app = express();
    app.use(express.json());

    if (config.httpToken) {
      const token = config.httpToken;
      app.use((_req: Request, res: Response, next: NextFunction) => {
        const auth = _req.headers['authorization'];
        if (auth !== `Bearer ${token}`) {
          res.status(401).json({ error: 'Unauthorized' });
          return;
        }
        next();
      });
    }

    app.post('/mcp', async (req: Request, res: Response) => {
      const server = buildServer(client, logger, config);
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      res.on('finish', () => { transport.close().catch(() => {}); });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    });

    app.get('/mcp', async (req: Request, res: Response) => {
      const server = buildServer(client, logger, config);
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      res.on('finish', () => { transport.close().catch(() => {}); });
      await server.connect(transport);
      await transport.handleRequest(req, res);
    });

    app.listen(config.httpPort, '0.0.0.0', () => {
      const authMode = config.httpToken ? 'Bearer token' : 'no auth';
      console.error(`mcp-ipm HTTP listening on :${config.httpPort} (${authMode})`);
    });
  } else {
    const server = buildServer(client, logger, config);
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
