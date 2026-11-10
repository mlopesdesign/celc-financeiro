import {hojeLocal} from './datas.js';
const dataValida=valor=>/^\d{4}-\d{2}-\d{2}$/.test(valor)&&!Number.isNaN(Date.parse(`${valor}T12:00:00Z`))&&new Date(`${valor}T12:00:00Z`).toISOString().slice(0,10)===valor;

export function pagamentosDaDespesa(db,item){
  return (db.listarCaixaDiario?.()||[]).filter(x=>x.tipo==='despesa'&&x.lancamentoId===item.id);
}

export function valorRealizado(db,item){
  if(item.tipo==='entrada')return item.situacao==='recebido'?item.valorCentavos:0;
  const pagamentos=pagamentosDaDespesa(db,item);
  return pagamentos.length?pagamentos.reduce((s,x)=>s+x.valorCentavos,0):item.situacao==='pago'?item.valorCentavos:0;
}

const formaDinheiro=item=>String(item?.formaPagamento||'').trim().toLocaleLowerCase('pt-BR')==='dinheiro';
export function saldoDinheiroEmMaos(db){
  return (db.listarCaixaDiario?.()||[]).filter(formaDinheiro).reduce((saldo,item)=>saldo+(item.tipo==='entrada'?1:-1)*Number(item.valorCentavos||0),0);
}

export const saldoDoLancamento=(db,item)=>Math.max(0,item.valorCentavos-valorRealizado(db,item));

export function fluxoRealizado(db){
  return db.listarLancamentos().flatMap(item=>{
    const pagamentos=item.tipo==='despesa'?pagamentosDaDespesa(db,item):[];
    if(pagamentos.length)return pagamentos.map(p=>({...item,valorCentavos:p.valorCentavos,data:p.data,liquidadoEm:p.data,situacao:'pago',pagamentoId:p.id,formaPagamento:p.formaPagamento}));
    return valorRealizado(db,item)?[{...item,data:(item.liquidadoEm||item.competencia).slice(0,10)}]:[];
  });
}

export async function registrarPagamentoDespesa(db,dados,u={id:'direcao-celc'}){
  const item=db.listarLancamentos().find(x=>x.id===dados.id);
  if(!item||item.tipo!=='despesa')return {ok:false,erro:'Selecione uma despesa cadastrada.'};
  const saldo=saldoDoLancamento(db,item),valor=Number(dados.valorCentavos),data=String(dados.data||''),forma=String(dados.formaPagamento??'Não informado').trim();
  if(!Number.isSafeInteger(valor)||valor<=0)return {ok:false,erro:'Informe um pagamento maior que zero.'};
  if(valor>saldo)return {ok:false,erro:'O pagamento não pode ultrapassar o saldo da despesa.'};
  if(!dataValida(data))return {ok:false,erro:'Informe uma data de pagamento válida.'};
  if(data>hojeLocal())return {ok:false,erro:'A data do pagamento não pode ser futura.'};
  if(!forma)return {ok:false,erro:'Informe a forma de pagamento.'};
  const t=new Date().toISOString(),id=db.proximoId('caixa'),situacao=valor===saldo?'pago':'pendente';
  await db.executar('INSERT INTO caixa_diario (id,data,competencia,tipo,origem,aluno,responsavel,forma_pagamento,valor_centavos,observacao,lancamento_id,criado_em,usuario_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',[id,data,item.competencia,'despesa',item.descricao,'','',forma,valor,String(dados.observacao||''),item.id,t,u.id]);
  await db.executar('UPDATE lancamentos SET situacao=?,liquidado_em=?,atualizado_em=? WHERE id=?',[situacao,situacao==='pago'?`${data}T12:00:00.000Z`:null,t,item.id]);
  await db.executar('INSERT INTO auditoria (usuario_id,acao,entidade,entidade_id,criado_em,detalhes) VALUES (?,?,?,?,?,?)',[u.id,'pagamento_parcial','lancamento',item.id,t,JSON.stringify({pagamentoId:id,valorCentavos:valor,data,formaPagamento:forma})]);
  return {ok:true,saldoRestante:saldo-valor,pagamentoId:id};
}

export function historicoMensalCategoria(db,{categoria,tipo='despesa'}={}){
  const itens=db.listarLancamentos().filter(x=>x.tipo===tipo&&x.categoria===categoria),meses=new Map();
  for(const item of itens){const mes=item.competencia.slice(0,7),grupo=meses.get(mes)||{mes,total:0,pago:0,saldo:0,itens:[]},pago=valorRealizado(db,item);grupo.total+=item.valorCentavos;grupo.pago+=pago;grupo.saldo+=saldoDoLancamento(db,item);grupo.itens.push({...item,pagoCentavos:pago,saldoCentavos:saldoDoLancamento(db,item)});meses.set(mes,grupo);}
  return [...meses.values()].sort((a,b)=>b.mes.localeCompare(a.mes));
}
