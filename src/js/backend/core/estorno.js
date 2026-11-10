export async function estornarDevedorDoCaixa(db,caixa,lancamento){
  if(caixa.tipo!=='entrada'||caixa.origem!=='Recebimento de pendência')return false;
  const devedores=db.listarDevedores?.()||[];
  let devedor=caixa.devedorId?devedores.find(d=>d.id===caixa.devedorId):null;
  if(!devedor){const candidatos=devedores.filter(d=>lancamento&&lancamento.descricao===`Pagamento de aluno - ${d.aluno} - ${d.descricao}`&&Number(d.valorPagoCentavos||0)>=caixa.valorCentavos);if(candidatos.length===1)devedor=candidatos[0];}
  if(!devedor)return false;
  const pago=Math.max(0,Number(devedor.valorPagoCentavos||0)-caixa.valorCentavos),situacao=pago===0?'em_aberto':pago>=devedor.valorCentavos?'quitado':'parcial';
  await db.executar('UPDATE alunos_devedores SET situacao=?, valor_pago_centavos=?, atualizado_em=? WHERE id=?',[situacao,pago,new Date().toISOString(),devedor.id]);
  return true;
}
