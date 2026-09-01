# GRAPHIFY — CELC Financeiro

> Gerado automaticamente por `node tools/graphify.js`. Não editar manualmente.

## Arquivos mapeados

- `src/js/app.js`
- `src/js/auth.js`
- `src/js/backend/ambiente.js`
- `src/js/backend/atualizador.js`
- `src/js/backend/core/atualizador.js`
- `src/js/backend/core/backup.js`
- `src/js/backend/core/categorias.js`
- `src/js/backend/core/escolar.js`
- `src/js/backend/core/lancamentos.js`
- `src/js/backend/core/relatorios.js`
- `src/js/backend/db.js`
- `src/js/backend/servidor.js`
- `src/js/bootstrap.js`
- `src/js/neutralino.js`
- `src/js/vendor/sql-wasm.js`

## Canais encontrados

| Canal | Origem |
|---|---|
| `painel:resumo` | src/js/app.js |
| `lancamentos:listar` | src/js/app.js |
| `caixa:resumo` | src/js/app.js |
| `caixa:registrar` | src/js/app.js |
| `lancamentos:listar` | src/js/app.js |
| `caixa:pagarDespesa` | src/js/app.js |
| `devedores:listar` | src/js/app.js |
| `devedores:baixar` | src/js/app.js |
| `categorias:listar` | src/js/app.js |
| `relatorios:resumo` | src/js/app.js |
| `categorias:listar` | src/js/app.js |
| `lancamentos:listar` | src/js/app.js |
| `lancamentos:baixar` | src/js/app.js |
| `lancamentos:excluir` | src/js/app.js |
| `relatorios:exportar` | src/js/app.js |
| `relatorios:exportarPdf` | src/js/app.js |
| `categorias:criar` | src/js/app.js |
| `categorias:editar` | src/js/app.js |
| `caixa:registrar` | src/js/app.js |
| `caixa:excluir` | src/js/app.js |
| `devedores:registrar` | src/js/app.js |
| `categorias:arquivar` | src/js/app.js |
| `categorias:excluir` | src/js/app.js |
| `acesso:trocarSenha` | src/js/app.js |
| `backup:criar` | src/js/app.js |
| `backup:restaurar` | src/js/app.js |
| `backup:criar` | src/js/app.js |
| `categorias:listar` | src/js/app.js |
| `lancamentos:editar` | src/js/app.js |
| `lancamentos:criar` | src/js/app.js |
| `lancamentos:recorrencias` | src/js/app.js |
| `lancamentos:atualizarVencidos` | src/js/app.js |
| `painel:resumo` | src/js/backend/servidor.js |
| `lancamentos:listar` | src/js/backend/servidor.js |
| `lancamentos:criar` | src/js/backend/servidor.js |
| `lancamentos:editar` | src/js/backend/servidor.js |
| `lancamentos:baixar` | src/js/backend/servidor.js |
| `lancamentos:excluir` | src/js/backend/servidor.js |
| `lancamentos:recorrencias` | src/js/backend/servidor.js |
| `lancamentos:atualizarVencidos` | src/js/backend/servidor.js |
| `caixa:resumo` | src/js/backend/servidor.js |
| `caixa:listar` | src/js/backend/servidor.js |
| `caixa:registrar` | src/js/backend/servidor.js |
| `caixa:pagarDespesa` | src/js/backend/servidor.js |
| `caixa:excluir` | src/js/backend/servidor.js |
| `devedores:listar` | src/js/backend/servidor.js |
| `devedores:registrar` | src/js/backend/servidor.js |
| `devedores:baixar` | src/js/backend/servidor.js |
| `categorias:listar` | src/js/backend/servidor.js |
| `categorias:criar` | src/js/backend/servidor.js |
| `categorias:editar` | src/js/backend/servidor.js |
| `categorias:arquivar` | src/js/backend/servidor.js |
| `categorias:excluir` | src/js/backend/servidor.js |
| `backup:criar` | src/js/backend/servidor.js |
| `backup:restaurar` | src/js/backend/servidor.js |
| `relatorios:resumo` | src/js/backend/servidor.js |
| `relatorios:exportar` | src/js/backend/servidor.js |
| `relatorios:exportarPdf` | src/js/backend/servidor.js |
| `acesso:trocarSenha` | src/js/backend/servidor.js |
| `node:fs` | src/js/vendor/sql-wasm.js |
| `node:crypto` | src/js/vendor/sql-wasm.js |

## Invariantes

- Banco fora do diretório atualizável do aplicativo.
- Atualização exige backup válido e versão superior.
- Regras financeiras ficam no backend/core, nunca na interface.

