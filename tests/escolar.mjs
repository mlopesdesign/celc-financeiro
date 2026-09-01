import assert from 'node:assert/strict';
import {registrarCaixaDiario,resumirCaixaDiario,pagarDespesaNoCaixa,registrarDevedor,listarDevedores,baixarDevedor} from '../src/js/backend/core/escolar.js';

const caixa=[],devedores=[],lancamentos=[],auditoria=[];let n=0;
const db={proximoId:p=>`${p}-${++n}`,listarCaixaDiario:()=>[...caixa],listarLancamentos:()=>[...lancamentos],listarDevedores:()=>[...devedores],executar:async(q,p)=>{if(q.startsWith('INSERT INTO lancamentos'))lancamentos.push({id:p[0],descricao:p[1],tipo:p[2],valorCentavos:p[5],situacao:p[9],liquidadoEm:p[8]});else if(q.startsWith('UPDATE lancamentos SET situacao=')){const item=lancamentos.find(x=>x.id===p[3]);item.situacao=p[0];item.liquidadoEm=p[1]}else if(q.startsWith('INSERT INTO caixa_diario'))caixa.push({id:p[0],data:p[1],tipo:p[2],origem:p[3],aluno:p[4],responsavel:p[5],formaPagamento:p[6],valorCentavos:p[7],observacao:p[8],lancamentoId:p[9],criadoEm:p[10],usuarioId:p[11]});else if(q.startsWith('INSERT INTO alunos_devedores'))devedores.push({id:p[0],aluno:p[1],turma:p[2],responsavel:p[3],contato:p[4],descricao:p[5],valorCentavos:p[6],valorPagoCentavos:0,vencimento:p[7],situacao:p[8],observacao:p[9],criadoEm:p[10],atualizadoEm:p[11],usuarioId:p[12]});else if(q.startsWith('UPDATE alunos_devedores SET situacao=')){const item=devedores.find(x=>x.id===p[3]);item.situacao=p[0];item.valorPagoCentavos=p[1];item.atualizadoEm=p[2]}else if(q.startsWith('INSERT INTO auditoria'))auditoria.push(p)}};

assert.equal((await registrarCaixaDiario(db,{data:'2026-08-27',receitasCentavos:35000,despesasCentavos:8000})).ok,true);
assert.equal(lancamentos.length,2);
assert.equal(resumirCaixaDiario(db,{data:'2026-08-27'}).receitas,35000);
assert.equal(resumirCaixaDiario(db,{data:'2026-08-27'}).despesas,8000);
lancamentos.push({id:'despesa-fixa',tipo:'despesa',descricao:'Energia elétrica',valorCentavos:12500,situacao:'pendente',liquidadoEm:null});
assert.equal((await pagarDespesaNoCaixa(db,{id:'despesa-fixa',data:'2026-08-27'})).ok,true);
assert.equal(lancamentos.find(x=>x.id==='despesa-fixa').situacao,'pago');
assert.equal(caixa.some(x=>x.lancamentoId==='despesa-fixa'&&x.formaPagamento==='Dinheiro'),true);
assert.equal((await pagarDespesaNoCaixa(db,{id:'despesa-fixa',data:'2026-08-27'})).ok,false);
const cadastroDevedor=await registrarDevedor(db,{aluno:'Bruno CELC',descricao:'Mensalidade agosto',valorCentavos:42000,vencimento:'2026-08-30'});
assert.equal(cadastroDevedor.ok,true);
assert.equal(listarDevedores(db,{situacao:'em_aberto'}).length,1);
assert.equal((await baixarDevedor(db,cadastroDevedor.devedor.id,{data:'2026-08-27',valorCentavos:12000})).situacao,'parcial');
assert.equal(listarDevedores(db,{situacao:'parcial'}).length,1);
assert.equal((await baixarDevedor(db,cadastroDevedor.devedor.id,{data:'2026-08-27',valorCentavos:30000})).situacao,'quitado');
assert.equal(listarDevedores(db,{situacao:'quitado'}).length,1);
assert.equal(auditoria.length>=4,true);
console.log('15 asserções aprovadas — caixa escolar, despesas e pagamentos parciais de alunos.');
