# Registro de ações — CELC Financeiro

Este arquivo registra tentativas, falhas e resultados observáveis para evitar repetição de erros.

## 2026-09-01 — correção definitiva da atualização online

1. **Auditoria da instalação — sucesso.** O processo instalado estava aberto com `resources.neu` de hash `721157046F505FD5D4AA46F7CFD52EC5E52894CE3AD8D5A53795104F80F97EA9`; o banco externo tinha hash `F16B1CA039D934431EDF3596AE8E25A34F28A3CF34F20A22FB9BB91D4B39D92F`; o manifesto público indicava 0.2.10.
2. **Diagnóstico — sucesso.** Confirmado que `Neutralino.filesystem.readBinaryFile` devolve `ArrayBuffer` e que a versão instalada 0.2.8 o rejeita antes da leitura do SQLite.
3. **Teste novo de backup, primeira execução — falha.** O SQLite criado dentro de `vm` retornou um `Uint8Array` de outro realm JavaScript; o fixture não representava o contexto da janela do Neutralino.
4. **Correção do fixture — sucesso.** O conteúdo exportado foi normalizado para `Uint8Array` do contexto principal e convertido em `ArrayBuffer` antes da validação.
5. **Suíte automatizada — sucesso.** 85 asserções aprovadas; o novo teste valida SQLite real em `ArrayBuffer`, `Uint8Array`, banco sem movimentações e cabeçalho inválido; 39 arquivos textuais aprovados em UTF-8.
6. **Validação de sintaxe, primeira tentativa — falha operacional.** Foi chamado por engano `tools/validate-syntax.mjs`, arquivo inexistente; nenhum arquivo do projeto foi alterado por essa tentativa.
7. **Validação de sintaxe, segunda tentativa — sucesso.** 26 arquivos JavaScript aprovados com `node --check`.
8. **Graphify — sucesso.** `node tools/graphify.js` executado após a mudança; canais e invariantes permaneceram sem alteração estrutural.
9. **Build Neutralino 0.2.11 — sucesso.** `resources.neu` gerado com a versão 0.2.11 presente no pacote e SHA-256 `9797CABAE2B9323B516A7BC1AAD625C4D2C1655DD0F2257663E79473F3F15269`.
10. **Compilação NSIS, primeira tentativa — falha operacional.** A chamada sem o operador do PowerShell produziu erro de parsing; o instalador não foi executado.
11. **Compilação NSIS, segunda tentativa — sucesso.** Setup 0.2.11 compilado como UTF-8; metadados `FileVersion`, `ProductVersion` e `OriginalFilename` confirmados; SHA-256 `5EA4778F1B2490F7937AAC6C8C4123BDF584C4328E77BA84C0CA1B9297C01BC8`. O Setup não foi executado, conforme determinação do cliente.
12. **Pacote de release — sucesso.** `Release/v0.2.11/` contém Setup, `resources.neu`, `latest.json`, `SHA256SUMS.txt` e `RELEASE.md`.
13. **Prova online em instalação existente — pendente.** Será registrada após a publicação e o ciclo real 0.2.10 → 0.2.11.
