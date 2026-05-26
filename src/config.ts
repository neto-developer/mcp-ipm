import type { IpmConfig } from './ipm/types.js';

const DEFAULT_BASE_URL =
  'https://ws-ibirama.atende.net/?pg=rest&service=WNERestServiceNFSe';

function deriveDefaultPdfUrl(baseUrl: string): string {
  return baseUrl.replace('WNERestServiceNFSe', 'WNERestPDFNFSe');
}

export function loadConfig(): IpmConfig {
  const required = ['NFSE_USER', 'NFSE_PASS', 'NFSE_CADASTRO', 'NFSE_CIDADE'] as const;
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  const baseUrl = process.env['NFSE_BASE_URL'] ?? DEFAULT_BASE_URL;

  return {
    user: process.env['NFSE_USER']!,
    pass: process.env['NFSE_PASS']!,
    cadastro: process.env['NFSE_CADASTRO']!,
    cidade: process.env['NFSE_CIDADE']!,
    baseUrl,
    pdfUrl: process.env['NFSE_PDF_URL'] ?? deriveDefaultPdfUrl(baseUrl),
    testMode: process.env['NFSE_TEST_MODE'] === 'true',
    sslVerify: process.env['NFSE_SSL_VERIFY'] !== 'false',
  };
}
