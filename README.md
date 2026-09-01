# CELC Financeiro

Sistema financeiro instalável do Colégio CELC para Windows. A primeira versão organiza entradas, despesas diárias e mensais, contas pendentes e o resultado financeiro em um painel simples e premium.

## Visão do produto

O diretor visualiza o saldo, as entradas, as despesas, as contas próximas do vencimento e os indicadores do mês em uma única tela. Os dados ficam no computador do colégio, separados dos arquivos atualizáveis do programa.

## Princípios

- Instalável: Setup profissional para Windows, sem Java ou Node no computador do cliente; inclui WebView2 offline.
- Privado: banco local em `%APPDATA%\CELC Financeiro\dados`.
- Seguro: credencial derivada por PBKDF2 no banco externo, backup validado e persistência com recuperação atômica.
- Simples: interface em português, com prioridade para o diretor.
- Premium: branco, azul-marinho e azul-turquesa institucional do CELC.

## Módulos do MVP

1. Visão geral financeira.
2. Entradas e mensalidades.
3. Despesas avulsas e recorrentes.
4. Contas a pagar e receber.
5. Categorias, comprovantes e filtros.
6. Relatórios e exportação.
7. Atualização online pelo GitHub Releases (depende da definição do repositório oficial).

## Estrutura

Consulte [AGENTS.md](AGENTS.md) para as regras de desenvolvimento e [GRAPHIFY.md](GRAPHIFY.md) para o mapa técnico do sistema.

## Situação atual

Versão de instalação `0.2.9`: dashboard funcional, lançamentos de entrada e despesa persistidos em SQLite no diretório externo do usuário, módulo de alunos devedores oculto na navegação e atualização online com download validado, troca resiliente e reabertura automática. Consulte `docs/TESTE-DA-VERSAO.md` antes de testar.
