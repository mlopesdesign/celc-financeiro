# AUDITORIA TÉCNICA — CELC FINANCEIRO (SISTEMA DE GESTÃO FINANCEIRA)

Data: 2026-11-10
Versão auditada: 0.2.32 (`Z:\SISTEMA DE GESTÃO FINANCEIRA`)
Auditor: Claude, auditoria somente leitura a pedido do Marcio. Nenhum código, banco ou release foi alterado.
Natureza deste arquivo: **ordem de serviço de correção**. Ele substitui, como referência, a auditoria anterior em `audit-output/`, que não é confiável como aprovação (ver seção 6).

---

## 0. REGRAS OBRIGATÓRIAS PARA QUEM FOR CORRIGIR (Codex)

1. Siga este arquivo item por item, na ordem da seção 4. Não reinterprete, não amplie o escopo e não "aproveite para melhorar" nada que não esteja pedido.
2. Para cada item:
   - escreva primeiro o teste que reproduz o bug e mostre o teste falhando;
   - corrija;
   - mostre o mesmo teste passando.
   - Item sem teste não está corrigido.
3. Testes de cálculo e de persistência rodam com o **sql.js real** (`src/js/vendor/sql-wasm.*`) e passam pela API de produção (`criarApiFinanceira` + `abrirBancoSeguro`). Banco simulado à mão não prova nada.
4. Todos os testes rodam duas vezes: com `TZ=America/Sao_Paulo` e o relógio fixado em **22h30**, e com `TZ=UTC`.
5. **Nenhum dado do cliente será alterado** sem autorização escrita do Marcio. Correções em registros existentes (seção 3) são feitas por um script que gera relatório antes e depois, rodado sobre uma **cópia** do banco, e só são aplicadas no banco real com aprovação.
6. Ao fechar cada bloco:
   - commit e tag no git;
   - atualize `ESTADO.md`;
   - regenere `GRAPHIFY.md`;
   - registre em `REGISTRO-DE-ACOES.md` (o que mudou, o teste que prova, o resultado);
   - marque o item aqui como `[CORRIGIDO vX.Y.Z — teste: caminho]`, sem apagar o texto do achado.
7. **Execute TODOS os blocos (P0 → P1 → P2 → P3 → P4) em sequência, sem parar e sem pedir confirmação entre eles.** O Marcio não vai fazer etapa nenhuma. Ao final, publique uma única release seguindo o fluxo obrigatório do `AGENTS.md`. Só publique se todos os testes passarem.
   - **Única pausa permitida:** aplicar correção em registros do banco REAL do cliente. Gere o script e o relatório antes/depois sobre a cópia, entregue os dois e não aplique no banco real. Todo o resto segue sem parar.
   - **Decisões já tomadas** (não pergunte):
     - **CALC-11:** mantenha os devedores fora do "A receber" e rotule na tela "A receber (exceto mensalidades de alunos)".
     - **UI-08:** adicione no fechamento de caixa o seletor de forma de pagamento, com padrão "Dinheiro".
8. **SENHA E LOGIN: NÃO MEXER.** Decisão do Marcio de 2026-11-10. Ficam proibidos:
   - alterar a senha `admin/admin123`, o `auth.js` e o `login.css`;
   - alterar a tela de login, a credencial gravada no banco e a rotina `acesso:*`;
   - criar troca obrigatória de senha ou limite de tentativas.
   - Os itens **SEG-01** e **SEG-05** estão **FORA DO ESCOPO**.
   - Na correção do CALC-01, o caminho de credencial (`salvarCredencial` / `acesso:trocarSenha`) não pode mudar de comportamento. Se a correção de `db.js` tocar nele por tabela, prove por teste que a senha atual continua funcionando igual.

---

## 1. RESUMO EXECUTIVO — "os relatórios estão furados?"

**Resposta curta: os números exibidos não merecem confiança. A conta dos relatórios está certa; os dados que chegam a ela é que entram errados.**

**Como foi verificado.** Montei um banco sql.js real com um cenário de três meses (dezembro/2025 a fevereiro/2026). O cenário inclui:
- pagamento parcial em duas datas;
- despesa de competência anterior paga no mês seguinte;
- recebimentos no caixa com e sem lançamento vinculado;
- pagamentos em dinheiro e Pix;
- alunos devedores com pagamento parcial e quitado;
- um lançamento excluído.

O resultado esperado foi calculado à mão e comparado com o dashboard, os relatórios, a exportação CSV e a exportação PDF:

- **64 conferências bateram.** Dashboard igual a relatório. Soma por categoria igual à soma por dia e à soma por forma de pagamento. Saldo final do mês igual ao saldo inicial do mês seguinte, inclusive na virada do ano. Nenhum recebimento contado duas vezes. Nenhum erro de centavo: o dinheiro é guardado como inteiro em centavos.
- **As divergências encontradas vêm de dados registrados errados ou deixados para trás.** Os números da tela ficam "estranhos" por estes motivos:

| # | Causa | Efeito no número exibido | ID |
|---|---|---|---|
| 1 | **Salvar despesa falha sempre** na 0.2.32 (confirmado de forma independente) | Despesas digitadas não entram; as saídas ficam menores do que a realidade | CALC-01 |
| 2 | A data "hoje" é calculada em **UTC** | Depois das 21h, o recebimento, a baixa e o fechamento de caixa caem no **dia seguinte** (no dia 31, no mês seguinte). A conta que vence hoje já aparece "vencida" | CALC-02, CALC-08, UI-02, UI-03 |
| 3 | Valor digitado "1.200" vira **R$ 1,20** | Lançamentos 1.000 vezes menores | UI-05 |
| 4 | Clique duplo **duplica** fechamento e lançamento | Entradas e saídas em dobro | UI-06 |
| 5 | Excluir ou editar uma entrada que veio do caixa ou de pagamento de aluno **deixa o registro do caixa órfão** | O caixa e o "dinheiro em mãos" continuam somando o valor antigo; o devedor continua "quitado" | CALC-03, CALC-04, CALC-13, UI-04 |
| 6 | Recorrência mensal **gera 31/02** e pula meses | A despesa fixa some de fevereiro; meses sem abrir o app ficam sem lançamento | CALC-05, CALC-06 |
| 7 | Digitar a descrição **sobrescreve o valor e a recorrência** | Lançamento com valor de outro, virando fixo mensal sem o usuário pedir | UI-07 |
| 8 | Renomear "Serviços e utilidades" **funde** com o caixa | Uma categoria absorve a outra | CALC-07 |
| 9 | A baixa de despesa força a forma **"Dinheiro"** | O "dinheiro em mãos" cai sem ter saído dinheiro | CALC-09 |
| 10 | Mensalidades de devedores **ficam fora** do "A receber" e da projeção | A projeção fica subestimada | CALC-11 |

**Achados graves fora dos cálculos:**
- **O login está desligado por CSS em todas as versões desde a 0.2.10.** Qualquer pessoa que abrir o programa vê e altera tudo (SEG-01).
- **Três falhas comprovadas de perda total do banco:** queda no meio da gravação, leitura bloqueada por antivírus/OneDrive, e falha de gravação que trava todas as gravações seguintes (DADOS-01, DADOS-02, DADOS-03).
- **As versões 0.2.30 a 0.2.32 não estão no git.** O arquivo `core/dashboard.js` nem está versionado (REL-01).

**Quantidade:** 4 críticos, 19 altos, 21 médios, 16 baixos.

**Testes:** `npm test` passa (15 grupos, nos fusos Sao_Paulo e UTC), mas **não cobre nenhum dos achados críticos**.

---

## 2. ACHADOS

Formato de cada achado: **ID — local — problema → cenário (com números) → correção exata.**

### 2.1 CRÍTICO

**CALC-01 — Salvar despesa sempre falha com "cannot commit - no transaction is active"; nada é gravado** [CORRIGIDO v0.2.33 — teste: tests/p0-persistencia.mjs]
- **Local:**
  - `src/js/backend/db.js:31`: `salvarConfiguracao`, `salvarCredencial` e `obterConfiguracao` usam o `executar` interno, que chama `persistir()`, que chama `sql.export()`.
  - `db.js:67-82` (`emTransacao`).
  - `src/js/backend/servidor.js:22`: `if(d.favorecido!==undefined)await salvarFavorecidoDespesa(...)`.
  - O formulário sempre envia `favorecido`, mesmo vazio (`app.js:305,551`).
- **Causa:** no sql.js, `export()` fecha e reabre o banco. Isso descarta a transação aberta, e o `COMMIT` falha.
- **Prova** (`/tmp/claude-0/gf-fin/audit-calc/b9b.mjs`, reconferida pelo auditor-chefe):
  ```
  sql.js puro: BEGIN; INSERT; export(); COMMIT → cannot commit - no transaction is active | linhas: 0
  favorecido=""             → EXCEÇÃO cannot commit ... | lançamentos no banco: 0
  favorecido="Fornecedor X" → EXCEÇÃO cannot commit ... | lançamentos no banco: 0
  ```
- **Também afetados:** `caixa:salvarContagem`. `acesso:trocarSenha` falhou em um dos dois roteiros (A CONFIRMAR).
- **Correção:**
  1. Dentro de `emTransacao`, toda escrita (inclusive `salvarConfiguracao` e `salvarCredencial`) usa o executor **sem persistir**. Exponha esses métodos chamando `banco.executar` em vez da closure interna.
  2. `persistir()` não exporta enquanto houver transação ativa (flag `transacaoAtiva`).
  3. Crie testes pela API real cobrindo: `despesas:salvar` com `favorecido:''`, `despesas:salvar` com `favorecido:'X'` e `caixa:salvarContagem`. Crie também um teste que comprove que o login com a senha atual continua funcionando igual. Não altere o fluxo de senha.
  4. Reproduza no executável Windows e registre o resultado.

**SEG-01 (= UI-01) — Login desativado na versão distribuída — [FORA DO ESCOPO: decisão do Marcio, não mexer em senha/login]**
- **Local:**
  - `src/css/login.css:1-2` (`#login{display:none!important}`, com o comentário "Versão de teste: acesso direto ao painel, sem autenticação"), carregado em `index.html:4`.
  - `app.js:622-634`: o painel é renderizado antes do login.
  - A regra está presente no `resources.neu` publicado nas versões 0.2.10, 0.2.22, 0.2.29 e 0.2.32.
- **Correção:**
  1. Apague `login.css` e o `<link>` correspondente.
  2. Em `iniciar()`, não chame `render()`, `lancamentos:recorrencias` nem `atualizarVencidos` antes do login validado. Mova essas chamadas para o sucesso de `formLogin`.
  3. `criarApiFinanceira` recusa todo assunto que não seja `acesso:*` enquanto `sessaoAutenticada` for falso.
  4. Remova "Primeiro acesso: admin / admin123" e o usuário pré-preenchido (`index.html:4`, `app.js:630`).
  5. No primeiro uso, obrigue a criar senha com no mínimo 8 caracteres.
  6. Crie um teste que abra `index.html` e confirme que `#login` aparece e o painel não aparece sem autenticação.

**DADOS-01 — Queda no meio da troca de arquivos apaga o banco** [CORRIGIDO v0.2.33 — teste: tests/p0-persistencia.mjs]
- **Local:** `db.js:22-27,60-62`. A sequência hoje é: grava `.tmp` → remove `.old` → move `db` para `.old` → move `.tmp` para `db` → remove `.old`.
- **Cenário:** se o programa cair entre a 3ª e a 4ª etapa, o `.db` não existe na próxima abertura. Nessa abertura:
  - o sistema cria um banco **vazio**;
  - a primeira gravação apaga o `.old`, que era a única cópia boa.
- **Prova:** `/tmp/claude-0/gf-sec/_auditoria/repro.mjs`, cenário C2. Depois da queda simulada, só sobra o banco vazio.
- **Correção:**
  1. Na abertura: se o `.db` faltar, recupere a partir do `.tmp` ou do `.old` válido (cabeçalho `SQLite format 3\0` e `PRAGMA integrity_check`='ok'), com preferência pelo `.tmp`.
  2. Na gravação, use esta ordem: grava `.tmp` → relê e valida → **copia** o `.db` para `.bak` → substitui `.db` pelo `.tmp`. Nunca apague a última cópia válida antes de confirmar a nova.

**DADOS-02 — Falha de leitura vira "banco novo" e sobrescreve o banco real** [CORRIGIDO v0.2.33 — teste: tests/p0-persistencia.mjs]
- **Local:** `db.js:60` (`catch{bytes=null}`).
- **Cenário:** antivírus ou OneDrive bloqueia a leitura por um instante → o programa abre um banco vazio e grava por cima do real.
- **Prova:** C3, com resultado `dado real ainda em disco? false`.
- **Correção:**
  1. Crie banco novo **somente** quando o erro for de arquivo inexistente (`NE_FS_NOPATHE`, confirmado por `getStats`).
  2. Para qualquer outro erro, aborte com a mensagem "Banco bloqueado; feche outros programas e reabra", sem gravar nada.
  3. Se os bytes lidos não tiverem cabeçalho SQLite, aborte.

### 2.2 ALTO

**CALC-02 (= UI-02) — "Hoje" em UTC e calculado uma vez só** [CORRIGIDO v0.2.34 — teste: tests/p1-calculos.mjs]
- **Local:**
  - `app.js:9` (`new Date().toISOString().slice(0,10)`), usado nas linhas 22, 25, 57, 150, 151, 164, 181, 184, 275, 325, 422, 632 e 633;
  - `lancamentos.js:2,21,22`;
  - `pagamentos.js:36`;
  - `escolar.js:30,78`;
  - padrões de `hoje` em `dashboard.js:22,35,41` e `relatorios.js:35`.
- **Cenário provado:** em 31/10, às 22h:
  - o painel abre em novembro;
  - uma entrada "Realizado hoje" de R$ 300,00 e a baixa de R$ 100,00 caem em novembro (outubro fica com 0/0);
  - a conta que vence em 31/10 já aparece "vencido";
  - o relatório padrão vira 01/11 a 01/11;
  - as recorrências do mês seguinte são geradas antes da hora.
- **Correção:**
  1. Crie uma função única `dataLocalISO(d=new Date())` que devolve `AAAA-MM-DD` com `getFullYear()`, `getMonth()+1` e `getDate()`.
  2. Use essa função em **todos** os pontos listados acima.
  3. Recalcule a data a cada `render()` e a cada envio de formulário, nunca numa constante de módulo.
  4. Grave datas efetivas como `${data}T12:00:00.000Z`, como já faz `pagamentos.js:38`.

**CALC-08 / UI-03 / UI-13 — Data efetiva = momento da digitação; não existe campo "data do recebimento/pagamento"** [CORRIGIDO v0.2.34 — teste: tests/p1-calculos.mjs]
- **Local:** `lancamentos.js:6,21`; `app.js:303` ("Realizado hoje"), `386` (botão Receber, sem confirmação) e `545`.
- **Cenário:** mensalidade recebida em 05/10 e registrada em 10/11 entra no caixa de novembro. Não há como informar a data real.
- **Correção:**
  1. Para entrada, troque "Realizado hoje" por "Recebido", com campo de data (padrão `dataLocalISO()`) e forma de pagamento obrigatória.
  2. O botão "Receber" abre esse mesmo mini-formulário.
  3. Grave `liquidado_em=${data}T12:00:00.000Z` e crie a linha correspondente em `caixa_diario` com a forma escolhida.

**CALC-03 — Excluir uma entrada vinda do caixa ou de pagamento de aluno deixa o caixa órfão** [CORRIGIDO v0.2.34 — teste: tests/p1-calculos.mjs]
- **Local:** `lancamentos.js:23`. Só apaga do caixa as linhas do tipo `despesa`.
- **Cenário:** caixa de R$ 111,00 + pagamento de aluno de R$ 400,00, ambos em dinheiro, e depois os dois lançamentos são excluídos.
  - Errado: entradas = 0, mas dinheiro em mãos = R$ 511,00 e o devedor continua "quitado, R$ 400,00".
  - Correto: tudo 0 e devedor "em aberto".
- **Correção:**
  1. `excluirLancamento` apaga **todas** as linhas de `caixa_diario` com aquele `lancamento_id`.
  2. Crie a coluna `devedor_id` em `caixa_diario` e, na exclusão, estorne `valor_pago_centavos` do devedor e recalcule a situação.
  3. Faça tudo numa única transação.

**CALC-04 — Excluir uma ENTRADA no caixa mantém o lançamento "recebido" e o devedor quitado** [CORRIGIDO v0.2.34 — teste: tests/p1-calculos.mjs]
- **Local:** `escolar.js:45-57` (só trata `despesa`, na linha 49).
- **Correção:** para entrada com `lancamentoId`, apague o lançamento vinculado e estorne o devedor. Use a mesma rotina do CALC-03.

**CALC-13 / UI-04 — Editar ou excluir em "Entradas" uma receita gerada pelo caixa deixa caixa e painel diferentes** [CORRIGIDO v0.2.34 — teste: tests/p1-calculos.mjs]
- **Local:** `app.js:66,390-404`. Na tabela do caixa, a receita não tem ação (`app.js:146`).
- **Cenário provado:** receita de R$ 500,00 editada para R$ 50,00 → caixa R$ 500,00 e painel R$ 50,00.
- **Correção:**
  1. Lançamentos com linha em `caixa_diario` não podem ter valor nem tipo editados pela tela "Entradas"; mostre "Gerado pelo caixa".
  2. A correção é feita no caixa, que atualiza o lançamento na mesma transação.

**CALC-05 — A recorrência gera data inexistente (31/02)** [CORRIGIDO v0.2.34 — teste: tests/p1-calculos.mjs]
- **Local:** `lancamentos.js:27`.
- **Cenário:** salário com vencimento no dia 31 → competência `2026-02-31` → some do "A pagar" de fevereiro.
- **Correção:**
  1. Use `Math.min(dia, ultimoDiaDoMes)`, igual a `escolar.js:6`.
  2. `validar()` (`lancamentos.js:4`) rejeita datas inválidas, usando a mesma `dataValida` de `pagamentos.js:1`.
  3. Corrija os registros existentes conforme a seção 3.

**CALC-06 — A recorrência descarta modelos com a mesma descrição e pula meses** [CORRIGIDO v0.2.34 — teste: tests/p1-calculos.mjs]
- **Local:** `lancamentos.js:27`.
- **Cenário 1:** dois "Professor/Pessoal" (R$ 1.200 e R$ 950) → só um é gerado.
- **Cenário 2:** app aberto em janeiro e depois só em abril → fevereiro e março nunca são gerados.
- **Correção:**
  1. Crie a coluna `recorrencia_origem_id` e use-a para evitar duplicatas, em vez de descrição + categoria + tipo.
  2. Gere todos os meses entre a última cópia e o mês atual.
  3. O modelo é sempre o lançamento original.

**CALC-07 — Renomear "Serviços e utilidades" ou "Receitas escolares" funde com o caixa diário** [CORRIGIDO v0.2.34 — teste: tests/p1-calculos.mjs]
- **Local:** `escolar.js:15` usa `cat-utilidades` e `cat-receitas` com o nome "Caixa diário - …"; `categorias.js:3` atualiza por `categoria_id`.
- **Cenário:** R$ 200,00 + R$ 50,00 viram uma categoria só, de R$ 250,00, de forma irreversível.
- **Correção:**
  1. Crie as categorias próprias `cat-caixa-receitas` e `cat-caixa-despesas` e use-as no caixa.
  2. Corrija os existentes conforme a seção 3.

**UI-05 — Entrada de dinheiro: "1.200" vira R$ 1,20; "1.234,56" é bloqueado sem explicação; Windows sem pt-BR pode multiplicar por 100 (A CONFIRMAR)** [CORRIGIDO v0.2.34 — teste: tests/p1-calculos.mjs]
- **Local:** todos os `type="number"` (`index.html`; `app.js:94,151,158,170,181,184,325`) e o parse `Math.round(Number(...)*100)` (`app.js:162,171,184,333,376,448,466,545,546`).
- **Correção:**
  1. Troque esses campos por `type="text" inputmode="decimal"`.
  2. Use uma função única `centavosDe()` que aceite "1.234,56", "1234,56", "1.200" e "R$ 10", e rejeite negativo, vazio e mais de 2 casas.
  3. Mostre `brl(valor)` ao lado do campo como conferência.
  4. Recuse com mensagem clara quando o valor for inválido ou ≤ 0.
  5. Teste a função com a tabela de casos citada.

**UI-06 — Clique duplo duplica valores** [CORRIGIDO v0.2.34 — teste: tests/p1-calculos.mjs]
- **Local:** `formCaixa` (445-451), `formDevedor` (463), `formRecebimentoDevedor` (184), `formDespesaAvulsaCaixa` (162), `formCategoria` (428). No `formLancamento` (539-551), o bloqueio vem depois de um `await`.
- **Prova:** dois cliques em 60 ms → fechamento de R$ 50,00 vira "Receitas R$ 100,00"; dois envios → 2 lançamentos.
- **Correção:**
  1. Envolva todos os `onsubmit` e os botões de ação em `enviarUmaVez(form,fn)`, que desabilita e reabilita os botões, com `try/catch/finally`.
  2. No `formLancamento`, desabilite o botão na primeira linha do handler.

**UI-07 — O autopreenchimento pela descrição sobrescreve valor e recorrência já digitados** [CORRIGIDO v0.2.34 — teste: tests/p1-calculos.mjs]
- **Local:** `app.js:537-538,340-350`.
- **Cenário provado:** valor 999 avulso + descrição "Energia" → passa a R$ 350,00, mensal.
- **Correção:**
  1. Rode o autopreenchimento só no `onchange`.
  2. Preencha apenas campos vazios e **nunca** altere `recorrencia`.
  3. Mostre o aviso "valores sugeridos".

**CALC-09 — A baixa do saldo de despesa força a forma "Dinheiro" e usa data UTC** [CORRIGIDO v0.2.34 — teste: tests/p1-calculos.mjs]
- **Local:** `lancamentos.js:21`.
- **Cenário:** saldo de R$ 60,00 pago em Pix às 22h30 de 06/11 → gravado como Dinheiro em 07/11, e o dinheiro em mãos fica em −R$ 60,00.
- **Correção:** a baixa abre o diálogo de pagamento, com data local e forma obrigatória.

**DADOS-03 — Uma falha de gravação trava todas as gravações seguintes; memória e disco divergem; a janela não fecha** [CORRIGIDO v0.2.33 — teste: tests/p0-persistencia.mjs]
- **Local:** `db.js:31` (`fila` rejeitada para sempre); `app.js:607-617`.
- **Prova:** C1. Na memória ficam 3 registros, no disco 1. Novas gravações dão "EBUSY" mesmo depois que a falha passa.
- **Correção:**
  1. Use `fila=fila.catch(()=>{}).then(()=>salvarComSeguranca(caminho,sql.export()))`.
  2. Se a persistência falhar depois do COMMIT, recarregue o banco do disco e devolva erro.
  3. Tente gravar 3 vezes, com espera crescente.
  4. Na janela, ofereça sempre "Fechar mesmo assim".

**DADOS-04 — Duas instâncias abertas: a última gravação vence, sem aviso** [CORRIGIDO v0.2.33 — teste: tests/p0-persistencia.mjs]
- **Correção:**
  1. Crie um lock `dados\celc-financeiro.lock` com PID e heartbeat a cada 10 s; recuse abrir uma segunda instância.
  2. Ou: compare o hash/mtime do arquivo com a última leitura antes de gravar, e aborte se mudou.

**DADOS-05 — Restaurar backup sobrescreve os dados atuais sem cópia** [CORRIGIDO v0.2.33 — teste: tests/p0-persistencia.mjs]
- **Local:** `core/backup.js:12-19,37-48`.
- **Correção:**
  1. Antes de restaurar, crie `backups\pre-restauracao-<data-hora>.db` e aborte se não conseguir.
  2. Rode `aguardarPersistencia()` antes da troca.
  3. Valide com `PRAGMA integrity_check` e confira todas as tabelas.

**SEG-02 — HTML vindo do banco sem escape + `os.*`/`filesystem.*` liberados = um backup malicioso executa comando no Windows**
- **Local:** `app.js:146` (`class="type-badge ${x.tipo}"`), `app.js:135` (`<option value="${g.mes}">`), `neutralino.config.json:13`. Não há CSP.
- **Correção:**
  1. Aplique `esc()` em **toda** interpolação vinda de dados.
  2. Reduza `nativeAllowList` à lista mínima: `app.exit`, `app.getConfig`, as funções de filesystem usadas, `os.getEnv`, os diálogos, `os.execCommand` (enquanto existir o curl), `window.*` e `events.*`.
  3. Adicione CSP: `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'`. A CONFIRMAR a compatibilidade com o Neutralino 6.3.

**UPD-01 — A atualização online exige release pública, o que contradiz a regra "repositório privado"; o hash não autentica quem publicou**
- **Local:** `atualizador.js:4,36,42,55`. Baixa sem token de `github.com/mlopesdesign/celc-financeiro/releases/latest/download/latest.json`.
- **Problema:** ou o repositório é público hoje, ou o app fica sem atualizar. Confirme com `gh repo view mlopesdesign/celc-financeiro --json visibility`. O SHA-256 vem da mesma origem do pacote.
- **Correção:**
  1. Código em repositório **privado**; artefatos em repositório **público** separado (`celc-financeiro-releases`), contendo só as releases.
  2. Assine o `latest.json` com ECDSA P-256. A chave privada fica fora do repositório; a chave pública vai embutida no app. Verifique com `crypto.subtle.verify` antes de usar o hash.
  3. Nunca embuta token no app.

**REL-01 — As versões 0.2.30 a 0.2.32 não estão no git** [CORRIGIDO v0.2.33 — teste: tests/p0-rel-01.mjs]
- **Problema:** `main` e `origin/main` estão em `faef95c` (registro da 0.2.29). As tags param em v0.2.29, e a v0.2.8 não existe. `core/dashboard.js` e `tests/dashboard.mjs` não estão versionados. O repositório não reconstrói a versão em produção.
- **Correção:**
  1. Faça commit do estado atual **antes** de qualquer correção.
  2. Crie as tags anotadas v0.2.30, v0.2.31 e v0.2.32 (se forem as builds publicadas) e faça push.
  3. Confirme quais releases existem no GitHub e registre no `ESTADO.md`.

**UI-08 / CALC-10 — Receitas do caixa nunca entram no "Dinheiro em espécie esperado"; a regra é assimétrica (A CONFIRMAR a regra de negócio)**
- **Local:** `app.js:448` (sempre `'Não informado'`); `dashboard.js:11,30`.
- **Cenário:** contagem de R$ 100,00 + receita de R$ 300,00 em dinheiro − despesa de R$ 50,00 em dinheiro → o sistema mostra R$ 50,00 esperados; o correto é R$ 350,00. Também diverge de `saldoDinheiroEmMaos` e de `caixa:resumo`, que dão R$ 250,00.
- **Correção:**
  1. Adicione ao fechamento um seletor de forma de pagamento (padrão Dinheiro).
  2. `formaRegistrada` só reclassifica quando a forma está vazia ou "Não informado", nunca pela origem.
  3. Os três cálculos de dinheiro usam a mesma função.

### 2.3 MÉDIO

| ID | Local | Problema | Correção |
|---|---|---|---|
| CALC-11 | `relatorios.js:46-47`, `dashboard.js:80-85` | Devedores fora do "A receber" e da projeção (A CONFIRMAR a regra) | O Marcio decide: somar devedores em `aReceber`/projeção, ou rotular "A receber (exceto mensalidades de alunos)" |
| CALC-12 [CORRIGIDO v0.2.34] | `lancamentos.js:16` | Editar sem reenviar os campos apaga vencimento e recorrência | Use `dados.vencimento ?? atual.vencimento` e `dados.recorrencia ?? atual.recorrencia` |
| CALC-14 [CORRIGIDO v0.2.34] | `pagamentos.js:34-38` | Pagamento com data futura marca "pago" enquanto o "A pagar" continua mostrando o valor | Rejeite `data > dataLocalISO()` |
| UI-09 | `app.js:150-151` | O caixa sempre mostra "hoje"; o fechamento de ontem não aparece, o que induz a salvar de novo | Crie a variável `dataCaixa` e o resumo por data escolhida |
| UI-10 | `app.js:71,103` | "Últimos cadastrados" está ordenado por competência | Ordene por `criadoEm` decrescente |
| UI-11 | `app.js:407-414` | A exportação ignora as datas digitadas e não aplicadas; não mostra onde salvou; sobrescreve o arquivo do mesmo dia; o CSV não tem período | Leia o formulário antes de exportar, mostre o caminho, coloque o período no nome do arquivo e no CSV |
| UI-12 | `app.js:101,132-137` | O valor do botão da categoria (pago no mês) ≠ o histórico do modal (competência, todos os meses) | Use o mesmo critério e período, ou renomeie o modal |
| UI-14 | `app.js:162,184,383,394,428,438,445,463,471,476,487` | Falha de gravação silenciosa | Use `try/catch` com aviso, junto do `enviarUmaVez` |
| UI-15 | `app.js:196,198` | Contagem e ordenação dos cards incoerentes com o valor exibido | Use `quantidadeRealizada` e ordene por realizado |
| UPD-02 | `atualizador.js:36` | O regex da URL aceita `"` e `&` → injeção no cmd | Use um regex estrito com a versão igual a `atualizacao.version` |
| UPD-03 | `atualizador.js:82` | Não há rollback se a nova versão não abrir | Mantenha o `.bak` e use boot-ok com timeout de 60 s no ps1 |
| UPD-04 | `atualizador.js:42,55` | curl sem tempo limite | Use `--connect-timeout 15 --max-time 120` |
| APP-01 | `neutralino.config.json:14`, `app.js:626-629` | A janela não fecha se a inicialização falhar | Registre o handler antes de abrir o banco; sem banco, `app.exit(0)` |
| DADOS-06 | `backup.js:1-7` | A restauração aceita qualquer SQLite com 3 tabelas e traz de volta a credencial antiga | Exija `integrity_check`, schema completo e `user_version` |
| DADOS-07 | `db.js:32-43` | Migração sem versão de schema | Use `PRAGMA user_version` e migrações numeradas em transação, com backup antes |
| SEG-03 | `Release\v0.2.22\celc-financeiro-backup*.db` | Bancos reais, com dados de alunos (LGPD), dentro da pasta de release, na unidade de rede | Mova para fora do projeto. O `preparar-release.mjs` deve abortar se houver `*.db` em `Release/` |
| REL-02 | `installer/CELC-Financeiro-Setup.nsi` | Atalho sempre criado; retorno do WebView2 ignorado (:83); não fecha o app antes de copiar; a desinstalação deixa ps1, `.bak` e logs (o `RMDir` falha); sem assinatura de código | Corrija cada ponto. "Abrir ao final marcado" já está correto |
| CALC-15 | `pagamentos.js:36`, `escolar.js:52` | Situação após parcial e estorno calculada errada | Use uma função única de situação, comparando com a data local de hoje |
| CALC-16 | `relatorios.js:35` | Período invertido aceito | Valide `inicio<=fim` e datas válidas |
| UI-18 | `app.js:394-403,471,500-506` | Exclusão em cascata sem modal; arquivar sem confirmação; restauração armada sem prazo | Modal "Excluir também N pagamentos (R$ X)?" e timeout de 3,5 s |
| UI-20 | `styles.css` (`.content-grid`) | Com 800×600 o caixa estoura 406 px; botões desalinhados | Use `repeat(auto-fit,minmax(320px,1fr))` e `.row-actions` à direita com larguras iguais |

### 2.4 BAIXO

- **CALC-17:** `bancoPreview` em `db.js:44` tem mapeamento errado (12 em vez de 13 colunas) e não está em uso. Remova.
- **CALC-18:** `listarCaixaDiario()` é chamado para cada lançamento (O(n·m)). Indexe com `Map` por `lancamentoId`.
- **CALC-19:** `src/schema.sql` não é usado e diverge do schema real em `db.js:2-8`. Apague, ou gere a partir de `db.js`.
- **UI-16:** a coluna "Valor" do modal de categoria mostra o saldo, e o pagamento parcial é ignorado. Passe `valorCentavos`, `pagoTotal` e `saldo`.
- **UI-17:** a tela de devedores está fora do menu, mas o relatório continua dando baixa. Decida: devolva ao menu ou remova a baixa do relatório.
- **UI-19:** o modal de despesa avulsa não é limpo após salvar e o mês de referência começa errado. Use `reset()` e o mês da data do caixa.
- **UI-21:** acessibilidade:
  - adicione `role="dialog"`, `aria-modal` e `aria-label="Fechar"`;
  - feche com Esc e devolva o foco;
  - não feche formulários com clique no fundo;
  - use `aria-current` no menu.
- **UI-22:** "Sem contagem de referência" aparece quando a contagem é posterior ao mês. Corrija o texto.
- **UI-23:** padronize "Despesa" (não "Saída") e o sinal "−".
- **SEG-04:** declare `tokenSecurity:"one-time"`, `port:0` e logging desligado no `neutralino.config.json` (A CONFIRMAR os padrões da 6.3).
- **SEG-05 [FORA DO ESCOPO: decisão do Marcio]:** `admin/admin123` fixo em `auth.js:12`, sem troca obrigatória nem limite de tentativas. Ver SEG-01.
- **DADOS-08:** backup a cada fechamento, sem rotação, aceitando banco vazio. Mantenha 30 backups e não grave um backup vazio por cima de um com dados.
- **DADOS-09:** cada operação exporta e relê o banco inteiro. Monitore conforme o volume crescer.
- **REL-03:** dois builds diferentes com o mesmo número 0.2.26, e a versão repetida em 5 lugares. Leia a versão de `Neutralino.app.getConfig()`; o `preparar-release.mjs` aborta se houver divergência ou se faltar a tag.
- **REL-04:** lixo na pasta do projeto:
  - `Lixeira/` (cerca de 470 MB);
  - `Release/` (cerca de 3,4 GB de setups antigos);
  - `_backup_*` (fora do `.gitignore`);
  - `dist/` antigo;
  - binários duplicados em `bin/` e `.neutralino/`.

  Mova para fora do projeto e corrija o `.gitignore`.
- **UPD-05:** o ps1 roda com `-ExecutionPolicy Bypass` na pasta do usuário. Recalcule o SHA-256 dentro do ps1 antes de mover.

---

## 3. DIAGNÓSTICO OBRIGATÓRIO NOS DADOS REAIS (antes de corrigir qualquer registro)

[DIAGNÓSTICO EXECUTADO — evidência: evidencias/diagnostico-dados-2026-11-10.md]

Os bugs acima podem já ter gravado dados errados no banco do cliente. Rode as consultas abaixo sobre uma **cópia** de `%APPDATA%\CELC Financeiro\dados\celc-financeiro.db`, salve o resultado em `evidencias/diagnostico-dados-<data>.md` e mostre ao Marcio. **Nenhum UPDATE ou DELETE sem aprovação.**

```sql
-- 1. Caixa órfão (CALC-03/04): linha de caixa apontando para lançamento que não existe
SELECT c.* FROM caixa_diario c
WHERE c.lancamento_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM lancamentos l WHERE l.id=c.lancamento_id);

-- 2. Datas inexistentes (CALC-05)
SELECT id,descricao,competencia,vencimento FROM lancamentos
WHERE date(competencia) IS NULL OR date(competencia)<>competencia
   OR (vencimento IS NOT NULL AND (date(vencimento) IS NULL OR date(vencimento)<>vencimento));

-- 3. Liquidados entre 21h e 23h59 de Brasília = gravados no dia seguinte (CALC-02/08)
SELECT id,descricao,valor_centavos,liquidado_em FROM lancamentos
WHERE liquidado_em IS NOT NULL AND substr(liquidado_em,12,2) IN ('00','01','02')
  AND substr(liquidado_em,12,8)<>'12:00:00';

-- 4. Caixa gravado à noite com a data do dia seguinte (UI-02)
SELECT * FROM caixa_diario
WHERE substr(criado_em,12,2) IN ('00','01','02') AND data=substr(criado_em,1,10);

-- 5. Possíveis duplicidades por clique duplo (UI-06)
SELECT descricao,tipo,valor_centavos,competencia,COUNT(*) n FROM lancamentos
GROUP BY 1,2,3,4 HAVING COUNT(*)>1;
SELECT data,tipo,origem,forma_pagamento,valor_centavos,COUNT(*) n FROM caixa_diario
GROUP BY 1,2,3,4,5 HAVING COUNT(*)>1;

-- 6. Valores suspeitos de "1.200 → R$ 1,20" (UI-05)
SELECT id,descricao,valor_centavos FROM lancamentos WHERE valor_centavos<1000 ORDER BY valor_centavos;

-- 7. Caixa com valor diferente do lançamento vinculado (CALC-13 / UI-04)
SELECT c.id,c.valor_centavos caixa,l.valor_centavos lancamento,l.descricao FROM caixa_diario c
JOIN lancamentos l ON l.id=c.lancamento_id WHERE c.tipo='entrada' AND c.valor_centavos<>l.valor_centavos;

-- 8. Categorias fundidas (CALC-07)
SELECT categoria_id,categoria,COUNT(*) FROM lancamentos
WHERE categoria_id IN ('cat-utilidades','cat-receitas') GROUP BY 1,2;

-- 9. Baixas forçadas como Dinheiro (CALC-09)
SELECT * FROM caixa_diario WHERE tipo='despesa' AND forma_pagamento='Dinheiro' AND origem LIKE '%baixa%';
```

Para cada consulta, registre: quantidade de linhas, soma em R$ e efeito nos meses afetados.

---

## 4. ORDEM DE EXECUÇÃO

**P0 — Proteger o que existe**

Fechamento local: `v0.2.33`, sem publicação. Evidência RED/GREEN: `evidencias/testes-p0-2026-11-10.txt`. P1 não iniciado.
1. REL-01: commit e tags do estado atual (0.2.30 a 0.2.32), antes de mudar qualquer linha.
2. Seção 3: diagnóstico na cópia do banco real; resultado ao Marcio.
3. DADOS-02, DADOS-01, DADOS-03, DADOS-04, DADOS-05: persistência à prova de falha, com os testes C1, C2 e C3 na suíte.
4. CALC-01: salvar despesa e contagem.

**P1 — Números corretos**
5. CALC-02, CALC-08, UI-03, UI-13, CALC-09: data local única e campo de data/forma no recebimento e no pagamento.
6. UI-05, UI-06, UI-07: entrada de valor, clique duplo e autopreenchimento.
7. CALC-03, CALC-04, CALC-13, UI-04: exclusão e edição coerentes entre caixa, lançamento e devedor.
8. CALC-05, CALC-06, CALC-07, CALC-12, CALC-14, CALC-15, CALC-16, UI-08, CALC-10, CALC-11 (decidido: rotular).
9. Correção dos registros existentes conforme a seção 3, **só com aprovação**.

**P2 — Segurança**
10. SEG-02, UPD-01, UPD-02 a UPD-05, SEG-03, SEG-04, APP-01, DADOS-06 a DADOS-08.

**P3 — Interface e release**
11. UI-09 a UI-23, REL-02 a REL-04, CALC-17 a CALC-19.
12. Release nova: versão nos 5 pontos, build, Setup, `/S /VALIDATE`, tag, release, hash conferido, `ESTADO.md` e `GRAPHIFY.md`.

## 5. CRITÉRIOS DE ACEITE (o Marcio confere)

- [ ] Cenário dez/2025 a fev/2026 desta auditoria transformado em teste: as 64 conferências continuam batendo, e as do caixa órfão passam.
- [ ] Teste às 22h30 de 31/10 em `TZ=America/Sao_Paulo`: recebimento, baixa e caixa ficam em **31/10**.
- [ ] Salvar despesa, com e sem favorecido, grava no banco real.
- [ ] "1.234,56", "1.200" e "R$ 10" gravam R$ 1.234,56, R$ 1.200,00 e R$ 10,00.
- [ ] Clique duplo não duplica.
- [ ] Excluir uma entrada do caixa zera caixa, painel e devedor.
- [ ] Senha e login idênticos ao que era antes (nada mexido).
- [ ] Testes de queda, leitura bloqueada e falha de gravação não perdem dados.
- [ ] Diagnóstico da seção 3 entregue e aprovado; correções aplicadas só com autorização.
- [ ] git com commit e tag de cada versão; release conferida.

## 6. SOBRE A AUDITORIA ANTERIOR DO CODEX (`audit-output/`)

Ela não serve como aprovação:
- **Não percebeu que o login está desligado.** Tratou `admin123` como "risco aceito" sobre um login que não existe.
- **Declarou a persistência robusta sem testar falhas.** As três perdas de dados (DADOS-01 a 03) passaram despercebidas.
- **Chamou o SHA-256 de verificação criptográfica.** Ele vem da mesma origem do pacote.
- **Afirmou que o HTML estava controlado**, mas há interpolação sem escape em `app.js:135,146`.
- **Não viu que as versões 0.2.30 a 0.2.32 estão fora do git.**
- **Mérito:** marcou a integridade de dados como INCONCLUSIVA e não aprovou a atualização no cliente. Isso continua correto.

## 7. EVIDÊNCIAS E LIMITES

**Scripts de prova (ambiente da auditoria):**

| Pasta | O que contém |
|---|---|
| `/tmp/claude-0/gf-fin/audit-calc/` | `cenario.mjs`, `conferir.mjs`, `bugs.mjs`, `b9b.mjs`, `b9c.mjs`, `extra.mjs` |
| `/tmp/claude-0/gf-ui/` | Playwright com stub do Neutralino: `t1_fuso.js`, `t2b_duplo.js`, `t4b.js`, `t5_varios.js`, `t6_receb.js`, `t7_layout.js` |
| `/tmp/claude-0/gf-sec/_auditoria/repro.mjs` | Reproduções de persistência C1, C2 e C3 |

**Fora do alcance (A CONFIRMAR):**
- executável Windows real e banco do cliente;
- comportamento da vírgula no WebView2 da máquina da escola;
- visibilidade do repositório no GitHub;
- existência das releases 0.2.30 a 0.2.32 no GitHub;
- regras de negócio do CALC-11 e do UI-08.
