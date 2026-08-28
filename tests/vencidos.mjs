import assert from 'node:assert/strict';
import {atualizarLancamentosVencidos} from '../src/js/backend/core/lancamentos.js';

const itens=[
  {id:'entrada-vencida',tipo:'entrada',situacao:'previsto',vencimento:'2026-08-10'},
  {id:'despesa-vencida',tipo:'despesa',situacao:'pendente',vencimento:'2026-08-11'},
  {id:'futura',tipo:'entrada',situacao:'previsto',vencimento:'2026-08-30'},
  {id:'liquidada',tipo:'despesa',situacao:'pago',vencimento:'2026-08-01'},
  {id:'sem-vencimento',tipo:'entrada',situacao:'previsto',vencimento:null}
];
const auditoria=[];
const db={listarLancamentos:()=>itens.map(item=>({...item})),executar:async(sql,parametros)=>{if(sql.startsWith('UPDATE lancamentos')){const item=itens.find(x=>x.id===parametros.at(-1));item.situacao=parametros[0];}if(sql.startsWith('INSERT INTO auditoria'))auditoria.push(parametros);}};
const resultado=await atualizarLancamentosVencidos(db,{referencia:'2026-08-20'});
assert.equal(resultado.ok,true);
assert.equal(resultado.quantidade,2);
assert.equal(itens.find(x=>x.id==='entrada-vencida').situacao,'vencido');
assert.equal(itens.find(x=>x.id==='despesa-vencida').situacao,'vencido');
assert.equal(itens.find(x=>x.id==='futura').situacao,'previsto');
assert.equal(itens.find(x=>x.id==='liquidada').situacao,'pago');
assert.equal(auditoria.length,2);
console.log('7 asserções aprovadas — automação de vencidos.');
