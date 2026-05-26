import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('loadConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('throws when NFSE_USER missing', async () => {
    delete process.env['NFSE_USER'];
    process.env['NFSE_PASS'] = 'pass';
    process.env['NFSE_CADASTRO'] = '1234';
    process.env['NFSE_CIDADE'] = '8135';
    const { loadConfig } = await import('./config.js');
    expect(() => loadConfig()).toThrow('NFSE_USER');
  });

  it('throws when NFSE_PASS missing', async () => {
    process.env['NFSE_USER'] = 'user';
    delete process.env['NFSE_PASS'];
    process.env['NFSE_CADASTRO'] = '1234';
    process.env['NFSE_CIDADE'] = '8135';
    const { loadConfig } = await import('./config.js');
    expect(() => loadConfig()).toThrow('NFSE_PASS');
  });

  it('returns config with defaults', async () => {
    process.env['NFSE_USER'] = 'myuser';
    process.env['NFSE_PASS'] = 'mypass';
    process.env['NFSE_CADASTRO'] = '5389';
    process.env['NFSE_CIDADE'] = '8135';
    const { loadConfig } = await import('./config.js');
    const config = loadConfig();
    expect(config.user).toBe('myuser');
    expect(config.pass).toBe('mypass');
    expect(config.cadastro).toBe('5389');
    expect(config.cidade).toBe('8135');
    expect(config.testMode).toBe(false);
    expect(config.sslVerify).toBe(true);
    expect(config.baseUrl).toContain('WNERestServiceNFSe');
    expect(config.pdfUrl).toContain('WNERestPDFNFSe');
  });

  it('respects NFSE_TEST_MODE=true', async () => {
    process.env['NFSE_USER'] = 'u';
    process.env['NFSE_PASS'] = 'p';
    process.env['NFSE_CADASTRO'] = '1';
    process.env['NFSE_CIDADE'] = '1';
    process.env['NFSE_TEST_MODE'] = 'true';
    const { loadConfig } = await import('./config.js');
    expect(loadConfig().testMode).toBe(true);
  });
});
