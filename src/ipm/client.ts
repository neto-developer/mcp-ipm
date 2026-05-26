import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import iconv from 'iconv-lite';
import type { IpmConfig } from './types.js';
import type { IpmLogger } from './logger.js';

export class IpmClient {
  private sessionCookie: string | null = null;

  constructor(
    private readonly config: IpmConfig,
    private readonly logger: IpmLogger | null = null,
  ) {}

  saveToLog(name: string, content: string | Buffer): string | null {
    return this.logger?.save(name, content) ?? null;
  }

  saveDocument(name: string, content: string | Buffer): string | null {
    if (!this.config.logDir) return null;
    const dir = join(this.config.logDir, 'downloads', this.config.user);
    mkdirSync(dir, { recursive: true });
    const filePath = join(dir, name);
    writeFileSync(filePath, content);
    return filePath;
  }

  private get authHeader(): string {
    const creds = `${this.config.user}:${this.config.pass}`;
    return `Basic ${Buffer.from(creds, 'utf8').toString('base64')}`;
  }

  private encodeXml(xmlUtf8: string): Buffer {
    return iconv.encode(xmlUtf8, 'ISO-8859-1');
  }

  private decodeResponse(buffer: ArrayBuffer): string {
    return iconv.decode(Buffer.from(buffer), 'ISO-8859-1');
  }

  private extractSessionCookie(headers: Headers): void {
    const setCookie = headers.get('set-cookie');
    if (setCookie) {
      const match = setCookie.match(/PHPSESSID=([^;]+)/);
      if (match?.[1]) {
        this.sessionCookie = match[1];
      }
    }
  }

  private debug(msg: string): void {
    if (this.config.debug) process.stderr.write(`[mcp-ipm] ${msg}\n`);
  }

  async postXml(xmlUtf8: string, tag = 'xml'): Promise<string> {
    this.debug(`POST XML to ${this.config.baseUrl}`);
    this.debug(`Request XML:\n${xmlUtf8}`);
    this.logger?.save(`${tag}_req.xml`, xmlUtf8);

    const xmlBytes = this.encodeXml(xmlUtf8);
    const blob = new Blob([new Uint8Array(xmlBytes)], { type: 'text/xml' });

    const form = new FormData();
    form.append('xml', blob, 'nfse.xml');

    const headers: Record<string, string> = {
      Authorization: this.authHeader,
    };
    if (this.sessionCookie) {
      headers['Cookie'] = `PHPSESSID=${this.sessionCookie}`;
    }

    const response = await fetch(this.config.baseUrl, {
      method: 'POST',
      headers,
      body: form,
    });

    this.debug(`HTTP ${response.status} ${response.statusText}`);
    this.debug(`Response headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`);

    this.extractSessionCookie(response.headers);

    const buffer = await response.arrayBuffer();
    const text = this.decodeResponse(buffer);

    this.debug(`Response body:\n${text}`);
    this.logger?.save(`${tag}_res.xml`, text);

    if (!response.ok && !text.includes('<retorno>')) {
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
    }

    return text;
  }

  async postXmlWithRetry(xmlUtf8: string, tag = 'xml'): Promise<string> {
    try {
      return await this.postXml(xmlUtf8, tag);
    } catch (err) {
      if (err instanceof Error && err.message.includes('sessao')) {
        this.sessionCookie = null;
        return await this.postXml(xmlUtf8, tag);
      }
      throw err;
    }
  }

  async postJson(body: Record<string, string>, tag = 'pdf'): Promise<Buffer> {
    this.debug(`POST JSON to ${this.config.pdfUrl}`);
    this.logger?.save(`${tag}_req.json`, JSON.stringify(body, null, 2));

    const response = await fetch(this.config.pdfUrl, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    this.debug(`HTTP ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
    }

    const buf = Buffer.from(await response.arrayBuffer());
    this.logger?.save(`${tag}_res.pdf`, buf);
    return buf;
  }
}
