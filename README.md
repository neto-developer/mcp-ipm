# mcp-ipm

MCP server para emissao de NFS-e via IPM Atende.Net (municipio de Ibirama/SC).

![CI](https://github.com/neto-developer/mcp-ipm/actions/workflows/ci.yml/badge.svg)
![Docker](https://ghcr-badge.egpl.dev/neto-developer/mcp-ipm/size)

## Instalacao

**macOS/Linux/WSL:**
```bash
curl -fsSL https://raw.githubusercontent.com/neto-developer/mcp-ipm/main/install.sh | bash
```

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/neto-developer/mcp-ipm/main/install.ps1 | iex
```

O script detecta e configura automaticamente Claude Code, OpenCode e Codex.

## Configuracao

| Variavel | Obrigatoria | Descricao |
|---|---|---|
| `NFSE_USER` | sim | CPF/CNPJ do prestador (somente digitos) |
| `NFSE_PASS` | sim | Senha do prestador no IPM |
| `NFSE_CADASTRO` | sim | Codigo de cadastro no sistema IPM |
| `NFSE_CIDADE` | sim | Codigo TOM da cidade (Ibirama/SC = 8135) |
| `NFSE_BASE_URL` | nao | URL customizada do Web Service NFS-e |
| `NFSE_PDF_URL` | nao | URL customizada do servico PDF |
| `NFSE_TEST_MODE` | nao | `true` para modo teste (nao registra oficialmente) |
| `NFSE_SSL_VERIFY` | nao | `false` desabilita verificacao SSL |
| `NFSE_LOG_DIR` | nao | Diretorio de logs e downloads (default: `./nfse-logs`) |
| `NFSE_DEBUG` | nao | `true` loga XML e HTTP no stderr |

## Ferramentas

### `emitir_nfse`

Emite uma NFS-e no sistema IPM.

**Obrigatorios:** `valor_total`, `discriminacao`, `codigo_atividade`, `codigo_item_lista_servico`, `tomador_cpfcnpj`, `tomador_tipo` (F/J), `tomador_razao_social`, `tomador_email`

**Opcionais:** endereco completo do tomador, `aliquota_iss`, `valor_deducao`, `parcelas`, `codigo_nbs`, `ibscbs` (Reforma Tributaria IBS/CBS), `pis_cofins`, e mais.

**Retorna:** `{ numero_nfse, serie_nfse, link_nfse, cod_verificador, data_emissao, hora_emissao, situacao }`

### `cancelar_nfse`

Cancela uma NFS-e emitida.

**Obrigatorios:** `numero`, `serie`, `observacao` (motivo)

**Retorna:** `{ sucesso, mensagem }`

### `consultar_nfse`

Consulta uma NFS-e por codigo de autenticidade ou por numero+serie. Salva o XML da nota localmente.

**Modo A:** `codigo_autenticidade`
**Modo B:** `numero` + `serie` (default: "1")

**Retorna:** `{ numero_nfse, serie_nfse, cod_verificador, chave_acesso_nacional, data_emissao, hora_emissao, situacao, valor_total, valor_desconto, link_nfse, tomador_nome, tomador_cpfcnpj, tomador_email, discriminacao, codigo_atividade, xml_local }`

### `download_pdf`

Faz download do PDF da NFS-e e salva localmente. Realiza uma consulta interna para nomear o arquivo corretamente.

**Obrigatorios:** `numero`

**Retorna:** `{ pdf_local }` com caminho absoluto do arquivo salvo

## Desenvolvimento local

```bash
git clone https://github.com/neto-developer/mcp-ipm
cd mcp-ipm
npm install
cp .env.example .env
# preencher .env com suas credenciais
npm run dev
```

## Documentacao tecnica

- [NTE-35/2021 v2.8](docs/NTE-35-2021-v2.8-Integracao-NFSe-IPM.pdf) - Spec principal NFS-e IPM
- [NTE-122/2025 v1.5](docs/NTE-122-2025-v1.5-Reforma-Tributaria-IBS-CBS.pdf) - Extensao Reforma Tributaria (IBS/CBS)
- [NTI-79/2026 v1.0](docs/NTI-79-2026-v1.0-Download-PDF-NFSe.pdf) - Download PDF via WNERestPDFNFSe
