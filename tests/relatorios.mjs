import assert from 'node:assert/strict';
import {exportarRelatorioPdf,gerarPdfRelatorio,resumirRelatorios} from '../src/js/backend/core/relatorios.js';

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
const relatorio=resumirRelatorios({listarLancamentos:()=>lancamentos,listarDevedores:()=>devedores},{inicio:'2026-08-01',fim:'2026-08-31'});
assert.equal(relatorio.totais.entradasRealizadas,10000);
assert.equal(relatorio.totais.despesasRealizadas,3000);
assert.equal(relatorio.totais.resultadoRealizado,7000);
assert.equal(relatorio.totais.aReceber,5000);
assert.equal(relatorio.totais.aPagar,2000);
assert.equal(relatorio.totais.resultadoProjetado,10000);
assert.equal(relatorio.categoriasEntrada.length,2);
assert.equal(relatorio.categoriasDespesa.find(x=>x.categoria==='Pessoal').realizado,3000);
assert.equal(relatorio.fluxo.length,2);
assert.equal(relatorio.devedores.quantidade,2);
assert.equal(relatorio.devedores.valor,6500);
assert.equal(relatorio.devedores.vencidos,1);
assert.equal(relatorio.devedores.valorVencido,4000);
const pdf=gerarPdfRelatorio(relatorio),textoPdf=new TextDecoder('latin1').decode(pdf);
assert.equal(textoPdf.startsWith('%PDF-1.4'),true);
assert.equal(textoPdf.includes('CELC Financeiro'),true);
let arquivoPdf=null;
const neutralino={filesystem:{createDirectory:async()=>{},writeBinaryFile:async(caminho,bytes)=>{arquivoPdf={caminho,bytes};}}};
assert.equal((await exportarRelatorioPdf(neutralino,{modo:'sqlite',caminho:'C:\\CELC Financeiro\\dados\\celc-financeiro.db',listarLancamentos:()=>lancamentos,listarDevedores:()=>devedores},{inicio:'2026-08-01',fim:'2026-08-31'})).ok,true);
assert.equal(arquivoPdf.caminho.endsWith('.pdf'),true);
assert.equal(new TextDecoder('latin1').decode(arquivoPdf.bytes).startsWith('%PDF-1.4'),true);
console.log('18 asserções aprovadas — cálculos e PDF dos relatórios financeiros.');
