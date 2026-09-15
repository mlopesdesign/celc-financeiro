import assert from 'node:assert/strict';
import {resumirLancamentos} from '../src/js/backend/core/lancamentos.js';

const itens=[
  {id:'entrada-paga',tipo:'entrada',valorCentavos:10000,competencia:'2026-08-05',situacao:'recebido'},
  {id:'despesa-paga',tipo:'despesa',valorCentavos:3500,competencia:'2026-08-06',situacao:'pago'},
  {id:'despesa-do-mes',tipo:'despesa',valorCentavos:500,competencia:'2026-08-25',situacao:'pendente'},
  {id:'despesa-vencida',tipo:'despesa',valorCentavos:2400,competencia:'2026-07-20',situacao:'vencido'},
  {id:'despesa-futura',tipo:'despesa',valorCentavos:900,competencia:'2026-09-10',situacao:'pendente'}
];
const resumo=resumirLancamentos({listarLancamentos:()=>itens},'2026-08-25');
assert.equal(resumo.saldoDisponivel,6500);
assert.equal(resumo.previsto,-2900);
assert.equal(resumo.projecao,3600);
assert.equal(resumo.doMes.length,3);
console.log('4 asserções aprovadas — projeção mensal inclui vencidos e exclui competências futuras.');
