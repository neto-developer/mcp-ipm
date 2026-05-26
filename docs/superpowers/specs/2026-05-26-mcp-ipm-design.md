# MCP IPM NFS-e - Design Spec

**Data:** 2026-05-26
**Repo:** neto-developer/mcp-ipm
**Status:** aprovado

---

## 1. Objetivo

Servidor MCP que expoe 4 ferramentas para emissao de NFS-e via sistema IPM Atende.Net (municipio de Ibirama/SC). Roda em Docker para producao, localmente em desenvolvimento.

Documentacao tecnica base:
- NTE-35/2021 v2.8: emissao, cancelamento, consulta via multipart/form-data + XML
- NTE-122/2025 v1.5: extensao Reforma Tributaria (IBS/CBS), campos opcionais
- NTI-79/2026 v1.0: download PDF via WNERestPDFNFSe (JSON body, binario retorno)
- Implementacao PHP de referencia: `argonsolar-admin-backend/src/Fiscal/Controller/IpmController.php`

---

## 2. Arquitetura

**Transport:** STDIO (padrao MCP universal)
**Runtime:** Node.js 22 + TypeScript
**Imagem Docker:** `ghcr.io/neto-developer/mcp-ipm:latest` (base node:22-alpine)
**Registro:** GitHub Container Registry (GHCR)

```
Client MCP (Claude Code / OpenCode / Codex)
    |
    | STDIO (stdin/stdout)
    v
[Docker: ghcr.io/neto-developer/mcp-ipm]
    |
    | HTTPS + Basic Auth + PHPSESSID cookie
    v
IPM Atende.Net Web Service (ws-ibirama.atende.net)
```

**PHPSESSID:** cacheado em memoria no processo. Reconecta automaticamente em caso de sessao expirada (1 retry antes de falhar).

---

## 3. Estrutura do Repositorio

```
neto-developer/mcp-ipm/
├── src/
│   ├── index.ts              # entry point, MCP server STDIO init
│   ├── config.ts             # leitura e validacao de env vars
│   ├── tools/
│   │   ├── emit.ts           # tool: emitir_nfse
│   │   ├── cancel.ts         # tool: cancelar_nfse
│   │   ├── query.ts          # tool: consultar_nfse
│   │   └── pdf.ts            # tool: download_pdf
│   └── ipm/
│       ├── client.ts         # HTTP client, Basic Auth, session cookie
│       ├── xml-builder.ts    # montagem XML NFS-e (NTE-35 + NTE-122)
│       ├── xml-parser.ts     # parse retorno XML IPM
│       └── types.ts          # tipos TypeScript de todos os campos
├── bin/
│   └── install.js            # installer Node.js sem deps externas
├── Dockerfile
├── docker-compose.yml        # uso em desenvolvimento local
├── .env.example
├── install.sh                # curl wrapper -> bin/install.js
├── install.ps1               # irm wrapper -> bin/install.js
├── package.json
├── tsconfig.json
├── README.md
├── CONTRIBUTING.md
└── docs/
    └── superpowers/specs/
        └── 2026-05-26-mcp-ipm-design.md
```

---

## 4. Configuracao (Env Vars)

| Variavel | Obrigatoria | Descricao |
|---|---|---|
| `NFSE_USER` | sim | CPF/CNPJ do prestador (somente digitos) |
| `NFSE_PASS` | sim | Senha do prestador no IPM |
| `NFSE_CADASTRO` | sim | Codigo de cadastro do prestador no sistema IPM |
| `NFSE_CIDADE` | sim | Codigo TOM da cidade do prestador (Ibirama/SC = 8135) |
| `NFSE_BASE_URL` | nao | URL NFS-e (default: `https://ws-ibirama.atende.net/?pg=rest&service=WNERestServiceNFSe`) |
| `NFSE_PDF_URL` | nao | URL PDF (default: mesma base com `service=WNERestPDFNFSe`) |
| `NFSE_TEST_MODE` | nao | `true` injeta `<nfse_teste>1</nfse_teste>` e prefixo TESTE no identificador |
| `NFSE_SSL_VERIFY` | nao | `false` desabilita verificacao SSL (util para ambientes dev com cert self-signed) |

Startup valida obrigatorias e falha rapido com mensagem clara se alguma estiver faltando.

---

## 5. Ferramentas MCP

### 5.1 `emitir_nfse`

`<identificador>` e gerado automaticamente pelo servidor (UUID). Em modo teste, formato: `TESTE_<uuid>_<timestamp>`.

**Obrigatorios:**
- `valor_total: number`
- `discriminacao: string` - descricao do servico (campo `<descritivo>` no XML)
- `codigo_atividade: string` - codigo de atividade IPM (ex: "101401")
- `codigo_item_lista_servico: string` - codigo LC 116/2003 (ex: "140101")
- `tomador_cpfcnpj: string` - somente digitos
- `tomador_tipo: 'F' | 'J'` - pessoa fisica ou juridica
- `tomador_razao_social: string` - em maiusculas
- `tomador_email: string`

**Opcionais - Tomador:**
- `tomador_nome_fantasia: string`
- `tomador_ie: string` - inscricao estadual
- `tomador_cidade_tom: string` - codigo TOM da cidade do tomador (lookup do municipio)
- `tomador_logradouro: string`
- `tomador_numero: string`
- `tomador_complemento: string`
- `tomador_bairro: string`
- `tomador_cep: string` - somente digitos
- `tomador_uf: string`
- `tomador_ponto_referencia: string`
- `tomador_ddd_fone: string`
- `tomador_fone: string`
- `tomador_ddd_fone_comercial: string`
- `tomador_fone_comercial: string`

**Opcionais - Item/Servico:**
- `codigo_nbs: string` - Nomenclatura Brasileira de Servicos (NTE-122, ex: "118032900")
- `aliquota_iss: number` - percentual ISS (default: 5.0)
- `situacao_tributaria: string` - codigo situacao tributaria (default: "0")
- `valor_tributavel: number` - default = valor_total
- `valor_deducao: number` - default: 0
- `valor_issrf: number` - ISS retido na fonte, default: 0
- `tributa_municipio_prestador: 'S' | 'N'` - default: 'S'
- `tributa_municipio_tomador: 'S' | 'N'` - default: 'N'
- `valor_desconto_incondicional: number` - NTE-122

**Opcionais - Pagamento:**
- `observacao_nf: string` - observacoes/dados bancarios no campo `<observacao>` do `<nf>`
- `tipo_pagamento: string` - default: "2" (a prazo)
- `parcelas: Array<{ numero: number, valor: number, data_vencimento: string }>` - formato data: "dd/mm/yyyy"

**Opcionais - Reforma Tributaria (NTE-122):**
- `ibscbs: object` - `{ finNFSe, indFinal, cIndOp, tpOper, CST, cClassTrib }` - bloco `<IBSCBS>`
- `pis_cofins: object` - `{ cst, base_calculo, aliquota_pis, aliquota_cofins }`

**Retorno:** `{ numero_nfse, serie_nfse, link_nfse, cod_verificador, data_emissao, hora_emissao, situacao }`

### 5.2 `cancelar_nfse`

**Obrigatorios:**
- `numero: string`
- `serie: string`
- `observacao: string` - motivo do cancelamento

Prestador (`<cpfcnpj>` e `<cidade>`) vem de env vars `NFSE_USER` e `NFSE_CIDADE`.

**Retorno:** `{ sucesso: boolean, mensagem: string }`

### 5.3 `consultar_nfse`

Dois modos mutuamente exclusivos. Regra: se `codigo_autenticidade` fornecido, usa Modo A; senao, `numero` + `serie` obrigatorios (Modo B). `<cadastro>` no XML do Modo B sempre vem de `NFSE_CADASTRO` (env var). Se nenhum fornecido ou mistura invalida, retorna erro descritivo.

**Modo A - por autenticidade:**
- `codigo_autenticidade: string`

**Modo B - por numero:**
- `numero: string`
- `serie: string` - default: "1"

**Retorno:** dados da NFS-e parseados como objeto JSON (numero, serie, cod_verificador, situacao, valor_total, data_emissao, link_nfse, dados_tomador)

### 5.4 `download_pdf`

**Obrigatorios:**
- `numero: string`

**Opcionais:**
- `serie_codigo: string`
- `serie_tipo: string`

`Prestador.cadastro` vem de `NFSE_CADASTRO` (env var, nao parametro).

**Retorno:** `{ pdf_base64: string, filename: string }` - filename formato: `nfse-<numero>.pdf`

---

## 6. Cliente HTTP IPM

**Autenticacao:** `Authorization: Basic base64(NFSE_USER:NFSE_PASS)`

**NFS-e (emit/cancel/query):**
- Method: POST
- Content-Type: multipart/form-data
- Campo `xml`: arquivo XML com filename `nfse.xml`, Content-Type `text/xml`
- Cookie: `PHPSESSID=<valor>` (cacheado em memoria apos primeiro request bem-sucedido)

**PDF:**
- Method: POST
- Content-Type: application/json
- Body: `{ "Prestador.cadastro": NFSE_CADASTRO, "numero": "...", ... }`

**Encoding obrigatorio (descoberto na implementacao PHP de referencia):**
- XML enviado: UTF-8 -> ISO-8859-1 (`latin1`) antes de enviar
- Resposta recebida: ISO-8859-1 -> UTF-8 antes de parsear
- Valores numericos: separador decimal e virgula (ex: `1234,56` nao `1234.56`)

**Tratamento de erros:**
- Resposta XML com `<codigo>` != "000" = erro de negocio, retorna mensagem IPM ao caller
- Resposta texto `"Nenhuma nota fiscal encontrada."` = not found, retorna erro descritivo
- HTTP 4xx/5xx = erro de comunicacao
- PHPSESSID expirado: retry 1x com nova autenticacao antes de falhar

---

## 7. Script de Instalacao

Padrao identico ao caveman (JuliusBrussee/caveman):

**install.sh** (macOS/Linux/WSL):
```bash
curl -fsSL https://raw.githubusercontent.com/neto-developer/mcp-ipm/main/install.sh | bash
```

**install.ps1** (Windows):
```powershell
irm https://raw.githubusercontent.com/neto-developer/mcp-ipm/main/install.ps1 | iex
```

Ambos sao thin wrappers que delegam para `bin/install.js` (Node.js >= 18, zero deps externas).

**Fluxo do install.js:**
1. Verifica Node >= 18 e Docker instalado
2. `docker pull ghcr.io/neto-developer/mcp-ipm:latest`
3. Detecta clientes MCP instalados (Claude Code, OpenCode, Codex) - exibe lista numerada igual ao caveman
4. Prompt interativo: usuario escolhe quais clientes configurar (ou todos)
5. Prompt interativo para credenciais: NFSE_USER, NFSE_PASS, NFSE_CADASTRO, NFSE_CIDADE
6. Salva em `~/.config/mcp-ipm/.env` (Linux/Mac) ou `%APPDATA%\mcp-ipm\.env` (Windows)
7. Registra MCP em cada cliente selecionado (idempotente: verifica antes de inserir)
8. Instrucoes finais: reiniciar cliente MCP

**Deteccao de clientes:**
- Claude Code: verifica binario `claude` no PATH, edita `~/.claude/settings.json` (chave `mcpServers`)
- OpenCode: verifica binario `opencode` no PATH ou dir `~/.config/opencode/`, edita `opencode.json`
- Codex: verifica binario `codex` no PATH

**Config MCP inserida (Claude Code):**
```json
{
  "mcpServers": {
    "mcp-ipm": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "--env-file", "<config-path>/.env", "ghcr.io/neto-developer/mcp-ipm:latest"]
    }
  }
}
```

**Flags suportadas:**
- `--dry-run`: mostra acoes sem executar
- `--force`: reinstala mesmo se ja detectado
- `--only claude|opencode|codex`: instala somente em cliente especifico
- `--uninstall`: remove config de todos clientes detectados

---

## 8. Docker

**Dockerfile (multi-stage):**
```
Stage 1 (builder): node:22-alpine, instala deps, compila TypeScript
Stage 2 (runner): node:22-alpine, copia dist/, sem devDependencies
```

**docker-compose.yml (dev local):**
```yaml
services:
  mcp-ipm:
    build: .
    env_file: .env
    stdin_open: true
    tty: true
```

**Publicacao:** GitHub Actions publica automaticamente em GHCR a cada push na main.

---

## 9. Repositorio

**Arquivos de qualidade:**
- `README.md`: badges (Docker pulls, versao), instalacao em 1 comando, tabela de env vars, lista de tools com parametros
- `CONTRIBUTING.md`: setup dev, como testar com NFSE_TEST_MODE, como fazer build Docker local
- `.env.example`: todas vars com comentarios e exemplos
- `.github/workflows/docker-publish.yml`: build + push GHCR na main com versionamento por tag git
- `.github/workflows/ci.yml`: typecheck + lint em PRs

---

## 10. Decisoes Tecnicas

| Decisao | Escolha | Motivo |
|---|---|---|
| Transport | STDIO | Universal, zero portas, padrao MCP |
| Linguagem | TypeScript | SDK MCP oficial, tipagem forte |
| XML build | template strings | Sem dep externa, controle total sobre encoding |
| XML parse | `fast-xml-parser` | Mais rapido que xml2js, API mais simples |
| HTTP client | `fetch` global nativo | Built-in no Node 22, zero deps extras |
| Encoding | ISO-8859-1 I/O | Requisito IPM confirmado na implementacao PHP |
| Decimal | virgula (`1234,56`) | Requisito IPM confirmado na implementacao PHP |
| Session | memoria (Map no client) | Simples, correto para processo unico STDIO |
| identificador | UUID auto-gerado | Garante unicidade sem depender do caller |
| IBS/CBS | opcional agora | NTE-122 facultativo ate tornar obrigatorio |
| SSL verify | configuravel via env | IPM pode ter cert issues em alguns ambientes |
