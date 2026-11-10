import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {detalharCategoria,exportarRelatorio,exportarRelatorioPdf,gerarPdfRelatorio,resumirRelatorios} from '../src/js/backend/core/relatorios.js';
import {resumirDashboard} from '../src/js/backend/core/dashboard.js';

const lancamentos=[
  {id:'1',descricao:'Matrícula Ana',tipo:'entrada',categoria:'Matrículas',valorCentavos:10000,competencia:'2026-08-05',situacao:'recebido',liquidadoEm:'2026-08-05T10:00:00.000Z'},
  {id:'2',descricao:'Mensalidade Bruno',tipo:'entrada',categoria:'Receitas escolares',valorCentavos:5000,competencia:'2026-08-10',situacao:'pendente',liquidadoEm:null},
  {id:'3',descricao:'Pagamento docente',tipo:'despesa',categoria:'Pessoal',valorCentavos:3000,competencia:'2026-08-12',situacao:'pago',liquidadoEm:'2026-08-12T10:00:00.000Z'},
  {id:'4',descricao:'Energia',tipo:'despesa',categoria:'Serviços e utilidades',valorCentavos:2000,competencia:'2026-08-15',situacao:'pendente',liquidadoEm:null},
  {id:'5',descricao:'Fora do período',tipo:'entrada',categoria:'Matrículas',valorCentavos:9000,competencia:'2026-07-31',situacao:'recebido',liquidadoEm:'2026-07-31T10:00:00.000Z'}
];
const hoje=new Date(),ontem=new Date(hoje);ontem.setDate(hoje.getDate()-1);const amanha=new Date(hoje);amanha.setDate(hoje.getDate()+1);const dataIso=data=>data.toISOString().slice(0,10);
const devedores=[
  {aluno:'Carla',situacao:'em_aberto',vencimento:dataIso(ontem),valorCentavos:4000},
  {aluno:'Diego',situacao:'em_aberto',vencimento:dataIso(amanha),valorCentavos:2500},
  {aluno:'Elisa',situacao:'quitado',vencimento:'2026-08-15',valorCentavos:8000}
];
const categorias=[{id:'c1',nome:'Matrículas',tipo:'entrada'},{id:'c2',nome:'Receitas escolares',tipo:'entrada'},{id:'c3',nome:'Doações futuras',tipo:'entrada'},{id:'c4',nome:'Pessoal',tipo:'despesa'},{id:'c5',nome:'Serviços e utilidades',tipo:'despesa'},{id:'c6',nome:'Manutenção futura',tipo:'despesa'}];
const bancoRelatorio={listarLancamentos:()=>lancamentos,listarDevedores:()=>devedores,listarCategorias:()=>categorias};
const relatorio=resumirRelatorios(bancoRelatorio,{inicio:'2026-08-01',fim:'2026-08-31'});
assert.equal(relatorio.totais.entradasRealizadas,10000);
assert.equal(relatorio.totais.despesasRealizadas,3000);
assert.equal(relatorio.totais.resultadoRealizado,7000);
assert.equal(relatorio.totais.aReceber,5000);
assert.equal(relatorio.totais.aPagar,2000);
assert.equal(relatorio.totais.resultadoProjetado,10000);
assert.equal(relatorio.categoriasEntrada.length,3);
assert.equal(relatorio.categoriasDespesa.find(x=>x.categoria==='Pessoal').realizado,3000);
assert.equal(relatorio.categoriasEntrada.find(x=>x.categoria==='Doações futuras').projetado,0);
assert.equal(relatorio.categoriasDespesa.find(x=>x.categoria==='Manutenção futura').quantidade,0);
assert.equal(relatorio.fluxo.length,2);
assert.equal(relatorio.devedores.quantidade,2);
assert.equal(relatorio.devedores.valor,6500);
assert.equal(relatorio.devedores.vencidos,1);
assert.equal(relatorio.devedores.valorVencido,4000);
const detalheMatrículas=detalharCategoria(bancoRelatorio,{categoria:'Matrículas',tipo:'entrada',inicio:'2026-08-01',fim:'2026-08-31'});
assert.equal(detalheMatrículas.ok,true);
assert.equal(detalheMatrículas.itens.length,1);
assert.equal(detalheMatrículas.totais.realizado,10000);
assert.equal(detalheMatrículas.totais.projetado,10000);
assert.equal(detalharCategoria(bancoRelatorio,{categoria:'Matrículas',tipo:'invalido'}).ok,false);
const pdf=gerarPdfRelatorio(relatorio),textoPdf=new TextDecoder('latin1').decode(pdf);
assert.equal(textoPdf.startsWith('%PDF-1.4'),true);
assert.equal(textoPdf.includes('CELC Financeiro'),true);
let arquivoPdf=null;
const neutralino={filesystem:{createDirectory:async()=>{},writeBinaryFile:async(caminho,bytes)=>{arquivoPdf={caminho,bytes};}}};
assert.equal((await exportarRelatorioPdf(neutralino,{modo:'sqlite',caminho:'C:\\CELC Financeiro\\dados\\celc-financeiro.db',...bancoRelatorio},{inicio:'2026-08-01',fim:'2026-08-31'})).ok,true);
assert.equal(arquivoPdf.caminho.endsWith('.pdf'),true);
assert.equal(new TextDecoder('latin1').decode(arquivoPdf.bytes).startsWith('%PDF-1.4'),true);
const interfaceRelatorios=await readFile(new URL('../src/js/app.js',import.meta.url),'utf8');
assert.equal(interfaceRelatorios.includes("['categorias','Por categoria']"),true);
assert.equal(interfaceRelatorios.includes('Resultado por categoria'),true);
assert.equal(interfaceRelatorios.includes('Arrecadado no período'),true);
assert.equal(interfaceRelatorios.includes('Gasto no período'),true);
assert.equal(interfaceRelatorios.includes('category-total-card'),true);
assert.equal(interfaceRelatorios.includes('data-detalhar-categoria'),true);
console.log('31 asserções aprovadas — cálculos, dashboard, detalhamento por categoria e PDF dos relatórios financeiros.');

const dbConciliado={...bancoRelatorio,
  listarLancamentos:()=>[
    {id:'atrasado',tipo:'entrada',categoria:'Receitas escolares',descricao:'Receita de outubro',competencia:'2026-10-20',situacao:'recebido',valorCentavos:634900},
    {id:'salario',tipo:'despesa',categoria:'Pessoal',descricao:'Despesa de setembro',competencia:'2026-09-30',situacao:'pendente',valorCentavos:100000}
  ],
  listarCaixaDiario:()=>[
    {id:'1',lancamentoId:'atrasado',tipo:'entrada',data:'2026-11-03',origem:'Fechamento diário',formaPagamento:'Dinheiro',valorCentavos:634900},
    {id:'2',lancamentoId:'salario',tipo:'despesa',data:'2026-10-23',formaPagamento:'Dinheiro',valorCentavos:30000},
    {id:'3',lancamentoId:'salario',tipo:'despesa',data:'2026-11-04',formaPagamento:'Pix',valorCentavos:20000}
  ],
  obterConfiguracao:k=>k==='favorecido_despesa:salario'?'Prestador Teste':''
};
const filtro={inicio:'2026-11-01',fim:'2026-11-30',hoje:'2026-11-10'};
const caixaNovo=resumirRelatorios(dbConciliado,filtro);
const dashboard=resumirDashboard(dbConciliado,{referencia:'2026-11',hoje:filtro.hoje});
assert.deepEqual([caixaNovo.totais.entradasRealizadas,caixaNovo.totais.despesasRealizadas,caixaNovo.totais.aPagar,caixaNovo.totais.saldoProjetado],[dashboard.entradas,dashboard.saidas,dashboard.aPagar,dashboard.projecao]);
assert.deepEqual([caixaNovo.totais.entradasRealizadas,caixaNovo.totais.despesasRealizadas,caixaNovo.totais.aPagar],[634900,20000,50000]);
assert.equal(caixaNovo.competencia.entradas,0);
assert.equal(caixaNovo.financeiro.entradasPorDia[0].semDiscriminacao,634900);
assert.equal(caixaNovo.financeiro.pendencias[0].favorecido,'Prestador Teste');
const detalhe=detalharCategoria(dbConciliado,{categoria:'Pessoal',tipo:'despesa',...filtro});
assert.deepEqual([detalhe.totais.realizado,detalhe.totais.pendente,detalhe.movimentos[0].formaPagamento],[20000,50000,'Pix']);
const pdfConciliado=new TextDecoder('latin1').decode(gerarPdfRelatorio(caixaNovo));
assert.match(pdfConciliado,/Entradas realizadas: R\$ 6349,00/);
assert.match(pdfConciliado,/Prestador Teste/);
let csv='';
await exportarRelatorio({filesystem:{createDirectory:async()=>{},writeFile:async(_,v)=>{csv=v;}}},{modo:'sqlite',caminho:'C:\\CELC\\dados\\celc-financeiro.db',...dbConciliado},filtro);
assert.match(csv,/"Movimento realizado";"2026-11-03";"2026-10-20".*"Sem discriminação";"6349,00"/);
assert.match(csv,/"Despesa a pagar".*"Prestador Teste".*"500,00"/);
assert.equal((csv.match(/"Movimento realizado"/g)||[]).length,2);
console.log('Conciliação entre dashboard, relatório, categorias, PDF e CSV aprovada.');
