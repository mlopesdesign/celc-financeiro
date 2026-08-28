# Fluxo obrigatório de release — CELC Financeiro

Cada entrega publicada segue este fluxo; não existe atualização sem versão e sem artefatos rastreáveis.

1. Implementar e validar a mudança.
2. Aumentar a versão em `neutralino.config.json`, `src/js/app.js`, `src/js/backend/ambiente.js` e `package.json`.
3. Atualizar `AGENTS.md`, `GRAPHIFY.md`, testes e documentação.
4. Gerar o aplicativo e o Setup.
5. Executar `node tools/preparar-release.mjs`.
6. Criar no GitHub a tag indicada e uma Release com o título fornecido em `Release/vX.Y.Z/RELEASE.md`.
7. Anexar `resources.neu`, `latest.json`, `SHA256SUMS.txt` e o Setup.
8. Conferir que `latest.json` aponta para a tag publicada e testar **Configurações > Atualização**.

## Artefatos obrigatórios

| Artefato | Uso |
|---|---|
| `resources.neu` | Atualização automática do aplicativo já instalado. |
| `latest.json` | Manifesto que informa a versão e a URL do recurso. |
| `SHA256SUMS.txt` | Conferência de integridade antes do upload. |
| `RELEASE.md` | Título, tag, notas e instruções de publicação. |
| `CELC-Financeiro-Setup-X.Y.Z.exe` | Instalação inicial em novos computadores. |

O banco nunca é anexado ou substituído em uma release.
