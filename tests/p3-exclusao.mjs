import assert from 'node:assert/strict';
import {fixture} from './p0-fixture.mjs';
let n=0;
await fixture(async({abrir})=>{
  const {banco,api}=await abrir();
  const foto=async()=>JSON.stringify({
    painel:await api('painel:fluxo',{referencia:'2026-11',hoje:'2026-11-17'}),
    relatorio:await api('relatorios:resumo',{inicio:'2026-11-01',fim:'2026-11-30',hoje:'2026-11-17'}),
    caixa:await api('caixa:resumo',{data:'2026-11-10'})
  });
  await api('lancamentos:criar',{tipo:'entrada',descricao:'Mensalidades',categoria:'Receitas escolares',categoriaId:'cat-receitas',competencia:'2026-11-10',valorCentavos:100000,liquidado:true,dataLiquidacao:'2026-11-10'});
  const base=await foto();
  // Despesas lançadas erradas: paga integral em dinheiro, parcial em Pix, pendente.
  const a=await api('despesas:salvar',{descricao:'Errada paga',categoria:'Pessoal',categoriaId:'cat-pessoal',competencia:'2026-11-10',valorCentavos:50000,favorecido:'Fulano',pagamentos:[{data:'2026-11-10',valorCentavos:50000,formaPagamento:'Dinheiro'}]});
  const b=await api('despesas:salvar',{descricao:'Errada parcial',categoria:'Pessoal',categoriaId:'cat-pessoal',competencia:'2026-11-10',valorCentavos:30000,favorecido:'',pagamentos:[{data:'2026-11-10',valorCentavos:10000,formaPagamento:'Pix'}]});
  const c=await api('despesas:salvar',{descricao:'Errada pendente',categoria:'Pessoal',categoriaId:'cat-pessoal',competencia:'2026-11-12',valorCentavos:20000,favorecido:''});
  assert.ok(a.ok&&b.ok&&c.ok);
  const comDespesas=await foto();
  assert.notEqual(comDespesas,base,'as despesas entram nos cálculos');n++;
  const p=JSON.parse(comDespesas).painel;assert.equal(p.saidas,60000);assert.equal(p.aPagar,40000);n++;
  // Despesa paga pelo detalhamento do caixa e despesa avulsa do caixa.
  const d=await api('despesas:salvar',{descricao:'Errada no caixa',categoria:'Pessoal',categoriaId:'cat-pessoal',competencia:'2026-11-10',valorCentavos:15000,favorecido:''});
  assert.equal((await api('caixa:pagarDespesa',{id:d.id,data:'2026-11-10',valorCentavos:15000,formaPagamento:'Dinheiro'})).ok,true);
  assert.equal((await api('caixa:registrar',{data:'2026-11-10',despesasCentavos:7000,formaPagamento:'Dinheiro'})).ok,true);
  const avulsa=banco.listarLancamentos().find(x=>x.descricao==='Caixa diário - despesa');
  assert.equal(JSON.parse(await foto()).painel.saidas,82000);n++;
  for(const id of [d.id,avulsa.id])assert.equal((await api('lancamentos:excluir',{id})).ok,true);
  for(const id of [a.id,b.id,c.id])assert.equal((await api('lancamentos:excluir',{id})).ok,true);
  assert.equal(banco.listarLancamentos().filter(x=>x.tipo==='despesa').length,0,'despesas apagadas');
  assert.equal(banco.listarCaixaDiario().length,0,'pagamentos das despesas apagados do caixa');n++;
  assert.equal(await foto(),base,'painel, relatórios e caixa voltam exatamente ao estado sem as despesas');n++;
});
console.log(`Exclusão de despesa: ${n} grupos aprovados — despesa paga, parcial e pendente saem do painel, relatórios, caixa e dinheiro em espécie.`);
