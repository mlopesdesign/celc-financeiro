import {dataValidaISO,dataEfetiva} from './datas.js';

// Correção única dos registros gravados antes da 0.2.34: entradas recebidas que ficaram
// com a data do recebimento igual ao dia em que foram digitadas, e não ao dia do caixa.
export const CHAVE_CORRECAO_DATAS='correcao:data-recebimento-caixa:v1';
export const CORTE_CORRECAO_DATAS='2026-11-10T16:00:00.000Z';

export function entradasComDataDeDigitacao(banco){
  const vinculadas=new Set((banco.listarCaixaDiario?.()||[]).map(x=>x.lancamentoId).filter(Boolean));
  return banco.listarLancamentos().filter(x=>x.tipo==='entrada'&&x.situacao==='recebido'&&!vinculadas.has(x.id)&&x.liquidadoEm&&dataValidaISO(x.competencia)&&x.liquidadoEm.slice(0,10)>x.competencia&&String(x.criadoEm||'')<CORTE_CORRECAO_DATAS);
}

export async function aplicarCorrecaoDatasRecebimento(banco,{antesDeAplicar=async()=>{}}={}){
  if(banco.obterConfiguracao?.(CHAVE_CORRECAO_DATAS))return {aplicada:false,quantidade:0};
  const itens=entradasComDataDeDigitacao(banco);
  if(itens.length)await antesDeAplicar(itens.length);
  const t=new Date().toISOString();
  const resultado=await banco.emTransacao(async()=>{
    for(const x of itens){
      const depois=dataEfetiva(x.competencia);
      await banco.executar('UPDATE lancamentos SET liquidado_em=?,atualizado_em=? WHERE id=?',[depois,t,x.id]);
      await banco.executar('INSERT INTO auditoria (usuario_id,acao,entidade,entidade_id,criado_em,detalhes) VALUES (?,?,?,?,?,?)',['sistema','corrigir_data_recebimento','lancamento',x.id,t,JSON.stringify({antes:x.liquidadoEm,depois,motivo:'Data do recebimento = data do caixa (correção automática da versão 0.2.36)'})]);
    }
    await banco.salvarConfiguracao(CHAVE_CORRECAO_DATAS,JSON.stringify({aplicadaEm:t,quantidade:itens.length}));
    return {ok:true,quantidade:itens.length};
  });
  return {aplicada:true,quantidade:resultado.quantidade};
}
