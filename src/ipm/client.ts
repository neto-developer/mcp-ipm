import iconv from 'iconv-lite';
import type { IpmConfig } from './types.js';

export class IpmClient {
  private sessionCookie: string | null = null;

  constructor(private readonly config: IpmConfig) {}

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

  async postXml(xmlUtf8: string): Promise<string> {
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

    this.extractSessionCookie(response.headers);

    const buffer = await response.arrayBuffer();
    const text = this.decodeResponse(buffer);

    if (!response.ok && !text.includes('<retorno>')) {
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
    }

    return text;
  }

  async postXmlWithRetry(xmlUtf8: string): Promise<string> {
    try {
      return await this.postXml(xmlUtf8);
    } catch (err) {
      if (err instanceof Error && err.message.includes('sessao')) {
        this.sessionCookie = null;
        return await this.postXml(xmlUtf8);
      }
      throw err;
    }
  }

  async postJson(body: Record<string, string>): Promise<Buffer> {
    const response = await fetch(this.config.pdfUrl, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }
}
