# Estado do projeto — CELC Financeiro

**Versão em preparação:** `0.2.1`  
**Aplicação:** desktop Windows para a gestão financeira do Colégio CELC.  
**Stack:** JavaScript ESM, HTML/CSS puro, sql.js (SQLite local), Neutralino.js 6.3.0 e instalador NSIS.

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

A versão anterior publicada é `v0.2.0` no repositório:

`https://github.com/mlopesdesign/celc-financeiro`

A versão `0.2.1` está sendo finalizada com:

- automação de vencidos;
- ícone próprio nos atalhos e no instalador;
- bundle `resources.neu` atualizado;
- instalador `CELC-Financeiro-Setup-0.2.1.exe`;
- manifesto de atualização e checksums.

## Pendências de produto

1. Validar em uma máquina limpa o ciclo completo: instalar, registrar lançamentos, fechar e reabrir.
2. Publicar a release `v0.2.1` com os quatro anexos: Setup, `resources.neu`, `latest.json` e `SHA256SUMS.txt`.
3. Testar a atualização online partindo de uma instalação `v0.2.0`.
4. Definir o fluxo operacional mensal para conferência de caixa, inadimplência e relatórios pela direção.

## Regra de continuidade

Nenhuma alteração é entregue sem: testes automatizados, incremento de versão, geração de `resources.neu`, instalador, checksums, commit, tag e dados de publicação no GitHub.
