import assert from 'node:assert/strict';
import {resumirCaixaDiario} from '../src/js/backend/core/escolar.js';
import {saldoDinheiroEmMaos} from '../src/js/backend/core/pagamentos.js';

const caixa=[
  {id:'entrada-pix',data:'2026-11-06',tipo:'entrada',origem:'Mensalidade',formaPagamento:'Pix',valorCentavos:100000},
  {id:'saida-transferencia',data:'2026-11-06',tipo:'despesa',origem:'Fornecedor',formaPagamento:'Transferência',valorCentavos:40000},
  {id:'entrada-dinheiro',data:'2026-11-06',tipo:'entrada',origem:'Evento',formaPagamento:'Dinheiro',valorCentavos:20000},
  {id:'saida-dinheiro',data:'2026-11-06',tipo:'despesa',origem:'Material',formaPagamento:'Dinheiro',valorCentavos:20000}
];
const db={listarCaixaDiario:()=>caixa};
const resumo=resumirCaixaDiario(db,{data:'2026-11-06'});
assert.equal(resumo.saldo,60000,'saldo geral considera todas as formas');
assert.equal(resumo.dinheiroReceitas,20000,'separa entrada em dinheiro');
assert.equal(resumo.dinheiroDespesas,20000,'separa saída em dinheiro');
assert.equal(resumo.dinheiroEmMaos,0,'dinheiro em mãos não inclui Pix ou transferência');
assert.equal(saldoDinheiroEmMaos(db),0,'saldo físico global não inclui meios eletrônicos');
console.log('5 asserções aprovadas — saldo geral separado do dinheiro em mãos.');
