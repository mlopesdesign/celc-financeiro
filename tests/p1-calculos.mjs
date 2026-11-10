import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {fixture} from './p0-fixture.mjs';

// Relógio fixo: 31/10/2026 às 22h30 no fuso de Brasília (01:30 UTC de 01/11).
const RealDate=Date,instante=new RealDate('2026-11-01T01:30:00.000Z').getTime();
class Relogio extends RealDate{constructor(...a){super(...(a.length?a:[instante]));}static now(){return instante;}}
const emSaoPaulo=process.env.TZ==='America/Sao_Paulo';
globalThis.Date=Relogio;
const {hojeLocal}=await import('../src/js/backend/core/datas.js');
const HOJE=hojeLocal();
assert.equal(HOJE,emSaoPaulo?'2026-10-31':'2026-11-01','hojeLocal deve seguir o relógio do Windows');
let n=1;

await fixture(async({abrir})=>{
  const {banco,api}=await abrir();
  const lista=()=>banco.listarLancamentos(),caixa=()=>banco.listarCaixaDiario(),devedores=()=>banco.listarDevedores();

  // CALC-02/08: recebimento registrado às 22h30 fica no dia local; data informada é respeitada.
  let r=await api('lancamentos:criar',{tipo:'entrada',descricao:'Mensalidade A',categoria:'Receitas escolares',categoriaId:'cat-receitas',competencia:'2026-10-05',valorCentavos:80000,liquidado:true});
  assert.equal(r.ok,true);assert.equal(lista().find(x=>x.descricao==='Mensalidade A').liquidadoEm.slice(0,10),HOJE);n++;
  r=await api('lancamentos:criar',{tipo:'entrada',descricao:'Mensalidade B',categoria:'Receitas escolares',categoriaId:'cat-receitas',competencia:'2026-10-05',valorCentavos:50000,liquidado:true,dataLiquidacao:'2026-10-05'});
  assert.equal(lista().find(x=>x.descricao==='Mensalidade B').liquidadoEm.slice(0,10),'2026-10-05');n++;
  // data futura é ignorada (vira hoje)
  r=await api('lancamentos:criar',{tipo:'entrada',descricao:'Mensalidade C',categoria:'Receitas escolares',categoriaId:'cat-receitas',competencia:'2026-10-05',valorCentavos:1000,liquidado:true,dataLiquidacao:'2030-01-01'});
  assert.equal(lista().find(x=>x.descricao==='Mensalidade C').liquidadoEm.slice(0,10),HOJE);n++;
  // corrigir a data de um recebimento já baixado
  const idB=lista().find(x=>x.descricao==='Mensalidade B').id;
  assert.equal((await api('lancamentos:editar',{id:idB,dataLiquidacao:'2026-10-06',liquidado:true})).ok,true);
  assert.equal(lista().find(x=>x.id===idB).liquidadoEm.slice(0,10),'2026-10-06');n++;

  // CALC-12: editar só o valor não apaga vencimento nem recorrência.
  r=await api('lancamentos:criar',{tipo:'entrada',descricao:'Aluguel cantina',categoria:'Receitas escolares',categoriaId:'cat-receitas',competencia:'2026-10-10',vencimento:'2026-10-10',recorrencia:'mensal',valorCentavos:30000,liquidado:false});
  const idAl=r.lancamento.id;
  assert.equal((await api('lancamentos:editar',{id:idAl,valorCentavos:31000})).ok,true);
  const al=lista().find(x=>x.id===idAl);assert.equal(al.vencimento,'2026-10-10');assert.equal(al.recorrencia,'mensal');n++;

  // CALC-09: baixa do saldo de despesa parcial não força "Dinheiro".
  r=await api('despesas:salvar',{descricao:'Fornecedor',categoria:'Pessoal',categoriaId:'cat-pessoal',competencia:'2026-10-01',valorCentavos:10000,favorecido:'',pagamentos:[{data:'2026-10-02',valorCentavos:4000,formaPagamento:'Pix'}]});
  assert.equal(r.ok,true);
  assert.equal((await api('lancamentos:baixar',{id:r.id})).ok,true);
  const ultimo=caixa().find(x=>x.lancamentoId===r.id&&x.valorCentavos===6000);
  assert.notEqual(ultimo.formaPagamento,'Dinheiro');assert.equal(ultimo.data,HOJE);assert.equal(ultimo.valorCentavos,6000);n++;

  // CALC-14: pagamento com data futura é recusado.
  const d2=await api('despesas:salvar',{descricao:'Energia',categoria:'Serviços e utilidades',categoriaId:'cat-utilidades',competencia:'2026-10-01',valorCentavos:5000});
  assert.equal((await api('despesas:pagar',{id:d2.id,valorCentavos:5000,data:'2030-01-01',formaPagamento:'Pix'})).ok,false);n++;

  // CALC-07: caixa diário não usa os IDs das categorias renomeáveis.
  r=await api('caixa:registrar',{data:HOJE,receitasCentavos:11100,despesasCentavos:2000,formaPagamento:'Dinheiro'});assert.equal(r.ok,true);
  const doCaixa=lista().filter(x=>x.descricao.startsWith('Caixa diário'));
  assert.equal(doCaixa.map(x=>x.categoriaId).sort().join(','),'cat-caixa-despesas,cat-caixa-receitas');n++;

  // CALC-13: entrada gerada pelo caixa não pode ter o valor mudado pela tela Entradas.
  const entCaixa=doCaixa.find(x=>x.tipo==='entrada');
  assert.equal((await api('lancamentos:editar',{id:entCaixa.id,valorCentavos:5000})).ok,false);n++;

  // CALC-03: excluir a entrada gerada pelo caixa remove a linha do caixa.
  assert.equal((await api('lancamentos:excluir',{id:entCaixa.id})).ok,true);
  assert.equal(caixa().some(x=>x.lancamentoId===entCaixa.id),false);n++;

  // CALC-03 + devedor: excluir o lançamento de pagamento de aluno estorna o devedor.
  r=await api('devedores:registrar',{aluno:'Bruno',descricao:'Mensalidade outubro',valorCentavos:40000,vencimento:'2026-10-10'});const dev=r.devedor.id;
  r=await api('devedores:baixar',{id:dev,valorCentavos:40000,formaPagamento:'Dinheiro'});assert.equal(r.ok,true);
  assert.equal(devedores().find(x=>x.id===dev).situacao,'quitado');
  assert.equal((await api('lancamentos:excluir',{id:r.lancamentoId})).ok,true);
  let dv=devedores().find(x=>x.id===dev);assert.equal(dv.situacao,'em_aberto');assert.equal(dv.valorPagoCentavos,0);
  assert.equal(caixa().some(x=>x.lancamentoId===r.lancamentoId),false);n++;

  // CALC-04: excluir no caixa uma entrada de devedor remove o lançamento e estorna parcialmente.
  r=await api('devedores:baixar',{id:dev,valorCentavos:15000,formaPagamento:'Pix'});
  const r2=await api('devedores:baixar',{id:dev,valorCentavos:10000,formaPagamento:'Pix'});
  assert.equal(devedores().find(x=>x.id===dev).situacao,'parcial');
  assert.equal((await api('caixa:excluir',{id:r2.caixaId})).ok,true);
  dv=devedores().find(x=>x.id===dev);assert.equal(dv.valorPagoCentavos,15000);assert.equal(dv.situacao,'parcial');
  assert.equal(lista().some(x=>x.id===r2.lancamentoId),false);n++;
  assert.equal((await api('caixa:excluir',{id:r.caixaId})).ok,true);
  assert.equal(devedores().find(x=>x.id===dev).situacao,'em_aberto');n++;

  // Auditoria da exclusão do caixa grava data válida (antes gravava o nome da origem no campo da data).
  const aud=banco.linhas("SELECT criado_em FROM auditoria WHERE entidade='caixa_diario' AND acao='excluir'");
  assert.ok(aud.length>0&&aud.every(x=>/^\d{4}-\d{2}-\d{2}T/.test(x.criado_em)));n++;
  // Excluir no caixa uma receita do fechamento remove o lançamento.
  r=await api('caixa:registrar',{data:HOJE,receitasCentavos:30000,formaPagamento:'Dinheiro'});
  const linha=caixa().find(x=>x.tipo==='entrada'&&x.valorCentavos===30000);
  assert.equal((await api('caixa:excluir',{id:linha.id})).ok,true);
  assert.equal(lista().some(x=>x.id===linha.lancamentoId),false);n++;
});

await fixture(async({abrir})=>{
  const {banco,api}=await abrir();
  const lista=()=>banco.listarLancamentos();
  // CALC-05: dia 31 vira último dia do mês; data inexistente é recusada.
  assert.equal((await api('lancamentos:criar',{tipo:'despesa',descricao:'X',categoria:'Pessoal',categoriaId:'cat-pessoal',competencia:'2026-02-31',valorCentavos:100,liquidado:false})).ok,false);n++;
  await api('despesas:salvar',{descricao:'Salário',categoria:'Pessoal',categoriaId:'cat-pessoal',competencia:'2026-01-31',vencimento:'2026-01-31',recorrencia:'mensal',valorCentavos:150000});
  // CALC-06: dois modelos com o mesmo nome são gerados.
  await api('despesas:salvar',{descricao:'Professor',categoria:'Pessoal',categoriaId:'cat-pessoal',competencia:'2026-01-05',recorrencia:'mensal',valorCentavos:120000});
  await api('despesas:salvar',{descricao:'Professor',categoria:'Pessoal',categoriaId:'cat-pessoal',competencia:'2026-01-05',recorrencia:'mensal',valorCentavos:95000});
  await api('lancamentos:recorrencias',{referencia:'2026-02-10'});
  const fev=lista().filter(x=>x.competencia.startsWith('2026-02'));
  assert.equal(fev.find(x=>x.descricao==='Salário').competencia,'2026-02-28');
  assert.equal(fev.find(x=>x.descricao==='Salário').vencimento,'2026-02-28');
  assert.equal(fev.filter(x=>x.descricao==='Professor').map(x=>x.valorCentavos).sort((a,b)=>a-b).join(','),'95000,120000');n++;
  // Rodar de novo não duplica.
  await api('lancamentos:recorrencias',{referencia:'2026-02-10'});
  assert.equal(lista().filter(x=>x.competencia.startsWith('2026-02')).length,3);n++;
  // CALC-06: meses sem abrir o programa são preenchidos (março e abril).
  await api('lancamentos:recorrencias',{referencia:'2026-04-10'});
  assert.equal(lista().filter(x=>x.competencia.startsWith('2026-03')).length,3);
  assert.equal(lista().filter(x=>x.competencia.startsWith('2026-04')).length,3);
  assert.equal(lista().find(x=>x.descricao==='Salário'&&x.competencia.startsWith('2026-04')).competencia,'2026-04-30');n++;
});

// UI-05: conversão do valor digitado.
const app=await readFile(new URL('../src/js/app.js',import.meta.url),'utf8');
const fonte=app.match(/function centavosDe\(texto\)\{.*?\n/)[0];
const centavosDe=vm.runInNewContext(`(${fonte.trim().replace(/^function centavosDe/,'function')})`);
const casos=[['1.234,56',123456],['1.200',120000],['1234,56',123456],['1234.56',123456],['R$ 10',1000],['10',1000],['0,5',50],['1.20',120],['12.345.678,90',1234567890]];
for(const [t,v] of casos)assert.equal(centavosDe(t),v,`"${t}"`);
for(const t of ['','-5','0,285','abc','1,2,3'])assert.ok(Number.isNaN(centavosDe(t)),`"${t}" deve ser recusado`);n++;
assert.equal((app.match(/Math\.round\(Number\(/g)||[]).length,1,'todo valor digitado passa por centavosDe (única conversão fica dentro dela)');
assert.equal(/type="number"/.test(app),false,'campos de dinheiro não usam type=number');n++;
// UI-02: o app recalcula o dia a cada tela.
assert.ok(app.includes('let hoje=hojeLocal();')&&app.includes('hoje=hojeLocal();'));n++;
// Exclusão: confirmação explícita e botão Excluir também nas receitas do caixa.
assert.ok(app.includes('function confirmarExclusao')&&!app.includes("botao.textContent='Confirmar'")&&!app.includes(":'—'}</td></tr>`).join('')||'<tr><td colspan=\"6\""));n++;
// UI-06: guarda contra clique duplo em formulários.
assert.ok(app.includes("document.addEventListener('submit'")&&app.includes('envios.has(form)'));n++;
// UI-07: autopreenchimento não sobrescreve valor nem recorrência.
assert.ok(!/form\.recorrencia\.value=ultimo\.recorrencia/.test(app)&&app.includes('if(!form.valor.value)form.valor.value='));n++;
// Senha e login intocados.
const auth=await readFile(new URL('../src/js/auth.js',import.meta.url),'utf8');
assert.ok(auth.includes('admin123'));n++;

globalThis.Date=RealDate;
console.log(`P1 (${process.env.TZ||'TZ padrão'}): ${n} grupos de asserções aprovados — data local, recebimento, baixa, exclusões sincronizadas, recorrência, valor digitado, clique duplo e autopreenchimento.`);
