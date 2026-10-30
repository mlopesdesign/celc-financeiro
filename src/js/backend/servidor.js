import {salvarLancamento,editarLancamento,baixarLancamento,excluirLancamento,resumirLancamentos,consultarLancamentos,sugerirDescricoesLancamentos,gerarRecorrenciasMensais,atualizarLancamentosVencidos} from './core/lancamentos.js';
import {listarCategorias,cadastrarCategoria,editarCategoria,arquivarCategoria,excluirCategoria} from './core/categorias.js';
import {criarBackup,restaurarBackup,restaurarBackupMaisRecente} from './core/backup.js';
import {detalharCategoria,exportarRelatorio,exportarRelatorioPdf,resumirRelatorios} from './core/relatorios.js';
import {registrarCaixaDiario,listarCaixaDiario,resumirCaixaDiario,pagarDespesaNoCaixa,excluirCaixaDiario,registrarDevedor,listarDevedores,baixarDevedor} from './core/escolar.js';
import {trocarSenha} from '../auth.js';
import {registrarPagamentoDespesa,historicoMensalCategoria,saldoDoLancamento} from './core/pagamentos.js';

export function criarApiFinanceira(opcoes){
  const {banco,usuario=()=>({id:'direcao-celc'})}=opcoes,apiOriginal=criarApi(opcoes);
  const salvarDespesa=async d=>{
    const pagamentos=d.pagamentos||[];
    if(!Array.isArray(pagamentos)||pagamentos.some(p=>!Number.isSafeInteger(p.valorCentavos)||p.valorCentavos<=0))return {ok:false,erro:'Confira os valores de cada pagamento.'};
    const existente=d.id?banco.listarLancamentos().find(x=>x.id===d.id):null;
    const r=d.id?await editarLancamento(banco,d.id,{...d,tipo:'despesa',liquidado:existente?.situacao==='pago'},usuario()):await salvarLancamento(banco,{...d,tipo:'despesa',liquidado:false},usuario());
    if(!r.ok)return r;
    const id=d.id||r.lancamento.id;
    for(const pagamento of pagamentos){const resultado=await registrarPagamentoDespesa(banco,{...pagamento,id},usuario());if(!resultado.ok)return resultado;}
    return {ok:true,id};
  };
  const novas={
    'despesas:salvar':salvarDespesa,
    'despesas:pagar':d=>registrarPagamentoDespesa(banco,d,usuario()),
    'painel:historicoCategoria':d=>historicoMensalCategoria(banco,d),
    'caixa:pagarDespesa':d=>{const item=banco.listarLancamentos().find(x=>x.id===d.id);return registrarPagamentoDespesa(banco,{...d,valorCentavos:d.valorCentavos??(item?saldoDoLancamento(banco,item):0)},usuario());}
  };
  let fila=Promise.resolve();
  return (assunto,dados={})=>{
    const tarefa=()=>{
      const executar=()=>novas[assunto]?novas[assunto](dados):apiOriginal(assunto,dados);
      const escrita=/(?:criar|editar|excluir|baixar|registrar|pagar|salvar|recorrencias|atualizarVencidos|arquivar|trocarSenha)$/.test(assunto);
      return escrita&&banco.emTransacao?banco.emTransacao(executar):executar();
    };
    const resultado=fila.then(tarefa);fila=resultado.catch(()=>{});return resultado;
  };
}
export function criarApi({banco,Neutralino,usuario=()=>({id:'direcao-celc'})}){const rotas={'painel:resumo':d=>resumirLancamentos(banco,d.referencia),'lancamentos:listar':d=>consultarLancamentos(banco,d),'lancamentos:sugerirDescricoes':d=>sugerirDescricoesLancamentos(banco,d),'lancamentos:criar':d=>salvarLancamento(banco,d,usuario()),'lancamentos:editar':d=>editarLancamento(banco,d.id,d,usuario()),'lancamentos:baixar':d=>baixarLancamento(banco,d.id,usuario()),'lancamentos:excluir':d=>excluirLancamento(banco,d.id,usuario()),'lancamentos:recorrencias':d=>gerarRecorrenciasMensais(banco,d.referencia,usuario()),'lancamentos:atualizarVencidos':d=>atualizarLancamentosVencidos(banco,d,usuario()),'caixa:resumo':d=>resumirCaixaDiario(banco,d),'caixa:listar':d=>listarCaixaDiario(banco,d),'caixa:registrar':d=>registrarCaixaDiario(banco,d,usuario()),'caixa:pagarDespesa':d=>pagarDespesaNoCaixa(banco,d,usuario()),'caixa:excluir':d=>excluirCaixaDiario(banco,d.id,usuario()),'devedores:listar':d=>listarDevedores(banco,d),'devedores:registrar':d=>registrarDevedor(banco,d,usuario()),'devedores:baixar':d=>baixarDevedor(banco,d.id,d,usuario()),'categorias:listar':()=>listarCategorias(banco),'categorias:criar':d=>cadastrarCategoria(banco,d.nome,d.tipo),'categorias:editar':d=>editarCategoria(banco,d.id,d.nome,d.tipo),'categorias:arquivar':d=>arquivarCategoria(banco,d.id),'categorias:excluir':d=>excluirCategoria(banco,d.id),'backup:criar':async d=>{await banco.aguardarPersistencia();return criarBackup(Neutralino,banco.caminho,{destino:d.destino||''})},'backup:restaurar':d=>d.caminho?restaurarBackup(Neutralino,banco.caminho,d.caminho):restaurarBackupMaisRecente(Neutralino,banco.caminho),'relatorios:resumo':d=>resumirRelatorios(banco,d),'relatorios:detalharCategoria':d=>detalharCategoria(banco,d),'relatorios:exportar':d=>exportarRelatorio(Neutralino,banco,d),'relatorios:exportarPdf':d=>exportarRelatorioPdf(Neutralino,banco,d),'acesso:trocarSenha':d=>trocarSenha(banco,d.atual,d.nova,d.confirmacao)};return async(assunto,dados={})=>{if(!rotas[assunto])throw Error('Ação não disponível.');return rotas[assunto](dados)};}
