# CELC Financeiro — instruções do projeto

Leia este arquivo e `GRAPHIFY.md` antes de qualquer alteração estrutural.

## Identidade imutável

| Item | Valor |
|---|---|
| Nome | CELC Financeiro |
| Cliente | Colégio CELC |
| applicationId | `com.mllopesdesign.celcfinanceiro` |
| binaryName | `CELC Financeiro.exe` |
| Pasta de dados | `%APPDATA%\CELC Financeiro\dados` |
| Banco | `celc-financeiro.db` |
| Repositório | A definir antes da primeira release |

Não altere `applicationId`, `binaryName`, a pasta de dados ou o nome do banco após a primeira distribuição. Esses valores são a identidade da instalação e da atualização online.

## Tecnologia obrigatória

- JavaScript ES2020+, HTML e CSS escritos à mão.
- Neutralino.js 6.3.0 e WebView2 para o aplicativo Windows distribuído pelo instalador oficial.
- sql.js como banco SQLite local.
- Node.js somente para desenvolvimento, testes e geração de mapas; nunca como requisito do cliente.

Não usar Java, TypeScript, React, Vue, Angular, Electron, Tailwind, Vite, Webpack, Rollup ou dependências npm no aplicativo distribuído.

## Arquitetura

```text
src/
├── index.html
├── css/
├── js/
│   ├── app.js                 interface, navegação e chamada api()
│   ├── neutralino.js          runtime do Neutralino
│   ├── vendor/                bibliotecas versionadas como arquivos
│   └── backend/
│       ├── servidor.js        rotas, sessão e permissões
│       ├── db.js              banco, migrações e gravação segura
│       ├── ambiente.js        sistema operacional, arquivos e backup
│       └── core/              regra financeira pura e testável
├── schema.sql
docs/
tools/
tests/
```

Regra de negócio fica em `src/js/backend/core/`. Funções de core recebem `db` como primeiro argumento e não acessam DOM, `window` ou Neutralino. Toda comunicação tela ↔ regra usa `api('assunto:acao', dados)`. Permissão é conferida no backend, nunca apenas escondendo botões.

## Banco, backup e atualização

- Operações de escrita precisam de transação e backup antes de ações irreversíveis.
- Persistência segura: escreve `.tmp` → renomeia o atual para `.old` → move o `.tmp` para o banco → remove `.old`. Nunca apagar o banco antes de mover a cópia nova.
- Backups devem validar tabelas essenciais e presença de movimentações; um banco vazio não é backup válido.
- O atualizador só instala versão maior, faz backup obrigatório e salva o banco antes de reiniciar.
- Atualizações substituem apenas `resources.neu`; nunca o diretório de dados.

## Qualidade e entrega

1. Interfaces e mensagens em português claro.
2. Ícones somente em SVG coerente com a identidade CELC; não usar emojis, símbolos Unicode ou ícones genéricos.
3. Todo diagnóstico cita arquivo e linha; não deduza sem evidência.
4. Toda mudança estrutural atualiza `GRAPHIFY.md`, documentação e testes.
5. Todo build sobe a versão em `neutralino.config.json`.
6. Antes da entrega: validar sintaxe, regra afetada, migração quando houver e console sem erros.

## Release e atualização online

Toda versão publicada deve gerar uma release GitHub versionada. O pacote de entrega é preparado com `node tools/preparar-release.mjs` após o build e contém, em `Release/vX.Y.Z/`:

- tag `vX.Y.Z`, título e notas em `RELEASE.md`;
- `resources.neu` para atualização automática;
- `latest.json` com `applicationId`, versão e URL da tag;
- `SHA256SUMS.txt`;
- `CELC-Financeiro-Setup-X.Y.Z.exe` para instalações novas.

Publicar esses artefatos juntos na GitHub Release. Nunca anexar banco, backup, dados de cliente ou credenciais. A atualização online só é considerada entregue após a tag e o `latest.json` estarem disponíveis publicamente.

## Versões publicadas

- v0.2.0 (2026-08-27): primeira distribuição instalável profissional para Windows x64. O Setup instala por usuário, reconhece uma instalação CELC anterior, preserva integralmente o banco externo e inclui o WebView2 Runtime offline para computadores novos.
- v0.1.23 (2026-08-27): situação de lançamentos deixa de ser editável e passa a ser calculada pelo registro de pagamento realizado ou pendente; Caixa diário explicita pagamentos feitos no dia; a redundância de atalhos em Despesas é removida e a marca CELC ocupa 60% da largura lateral acima do menu.
- v0.1.22 (2026-08-27): Caixa diário passa a registrar os totais de receitas e despesas do dia, com detalhamento opcional em popup e geração automática de entrada e saída; pagamentos de alunos devedores aceitam valor total ou parcial, atualizando o saldo e gerando entrada no caixa; Relatórios também exporta PDF nativo na pasta de exportações do CELC.
- v0.1.21 (2026-08-27): Relatórios ganha filtro de período e telas próprias para visão geral, entradas por categoria, despesas por categoria, fluxo de caixa realizado e inadimplência; os cálculos distinguem realizado, a receber, a pagar e projeção.
- v0.1.20 (2026-08-27): página de Categorias redesenhada para impedir sobreposição: painel de lista ampliado, ações com quebra controlada e formulário de edição organizado em bloco vertical com espaçamento premium.
- v0.1.19 (2026-08-27): Categorias agora permitem edição inline de nome e tipo e exclusão com confirmação; categorias vinculadas a lançamentos preservam integridade, bloqueando exclusão e mudança de tipo, enquanto o renomeio atualiza os lançamentos associados.
- v0.1.18 (2026-08-27): Caixa diário registra os recebimentos escolares por origem, aluno, responsável e forma de pagamento, criando automaticamente a entrada financeira correspondente; Alunos devedores registra pendências, vencimentos e baixa de quitação.
- v0.1.17 (2026-08-27): Despesas recebe ação explícita de pagamento fixo mensal; lançamentos recorrentes ganham selo "Fixo mensal" na tabela; toast foi redesenhado com contraste, título e espaçamento premium.
- v0.1.16 (2026-08-26): editar e excluir ficam disponíveis em lançamentos liquidados e pendentes; exclusão exige confirmação em dois cliques; lista de categorias passa a separar nome, selo de tipo e ação com espaçamento correto.
- v0.1.15 (2026-08-26): refinamento visual de espaçamentos premium: painéis, métricas, relatórios, tabelas, toolbar e Configurações ganham respiro interno e separação entre blocos.
- v0.1.14 (2026-08-26): navegação lateral religada com renderização segura por página; botões de editar, baixar, excluir, filtrar, categorias, relatórios, backup e atualização passam a ser reassociados após cada troca de tela; fallback de banco em memória deixa o app abrir mesmo se o SQLite nativo falhar.
- v0.1.13 (2026-08-26): reconstrução dos módulos financeiros: telas próprias de entradas, despesas, contas a pagar, contas a receber, categorias e relatórios; saldo realizado separado da projeção; lançamentos sem dados fictícios; CRUD e baixa passam pela API interna.
- v0.1.12 (2026-08-26): módulo de Categorias cadastra e persiste categorias de entradas e saídas; lançamentos passam a selecioná-las diretamente.
- v0.1.11 (2026-08-26): Atualizações online passam a ser automáticas, sem campo técnico; Configurações adota abas horizontais e painel editorial em duas colunas.
- v0.1.10 (2026-08-26): restaurada a interface interna; ícone nativo do executável e da janela passou a usar a identidade CELC.
- v0.1.9 (2026-08-26): identidade visual passou a usar a logo CELC fornecida pelo colégio; ícones genéricos foram removidos da interface exibida.
- v0.1.8 (2026-08-26): página de Configurações passa a ocupar apenas a área de conteúdo; barra lateral permanece fixa e a rolagem é visualmente oculta.
- v0.1.7 (2026-08-26): baixas financeiras permitem marcar cada pendência como paga ou recebida, com auditoria e persistência no SQLite.
- v0.1.6 (2026-08-26): contas a pagar e contas a receber receberam filtros independentes; lançamento agora exige categoria e permite competência explícita.
- v0.1.5 (2026-08-26): Configurações em página própria com abas de segurança, backup/restauração e atualização online via manifesto GitHub, incluindo toast de atualização disponível.
- v0.1.4 (2026-08-26): menu, lançamentos, filtros, relatórios, backup e configurações passaram a executar ações reais no SQLite externo.
- v0.1.3 (2026-08-26): corrigida a chamada de movimentação de arquivos da API Neutralino na gravação segura do banco.
- v0.1.2 (2026-08-26): tela de login independente, senha com PBKDF2 no SQLite externo e persistência/backup com substituição segura e validação de integridade.
- v0.1.1 (2026-08-25): SQLite externo integrado ao executável portátil; lançamentos passam a persistir fora da pasta do aplicativo. Verificação: 6 asserções de regras financeiras e abertura do executável.
- v0.1.0 (2026-08-25): fundação do CELC Financeiro, dashboard demonstrativo e arquitetura inicial.
