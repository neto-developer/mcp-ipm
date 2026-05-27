import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import type { OAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import type { OAuthClientInformationFull, OAuthTokenRevocationRequest, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { AuthorizationParams } from '@modelcontextprotocol/sdk/server/auth/provider.js';

interface PendingCode {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  expiresAt: number;
}

interface StoredToken {
  clientId: string;
  expiresAt: number;
}

export class SimpleMcpOAuthProvider implements OAuthServerProvider {
  private readonly _clients = new Map<string, OAuthClientInformationFull>();
  private readonly _codes = new Map<string, PendingCode>();
  private readonly _accessTokens = new Map<string, StoredToken>();
  private readonly _refreshTokens = new Map<string, StoredToken>();

  readonly clientsStore: OAuthRegisteredClientsStore = {
    getClient: (clientId) => this._clients.get(clientId),
    registerClient: (client) => {
      const full: OAuthClientInformationFull = {
        ...client,
        client_id: randomUUID(),
        client_id_issued_at: Math.floor(Date.now() / 1000),
      };
      this._clients.set(full.client_id, full);
      return full;
    },
  };

  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response): Promise<void> {
    const code = randomUUID();
    this._codes.set(code, {
      clientId: client.client_id,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    const approveUrl = new URL(params.redirectUri);
    approveUrl.searchParams.set('code', code);
    if (params.state) approveUrl.searchParams.set('state', params.state);

    const denyUrl = new URL(params.redirectUri);
    denyUrl.searchParams.set('error', 'access_denied');
    if (params.state) denyUrl.searchParams.set('state', params.state);

    const clientName = client.client_name ?? client.client_id;

    res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>mcp-ipm — Autorizar</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 420px; margin: 80px auto; padding: 0 16px; text-align: center; color: #111; }
    h2 { margin-bottom: 8px; }
    p { color: #555; margin-bottom: 32px; }
    .actions { display: flex; gap: 12px; justify-content: center; }
    a { display: inline-block; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-size: 15px; font-weight: 500; }
    .allow { background: #0070f3; color: #fff; }
    .deny  { background: #e5e7eb; color: #333; }
  </style>
</head>
<body>
  <h2>mcp-ipm</h2>
  <p><strong>${escapeHtml(clientName)}</strong> solicita acesso às ferramentas de NFS-e.</p>
  <div class="actions">
    <a href="${escapeHtml(approveUrl.toString())}" class="allow">Permitir</a>
    <a href="${escapeHtml(denyUrl.toString())}" class="deny">Negar</a>
  </div>
</body>
</html>`);
  }

  async challengeForAuthorizationCode(client: OAuthClientInformationFull, authorizationCode: string): Promise<string> {
    const pending = this._codes.get(authorizationCode);
    if (!pending || pending.clientId !== client.client_id || pending.expiresAt < Date.now()) {
      throw new Error('Invalid or expired authorization code');
    }
    return pending.codeChallenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    _redirectUri?: string,
  ): Promise<OAuthTokens> {
    const pending = this._codes.get(authorizationCode);
    if (!pending || pending.clientId !== client.client_id || pending.expiresAt < Date.now()) {
      throw new Error('Invalid or expired authorization code');
    }
    this._codes.delete(authorizationCode);
    return this._issueTokens(client.client_id);
  }

  async exchangeRefreshToken(client: OAuthClientInformationFull, refreshToken: string): Promise<OAuthTokens> {
    const stored = this._refreshTokens.get(refreshToken);
    if (!stored || stored.clientId !== client.client_id || stored.expiresAt < Date.now()) {
      throw new Error('Invalid or expired refresh token');
    }
    this._refreshTokens.delete(refreshToken);
    return this._issueTokens(client.client_id);
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const stored = this._accessTokens.get(token);
    console.error(`[oauth] verifyToken ${token.slice(0, 8)}... found=${!!stored} storeSize=${this._accessTokens.size}`);
    if (!stored || stored.expiresAt < Date.now()) {
      throw new Error('Invalid or expired access token');
    }
    return { token, clientId: stored.clientId, scopes: [] };
  }

  async revokeToken(_client: OAuthClientInformationFull, request: OAuthTokenRevocationRequest): Promise<void> {
    this._accessTokens.delete(request.token);
    this._refreshTokens.delete(request.token);
  }

  private _issueTokens(clientId: string): OAuthTokens {
    const accessToken = randomUUID();
    const refreshToken = randomUUID();
    const expiresIn = 3600;

    this._accessTokens.set(accessToken, { clientId, expiresAt: Date.now() + expiresIn * 1000 });
    this._refreshTokens.set(refreshToken, { clientId, expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 });

    console.error(`[oauth] issued token ${accessToken.slice(0, 8)}... for client ${clientId.slice(0, 8)}... (store size: ${this._accessTokens.size})`);
    return { access_token: accessToken, token_type: 'Bearer', expires_in: expiresIn, refresh_token: refreshToken };
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
