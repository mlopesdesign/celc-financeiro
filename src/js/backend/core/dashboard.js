import {fluxoRealizado} from './pagamentos.js';

const chaveContagem='contagem_caixa_especie';
const dataValida=data=>typeof data==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(data)&&Number.isFinite(Date.parse(data))&&new Date(data).toISOString().slice(0,10)===data;
const totais=()=>({entradas:0,saidas:0,anteriores:0});
const adicionar=(t,m)=>{t[m.tipo==='entrada'?'entradas':'saidas']+=m.valorCentavos;if(m.tipo==='despesa'&&m.competencia.slice(0,7)<m.data.slice(0,7))t.anteriores+=m.valorCentavos;};
const resultado=t=>t.entradas-t.saidas;
const formaNaoInformada='Sem discriminação';
const formaRegistrada=x=>{
  const nome=String(x?.formaPagamento||'').trim();
  if(x?.tipo==='entrada'&&x.origem==='Fechamento diário')return formaNaoInformada;
  return !nome||/^n[aã]o informad[oa]$/i.test(nome)?formaNaoInformada:nome;
};
const chaveFavorecido=id=>`favorecido_despesa:${id}`;
export const favorecidoDaDespesa=(db,id)=>db.obterConfiguracao?.(chaveFavorecido(id))||'';
export const salvarFavorecidoDespesa=(db,id,nome)=>db.salvarConfiguracao(chaveFavorecido(id),nome);

function contagem(db){
  try{return JSON.parse(db.obterConfiguracao?.(chaveContagem)||'null');}catch{return null;}
}

export async function salvarContagemEspecie(db,{data,valorCentavos},hoje=new Date().toISOString().slice(0,10)){
  if(!dataValida(data)||data>=hoje)return {ok:false,erro:'Informe a data de fechamento de um dia anterior.'};
  if(!Number.isSafeInteger(valorCentavos)||valorCentavos<0)return {ok:false,erro:'Informe o valor contado em dinheiro, inclusive zero.'};
  await db.salvarConfiguracao(chaveContagem,JSON.stringify({data,valorCentavos}));
  return {ok:true};
}

function caixaEspecie(db,caixa,inicio,ate){
  const base=contagem(db),esp=caixa.filter(x=>formaRegistrada(x).toLowerCase()==='dinheiro'&&dataValida(x.data)&&x.data<=ate);
  const saldo=itens=>itens.reduce((s,x)=>s+(x.tipo==='entrada'?1:-1)*x.valorCentavos,0);
  return {base,liquidoMes:saldo(esp.filter(x=>x.data>=inicio)),esperado:base&&base.data<=ate?base.valorCentavos+saldo(esp.filter(x=>x.data>base.data)):null};
}

export function resumirDashboard(db,{referencia,hoje=new Date().toISOString().slice(0,10)}){
  const mes=referencia.slice(0,7),inicio=mes+'-01',fim=mes+'-31',ate=fim<hoje?fim:hoje;
  const lancamentos=db.listarLancamentos(),caixa=db.listarCaixaDiario?.()||[];
  const recebimentos=new Map(caixa.filter(x=>x.tipo==='entrada'&&x.lancamentoId&&dataValida(x.data)).map(x=>[x.lancamentoId,x]));
  const fluxo=fluxoRealizado({listarLancamentos:()=>lancamentos,listarCaixaDiario:()=>caixa})
    .map(x=>{const c=x.tipo==='entrada'?recebimentos.get(x.id):null;return {...x,data:c?.data||x.data,formaPagamento:formaRegistrada(c||x)};})
    .filter(x=>dataValida(x.data)&&x.data<=ate);
  const meses=new Map([[mes,totais()]]),anos=new Map([[mes.slice(0,4),totais()]]),pagos=new Map(),categorias=new Map(),despesasAnteriores=[];
  const entradasPorDia=new Map(),movimentosPorForma=new Map(),parcelasPorDespesa=new Map(),pendencias=[];
  let saldoInicial=0;
  for(const m of fluxo){
    const chave=m.data.slice(0,7),ano=chave.slice(0,4);
    if(!meses.has(chave))meses.set(chave,totais());
    if(!anos.has(ano))anos.set(ano,totais());
    adicionar(meses.get(chave),m);adicionar(anos.get(ano),m);
    pagos.set(m.id,(pagos.get(m.id)||0)+m.valorCentavos);
    if(m.tipo==='despesa'){
      const parcelas=parcelasPorDespesa.get(m.id)||[];
      parcelas.push(m);parcelasPorDespesa.set(m.id,parcelas);
    }
    if(chave===mes){
      const formas=movimentosPorForma.get(m.formaPagamento)||{forma:m.formaPagamento,entradas:0,saidas:0,itens:[]};
      formas[m.tipo==='entrada'?'entradas':'saidas']+=m.valorCentavos;formas.itens.push(m);movimentosPorForma.set(m.formaPagamento,formas);
      if(m.tipo==='entrada'){
        const dia=entradasPorDia.get(m.data)||{data:m.data,total:0,semDiscriminacao:0,itens:[]};
        dia.total+=m.valorCentavos;
        if(m.formaPagamento===formaNaoInformada)dia.semDiscriminacao+=m.valorCentavos;
        dia.itens.push(m);entradasPorDia.set(m.data,dia);
      }
    }
    if(m.data<inicio)saldoInicial+=(m.tipo==='entrada'?1:-1)*m.valorCentavos;
    if(chave===mes&&m.tipo==='despesa'){
      categorias.set(m.categoria,(categorias.get(m.categoria)||0)+m.valorCentavos);
      if(m.competencia.slice(0,7)<mes)despesasAnteriores.push(m);
    }
  }
  const atual=meses.get(mes),saldoFinal=saldoInicial+resultado(atual);
  let aPagar=0,aReceber=0,aPagarAnterior=0,aReceberAnterior=0;
  for(const l of lancamentos.filter(x=>x.competencia<=fim)){
    const saldo=Math.max(0,l.valorCentavos-(pagos.get(l.id)||0));
    if(l.tipo==='entrada'){
      aReceber+=saldo;
      if(l.competencia<inicio)aReceberAnterior+=saldo;
    }else{
      aPagar+=saldo;
      if(l.competencia<inicio)aPagarAnterior+=saldo;
      const parcelas=(parcelasPorDespesa.get(l.id)||[]).sort((a,b)=>a.data.localeCompare(b.data));
      const pagoAnterior=parcelas.filter(x=>x.data<inicio).reduce((s,x)=>s+x.valorCentavos,0);
      const pagoMes=(pagos.get(l.id)||0)-pagoAnterior;
      const trazido=l.competencia<inicio?Math.max(0,l.valorCentavos-pagoAnterior):0;
      if(saldo>0||(trazido>0&&pagoMes>0))pendencias.push({...l,favorecido:favorecidoDaDespesa(db,l.id),parcelas,pagoMes,pagoTotal:pagos.get(l.id)||0,trazido,saldo});
    }
  }
  const historico=map=>{let saldo=0;return [...map].sort(([a],[b])=>a.localeCompare(b)).map(([periodo,t])=>{
    const inicial=saldo,variacao=resultado(t);saldo+=variacao;
    return {periodo,...t,saldoInicial:inicial,resultado:variacao,saldoFinal:saldo};
  }).reverse();};
  return {mes,...atual,saldoInicial,saldoFinal,resultado:resultado(atual),aPagar,aReceber,aPagarAnterior,aReceberAnterior,projecao:saldoFinal+aReceber-aPagar,meses:historico(meses),anos:historico(anos),categorias:[...categorias].sort((a,b)=>b[1]-a[1]),despesasAnteriores:despesasAnteriores.sort((a,b)=>b.data.localeCompare(a.data)),especie:caixaEspecie(db,caixa,inicio,ate),entradasPorDia:[...entradasPorDia.values()].sort((a,b)=>b.data.localeCompare(a.data)),movimentosPorForma:[...movimentosPorForma.values()].sort((a,b)=>a.forma.localeCompare(b.forma,'pt-BR')),pendencias:pendencias.sort((a,b)=>b.saldo-a.saldo)};
}
