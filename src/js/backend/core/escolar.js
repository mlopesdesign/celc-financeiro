const agora=()=>new Date().toISOString();
const dinheiro=x=>Number(x);

function texto(valor){return String(valor||'').trim();}
function valorCentavos(valor){const n=dinheiro(valor);return Number.isSafeInteger(n)&&n>0?n:null;}

export async function registrarCaixaDiario(db,dados,u={id:'direcao-celc'}){
  const data=texto(dados.data),origem=texto(dados.origem)||'Fechamento diário',forma=texto(dados.formaPagamento||dados.forma_pagamento)||'Não informado',receita=valorCentavos(dados.receitasCentavos??dados.receitaCentavos??dados.valorCentavos),despesa=valorCentavos(dados.despesasCentavos??dados.despesaCentavos);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(data))return {ok:false,erro:'Informe a data do caixa.'};
  if(!receita&&!despesa)return {ok:false,erro:'Informe uma receita ou uma despesa maior que zero.'};
  const t=agora(),registros=[];
  for(const [tipo,valor] of [['entrada',receita],['despesa',despesa]]){if(!valor)continue;const id=db.proximoId('caixa'),lancamentoId=db.proximoId('lanc'),descricao=`Caixa diário - ${tipo==='entrada'?'receita':'despesa'}${origem!=='Fechamento diário'?` - ${origem}`:''}`,categoria=tipo==='entrada'?'Caixa diário - receitas':'Caixa diário - despesas';await db.executar('INSERT INTO lancamentos (id,descricao,tipo,categoria_id,categoria,valor_centavos,competencia,vencimento,liquidado_em,situacao,recorrencia,criado_em,atualizado_em,usuario_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[lancamentoId,descricao,tipo,tipo==='entrada'?'cat-receitas':'cat-utilidades',categoria,valor,data,null,t,tipo==='entrada'?'recebido':'pago','avulso',t,t,u.id]);await db.executar('INSERT INTO caixa_diario (id,data,tipo,origem,aluno,responsavel,forma_pagamento,valor_centavos,observacao,lancamento_id,criado_em,usuario_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',[id,data,tipo,origem,texto(dados.aluno),texto(dados.responsavel),forma,valor,texto(dados.observacao),lancamentoId,t,u.id]);await db.executar('INSERT INTO auditoria (usuario_id,acao,entidade,entidade_id,criado_em,detalhes) VALUES (?,?,?,?,?,?)',[u.id,'registrar','caixa_diario',id,t,descricao]);registros.push({id,data,tipo,origem,aluno:texto(dados.aluno),responsavel:texto(dados.responsavel),formaPagamento:forma,valorCentavos:valor,observacao:texto(dados.observacao),lancamentoId,criadoEm:t,usuarioId:u.id});}
  return {ok:true,caixas:registros};
}

export function listarCaixaDiario(db,{data=''}={}){
  return db.listarCaixaDiario().filter(item=>!data||item.data===data);
}

export function resumirCaixaDiario(db,{data=''}={}){
  const itens=listarCaixaDiario(db,{data});
  const receitas=itens.filter(x=>(x.tipo||'entrada')==='entrada').reduce((s,x)=>s+x.valorCentavos,0),despesas=itens.filter(x=>x.tipo==='despesa').reduce((s,x)=>s+x.valorCentavos,0),porOrigem=itens.reduce((a,x)=>{const chave=`${x.tipo||'entrada'}:${x.origem}`;a[chave]=(a[chave]||0)+x.valorCentavos;return a;},{});
  return {itens,receitas,despesas,saldo:receitas-despesas,porOrigem,quantidade:itens.length};
}

export async function pagarDespesaNoCaixa(db,dados,u={id:'direcao-celc'}){
  const id=texto(dados.id),data=texto(dados.data)||agora().slice(0,10),forma=texto(dados.formaPagamento)||'Dinheiro',item=db.listarLancamentos().find(x=>x.id===id);
  if(!item)return {ok:false,erro:'Despesa cadastrada não encontrada.'};
  if(item.tipo!=='despesa')return {ok:false,erro:'Somente despesas podem ser registradas no caixa.'};
  if(item.situacao==='pago'||item.liquidadoEm)return {ok:false,erro:'Esta despesa já foi paga.'};
  if(!/^\d{4}-\d{2}-\d{2}$/.test(data))return {ok:false,erro:'Informe a data do pagamento.'};
  if(db.listarCaixaDiario().some(x=>x.lancamentoId===id))return {ok:false,erro:'Esta despesa já está detalhada no caixa.'};
  const t=agora(),caixaId=db.proximoId('caixa');
  await db.executar('UPDATE lancamentos SET situacao=?,liquidado_em=?,atualizado_em=? WHERE id=?',['pago',`${data}T12:00:00.000Z`,t,id]);
  await db.executar('INSERT INTO caixa_diario (id,data,tipo,origem,aluno,responsavel,forma_pagamento,valor_centavos,observacao,lancamento_id,criado_em,usuario_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',[caixaId,data,'despesa',item.descricao,'','',forma,item.valorCentavos,texto(dados.observacao),id,t,u.id]);
  await db.executar('INSERT INTO auditoria (usuario_id,acao,entidade,entidade_id,criado_em,detalhes) VALUES (?,?,?,?,?,?)',[u.id,'pagar_despesa_caixa','caixa_diario',caixaId,t,item.descricao]);
  return {ok:true,caixaId,lancamentoId:id};
}

export async function registrarDevedor(db,dados,u={id:'direcao-celc'}){
  const aluno=texto(dados.aluno),descricao=texto(dados.descricao),vencimento=texto(dados.vencimento),valor=valorCentavos(dados.valorCentavos),t=agora(),id=db.proximoId('dev');
  if(!aluno)return {ok:false,erro:'Informe o nome do aluno.'};
  if(!descricao)return {ok:false,erro:'Informe a pendência do aluno.'};
  if(!valor)return {ok:false,erro:'Informe um valor pendente maior que zero.'};
  if(!/^\d{4}-\d{2}-\d{2}$/.test(vencimento))return {ok:false,erro:'Informe o vencimento da pendência.'};
  await db.executar('INSERT INTO alunos_devedores (id,aluno,turma,responsavel,contato,descricao,valor_centavos,vencimento,situacao,observacao,criado_em,atualizado_em,usuario_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',[id,aluno,texto(dados.turma),texto(dados.responsavel),texto(dados.contato),descricao,valor,vencimento,'em_aberto',texto(dados.observacao),t,t,u.id]);
  await db.executar('INSERT INTO auditoria (usuario_id,acao,entidade,entidade_id,criado_em,detalhes) VALUES (?,?,?,?,?,?)',[u.id,'registrar','aluno_devedor',id,t,aluno]);
  return {ok:true,devedor:{id,aluno,turma:texto(dados.turma),responsavel:texto(dados.responsavel),contato:texto(dados.contato),descricao,valorCentavos:valor,vencimento,situacao:'em_aberto',observacao:texto(dados.observacao),criadoEm:t,atualizadoEm:t,usuarioId:u.id}};
}

export function listarDevedores(db,{situacao=''}={}){
  return db.listarDevedores().filter(item=>!situacao||item.situacao===situacao);
}

export async function baixarDevedor(db,id,dados={},u={id:'direcao-celc'}){
  const item=db.listarDevedores().find(x=>x.id===id),pagoAnterior=Number(item?.valorPagoCentavos||0),saldo=Math.max(0,Number(item?.valorCentavos||0)-pagoAnterior);
  if(!item)return {ok:false,erro:'Aluno devedor não encontrado.'};
  if(item.situacao==='quitado'||!saldo)return {ok:false,erro:'Esta pendência já foi quitada.'};
  const data=texto(dados.data)||agora().slice(0,10),valor=valorCentavos(dados.valorCentavos),forma=texto(dados.formaPagamento)||'Não informado';
  if(!/^\d{4}-\d{2}-\d{2}$/.test(data))return {ok:false,erro:'Informe a data do pagamento.'};
  if(!valor)return {ok:false,erro:'Informe o valor recebido.'};
  if(valor>saldo)return {ok:false,erro:'O pagamento não pode ser maior que o saldo devedor.'};
  const t=agora(),novoPago=pagoAnterior+valor,situacao=novoPago>=item.valorCentavos?'quitado':'parcial',lancamentoId=db.proximoId('lanc'),caixaId=db.proximoId('caixa'),descricao=`Pagamento de aluno - ${item.aluno} - ${item.descricao}`;
  await db.executar('UPDATE alunos_devedores SET situacao=?, valor_pago_centavos=?, atualizado_em=? WHERE id=?',[situacao,novoPago,t,id]);
  await db.executar('INSERT INTO lancamentos (id,descricao,tipo,categoria_id,categoria,valor_centavos,competencia,vencimento,liquidado_em,situacao,recorrencia,criado_em,atualizado_em,usuario_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[lancamentoId,descricao,'entrada','cat-receitas','Receitas escolares',valor,data,null,t,'recebido','avulso',t,t,u.id]);
  await db.executar('INSERT INTO caixa_diario (id,data,tipo,origem,aluno,responsavel,forma_pagamento,valor_centavos,observacao,lancamento_id,criado_em,usuario_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',[caixaId,data,'entrada','Recebimento de pendência',item.aluno,item.responsavel||'',forma,valor,texto(dados.observacao)||item.descricao,lancamentoId,t,u.id]);
  await db.executar('INSERT INTO auditoria (usuario_id,acao,entidade,entidade_id,criado_em,detalhes) VALUES (?,?,?,?,?,?)',[u.id,'receber_pagamento','aluno_devedor',id,t,`${item.aluno}: ${valor}`]);
  return {ok:true,situacao,saldoRestante:item.valorCentavos-novoPago,lancamentoId,caixaId};
}
