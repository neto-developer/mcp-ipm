# Contributing

## Setup

```bash
git clone https://github.com/neto-developer/mcp-ipm
cd mcp-ipm
npm install
cp .env.example .env
# preencher .env com suas credenciais reais
```

## Desenvolvimento

```bash
npm run dev        # MCP server em modo watch (tsx)
npm test           # rodar testes unitarios
npm run typecheck  # verificar tipos TypeScript
npm run build      # compilar para dist/
```

## Modo teste

Adicionar `NFSE_TEST_MODE=true` no `.env`. A NFS-e sera emitida com prefixo `TESTE_` no identificador e tag `<nfse_teste>1</nfse_teste>` no XML - nao registrada oficialmente no sistema fiscal.

## Build Docker local

```bash
docker build -t mcp-ipm:local .
docker run -i --rm --env-file .env mcp-ipm:local
```

## Estrutura do projeto

```
src/
  config.ts          - leitura e validacao de env vars
  index.ts           - entry point MCP server (STDIO transport)
  ipm/
    types.ts         - interfaces TypeScript (IpmConfig, EmitInput, etc.)
    xml-builder.ts   - monta XML para enviar ao IPM
    xml-parser.ts    - faz parse do XML de retorno do IPM
    client.ts        - HTTP client (Basic Auth, PHPSESSID, ISO-8859-1)
    __tests__/       - testes unitarios
  tools/
    emit.ts          - tool: emitir_nfse
    cancel.ts        - tool: cancelar_nfse
    query.ts         - tool: consultar_nfse
    pdf.ts           - tool: download_pdf
bin/
  install.js         - script de instalacao (Node.js, zero deps)
```

## Encoding

O sistema IPM usa ISO-8859-1. O client.ts converte automaticamente:
- UTF-8 -> ISO-8859-1 antes de enviar XML
- ISO-8859-1 -> UTF-8 ao receber resposta

## Decimais

IPM usa virgula como separador decimal: `1234,56` (nao `1234.56`). O xml-builder.ts trata isso automaticamente.
