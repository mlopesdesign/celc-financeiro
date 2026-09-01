# Auditoria — toast e atualização pelo GitHub (2026-09-01)

## Escopo

Auditoria somente de leitura do toast e do fluxo de atualização online da versão `0.2.6`. Nenhum código, build, instalador ou release foi alterado.

## Tentativas e resultados

| Ação | Resultado |
|---|---|
| Leitura de `ESTADO.md` e `GRAPHIFY.md` | Concluída; o estado registra duas tentativas de atualização sem aceite do cliente. |
| Regeneração de `GRAPHIFY.md` | Concluída com `node tools/graphify.js`; não houve mudança estrutural detectável no mapa. |
| Consulta do manifesto público | Sucesso; retornou `0.2.6`, `applicationId` correto e URL de `resources.neu`. |
| HEAD dos anexos públicos | Sucesso; `latest.json` e `resources.neu` existem. Ambos são servidos pelo asset do GitHub como `application/octet-stream`. |
| `node tests/atualizador.mjs` | Sucesso: 9 asserções. |
| `node tests/utf8.mjs` | Sucesso: 38 arquivos validados em UTF-8. |
| `node --check` dos três módulos auditados | Sucesso. |

## Achados

### A1 — falha de instalação pode escapar sem toast (alta confiança)

Em `src/js/backend/atualizador.js:23`, `banco.aguardarPersistencia()` e `criarBackup()` são executados antes do `try` que envolve o download. Em `src/js/backend/core/backup.js:20-23`, a leitura/validação/gravação do backup pode rejeitar a Promise. Em `src/js/app.js:319-325`, o clique de instalação não possui `try/catch`; portanto uma exceção nessa etapa vira rejeição não tratada e não chama `aviso()`. O usuário pode clicar, não ver erro humano e concluir que nada aconteceu.

### A2 — o atualizador encerra o app sem confirmação do processo auxiliar (alta confiança)

Em `src/js/backend/atualizador.js:24`, o app inicia um PowerShell desacoplado, que espera dois segundos, move o download e inicia o executável; imediatamente depois chama `Neutralino.app.exit(0)`. Não há validação posterior de que o `.download` foi criado, que o `Move-Item` terminou, que `resources.neu` mudou ou que o executável reabriu. Como o processo auxiliar é `background:true`, qualquer erro de permissão, arquivo bloqueado ou caminho inválido fica invisível para a interface. Esse é o ponto mais compatível com “clicar não produziu atualização observável”.

### A3 — o toast tem regras duplicadas e conflitantes (alta confiança)

`.toast-celc` é definido em `src/css/styles.css:3` e novamente em `src/css/styles.css:9`, além de `src/css/configuracoes.css:1-3`. A última folha é carregada depois de `styles.css` em `src/index.html:1` e usa `!important`, forçando `bottom:68px`, `opacity:1`, `transform:none` e `pointer-events:none`. Isso torna o comportamento dependente da ordem das folhas e impede o ciclo visual de entrada/saída previsto pela regra `.toast-celc.show`.

### A4 — o fluxo de instalação não confirma sucesso visual (alta confiança)

Em `src/js/app.js:322-324`, uma resposta `ok` apenas atualiza `#statusAtualizacao`; nenhum toast de sucesso é exibido. Em seguida, o backend encerra o processo. Assim, mesmo quando o comando é aceito, o usuário não recebe confirmação observável na tela antes do fechamento.

### A5 — o manifesto público não tem o Content-Type documentado para o updater nativo (média confiança)

O manifesto público de `v0.2.6` é servido pelo GitHub Release como `application/octet-stream`. A documentação do Neutralino exige `application/json` para `Neutralino.updater.checkForUpdates`. O código atual evita esse problema por usar `curl.exe` e `JSON.parse`, mas qualquer fallback/caminho que use o updater nativo padrão rejeitaria o manifesto.

## Cobertura ausente

`tests/atualizador.mjs` cobre apenas comparação de versões, parsing da resposta do `curl` e erro de consulta. Não cobre backup válido, download para o caminho real, troca do `resources.neu`, processo bloqueado, reabertura, persistência do banco ou atualização partindo de uma instalação existente.

## Conclusão

O endpoint e os anexos públicos estão disponíveis. O problema principal não está comprovadamente no GitHub; está no trecho local de instalação desacoplada, que encerra o app sem confirmação e pode falhar antes do bloco de tratamento que exibiria o toast. O problema visual é agravado por três definições conflitantes do toast e pela ausência de uma mensagem de sucesso antes do encerramento.

## Limite da auditoria

Não foi feita instalação/atualização real em uma máquina cliente, conforme a pausa registrada em `ESTADO.md`. Portanto esta auditoria identifica causas de código e lacunas de validação, mas não declara a atualização funcional.
