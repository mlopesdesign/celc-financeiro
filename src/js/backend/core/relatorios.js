import {hojeLocal} from './datas.js';
import {resumirPeriodoFinanceiro} from './dashboard.js';

export function gerarCsvLancamentos(lancamentos) {
  const esc = (valor) => `"${String(valor).replaceAll('"', '""')}"`;
  const linhas = [['Data', 'Descrição', 'Tipo', 'Categoria', 'Situação', 'Recorrência', 'Valor']];
  lancamentos.forEach((item) => linhas.push([item.competencia, item.descricao, item.tipo, item.categoria, item.situacao, item.recorrencia, (item.valorCentavos / 100).toFixed(2).replace('.', ',')]));
  return `\uFEFF${linhas.map((linha) => linha.map(esc).join(';')).join('\r\n')}`;
}

const dentroDoPeriodo=(item,inicio,fim)=>item.competencia>=inicio&&item.competencia<=fim;
const somar=(itens,campo='valorCentavos')=>itens.reduce((s,x)=>s+x[campo],0);

function agruparPorCategoria(movimentos,pendencias,tipo,categorias=[]){
  const grupos=new Map();
  const obter=nome=>{
    if(!grupos.has(nome))grupos.set(nome,{categoria:nome,realizado:0,pendente:0,ids:new Set()});
    return grupos.get(nome);
  };
  categorias.filter(x=>x.tipo===tipo).forEach(x=>obter(x.nome));
  for(const x of movimentos.filter(x=>x.tipo===tipo)){const g=obter(x.categoria);g.realizado+=x.valorCentavos;g.ids.add(x.id);}
  for(const x of pendencias.filter(x=>x.tipo===tipo)){const g=obter(x.categoria);g.pendente+=x.saldo;g.ids.add(x.id);}
  return [...grupos.values()].map(({ids,...x})=>({...x,quantidade:ids.size,projetado:x.realizado+x.pendente})).sort((a,b)=>b.projetado-a.projetado||a.categoria.localeCompare(b.categoria));
}

export function detalharCategoria(db,{categoria='',tipo='',inicio='',fim='',hoje}={}){
  const nome=String(categoria).trim();
  if(!nome)return {ok:false,erro:'Categoria não informada.'};
  if(!['entrada','despesa'].includes(tipo))return {ok:false,erro:'Tipo de categoria inválido.'};
  const r=resumirRelatorios(db,{inicio,fim,hoje}),filtrar=x=>x.tipo===tipo&&x.categoria===nome;
  const movimentos=r.fluxo.filter(filtrar),pendencias=[...r.financeiro.pendencias,...r.financeiro.recebiveis].filter(x=>x.saldo>0&&filtrar(x));
  const realizado=somar(movimentos),pendente=somar(pendencias,'saldo');
  return {ok:true,categoria:nome,tipo,inicio:r.inicio,fim:r.fim,totais:{realizado,pendente,projetado:realizado+pendente},itens:movimentos,movimentos,pendencias};
}

export function resumirRelatorios(db,{inicio='',fim='',hoje=hojeLocal()}={}){
  const inicioPadrao=inicio||`${hoje.slice(0,7)}-01`,fimPadrao=fim||hoje;
  const financeiro=resumirPeriodoFinanceiro(db,{inicio:inicioPadrao,fim:fimPadrao,hoje});
  const {entradas:entradasRealizadas,saidas:despesasRealizadas,aReceber,aPagar,movimentos:fluxo}=financeiro;
  const pendencias=[...financeiro.pendencias.filter(x=>x.saldo>0),...financeiro.recebiveis];
  const categorias=db.listarCategorias?.(false)||[];
  const categoriasEntrada=agruparPorCategoria(fluxo,pendencias,'entrada',categorias),categoriasDespesa=agruparPorCategoria(fluxo,pendencias,'despesa',categorias);
  const porCompetencia=db.listarLancamentos().filter(x=>dentroDoPeriodo(x,inicioPadrao,fimPadrao));
  const lancado=tipo=>somar(porCompetencia.filter(x=>x.tipo===tipo));
  const competencia={entradas:lancado('entrada'),despesas:lancado('despesa'),itens:porCompetencia};
  competencia.resultado=competencia.entradas-competencia.despesas;
  const devedores=db.listarDevedores?.()||[],emAberto=devedores.filter(x=>x.situacao!=='quitado').map(x=>({...x,saldoCentavos:Math.max(0,x.valorCentavos-Number(x.valorPagoCentavos||0))})),inadimplentes=emAberto.filter(x=>x.vencimento<hoje);
  return {inicio:inicioPadrao,fim:fimPadrao,financeiro,competencia,totais:{entradasRealizadas,despesasRealizadas,resultadoRealizado:financeiro.resultado,aReceber,aPagar,entradasProjetadas:entradasRealizadas+aReceber,despesasProjetadas:despesasRealizadas+aPagar,resultadoProjetado:financeiro.resultado+aReceber-aPagar,saldoInicial:financeiro.saldoInicial,saldoFinal:financeiro.saldoFinal,saldoProjetado:financeiro.projecao},categoriasEntrada,categoriasDespesa,fluxo,devedores:{quantidade:emAberto.length,valor:somar(emAberto,'saldoCentavos'),vencidos:inadimplentes.length,valorVencido:somar(inadimplentes,'saldoCentavos'),itens:emAberto.sort((a,b)=>a.vencimento.localeCompare(b.vencimento))}};
}

const moeda=valor=>`R$ ${(valor/100).toFixed(2).replace('.',',')}`;
const dataBr=data=>data?data.split('-').reverse().join('/'):'-';
const cp1252=texto=>{const bytes=[];for(const caractere of String(texto)){let codigo=caractere.codePointAt(0);if(codigo>255){const simples=caractere.normalize('NFD').replace(/[\u0300-\u036f]/g,'');codigo=simples.codePointAt(0)||63;}bytes.push(codigo<=255?codigo:63);}return new Uint8Array(bytes);};
const juntar=partes=>{const tamanho=partes.reduce((total,parte)=>total+parte.length,0),saida=new Uint8Array(tamanho);let inicio=0;partes.forEach(parte=>{saida.set(parte,inicio);inicio+=parte.length;});return saida;};
const textoPdf=texto=>String(texto).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
function quebrarTexto(texto,tamanho){
  const linhas=[];let linha='',largura=0;
  for(const palavra of String(texto).trim().split(/\s+/)){
    const tokens=palavra.match(/.{1,45}/gu)||[''];
    for(const token of tokens){
      const w=[...token].reduce((s,c)=>s+(/[MWmw@%&]/.test(c)?1:/[A-ZÁÉÍÓÚÃÕÇ0-9]/.test(c)?.77:.65),0)*tamanho;
      if(linha&&largura+w+tamanho*.35>490){linhas.push(linha);linha='';largura=0;}
      if(linha){linha+=' ';largura+=tamanho*.35;}
      linha+=token;largura+=w;
    }
  }
  if(linha)linhas.push(linha);
  return linhas;
}
function gerarPdf(linhas){const porPagina=[];let atual=[],altura=0;for(const linha of linhas){for(const texto of quebrarTexto(linha.texto,linha.tamanho||10)){const passo=linha.altura||15;if(altura+passo>740){porPagina.push(atual);atual=[];altura=0;}atual.push({...linha,texto});altura+=passo;}}if(atual.length)porPagina.push(atual);const objetos=[];const idsPaginas=[];objetos[1]=cp1252('<< /Type /Catalog /Pages 2 0 R >>');objetos[3]=cp1252('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');objetos[4]=cp1252('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');porPagina.forEach((pagina,indice)=>{const paginaId=5+indice*2,conteudoId=paginaId+1;idsPaginas.push(`${paginaId} 0 R`);let y=800;const comandos=pagina.map(linha=>{const fonte=linha.negrito?'F2':'F1',tamanho=linha.tamanho||10,comando=`BT /${fonte} ${tamanho} Tf 48 ${y} Td (${textoPdf(linha.texto)}) Tj ET\n`;y-=linha.altura||15;return comando;}).join('');const conteudo=cp1252(comandos);objetos[paginaId]=cp1252(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${conteudoId} 0 R >>`);objetos[conteudoId]=juntar([cp1252(`<< /Length ${conteudo.length} >>\nstream\n`),conteudo,cp1252('\nendstream')]);});objetos[2]=cp1252(`<< /Type /Pages /Kids [${idsPaginas.join(' ')}] /Count ${idsPaginas.length} >>`);let corpo=cp1252('%PDF-1.4\n%CELC\n'),offsets=[0];for(let id=1;id<objetos.length;id+=1){offsets[id]=corpo.length;corpo=juntar([corpo,cp1252(`${id} 0 obj\n`),objetos[id],cp1252('\nendobj\n')]);}const inicioXref=corpo.length;let xref=`xref\n0 ${objetos.length}\n0000000000 65535 f \n`;for(let id=1;id<objetos.length;id+=1)xref+=`${String(offsets[id]).padStart(10,'0')} 00000 n \n`;return juntar([corpo,cp1252(`${xref}trailer\n<< /Size ${objetos.length} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF`)]);}
const indicadores=t=>[
  ['Saldo trazido',t.saldoInicial],['Entradas realizadas',t.entradasRealizadas],['Saídas realizadas',t.despesasRealizadas],
  ['Resultado realizado do período',t.resultadoRealizado],['Saldo acumulado dos lançamentos',t.saldoFinal],
  ['A receber registrado',t.aReceber],['A pagar registrado',t.aPagar],['Saldo projetado',t.saldoProjetado]
];
export function gerarPdfRelatorio(r){
  const f=r.financeiro,linhas=[];
  const texto=t=>linhas.push({texto:t}),secao=t=>linhas.push({texto:t,negrito:true,tamanho:13,altura:20});
  linhas.push({texto:'CELC Financeiro - Relatório gerencial',negrito:true,tamanho:18,altura:28});
  texto(`Período: ${dataBr(r.inicio)} a ${dataBr(r.fim)} | Realizado até: ${dataBr(f.ate)}`);
  secao('Fluxo realizado por data efetiva');
  for(const [nome,valor] of indicadores(r.totais))texto(`${nome}: ${moeda(valor)}`);
  texto('Saldo acumulado dos lançamentos: todas as formas; não representa dinheiro na gaveta.');
  texto(`Dinheiro em espécie esperado: ${f.especie.esperado===null?'Sem contagem de referência':moeda(f.especie.esperado)}`);
  secao('Recebimentos por dia');
  for(const d of f.entradasPorDia)texto(`${dataBr(d.data)} | Sem discriminação ${moeda(d.semDiscriminacao)} | Total do dia ${moeda(d.total)}`);
  secao('Movimentação por forma registrada');
  for(const x of f.movimentosPorForma)texto(`${x.forma}: entradas ${moeda(x.entradas)} | saídas ${moeda(x.saidas)}`);
  secao('Despesas a pagar por favorecido');
  for(const x of f.pendencias){
    texto(`${x.favorecido||'Favorecido não informado'} | ${x.descricao} | Competência ${dataBr(x.competencia)}`);
    texto(`Integral ${moeda(x.valorCentavos)} | Trazido ${moeda(x.trazido)} | Pago no período ${moeda(x.pagoMes)} | Total pago ${moeda(x.pagoTotal)} | Em aberto ${moeda(x.saldo)}`);
    for(const p of x.parcelas)texto(`Parcela: ${dataBr(p.data)} | ${p.formaPagamento} | ${moeda(p.valorCentavos)}`);
  }
  for(const [titulo,categorias] of [['Entradas por categoria',r.categoriasEntrada],['Despesas por categoria',r.categoriasDespesa]]){
    secao(titulo);
    for(const x of categorias)texto(`${x.categoria}: realizado ${moeda(x.realizado)} | pendente ${moeda(x.pendente)}`);
  }
  secao('Competência - valores integrais lançados');
  texto(`Receitas ${moeda(r.competencia.entradas)} | Despesas ${moeda(r.competencia.despesas)} | Diferença ${moeda(r.competencia.resultado)}`);
  secao('Inadimplência');
  texto(`Em aberto: ${r.devedores.quantidade} aluno(s) - ${moeda(r.devedores.valor)} | Vencidos: ${r.devedores.vencidos} - ${moeda(r.devedores.valorVencido)}`);
  secao('Extrato de caixa realizado');
  for(const x of r.fluxo)texto(`${dataBr(x.data)} | ${x.tipo==='entrada'?'Entrada':'Saída'} | ${x.formaPagamento} | ${x.descricao} | ${moeda(x.valorCentavos)} | Competência ${dataBr(x.competencia)}`);
  return gerarPdf(linhas);
}

export function gerarCsvRelatorio(r){
  const header=['Registro','Data efetiva','Competência','Descrição','Categoria','Favorecido','Forma','Entrada realizada (R$)','Saída realizada (R$)','Saldo pendente (R$)','Integral (R$)','Pago acumulado (R$)','Valor de referência (R$)'];
  const linhas=[header],decimal=x=>(x/100).toFixed(2).replace('.',',');
  const celula=x=>{const s=String(x??'');return '"'+(/^[\s]*[=+@-]/.test(s)&&!(/^-?\d+,\d{2}$/.test(s))?"'"+s:s).replaceAll('"','""')+'"';};
  for(const [nome,valor] of indicadores(r.totais))linhas.push(['Resumo','','',nome,'','','','','','','','',decimal(valor)]);
  for(const x of r.fluxo)linhas.push(['Movimento realizado',x.data,x.competencia,x.descricao,x.categoria,'',x.formaPagamento,x.tipo==='entrada'?decimal(x.valorCentavos):'',x.tipo==='despesa'?decimal(x.valorCentavos):'']);
  for(const x of r.financeiro.pendencias){
    linhas.push(['Despesa a pagar','',x.competencia,x.descricao,x.categoria,x.favorecido||'Favorecido não informado','','','',decimal(x.saldo),decimal(x.valorCentavos),decimal(x.pagoTotal)]);
    for(const p of x.parcelas)linhas.push(['Parcela (referência)',p.data,x.competencia,x.descricao,x.categoria,x.favorecido,p.formaPagamento,'','','','','',decimal(p.valorCentavos)]);
  }
  for(const x of r.financeiro.recebiveis)linhas.push(['Receita a receber','',x.competencia,x.descricao,x.categoria,'','','','',decimal(x.saldo),decimal(x.valorCentavos)]);
  for(const [nome,valor] of [['Receitas lançadas',r.competencia.entradas],['Despesas lançadas',r.competencia.despesas],['Diferença por competência',r.competencia.resultado]])linhas.push(['Competência','','',nome,'','','','','','','','',decimal(valor)]);
  for(const x of r.competencia.itens)linhas.push(['Lançamento por competência','',x.competencia,x.descricao,x.categoria,'','','','','',decimal(x.valorCentavos)]);
  return '\uFEFF'+linhas.map(l=>header.map((_,i)=>celula(l[i])).join(';')).join('\r\n');
}

export async function exportarRelatorio(Neutralino, banco,filtros={}) {
  if (!Neutralino || banco.modo !== 'sqlite') return { ok: false, erro: 'A exportação está disponível no executável Windows.' };
  const pasta = `${banco.caminho.slice(0, banco.caminho.lastIndexOf('\\'))}\\exportacoes`;
  try { await Neutralino.filesystem.createDirectory(pasta); } catch { /* pasta existente */ }
  const caminho = `${pasta}\\fluxo-de-caixa-${new Date().toISOString().slice(0, 10)}.csv`;
  await Neutralino.filesystem.writeFile(caminho, gerarCsvRelatorio(resumirRelatorios(banco,filtros)));
  return { ok: true, caminho };
}

export async function exportarRelatorioPdf(Neutralino,banco,filtros={}){if(!Neutralino||banco.modo!=='sqlite')return {ok:false,erro:'A exportação está disponível no executável Windows.'};const pasta=`${banco.caminho.slice(0,banco.caminho.lastIndexOf('\\'))}\\exportacoes`;try{await Neutralino.filesystem.createDirectory(pasta)}catch{}const caminho=`${pasta}\\relatorio-financeiro-${hojeLocal()}.pdf`,bytes=gerarPdfRelatorio(resumirRelatorios(banco,filtros));await Neutralino.filesystem.writeBinaryFile(caminho,bytes);return {ok:true,caminho};}
