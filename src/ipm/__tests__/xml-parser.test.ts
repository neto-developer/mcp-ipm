import { describe, it, expect } from 'vitest';
import { parseEmitResponse, parseCancelResponse, parseQueryResponse } from '../xml-parser.js';

const successEmitXml = `<?xml version="1.0" encoding="ISO-8859-1"?>
<retorno>
  <mensagem>
    <codigo>000</codigo>
    <descricao>Nota fiscal emitida com sucesso</descricao>
  </mensagem>
  <nfse>
    <nf>
      <numero_nfse>42</numero_nfse>
      <serie_nfse>1</serie_nfse>
      <cod_verificador_autenticidade>ABC123</cod_verificador_autenticidade>
      <valor_total>1234,56</valor_total>
      <data_nfse>01/01/2026</data_nfse>
      <hora_nfse>10:00:00</hora_nfse>
      <situacao>A</situacao>
      <link_nfse>https://ipm.link/42</link_nfse>
    </nf>
  </nfse>
</retorno>`;

const errorXml = `<?xml version="1.0" encoding="ISO-8859-1"?>
<retorno>
  <mensagem>
    <codigo>099</codigo>
    <descricao>Tomador invalido</descricao>
  </mensagem>
</retorno>`;

const notFoundText = 'Nenhuma nota fiscal encontrada.';

describe('parseEmitResponse', () => {
  it('returns emit result on success', () => {
    const result = parseEmitResponse(successEmitXml);
    expect(result.numero_nfse).toBe('42');
    expect(result.serie_nfse).toBe('1');
    expect(result.cod_verificador).toBe('ABC123');
    expect(result.link_nfse).toBe('https://ipm.link/42');
    expect(result.situacao).toBe('A');
  });

  it('throws on business error', () => {
    expect(() => parseEmitResponse(errorXml)).toThrow('IPM [099]: Tomador invalido');
  });
});

describe('parseCancelResponse', () => {
  it('returns sucesso true on codigo 000', () => {
    const result = parseCancelResponse(successEmitXml);
    expect(result.sucesso).toBe(true);
  });

  it('returns sucesso false on error codigo', () => {
    const result = parseCancelResponse(errorXml);
    expect(result.sucesso).toBe(false);
    expect(result.mensagem).toContain('Tomador invalido');
  });
});

describe('parseQueryResponse', () => {
  it('throws on not found text', () => {
    expect(() => parseQueryResponse(notFoundText)).toThrow('Nenhuma nota fiscal encontrada');
  });

  it('returns query result on success', () => {
    const result = parseQueryResponse(successEmitXml);
    expect(result.numero_nfse).toBe('42');
    expect(result.cod_verificador).toBe('ABC123');
  });
});
