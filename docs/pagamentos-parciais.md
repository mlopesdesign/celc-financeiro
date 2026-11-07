# Pagamentos parciais de despesas

O valor integral pertence a um único lançamento. Cada pagamento efetivo é uma linha em `caixa_diario` vinculada pelo `lancamento_id`; não é criado outro lançamento para cada parte.

- Saldo = valor integral menos a soma dos pagamentos vinculados.
- Um saldo positivo mantém a despesa aberta. O rótulo Parcial é calculado para apresentação.
- Despesas antigas pagas sem detalhamento de caixa continuam tendo seu valor original reconhecido como realizado.
- O relatório por competência usa o mês da despesa; o fluxo de caixa usa a data real de cada pagamento.
- Salvar a despesa e suas partes usa uma transação SQLite. As chamadas da API são serializadas.
- Um pagamento maior que o saldo é recusado. A exclusão confirmada da despesa remove, na mesma transação, os pagamentos vinculados e a auditoria da exclusão.
- O estorno de uma parte conserva as demais e recalcula o saldo.
- Nenhum registro do cliente é migrado ou reclassificado por esta alteração.

O formulário oferece valor integral e pagamentos com valor, data e forma. Ao informar uma parte, oferece outra linha enquanto houver saldo. Linhas vazias não são gravadas.

O dashboard compara duas competências e permite consultar outros meses. O histórico da categoria agrupa os lançamentos por competência. A base para provisão é a média dos totais lançados nas duas competências exibidas, claramente identificada como referência, não como receita garantida.
