import assert from 'node:assert/strict';
import {resumirDashboard,salvarContagemEspecie,salvarFavorecidoDespesa} from '../src/js/backend/core/dashboard.js';

const lancamentos=[
  {id:'a',tipo:'entrada',competencia:'2025-12-20',situacao:'recebido',valorCentavos:100000},
  {id:'b',tipo:'despesa',competencia:'2025-12-22',situacao:'pendente',valorCentavos:40000,categoria:'Serviços'},
  {id:'c',tipo:'entrada',competencia:'2026-01-01',situacao:'recebido',valorCentavos:25000,liquidadoEm:'2026-02-01'},
  {id:'d',tipo:'despesa',competencia:'2026-01-20',situacao:'pago',valorCentavos:15000,liquidadoEm:'2026-02-02'}
];
const caixa=[
  {lancamentoId:'b',tipo:'despesa',data:'2025-12-30',formaPagamento:'Dinheiro',valorCentavos:5000},
  {lancamentoId:'b',tipo:'despesa',data:'2026-01-04',formaPagamento:'Dinheiro',valorCentavos:10000},
  {lancamentoId:'c',tipo:'entrada',data:'2026-01-05',formaPagamento:'Pix',valorCentavos:25000}
];
const configuracao=new Map();
const db={listarLancamentos:()=>lancamentos,listarCaixaDiario:()=>caixa,obterConfiguracao:k=>configuracao.get(k),salvarConfiguracao:async(k,v)=>{configuracao.set(k,v);}};
const janeiro=()=>resumirDashboard(db,{referencia:'2026-01',hoje:'2026-02-03'});
const r=janeiro();
assert.deepEqual([r.saldoInicial,r.entradas,r.saidas,r.resultado,r.saldoFinal],[95000,25000,10000,15000,110000]);
assert.equal(r.anteriores,10000);
assert.equal(r.despesasAnteriores[0].competencia,'2025-12-22');
assert.deepEqual(r.anos.map(x=>[x.periodo,x.saldoInicial,x.saldoFinal]),[['2026',95000,110000],['2025',0,95000]]);
assert.equal(r.aPagar,40000);
assert.equal(r.aPagarAnterior,25000);
assert.equal(r.aReceberAnterior,0);
assert.equal(r.projecao,70000);
assert.equal(r.especie.esperado,null);
assert.equal(r.especie.liquidoMes,-10000);
assert.equal(r.pendencias.reduce((s,x)=>s+x.saldo,0),r.aPagar);
const parcela=r.pendencias.find(x=>x.id==='b');
assert.deepEqual([parcela.trazido,parcela.pagoMes,parcela.pagoTotal,parcela.saldo],[35000,10000,15000,25000]);
assert.deepEqual(parcela.parcelas.map(x=>x.formaPagamento),['Dinheiro','Dinheiro']);
assert.equal(parcela.favorecido,'');
await salvarFavorecidoDespesa(db,'b','Prestador de teste');
assert.equal(janeiro().pendencias.find(x=>x.id==='b').favorecido,'Prestador de teste');
assert.equal(r.entradasPorDia[0].total,25000);
assert.equal(r.entradasPorDia[0].semDiscriminacao,0);
const semDiscriminacao=resumirDashboard({...db,listarCaixaDiario:()=>caixa.map(x=>x.tipo==='entrada'?{...x,formaPagamento:'Dinheiro',origem:'Fechamento diário'}:x)},{referencia:'2026-01',hoje:'2026-02-03'});
assert.equal(semDiscriminacao.entradasPorDia[0].semDiscriminacao,25000);
assert.equal(semDiscriminacao.especie.liquidoMes,-10000);
assert.equal(semDiscriminacao.movimentosPorForma.find(x=>x.forma==='Sem discriminação').entradas,25000);
const quitacao=resumirDashboard({...db,listarCaixaDiario:()=>[...caixa,{lancamentoId:'b',tipo:'despesa',data:'2026-01-20',formaPagamento:'Pix',valorCentavos:25000}]},{referencia:'2026-01',hoje:'2026-02-03'});
assert.deepEqual(quitacao.pendencias.filter(x=>x.id==='b').map(x=>[x.trazido,x.pagoMes,x.saldo]),[[35000,35000,0]]);
assert.equal((await salvarContagemEspecie(db,{data:'2025-12-31',valorCentavos:25000},'2026-01-05')).ok,true);
assert.equal(janeiro().especie.esperado,15000);
assert.equal((await salvarContagemEspecie(db,{data:'2026-02-30',valorCentavos:0},'2026-03-01')).ok,false);
assert.equal(resumirDashboard(db,{referencia:'2026-01',hoje:'2026-01-03'}).saidas,0);
console.log('Dashboard: virada de ano, pagamentos parciais, competência anterior, corte de datas e contagem em espécie aprovados.');
