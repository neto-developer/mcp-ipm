import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import express, { type Request, type Response, type NextFunction } from 'express';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { loadConfig } from './config.js';
import { IpmClient } from './ipm/client.js';
import { IpmLogger } from './ipm/logger.js';
import { registerEmitirNfse } from './tools/emit.js';
import { registerCancelarNfse } from './tools/cancel.js';
import { registerConsultarNfse } from './tools/query.js';
import { registerDownloadPdf } from './tools/pdf.js';
import { SimpleMcpOAuthProvider } from './auth/provider.js';
import type { IpmConfig } from './ipm/types.js';

function htmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

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
    app.set('trust proxy', 1);
    app.use(express.json());
    app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      res.on('finish', () => {
        const auth = req.headers['authorization'];
        const authTag = auth ? ` auth=${auth.slice(0, 14)}...` : ' no-auth';
        console.error(`${req.method} ${req.url} ${res.statusCode} ${Date.now() - start}ms${authTag}`);
      });
      next();
    });

    if (config.externalUrl) {
      // OAuth 2.1 mode — required for Claude.ai remote MCP
      const issuerUrl = new URL(config.externalUrl);
      const oauthProvider = new SimpleMcpOAuthProvider(config.dataDir);

      const downloadsDir = join(config.dataDir!, 'downloads');
      mkdirSync(downloadsDir, { recursive: true });
      app.use('/downloads', express.static(downloadsDir));

      if (config.authPin) {
        const pin = config.authPin;
        app.get('/authorize', (req: Request, res: Response, next: NextFunction) => {
          if (req.query['pin'] === pin) { next(); return; }
          const q = { ...req.query } as Record<string, string>;
          delete q['pin'];
          const hidden = Object.entries(q)
            .map(([k, v]) => `<input type="hidden" name="${htmlEscape(k)}" value="${htmlEscape(v)}">`)
            .join('');
          const wrongPin = 'pin' in req.query;
          res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>mcp-ipm — PIN</title>
<style>body{font-family:system-ui,sans-serif;max-width:360px;margin:80px auto;padding:0 16px;text-align:center}
input[type=password]{display:block;width:100%;padding:10px;margin:16px 0;font-size:16px;border:1px solid #ddd;border-radius:6px;box-sizing:border-box}
button{padding:10px 28px;background:#0070f3;color:#fff;border:none;border-radius:6px;font-size:15px;cursor:pointer}
.err{color:#c00;margin-bottom:8px;font-size:14px}</style>
</head>
<body>
<h2>mcp-ipm</h2>
<p>Digite o PIN para autorizar acesso.</p>
${wrongPin ? '<p class="err">PIN incorreto.</p>' : ''}
<form method="GET" action="/authorize">${hidden}
  <input type="password" name="pin" autofocus placeholder="PIN">
  <button type="submit">Entrar</button>
</form>
</body></html>`);
        });
      }

      app.use(mcpAuthRouter({
        provider: oauthProvider,
        issuerUrl,
        resourceServerUrl: new URL(`${config.externalUrl}/mcp`),
        resourceName: 'mcp-ipm',
      }));

      const bearerAuth = requireBearerAuth({ verifier: oauthProvider });

      app.post('/mcp', bearerAuth, async (req: Request, res: Response) => {
        const server = buildServer(client, logger, config);
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        res.on('finish', () => { transport.close().catch(() => {}); });
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
      });

      app.get('/mcp', bearerAuth, async (req: Request, res: Response) => {
        const server = buildServer(client, logger, config);
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        res.on('finish', () => { transport.close().catch(() => {}); });
        await server.connect(transport);
        await transport.handleRequest(req, res);
      });

      console.error(`mcp-ipm HTTP listening on :${config.httpPort} (OAuth — issuer: ${issuerUrl})`);
    } else if (config.httpToken) {
      // Simple Bearer token mode
      const token = config.httpToken;
      app.use((_req: Request, res: Response, next: NextFunction) => {
        const auth = _req.headers['authorization'];
        if (auth !== `Bearer ${token}`) {
          res.status(401).json({ error: 'Unauthorized' });
          return;
        }
        next();
      });

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

      console.error(`mcp-ipm HTTP listening on :${config.httpPort} (Bearer token)`);
    } else {
      // No auth
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

      console.error(`mcp-ipm HTTP listening on :${config.httpPort} (no auth)`);
    }

    app.listen(config.httpPort, '0.0.0.0');
  } else {
    // Stdio mode (default)
    const server = buildServer(client, logger, config);
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
