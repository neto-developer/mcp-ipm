import { describe, it, expect } from 'vitest';
import { buildEmitXml, buildCancelXml, buildQueryByAuthXml, buildQueryByNumberXml } from '../xml-builder.js';
import type { EmitInput } from '../types.js';

const baseConfig = {
  user: '45912608000120',
  pass: 'pass',
  cadastro: '5389',
  cidade: '8135',
  baseUrl: '',
  pdfUrl: '',
  testMode: false,
  sslVerify: true,
  debug: false,
  logDir: '',
};

const minimalEmit: EmitInput = {
  valor_total: 1234.56,
  discriminacao: 'Servico de teste',
  codigo_atividade: '101401',
  codigo_item_lista_servico: '140101',
  tomador_cpfcnpj: '12345678901',
  tomador_tipo: 'F',
  tomador_razao_social: 'JOAO DA SILVA',
  tomador_email: 'joao@test.com',
};

describe('buildEmitXml', () => {
  it('includes valor_total formatted with comma', () => {
    const xml = buildEmitXml(minimalEmit, baseConfig);
    expect(xml).toContain('<valor_total>1234,56</valor_total>');
  });

  it('includes prestador cpfcnpj and cidade from config', () => {
    const xml = buildEmitXml(minimalEmit, baseConfig);
    expect(xml).toContain('<cpfcnpj>45912608000120</cpfcnpj>');
    expect(xml).toContain('<cidade>8135</cidade>');
  });

  it('does not include nfse_teste tag in normal mode', () => {
    const xml = buildEmitXml(minimalEmit, baseConfig);
    expect(xml).not.toContain('<nfse_teste>');
  });

  it('includes nfse_teste tag in test mode', () => {
    const xml = buildEmitXml(minimalEmit, { ...baseConfig, testMode: true });
    expect(xml).toContain('<nfse_teste>1</nfse_teste>');
  });

  it('includes identificador with TESTE prefix in test mode', () => {
    const xml = buildEmitXml(minimalEmit, { ...baseConfig, testMode: true });
    expect(xml).toMatch(/<identificador>TESTE_/);
  });

  it('includes tomador data', () => {
    const xml = buildEmitXml(minimalEmit, baseConfig);
    expect(xml).toContain('<cpfcnpj>12345678901</cpfcnpj>');
    expect(xml).toContain('<nome_razao_social>JOAO DA SILVA</nome_razao_social>');
    expect(xml).toContain('<tipo>F</tipo>');
  });

  it('defaults tributa_municipio_prestador to S', () => {
    const xml = buildEmitXml(minimalEmit, baseConfig);
    expect(xml).toContain('<tributa_municipio_prestador>S</tributa_municipio_prestador>');
  });

  it('formats aliquota with 4 decimal places comma', () => {
    const xml = buildEmitXml({ ...minimalEmit, aliquota_iss: 5 }, baseConfig);
    expect(xml).toContain('<aliquota_item_lista_servico>5,0000</aliquota_item_lista_servico>');
  });

  it('includes ibscbs block when provided', () => {
    const xml = buildEmitXml({
      ...minimalEmit,
      ibscbs: { finNFSe: '1', indFinal: '1', cIndOp: '1', tpOper: '1', CST: '01', cClassTrib: '01' },
    }, baseConfig);
    expect(xml).toContain('<IBSCBS>');
    expect(xml).toContain('<CST>01</CST>');
  });
});

describe('buildCancelXml', () => {
  it('includes numero, situacao C, observacao, and prestador', () => {
    const xml = buildCancelXml({ numero: '123', serie: '1', observacao: 'erro' }, baseConfig);
    expect(xml).toContain('<numero>123</numero>');
    expect(xml).toContain('<situacao>C</situacao>');
    expect(xml).toContain('<observacao>erro</observacao>');
    expect(xml).toContain('<cpfcnpj>45912608000120</cpfcnpj>');
  });
});

describe('buildQueryByAuthXml', () => {
  it('includes codigo_autenticidade', () => {
    const xml = buildQueryByAuthXml('ABC123', baseConfig);
    expect(xml).toContain('<codigo_autenticidade>ABC123</codigo_autenticidade>');
  });
});

describe('buildQueryByNumberXml', () => {
  it('includes numero, serie, cadastro from config', () => {
    const xml = buildQueryByNumberXml('42', '1', baseConfig);
    expect(xml).toContain('<numero>42</numero>');
    expect(xml).toContain('<serie_nfse>1</serie_nfse>');
    expect(xml).toContain('<cadastro>5389</cadastro>');
  });
});
