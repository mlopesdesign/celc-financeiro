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
13. **Prova online em instalação existente — pendente.** Será registrada após a publicação e o ciclo real 0.2.10 → 0.2.12.
14. **Versão no rodapé — sucesso.** Após pedido do cliente, a versão passou a aparecer no rodapé do menu; como 0.2.11 já estava publicada, a alteração foi versionada como 0.2.12 e a prova online foi redirecionada para 0.2.10 → 0.2.12.
15. **Build e pacote 0.2.12 — sucesso.** Suíte com 85 asserções, UTF-8, 26 verificações de sintaxe e Graphify aprovados; `resources.neu` contém a versão e o identificador do rodapé, com SHA-256 `EC774AFB62589AB7AEF708B0FF8AF7968E0A595DC7A4128D70D288913DA7B0FD`. O Setup foi apenas compilado e teve metadados conferidos, sem execução; SHA-256 `B54A7656411BFC87C2561A9EAD341C72A1E0BE58C5EEB40129329614FC4D6FD7`.
16. **Leitura direta do banco instalado — atenção.** O SQLite externo contém zero linhas em `lancamentos` e `auditoria` e uma credencial em `acesso`; a tela após reabertura também mostrou zero movimentações. Nenhum lançamento artificial foi criado.
17. **Persistência controlada — sucesso.** Foi criado o lançamento reversível `TESTE TECNICO ATUALIZACAO 0.2.12`, no valor de R$ 0,01; leitura direta confirmou uma linha em `lancamentos`, uma em `auditoria` e mudança do hash do SQLite para `4A9973FE4ED4768956D58C5D149D117FEF0DAB2063C9F084E5B83D13F487076D`.
18. **Prova online 0.2.10 → 0.2.12 — falha diagnosticada.** O aplicativo encontrou 0.2.12, criou backup válido de 57.344 bytes e baixou `resources.neu.download` com o hash público correto `EC774AFB62589AB7AEF708B0FF8AF7968E0A595DC7A4128D70D288913DA7B0FD`, mas não fechou. A causa confirmada foi `Neutralino.os.getPath('exe')`: a API aceita somente nomes de pastas e rejeita `exe`.
19. **Correção 0.2.13 — em preparação.** O reinício passa a usar `${NL_PATH}\\CELC Financeiro.exe`; teste unitário cobre caminho com e sem separador e rejeita pasta ausente.
20. **Caixa diário/competência — sucesso.** O detalhamento mantém todas as despesas abertas retornadas pela API, identifica categorias e recorrências, oferece mês de referência padrão no mês corrente e grava a competência escolhida no lançamento e no caixa. A validação antecipada impede gravação parcial para mês inválido.
21. **Testes do Caixa diário — sucesso.** O mock foi atualizado para a coluna `competencia`; `npm.cmd test` passou com 21 asserções específicas do Caixa, incluindo mês anterior e mês inválido, 39 arquivos UTF-8 validados.
22. **Auditoria comparativa do Salgueiro — somente leitura.** Foi localizado `E:\Projetos\LOJA FISICA SALGUEIRO V2`; a implementação usa `resources.neu.new`, `.bak`, script PowerShell e `cmd /c start` desacoplado antes do `app.exit`. Nenhum arquivo do Salgueiro foi alterado.
23. **Correção 0.2.14 — em preparação.** O aplicador do CELC foi alinhado ao fluxo do Salgueiro, com script temporário, espera pelo desbloqueio, rollback e reabertura pelo executável em `NL_PATH`; o comando desacoplado ganhou cobertura unitária.
