# Estado do projeto — CELC Financeiro

**Versão publicada mais recente:** `0.2.7`
**Estado de validação:** correção do updater e do toast validada localmente; atualização em instalação existente real ainda pendente.
**Aplicação:** desktop Windows para a gestão financeira do Colégio CELC.  
**Stack:** JavaScript ESM, HTML/CSS puro, sql.js (SQLite local), Neutralino.js 6.3.0 e instalador NSIS.

## Estado atual — correção retomada (2026-09-01)

Após duas tentativas de atualização reportadas como fracassadas, a correção foi retomada nesta versão. O banco externo deve ser preservado durante toda a validação.

### Publicação anterior

- Tag/release: `v0.2.6` — https://github.com/mlopesdesign/celc-financeiro/releases/tag/v0.2.6
- Commit: `978fbb2d8a2d14759d83ac7d2656c8fc916691db`
- Anexos publicados: `CELC-Financeiro-Setup-0.2.6.exe`, `resources.neu`, `latest.json` e `SHA256SUMS.txt`.
- Manifesto público consultado: versão `0.2.6`.
- SHA-256 público do `resources.neu`: `DD7D4BAA149A8A5462B122E6581DED2F9B0AA89DAB3D5886F7970106429254EB`.

### Problemas ainda não aceitos como resolvidos

1. Na máquina do cliente, clicar para instalar a atualização não produziu atualização observável.
2. O toast de atenção/atualização foi reportado como cortado e sem explicação suficiente.
3. O ciclo real de download, substituição de `resources.neu`, fechamento e reabertura ainda precisa ser reproduzido e validado em uma instalação existente.
4. A correção para usar a versão do pacote (`APP_VERSION`) em vez da versão fixa do binário foi incluída na `v0.2.6`, mas ainda não foi confirmada pelo cliente.
5. O instalador foi recompilado com script NSIS reconhecido como UTF-8, mas a confirmação visual em máquina cliente continua pendente.

### Retomada obrigatória

- Não declarar a atualização online funcional sem teste real em uma instalação existente.
- Investigar primeiro com logs e estado da instalação, sem apagar dados.
- Preservar o banco em `%APPDATA%\CELC Financeiro\dados` durante qualquer teste.
- A correção parte da `v0.2.6` e segue integralmente o fluxo de `AGENTS.md`; não reutilizar a versão nem fazer downgrade.

## Correção do updater e toast — 0.2.7

- Falhas de backup, consulta e instalação retornam erro humano e não deixam rejeições sem tratamento na interface.
- O pacote baixado é validado antes de iniciar a troca.
- A troca usa comando PowerShell codificado em UTF-16LE, tentativas de substituição e log local de execução antes da reabertura.
- O toast global tem largura responsiva, quebra de texto e uma regra final que evita corte em escalas do Windows.
- O manifesto aceita somente a URL oficial de `resources.neu` do repositório CELC.
- Release publicada: `v0.2.7`, commit `e68374f`, com Setup, `resources.neu`, `latest.json` e `SHA256SUMS.txt`.

## Entregas implementadas

- Dashboard financeiro com indicadores de entradas, despesas e resultado.
- Cadastro de categorias de entrada e despesa, com edição, arquivamento e exclusão.
- Lançamentos de entradas e despesas, inclusive pagamentos fixos recorrentes.
- Contas a receber e a pagar.
- Caixa diário com totais de receita e despesa, pagamentos realizados no dia e detalhamento opcional.
- Alunos devedores, com baixas totais ou parciais e situação calculada pelo sistema.
- Relatórios financeiros, exportação CSV e PDF.
- Configurações para senha, backup e consulta de atualizações online.
- Banco local separado dos arquivos do aplicativo, preservado durante atualizações.
- Login local inicial: usuário `admin`, senha `admin123`; a senha pode ser alterada em Configurações.

## Automação de vencidos — 0.2.1

Foi criada a automação `lancamentos:atualizarVencidos`.

- Ao iniciar o aplicativo, as recorrências do período são geradas primeiro.
- Em seguida, todo lançamento não liquidado cujo vencimento seja anterior à data de referência recebe a situação `vencido`.
- Lançamentos pagos, parcialmente liquidados, futuros ou sem vencimento não são alterados.
- Cada alteração automática é registrada na auditoria.
- A cobertura automatizada está em `tests/vencidos.mjs`.

## Caixa diário e UTF-8 — 0.2.2

- O detalhamento de despesas não solicita aluno ou responsável.
- Despesas cadastradas podem ser encontradas por descrição ou categoria, incluindo pagamentos fixos mensais, e pagas diretamente no Caixa diário.
- Despesas não cadastradas recebem descrição, valor e forma de pagamento; o padrão é `Dinheiro`.
- A despesa detalhada entra no caixa e atualiza o lançamento original para `pago`, sem duplicar a movimentação.
- `tests/utf8.mjs` valida todos os arquivos textuais de código e documentação como UTF-8 e bloqueia sequências de codificação corrompida.

## Atualização online nativa — 0.2.3

- A consulta do manifesto e o download de `resources.neu` são executados pelo `curl.exe` do Windows através da API nativa do Neutralino.
- A tela não depende mais de `fetch` do WebView2 nem das regras CORS do GitHub.
- A instalação preserva o fluxo seguro: persistência do banco, backup obrigatório, troca apenas de `resources.neu` e reinício do aplicativo.
- A versão `0.2.2` publicada permanece preservada como histórico; a correção segue em nova versão, sem sobrescrever artefatos já distribuídos.

## Caixa e instalador UTF-8 — 0.2.4

- O Caixa diário permite excluir uma despesa com confirmação em dois passos.
- Ao excluir uma despesa cadastrada paga pelo caixa, o lançamento original volta a pendente ou vencido conforme a data de vencimento; despesas avulsas removem também o lançamento gerado.
- O script NSIS é salvo com BOM UTF-8, impedindo mensagens corrompidas no instalador Windows.

## Atualização assistida e toast — 0.2.5

- O pacote é baixado para arquivo temporário; o aplicativo fecha, troca `resources.neu` e reabre o executável.
- O toast de atualização fica acima da barra do Windows e informa descoberta, sucesso ou falha.

## Decisões técnicas

| Decisão | Motivo |
| --- | --- |
| Dados em diretório de usuário, fora da instalação | Atualizações trocam somente `resources.neu` e não apagam os dados financeiros. |
| `resources.neu` como pacote de atualização | O atualizador nativo do Neutralino baixa e substitui apenas esse arquivo. |
| GitHub Releases como origem de atualização | Permite distribuição versionada por tag, manifesto `latest.json` e rollback por release. |
| NSIS para o instalador Windows | Instala por usuário, preserva a versão anterior e cria atalhos. |
| Ícone ICO próprio do CELC | O instalador, os atalhos e os metadados do aplicativo usam `assets/celc-app-icon.ico`; não há ícones genéricos. |
| Situação financeira calculada | Estados de alunos e vencimentos são consequência de valores, baixas e datas, não campos livres para edição manual. |

## Versão e distribuição

A versão publicada mais recente é `v0.2.7` no repositório:

`https://github.com/mlopesdesign/celc-financeiro`

A release `v0.2.7` foi publicada com:

- correção do cálculo/exibição da versão a partir do pacote de recursos;
- atualizador assistido com download temporário e reabertura do executável;
- bundle `resources.neu` atualizado;
- instalador `CELC-Financeiro-Setup-0.2.7.exe`;
- manifesto de atualização e checksums.

## Pendências de produto

1. Reproduzir e corrigir a atualização online em uma instalação existente, sem risco de perda do banco.
2. Corrigir e validar o posicionamento/conteúdo do toast de atualização e de erro.
3. Confirmar a codificação UTF-8 das mensagens do instalador em uma máquina Windows limpa.
4. Validar em uma máquina limpa o ciclo completo: instalar, registrar lançamentos, fechar e reabrir.
5. Definir o fluxo operacional mensal para conferência de caixa, inadimplência e relatórios pela direção.

## Regra de continuidade

O fluxo completo é obrigatório sempre. Nenhuma alteração, correção, ajuste visual ou evolução é entregue sem: testes automatizados, validação UTF-8, incremento de versão, geração de `resources.neu`, instalador, checksums, commit, tag, push, GitHub Release e dados finais de publicação. Se qualquer etapa falhar, o trabalho continua até a correção e validação.
