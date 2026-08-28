# Teste da versão 0.2.1

## Abertura e navegação

1. Abra `Release/CELC-Financeiro-Setup-0.2.1.exe` e conclua a instalação.
2. Confirme que a janela abre no painel interno do CELC Financeiro.
3. Clique em todos os itens da barra lateral: Visão geral, Caixa diário, Alunos devedores, Entradas, Despesas, Contas a receber, Contas a pagar, Categorias, Relatórios e Configurações.
4. Cada item precisa trocar o título da página, manter a barra lateral fixa e carregar conteúdo próprio sem tela branca.

## Funções financeiras

1. Use **Novo lançamento** para cadastrar uma entrada recebida e uma despesa paga.
2. Abra **Entradas** e **Despesas** para conferir se cada lançamento aparece na lista correta.
3. Cadastre uma entrada prevista e uma despesa pendente.
4. Abra **Contas a receber** e **Contas a pagar**, use **Receber** e **Pagar**, e confirme a mudança de situação.
5. Teste **Editar** e **Excluir** em lançamento ainda não liquidado.
6. Use o campo de busca nas listas para filtrar por descrição ou categoria.

## Rotina escolar

1. Em **Caixa diário**, informe os totais de receitas recebidas e de **Pagamentos feitos no dia**. Use **Detalhar movimentações** somente se precisar informar origem, aluno, responsável, forma de pagamento ou observação.
2. Confirme receitas, despesas e saldo do dia; cada total informado deve aparecer também em **Entradas** ou **Despesas**.
3. Em **Alunos devedores**, registre uma pendência com aluno, descrição, vencimento e valor.
4. Use **Receber pagamento** para registrar uma quitação total ou parcial. Confirme que o saldo restante e o selo de situação são atualizados; cada pagamento deve criar uma entrada no Caixa diário e em Entradas.

## Administração

1. Em **Categorias**, cadastre uma categoria de entrada e outra de despesa. Edite o nome e o tipo de uma categoria sem lançamentos e confirme a atualização.
2. Use **Excluir** em uma categoria sem lançamentos: a exclusão só deve ocorrer após o segundo clique de confirmação. Em categoria já usada, o sistema deve impedir exclusão e mudança de tipo, mas permitir renomear.
3. Abra a edição de uma categoria e confirme que os campos Nome, Tipo, Salvar e Cancelar permanecem em linhas separadas, sem qualquer sobreposição de textos, campos ou ações.
2. Em **Relatórios**, gere o CSV.
3. Em **Configurações**, teste as abas Segurança, Backup e Atualização.
4. A aba Atualização não deve pedir endereço técnico: a consulta usa o canal oficial configurado no sistema.

## Relatórios

1. Em **Relatórios**, altere o período e use **Atualizar período**.
2. Em **Visão geral**, confirme a separação entre entradas e despesas realizadas, a receber, a pagar, resultado realizado e resultado projetado.
3. Abra as abas **Entradas** e **Despesas**: cada categoria deve exibir realizado, pendência e projeção em linhas próprias.
4. Em **Fluxo de caixa**, devem aparecer somente lançamentos recebidos ou pagos, na data da baixa.
5. Em **Inadimplência**, confira total em aberto, vencidos e a relação dos alunos pendentes.
6. Use **Exportar CSV** e **Exportar PDF** e confirme que os dois arquivos respeitam o período escolhido.

## Critério de aprovação

- Nenhum botão do menu lateral pode ficar sem ação.
- Nenhuma página pode abrir em branco.
- Botões de ação devem retornar toast de sucesso ou erro claro.
- O banco continua em `%APPDATA%\CELC Financeiro\dados\celc-financeiro.db`.
- O instalador oficial fica em `Release/`.
