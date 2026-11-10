import {abrirBancoSeguro} from './backend/db.js';
import {garantirAcesso,validarAcesso} from './auth.js';
import {criarApiFinanceira as criarApi} from './backend/servidor.js';
import {valorRealizado,saldoDoLancamento,pagamentosDaDespesa} from './backend/core/pagamentos.js';
import {favorecidoDaDespesa} from './backend/core/dashboard.js';
import {verificarAtualizacao,instalarAtualizacao} from './backend/atualizador.js';
import {hojeLocal} from './backend/core/datas.js';

const APP_VERSION='0.2.36';
let hoje=hojeLocal();
let dataCaixa='';
function centavosDe(texto){let s=String(texto??'').replace(/R\$|\s/g,'');if(s==='')return NaN;if(!/^\d{1,3}(\.\d{3})+(,\d{1,2})?$|^\d+(,\d{1,2})?$|^\d+\.\d{1,2}$/.test(s))return NaN;s=s.includes(',')?s.replace(/\./g,'').replace(',','.'):/^\d{1,3}(\.\d{3})+$/.test(s)?s.replace(/\./g,''):s;return Math.round(Number(s)*100);}
const envios=new WeakSet();
document.addEventListener('submit',evento=>{const form=evento.target;if(!(form instanceof HTMLFormElement)||form.id==='formLogin')return;if(envios.has(form)){evento.preventDefault();evento.stopImmediatePropagation();return;}envios.add(form);form.querySelectorAll('button').forEach(b=>b.disabled=true);setTimeout(()=>{envios.delete(form);form.querySelectorAll('button').forEach(b=>b.disabled=false);},1500);},true);
const $=seletor=>document.querySelector(seletor);
const $$=seletor=>Array.from(document.querySelectorAll(seletor));
const brl=valor=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((Number(valor)||0)/100);
const esc=valor=>String(valor??'').replace(/[&<>"']/g,caractere=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[caractere]));
const liquidado=item=>item.tipo==='entrada'?item.situacao==='recebido':item.situacao==='pago';

let banco;
let api;
let tela='dashboard';
let edicao=null;
let categoriaEmEdicao=null;
let relatorioAba='geral';
let periodoRelatorio=periodoMensal(hoje.slice(0,7));
let fechamentoEmAndamento=false;
let consultaDescricao=0;
let mesDashboard=hoje.slice(0,7);

const telas={
  dashboard:{rotulo:'PAINEL FINANCEIRO',titulo:'Visão geral',subtitulo:'Acompanhe a saúde financeira do Colégio CELC.',montar:dashboard},
  caixa:{rotulo:'CAIXA ESCOLAR',titulo:'Caixa diário',subtitulo:'Entradas recebidas no dia: matrículas, mensalidades, eventos e outros recebimentos.',montar:caixaDiario},
  devedores:{rotulo:'COBRANÇA ESCOLAR',titulo:'Alunos devedores',subtitulo:'Registro dos alunos com pendências financeiras e acompanhamento de quitação.',montar:alunosDevedores},
  entradas:{rotulo:'LANÇAMENTOS',titulo:'Entradas',subtitulo:'Recebimentos realizados e previstos.',montar:()=>lista('entrada',[])},
  despesas:{rotulo:'LANÇAMENTOS',titulo:'Despesas',subtitulo:'Saídas realizadas e previstas.',montar:()=>lista('despesa',[])},
  receber:{rotulo:'CONTROLE FINANCEIRO',titulo:'Contas a receber',subtitulo:'Recebimentos pendentes e previstos.',montar:()=>lista('entrada',['pendente','previsto','vencido'])},
  pagar:{rotulo:'CONTROLE FINANCEIRO',titulo:'Contas a pagar',subtitulo:'Pagamentos pendentes e previstos.',montar:()=>lista('despesa',['pendente','previsto','vencido'])},
  categorias:{rotulo:'CADASTRO FINANCEIRO',titulo:'Categorias',subtitulo:'Estruture receitas e despesas.',montar:categorias},
  relatorios:{rotulo:'RELATÓRIOS',titulo:'Relatórios',subtitulo:'Consolidação financeira para gestão.',montar:relatorios},
  configuracoes:{rotulo:'ADMINISTRAÇÃO',titulo:'Configurações',subtitulo:'Segurança, backup e atualização do sistema.',montar:configuracoes}
};

function confirmarExclusao(titulo,detalhe){
  return new Promise(resolver=>{
    const dialogo=document.createElement('dialog');dialogo.className='modal';
    dialogo.innerHTML=`<h2>${esc(titulo)}</h2><p>${esc(detalhe)}</p><p class="subtitle">A exclusão não pode ser desfeita.</p><div class="row-actions"><button type="button" class="outline-button">Cancelar</button><button type="button" class="primary-action">Excluir</button></div>`;
    const [cancelar,excluir]=dialogo.querySelectorAll('button');let resposta=false;
    cancelar.onclick=()=>dialogo.close();excluir.onclick=()=>{resposta=true;dialogo.close();};
    dialogo.addEventListener('close',()=>{dialogo.remove();resolver(resposta);},{once:true});
    document.body.append(dialogo);dialogo.showModal();excluir.focus();
  });
}
function aviso(texto,erro=false){
  document.querySelectorAll('.toast-celc').forEach(item=>item.remove());
  const toast=document.createElement('div');
  toast.className='toast-celc show'+(erro?' erro':'');toast.setAttribute('role','alert');toast.setAttribute('aria-live','assertive');
  toast.innerHTML=`<b>${erro?'Atenção':'CELC Financeiro'}</b><span>${esc(texto)}</span>`;
  document.body.append(toast);
  setTimeout(()=>toast.remove(),4200);
}

function caminhoDoDialogo(resultado){return Array.isArray(resultado)?resultado[0]||'':typeof resultado==='string'?resultado:'';}
async function escolherDestinoBackup(){return caminhoDoDialogo(await window.Neutralino.os.showSaveDialog('Salvar backup do CELC Financeiro',{defaultPath:'celc-financeiro-backup.db',filters:[{name:'Banco de dados CELC',extensions:['db']}]}));}
async function escolherArquivoBackup(){return caminhoDoDialogo(await window.Neutralino.os.showOpenDialog('Selecionar backup do CELC Financeiro',{multiSelections:false,filters:[{name:'Banco de dados CELC',extensions:['db']}]}));}

function dataPt(data){
  return data?new Date(`${data}T12:00`).toLocaleDateString('pt-BR'):'-';
}

function opcoesMeses(selecionado=hoje.slice(0,7)){
  const [ano,mes]=hoje.slice(0,7).split('-').map(Number),opcoes=[];
  for(let indice=0;indice<24;indice+=1){const data=new Date(ano,mes-1-indice,1,12),valor=`${data.getFullYear()}-${String(data.getMonth()+1).padStart(2,'0')}`,rotulo=data.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});opcoes.push(`<option value="${valor}" ${valor===selecionado?'selected':''}>${rotulo.charAt(0).toUpperCase()+rotulo.slice(1)}</option>`);}
  return opcoes.join('');
}

function tabela(itens,{acao=true}={}){
  itens=itens.map(item=>{const pago=item.pagoCentavos??valorRealizado(banco,item),saldo=item.saldoCentavos??saldoDoLancamento(banco,item);return {...item,situacao:item.tipo==='despesa'&&pago>0&&saldo>0?`Parcial: ${brl(pago)} pagos · ${brl(saldo)} em aberto`:item.situacao};});
  const vazio=`<tr><td colspan="${acao?7:6}" class="empty">Nenhum lançamento encontrado.</td></tr>`;
  return `<div class="table-wrap"><table><thead><tr><th>DESCRIÇÃO</th><th>CATEGORIA</th><th>COMPETÊNCIA</th><th>VENCIMENTO</th><th>VALOR</th><th>SITUAÇÃO</th>${acao?'<th>AÇÕES</th>':''}</tr></thead><tbody>${itens.map(item=>`<tr><td><div class="title-stack"><b>${esc(item.descricao)}</b>${item.recorrencia==='mensal'?'<small>Fixo mensal</small>':''}</div></td><td>${esc(item.categoria)}</td><td>${dataPt(item.competencia)}</td><td>${dataPt(item.vencimento)}</td><td class="amount ${item.tipo==='entrada'?'in':'out'}">${item.tipo==='entrada'?'+':'-'} ${brl(item.valorCentavos)}</td><td><span class="status ${liquidado(item)?'received':'pending'}">${esc(item.situacao)}</span></td>${acao?`<td><div class="row-actions">${liquidado(item)?'<span class="action-note">Liquidado</span>':`<button data-baixar="${esc(item.id)}" class="text-button">${item.tipo==='entrada'?'Receber':'Pagar'}</button>`}<button data-editar="${esc(item.id)}" class="text-button">Editar</button><button data-excluir="${esc(item.id)}" class="text-button danger">Excluir</button></div></td>`:''}</tr>`).join('')||vazio}</tbody></table></div>`;
}

async function dashboard(){
  const r=await api('painel:fluxo',{referencia:mesDashboard,hoje});
  const recentes=(await api('lancamentos:listar')).slice(0,8);
  const sinal=v=>v<0?'out':v>0?'in':'';
  const card=(titulo,valor,nota)=>`<article class="summary-card"><div><p>${titulo}</p><h2 class="${sinal(valor)}">${brl(valor)}</h2><span class="neutral">${nota}</span></div></article>`;
  const e=r.especie;
  const historico=(titulo,linhas)=>`<section class="panel dashboard-section"><h3>${titulo}</h3><div class="table-wrap"><table><thead><tr><th>Período</th><th>Saldo trazido</th><th>Entrou</th><th>Saiu</th><th>Resultado</th><th>Saldo final</th></tr></thead><tbody>${linhas.map(x=>`<tr><td>${x.periodo.split('-').reverse().join('/')}</td><td class="${sinal(x.saldoInicial)}">${brl(x.saldoInicial)}</td><td>${brl(x.entradas)}</td><td>${brl(x.saidas)}</td><td class="${sinal(x.resultado)}">${brl(x.resultado)}</td><td class="${sinal(x.saldoFinal)}">${brl(x.saldoFinal)}</td></tr>`).join('')}</tbody></table></div></section>`;
  return `<div class="toolbar"><label>Mês de referência <input type="month" id="mesDashboard" value="${mesDashboard}"></label></div>
    <section class="summary-grid">
      ${card('Saldo trazido',r.saldoInicial,'Acumulado antes deste mês')}
      ${card('Entradas do mês',r.entradas,'Pela data do recebimento')}
      ${card('Saídas do mês',r.saidas,'Pela data do pagamento')}
      ${card('Saldo acumulado dos lançamentos',r.saldoFinal,'Todas as formas; não é dinheiro na gaveta')}
    </section>
    <section class="content-grid dashboard-summary"><article class="panel"><h3>Resultado do mês e projeção</h3><div class="metric-strip">
      <span>Resultado do mês <b class="${sinal(r.resultado)}">${brl(r.resultado)}</b></span>
      <span>A receber registrado <b>${brl(r.aReceber)}</b></span><span>A pagar registrado <b>${brl(r.aPagar)}</b></span>
      <span>Saldo projetado <b class="${sinal(r.projecao)}">${brl(r.projecao)}</b></span>
    </div><div class="table-wrap"><table class="dashboard-origem"><thead><tr><th>Origem das pendências</th><th>A receber</th><th>A pagar</th></tr></thead><tbody>
      <tr><td>Meses anteriores</td><td>${brl(r.aReceberAnterior)}</td><td>${brl(r.aPagarAnterior)}</td></tr>
      <tr><td>Mês selecionado</td><td>${brl(r.aReceber-r.aReceberAnterior)}</td><td>${brl(r.aPagar-r.aPagarAnterior)}</td></tr>
    </tbody></table></div></article><article class="panel"><h3>Dinheiro em espécie esperado</h3>
      <div class="metric-strip"><span>Saldo esperado <b>${e.esperado===null?'Sem contagem de referência':brl(e.esperado)}</b></span><span>Movimentação líquida do mês <b>${brl(e.liquidoMes)}</b></span></div>
      ${e.base?`<p class="subtitle">Contagem de fechamento: ${dataPt(e.base.data)} · ${brl(e.base.valorCentavos)}</p>`:''}
      <details class="dashboard-contagem"><summary>${e.base?'Atualizar contagem':'Registrar contagem'}</summary>
      <form id="formContagemEspecie" class="stack"><label>Data do fechamento<input name="data" type="date" required></label><label>Dinheiro contado (R$)<input name="valor" type="text" inputmode="decimal" autocomplete="off" required></label><button class="primary-action" type="submit">Salvar contagem</button></form></details>
    </article></section>
    ${detalhesFinanceirosDashboard(r)}
    <section class="panel dashboard-section"><h3>Despesas de meses anteriores pagas neste mês</h3><p class="subtitle">${brl(r.anteriores)} já incluídos nas saídas do mês.</p>
      ${r.despesasAnteriores.length?`<div class="table-wrap"><table><thead><tr><th>Despesa</th><th>Categoria</th><th>Competência</th><th>Data do pagamento</th><th>Valor pago</th></tr></thead><tbody>${r.despesasAnteriores.map(x=>`<tr><td>${esc(x.descricao)}</td><td>${esc(x.categoria)}</td><td>${dataPt(x.competencia)}</td><td>${dataPt(x.data)}</td><td class="amount out">${brl(x.valorCentavos)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="subtitle">Nenhum pagamento de competência anterior neste mês.</p>'}</section>
    ${historico('Histórico mensal',r.meses)}
    ${historico('Histórico anual',r.anos)}
    <section class="panel dashboard-section"><h3>Despesas pagas por categoria</h3><div class="category-list">${r.categorias.map(([nome,valor])=>`<button class="text-button category-history-button" data-historico-categoria="${esc(nome)}">${esc(nome)} <b>${brl(valor)}</b></button>`).join('')||'<span>Sem despesas pagas no período.</span>'}</div></section>
    ${await comparativoDashboard()}
    <section class="panel dashboard-section"><h3>Últimos lançamentos cadastrados</h3>${tabela(recentes)}</section>`;
}

function tabelaFluxoFinanceiro(itens){
  return `<div class="table-wrap"><table><thead><tr><th>Data efetiva</th><th>Competência</th><th>Descrição</th><th>Categoria</th><th>Forma</th><th>Valor</th></tr></thead><tbody>${itens.map(x=>`<tr><td>${dataPt(x.data)}</td><td>${dataPt(x.competencia)}</td><td>${esc(x.descricao)}</td><td>${esc(x.categoria)}</td><td>${esc(x.formaPagamento)}</td><td class="amount ${x.tipo==='entrada'?'in':'out'}">${x.tipo==='entrada'?'+':'−'} ${brl(x.valorCentavos)}</td></tr>`).join('')||'<tr><td colspan="6">Nenhuma movimentação realizada neste período.</td></tr>'}</tbody></table></div>`;
}

function detalhesFinanceirosDashboard(r,{acao=true}={}){
  const linhas=itens=>`<ul class="dashboard-detalhes">${itens.map(x=>`<li>${dataPt(x.data)} · ${esc(x.descricao)} · ${x.tipo==='entrada'?'Entrada':'Saída'} · ${brl(x.valorCentavos)} · ${esc(x.formaPagamento)}</li>`).join('')}</ul>`;
  return `<section class="panel dashboard-section"><h3>A pagar por favorecido</h3><p class="subtitle">Saldo em aberto: <b>${brl(r.aPagar)}</b>. Inclui despesas sem pagamento e parcialmente pagas.</p>
    ${r.pendencias.length?`<div class="table-wrap"><table><thead><tr><th>Favorecido / despesa</th><th>Competência</th><th>Integral</th><th>Em aberto na virada</th><th>Pago no mês</th><th>Total pago</th><th>Falta pagar</th>${acao?'<th>Ação</th>':''}</tr></thead><tbody>
    ${r.pendencias.map(x=>`<tr><td><details><summary><b>${esc(x.favorecido||'Favorecido não informado')}</b></summary><p>${esc(x.descricao)}</p>${x.parcelas.length?linhas(x.parcelas):'<p>Nenhum pagamento registrado.</p>'}</details>${x.favorecido?'':`<small>${esc(x.descricao)}</small>`}</td><td>${dataPt(x.competencia)}</td><td>${brl(x.valorCentavos)}</td><td>${brl(x.trazido)}</td><td>${brl(x.pagoMes)}</td><td>${brl(x.pagoTotal)}</td><td class="amount out">${brl(x.saldo)}</td>${acao?`<td><button type="button" class="text-button" data-editar="${esc(x.id)}">${x.favorecido?'Abrir despesa':'Informar favorecido'}</button></td>`:''}</tr>`).join('')}
    </tbody></table></div>`:'<p class="subtitle">Nenhuma despesa em aberto ou trazida e quitada neste período.</p>'}</section>
    <section class="panel dashboard-section"><h3>Recebimentos por dia</h3><div class="table-wrap"><table><thead><tr><th>Data</th><th>Recebimentos sem discriminação</th><th>Total do dia</th></tr></thead><tbody>
    ${r.entradasPorDia.map(d=>`<tr><td><details><summary>${dataPt(d.data)}</summary>${linhas(d.itens)}</details></td><td>${brl(d.semDiscriminacao)}</td><td class="amount in">${brl(d.total)}</td></tr>`).join('')||'<tr><td colspan="3">Nenhum recebimento no período.</td></tr>'}
    </tbody></table></div></section>
    <section class="panel dashboard-section"><h3>Movimentação por forma registrada</h3><div class="table-wrap"><table><thead><tr><th>Forma</th><th>Entradas</th><th>Saídas</th><th>Movimentação líquida</th></tr></thead><tbody>
    ${r.movimentosPorForma.map(f=>`<tr><td><details><summary>${esc(f.forma)}</summary>${linhas(f.itens)}</details></td><td>${brl(f.entradas)}</td><td>${brl(f.saidas)}</td><td>${brl(f.entradas-f.saidas)}</td></tr>`).join('')||'<tr><td colspan="4">Nenhuma movimentação no período.</td></tr>'}
    </tbody><tfoot><tr><th>Total</th><td>${brl(r.entradas)}</td><td>${brl(r.saidas)}</td><td>${brl(r.resultado)}</td></tr></tfoot></table></div></section>`;
}

function periodoMensal(mes){const [ano,numero]=mes.split('-').map(Number);return {inicio:`${mes}-01`,fim:`${mes}-${String(new Date(ano,numero,0).getDate()).padStart(2,'0')}`};}
async function comparativoDashboard(){
  const [ano,numero]=mesDashboard.split('-').map(Number),anterior=new Date(ano,numero-2,1,12),mesAnterior=`${anterior.getFullYear()}-${String(anterior.getMonth()+1).padStart(2,'0')}`;
  const atual=await api('relatorios:resumo',periodoMensal(mesDashboard)),passado=await api('relatorios:resumo',periodoMensal(mesAnterior));
  const baseReceitas=Math.round((atual.competencia.entradas+passado.competencia.entradas)/2),baseDespesas=Math.round((atual.competencia.despesas+passado.competencia.despesas)/2);
  return `<section class="panel dashboard-section"><h3>Base para provisão do próximo mês</h3><p class="subtitle">Média dos valores totais lançados nas duas competências, incluindo pendências. O mês em andamento pode estar incompleto.</p><div class="metric-strip"><span>Receitas <b>${brl(baseReceitas)}</b></span><span>Despesas <b>${brl(baseDespesas)}</b></span><span>Resultado de referência <b>${brl(baseReceitas-baseDespesas)}</b></span></div></section>`;
}

async function abrirHistoricoCategoria(categoria){
  const grupos=await api('painel:historicoCategoria',{categoria}),modal=document.createElement('div');modal.className='modal-backdrop show';
  const fechar=()=>{modal.remove();document.removeEventListener('keydown',teclado);},teclado=e=>{if(e.key==='Escape')fechar();};
  modal.innerHTML=`<section class="modal category-history-modal" role="dialog" aria-modal="true" aria-label="${esc(categoria)}"><button type="button" class="close" aria-label="Fechar">×</button><h2>${esc(categoria)}</h2><label>Competência<select id="filtroHistoricoCategoria"><option value="">Todos os meses</option>${grupos.map(g=>`<option value="${g.mes}">${g.mes.split('-').reverse().join('/')}</option>`).join('')}</select></label><div id="historicoCategoriaMeses"></div></section>`;
  const preencher=()=>{modal.querySelector('#historicoCategoriaMeses').innerHTML=grupos.filter(g=>!modal.querySelector('select').value||g.mes===modal.querySelector('select').value).map(g=>`<section class="history-month"><h3>${g.mes.split('-').reverse().join('/')}</h3><div class="metric-strip"><span>Total <b>${brl(g.total)}</b></span><span>Pago <b>${brl(g.pago)}</b></span><span>Em aberto <b>${brl(g.saldo)}</b></span></div>${tabela(g.itens,{acao:false})}</section>`).join('')||'<p>Nenhuma despesa nesta categoria.</p>';};
  modal.querySelector('.close').onclick=fechar;modal.onclick=e=>{if(e.target===modal)fechar();};modal.querySelector('select').onchange=preencher;document.addEventListener('keydown',teclado);document.body.append(modal);preencher();modal.querySelector('.close').focus();
}

async function lista(tipo,situacoes){
  const itens=await api('lancamentos:listar',{tipo,situacoes});
  return `<section class="panel"><div class="toolbar"><input id="busca" placeholder="Buscar descrição ou categoria"><div class="toolbar-actions"><button class="primary-action" id="novoModulo">Novo ${tipo==='entrada'?'recebimento':'pagamento'}</button></div></div><div id="tabelaModulo" data-tipo="${tipo}" data-situacoes="${esc(situacoes.join(','))}">${tabela(itens)}</div></section>`;
}

function tabelaCaixa(itens){
  return `<div class="table-wrap"><table><thead><tr><th>DATA</th><th>TIPO</th><th>DETALHE</th><th>RECEITAS</th><th>DESPESAS</th><th>AÇÕES</th></tr></thead><tbody>${itens.map(x=>`<tr><td>${dataPt(x.data)}</td><td><span class="type-badge ${esc(x.tipo||'entrada')}">${(x.tipo||'entrada')==='entrada'?'receita':'despesa'}</span></td><td><div class="title-stack"><b>${esc(x.origem||'Fechamento diário')}</b><small>${esc(x.formaPagamento||'Dinheiro')} · Ref. ${dataPt(x.competencia||x.data)}${x.observacao?` · ${esc(x.observacao)}`:''}</small></div></td><td class="amount in">${(x.tipo||'entrada')==='entrada'?brl(x.valorCentavos):'-'}</td><td class="amount out">${x.tipo==='despesa'?brl(x.valorCentavos):'-'}</td><td><button class="text-button danger" data-excluir-caixa="${esc(x.id)}">Excluir</button></td></tr>`).join('')||'<tr><td colspan="6" class="empty">Nenhum fechamento registrado neste caixa.</td></tr>'}</tbody></table></div>`;
}

async function caixaDiario(){
  const resumo=await api('caixa:resumo',{data:dataCaixa||hoje});
  return `<section class="content-grid"><article class="panel"><h3>Fechamento do caixa diário</h3><p class="subtitle">Registre receitas e apenas despesas sem detalhamento. Use o detalhamento para localizar pagamentos já cadastrados ou incluir uma despesa pontual.</p><form id="formCaixa" class="stack wide-form"><div class="two-columns"><label>Data<input name="data" type="date" max="${hoje}" value="${dataCaixa||hoje}" required></label><label>Receitas recebidas (R$)<input name="receita" type="text" inputmode="decimal" autocomplete="off" placeholder="0,00"></label></div><label>Despesas sem detalhamento (R$)<input name="despesa" type="text" inputmode="decimal" autocomplete="off" placeholder="0,00"></label><button class="outline-button" id="abrirDetalhamento" type="button">Detalhar despesas</button><button class="primary-action">Salvar fechamento diário</button></form></article><article class="panel"><h3>Resumo do dia</h3><div class="metric-strip school-metrics"><span>Receitas <b>${brl(resumo.receitas)}</b></span><span>Pagamentos <b>${brl(resumo.despesas)}</b></span><span>Saldo do dia <b>${brl(resumo.saldo)}</b></span></div><p class="subtitle">${resumo.quantidade} registro(s) financeiro(s) no fechamento de ${dataPt(dataCaixa||hoje)}.</p></article></section><section class="panel"><div class="panel-heading"><div><h3>Movimentação do caixa</h3><p>${dataPt(dataCaixa||hoje)}</p></div></div>${tabelaCaixa(resumo.itens)}</section>`;
}

async function abrirDetalhamentoCaixa(){
  let modal=$('#modalDetalhamentoCaixa');
  if(!modal){
    modal=document.createElement('div');modal.className='modal-backdrop';modal.id='modalDetalhamentoCaixa';
    modal.innerHTML=`<section class="modal stack caixa-detalhamento"><button type="button" class="close" id="fecharDetalhamento">×</button><p class="eyebrow">CAIXA DIÁRIO</p><h2>Detalhar despesas</h2><p class="subtitle">Todos os pagamentos de despesas cadastradas aparecem aqui, inclusive funcionários, terceirizados, categorias e pagamentos fixos. </p><label>Buscar despesa cadastrada<input id="buscaDespesaCaixa" placeholder="Funcionário, terceirizado, descrição ou categoria"></label><div id="resultadosDespesaCaixa" class="expense-search-results"></div><hr class="form-separator"><h3>Despesa não cadastrada</h3><form id="formDespesaAvulsaCaixa" class="stack"><label>Descrição<input name="origem" placeholder="Ex.: compra emergencial de material" required></label><div class="two-columns"><label>Valor (R$)<input name="valor" type="text" inputmode="decimal" autocomplete="off" required></label><label>Pagamento<select name="formaPagamento" required><option value="">Selecione</option><option>Dinheiro</option><option>Pix</option><option>Transferência</option><option>Cartão</option><option>Boleto</option><option>Cheque compensado</option><option>Não informado</option></select></label></div><label>Mês de referência<select name="mesReferencia">${opcoesMeses()}</select></label><label>Observação opcional<input name="observacao" placeholder="Anotação interna"></label><div class="row-actions"><button class="outline-button" id="fecharDetalhamentoSecundario" type="button">Fechar</button><button class="primary-action" type="submit">Registrar despesa no caixa</button></div></form></section>`;
    document.body.append(modal);
    const fechar=()=>modal.classList.remove('show');$('#fecharDetalhamento').onclick=fechar;$('#fecharDetalhamentoSecundario').onclick=fechar;modal.onclick=evento=>{if(evento.target===modal)fechar()};
    $('#buscaDespesaCaixa').oninput=()=>listarDespesasDoCaixa();
    $('#formDespesaAvulsaCaixa').onsubmit=async evento=>{evento.preventDefault();const dados=Object.fromEntries(new FormData(evento.currentTarget)),resposta=await api('caixa:registrar',{data:modal.dataset.data,origem:dados.origem,formaPagamento:dados.formaPagamento,mesReferencia:dados.mesReferencia,observacao:dados.observacao,despesasCentavos:centavosDe(dados.valor)});aviso(resposta.ok?'Despesa pontual registrada no caixa.':resposta.erro,!resposta.ok);if(resposta.ok){fechar();render();}};
  }
  modal.dataset.data=$('#formCaixa [name="data"]')?.value||hoje;modal.classList.add('show');await listarDespesasDoCaixa();
}

async function listarDespesasDoCaixa(){
  const modal=$('#modalDetalhamentoCaixa'),alvo=$('#resultadosDespesaCaixa');if(!modal||!alvo)return;
  const busca=$('#buscaDespesaCaixa')?.value||'',itens=(await api('lancamentos:listar',{tipo:'despesa',busca})).filter(item=>!liquidado(item));
  alvo.innerHTML=itens.map(item=>`<article class="expense-search-result"><div><b>${esc(item.descricao)}</b><small>${esc(item.categoria)}${item.recorrencia==='mensal'?' · Pagamento fixo mensal':''} · Competência: ${dataPt(item.competencia)}</small><small>Total ${brl(item.valorCentavos)} · Pago ${brl(item.pagoCentavos||0)} · Saldo ${brl(item.saldoCentavos??item.valorCentavos)}</small></div><div><label>Valor deste pagamento (R$)<input data-valor-pagamento-caixa type="text" inputmode="decimal" autocomplete="off" value="${((item.saldoCentavos??item.valorCentavos)/100).toFixed(2)}"></label><label>Forma do pagamento<select data-forma-pagamento-caixa><option value="">Selecione</option><option>Dinheiro</option><option>Pix</option><option>Transferência</option><option>Cartão</option><option>Boleto</option><option>Cheque compensado</option><option>Não informado</option></select></label><button class="text-button" data-pagar-despesa-caixa="${esc(item.id)}">Registrar pagamento</button></div></article>`).join('')||'<p class="subtitle">Nenhuma despesa em aberto encontrada.</p>';
  $$('[data-pagar-despesa-caixa]').forEach(botao=>botao.onclick=async()=>{botao.disabled=true;try{const registro=botao.closest('.expense-search-result'),valor=registro.querySelector('[data-valor-pagamento-caixa]').value,resposta=await api('caixa:pagarDespesa',{id:botao.dataset.pagarDespesaCaixa,data:modal.dataset.data,valorCentavos:centavosDe(valor),formaPagamento:registro.querySelector('[data-forma-pagamento-caixa]').value});aviso(resposta.ok?'Pagamento registrado na despesa e no caixa.':resposta.erro,!resposta.ok);if(resposta.ok){modal.classList.remove('show');render();}}catch(erro){aviso(erro.message||'Não foi possível registrar o pagamento.',true);}finally{botao.disabled=false;}});
}

function tabelaDevedores(itens){
  return `<div class="table-wrap"><table><thead><tr><th>ALUNO</th><th>TURMA</th><th>RESPONSÁVEL</th><th>VENCIMENTO</th><th>SALDO</th><th>SITUAÇÃO</th><th>AÇÕES</th></tr></thead><tbody>${itens.map(x=>{const saldo=Math.max(0,x.valorCentavos-Number(x.valorPagoCentavos||0));return `<tr><td><div class="title-stack"><b>${esc(x.aluno)}</b><small>${esc(x.descricao)}</small></div></td><td>${esc(x.turma||'-')}</td><td>${esc(x.responsavel||'-')}<br><small>${esc(x.contato||'')}</small></td><td>${dataPt(x.vencimento)}</td><td class="amount out">${brl(saldo)}${Number(x.valorPagoCentavos||0)?`<small>Recebido ${brl(x.valorPagoCentavos)}</small>`:''}</td><td><span class="status ${x.situacao==='quitado'?'received':'pending'}">${x.situacao==='quitado'?'quitado':x.situacao==='parcial'?'parcial':'em aberto'}</span></td><td>${x.situacao==='quitado'?'Liquidado':`<button class="text-button" data-receber-devedor="${esc(x.id)}" data-saldo-devedor="${saldo}">Receber pagamento</button>`}</td></tr>`;}).join('')||'<tr><td colspan="7" class="empty">Nenhum aluno devedor registrado.</td></tr>'}</tbody></table></div>`;
}

async function alunosDevedores(){
  const itens=await api('devedores:listar',{});
  const aberto=itens.filter(x=>x.situacao!=='quitado'),saldoAberto=aberto.reduce((s,x)=>s+Math.max(0,x.valorCentavos-Number(x.valorPagoCentavos||0)),0);
  return `<section class="content-grid"><article class="panel"><h3>Novo aluno devedor</h3><form id="formDevedor" class="stack wide-form"><div class="two-columns"><label>Aluno<input name="aluno" required></label><label>Turma<input name="turma" placeholder="Ex.: 6º ano A"></label></div><div class="two-columns"><label>Responsável<input name="responsavel"></label><label>Contato<input name="contato" placeholder="Telefone ou WhatsApp"></label></div><label>Pendência<input name="descricao" placeholder="Ex.: mensalidade de agosto, matrícula, material" required></label><div class="two-columns"><label>Vencimento<input name="vencimento" type="date" value="${hoje}" required></label><label>Valor em aberto (R$)<input name="valor" type="text" inputmode="decimal" autocomplete="off" required></label></div><label>Observação<input name="observacao" placeholder="Acordo, histórico ou anotação interna"></label><button class="primary-action">Registrar devedor</button></form></article><article class="panel"><h3>Resumo de cobrança</h3><div class="metric-strip school-metrics"><span>Em aberto <b>${aberto.length}</b></span><span>Saldo pendente <b>${brl(saldoAberto)}</b></span></div><p class="subtitle">Recebimentos totais ou parciais atualizam o saldo do aluno, o Caixa diário e as Entradas.</p></article></section><section class="panel"><div class="panel-heading"><div><h3>Alunos com pendência</h3><p>${aberto.length} registro(s) em aberto ou parcial</p></div></div>${tabelaDevedores(itens)}</section>`;
}

function abrirRecebimentoDevedor(id,saldo){let modal=$('#modalRecebimentoDevedor');if(!modal){modal=document.createElement('div');modal.className='modal-backdrop';modal.id='modalRecebimentoDevedor';modal.innerHTML=`<form class="modal stack" id="formRecebimentoDevedor"><p class="eyebrow">ALUNOS DEVEDORES</p><h2>Receber pagamento</h2><p class="subtitle" id="saldoDevedorModal"></p><label>Data<input name="data" type="date" value="${hoje}" required></label><label>Valor recebido (R$)<input name="valor" type="text" inputmode="decimal" autocomplete="off" required></label><label>Forma de pagamento<select name="formaPagamento"><option value="">Não informar</option><option>Dinheiro</option><option>Pix</option><option>Cartão</option><option>Boleto</option><option>Transferência</option></select></label><label>Observação opcional<input name="observacao"></label><div class="row-actions"><button class="outline-button" id="cancelarRecebimento" type="button">Cancelar</button><button class="primary-action" type="submit">Confirmar recebimento</button></div></form>`;document.body.append(modal);$('#cancelarRecebimento').onclick=()=>modal.classList.remove('show');modal.onclick=evento=>{if(evento.target===modal)modal.classList.remove('show')};$('#formRecebimentoDevedor').onsubmit=async evento=>{evento.preventDefault();const dados=Object.fromEntries(new FormData(evento.currentTarget)),resposta=await api('devedores:baixar',{id:modal.dataset.devedorId,...dados,valorCentavos:centavosDe(dados.valor)});aviso(resposta.ok?(resposta.situacao==='quitado'?'Pendência quitada e entrada registrada.':'Pagamento parcial registrado.'):resposta.erro,!resposta.ok);if(resposta.ok){modal.classList.remove('show');render();}};}modal.dataset.devedorId=id;$('#saldoDevedorModal').textContent=`Saldo atual: ${brl(saldo)}. Informe o valor total ou parcial recebido.`;const form=$('#formRecebimentoDevedor');form.valor.value=(saldo/100).toFixed(2);form.data.value=hoje;modal.classList.add('show');}

async function categorias(){
  const itens=await api('categorias:listar');
  return `<section class="content-grid categories-layout"><article class="panel"><h3>Nova categoria</h3><form id="formCategoria" class="stack"><label>Nome<input name="nome" required></label><label>Tipo<select name="tipo"><option value="entrada">Entrada</option><option value="despesa">Despesa</option></select></label><button class="primary-action">Cadastrar categoria</button></form></article><article class="panel"><h3>Categorias ativas</h3><div class="category-list category-rows">${itens.map(item=>categoriaEmEdicao===item.id?`<form class="category-row category-edit" data-form-editar="${esc(item.id)}"><label>Nome<input name="nome" value="${esc(item.nome)}" required></label><label>Tipo<select name="tipo"><option value="entrada" ${item.tipo==='entrada'?'selected':''}>Entrada</option><option value="despesa" ${item.tipo==='despesa'?'selected':''}>Despesa</option></select></label><div class="row-actions"><button class="text-button" type="submit">Salvar</button><button class="text-button" type="button" data-cancelar-edicao>Cancelar</button></div></form>`:`<div class="category-row"><div><b>${esc(item.nome)}</b><small class="type-badge ${esc(item.tipo)}">${esc(item.tipo)}</small></div><div class="row-actions"><button class="text-button" data-editar-categoria="${esc(item.id)}">Editar</button><button class="text-button" data-arquivar="${esc(item.id)}">Arquivar</button><button class="text-button danger" data-excluir-categoria="${esc(item.id)}">Excluir</button></div></div>`).join('')||'<span>Nenhuma categoria ativa.</span>'}</div></article></section>`;
}

async function relatorios(){
  const relatorio=await api('relatorios:resumo',periodoRelatorio),t=relatorio.totais;
  const abas=[['geral','Visão geral'],['categorias','Por categoria'],['entradas','Entradas'],['despesas','Despesas'],['fluxo','Fluxo de caixa'],['conciliacao','Conferência'],['competencia','Competência'],['inadimplencia','Inadimplência']];
  const botaoAba=([id,nome])=>`<button class="report-tab ${relatorioAba===id?'active':''}" data-relatorio-aba="${id}">${nome}</button>`;
  const linhaCategoria=(item,tipo)=>`<article class="report-category"><div><b>${esc(item.categoria)}</b><span class="type-badge ${tipo}">${tipo}</span></div><div class="report-numbers"><span>Realizado <b>${brl(item.realizado)}</b></span><span>${tipo==='entrada'?'A receber':'A pagar'} <b>${brl(item.pendente)}</b></span><span>Projetado <b>${brl(item.projetado)}</b></span></div></article>`;
  const cartaoCategoria=(item,tipo)=>`<article class="category-total-card ${tipo}"><div><span class="type-badge ${tipo}">${tipo}</span><b>${esc(item.categoria)}</b></div><small>${tipo==='entrada'?'Arrecadado no período':'Gasto no período'}</small><strong>${brl(item.realizado)}</strong><p>${item.quantidade} lançamento${item.quantidade===1?'':'s'} no período</p><button class="text-button" type="button" data-detalhar-categoria="${esc(item.categoria)}" data-tipo-categoria="${tipo}">Detalhar</button></article>`;
  const geral=`<section class="report-metrics"><article><span>Entradas realizadas</span><b class="in">${brl(t.entradasRealizadas)}</b><small>Valores efetivamente recebidos</small></article><article><span>Despesas realizadas</span><b class="out">${brl(t.despesasRealizadas)}</b><small>Valores efetivamente pagos</small></article><article><span>Resultado realizado</span><b>${brl(t.resultadoRealizado)}</b><small>Entradas menos despesas realizadas</small></article><article><span>Saldo projetado</span><b>${brl(t.saldoProjetado)}</b><small>Saldo acumulado mais o saldo a receber, menos o saldo a pagar</small></article></section><section class="report-cards"><article class="panel"><h3>Compromissos em aberto até o fim do filtro</h3><div class="metric-strip report-strip"><span>A receber (exceto mensalidades de alunos) <b>${brl(t.aReceber)}</b></span><span>A pagar <b>${brl(t.aPagar)}</b></span></div><p class="subtitle">Valores pendentes não são somados ao realizado; aparecem somente na projeção.</p></article><article class="panel"><h3>Saldos dos lançamentos</h3><div class="metric-strip"><span>Saldo trazido <b>${brl(t.saldoInicial)}</b></span><span>Saldo acumulado <b>${brl(t.saldoFinal)}</b></span></div><p class="subtitle">Todas as formas de pagamento. O saldo acumulado não é dinheiro em espécie.</p></article></section>`;
  const categorias=`<section class="panel category-dashboard"><div class="panel-heading"><div><h3>Resultado por categoria</h3><p>O total é sempre o valor efetivamente arrecadado ou gasto no período selecionado.</p></div></div><h4>Receitas arrecadadas</h4><div class="category-total-grid">${relatorio.categoriasEntrada.map(item=>cartaoCategoria(item,'entrada')).join('')||'<p class="subtitle">Nenhuma categoria de entrada cadastrada.</p>'}</div><h4>Despesas realizadas</h4><div class="category-total-grid">${relatorio.categoriasDespesa.map(item=>cartaoCategoria(item,'despesa')).join('')||'<p class="subtitle">Nenhuma categoria de despesa cadastrada.</p>'}</div></section>`;
  const entradas=`<section class="panel report-list"><div class="panel-heading"><div><h3>Entradas por categoria</h3><p>Recebido, a receber e projeção por origem de receita.</p></div></div>${relatorio.categoriasEntrada.map(item=>linhaCategoria(item,'entrada')).join('')||'<p class="subtitle">Nenhuma entrada no período selecionado.</p>'}</section>`;
  const despesas=`<section class="panel report-list"><div class="panel-heading"><div><h3>Despesas por categoria</h3><p>Pago, a pagar e projeção por centro de custo.</p></div></div>${relatorio.categoriasDespesa.map(item=>linhaCategoria(item,'despesa')).join('')||'<p class="subtitle">Nenhuma despesa no período selecionado.</p>'}</section>`;
  const fluxo=`<section class="panel"><h3>Fluxo de caixa realizado</h3>${tabelaFluxoFinanceiro(relatorio.fluxo)}</section>`;
  const inadimplencia=`<section class="report-metrics"><article><span>Alunos em aberto</span><b>${relatorio.devedores.quantidade}</b><small>Pendências registradas</small></article><article><span>Valor em aberto</span><b class="out">${brl(relatorio.devedores.valor)}</b><small>Total pendente de alunos</small></article><article><span>Vencidos</span><b>${relatorio.devedores.vencidos}</b><small>Vencimento anterior a hoje</small></article><article><span>Valor vencido</span><b class="out">${brl(relatorio.devedores.valorVencido)}</b><small>Prioridade de cobrança</small></article></section><section class="panel"><div class="panel-heading"><div><h3>Relação de inadimplência</h3><p>Alunos em aberto, ordenados pelo vencimento.</p></div></div>${tabelaDevedores(relatorio.devedores.itens)}</section>`;
  const conciliacao=detalhesFinanceirosDashboard(relatorio.financeiro,{acao:false});
  const c=relatorio.competencia;
  const competencia=`<section class="panel"><h3>Valores integrais por competência</h3><p class="subtitle">Pelo mês de referência da despesa ou receita. Inclui lançamentos ainda não liquidados.</p><div class="metric-strip"><span>Receitas lançadas <b>${brl(c.entradas)}</b></span><span>Despesas lançadas <b>${brl(c.despesas)}</b></span><span>Diferença <b>${brl(c.resultado)}</b></span></div>${tabela(c.itens,{acao:false})}</section>`;
  const conteudo={geral,categorias,entradas,despesas,fluxo,conciliacao,competencia,inadimplencia}[relatorioAba]||geral;
  return `<section class="panel report-filter"><form id="filtroRelatorio"><div><label>De<input name="inicio" type="date" value="${relatorio.inicio}" required></label><label>Até<input name="fim" type="date" value="${relatorio.fim}" required></label></div><div class="toolbar-actions"><button class="outline-button" type="button" data-periodo-relatorio="mes">Mês atual</button><button class="outline-button" type="button" data-periodo-relatorio="ano">Ano atual</button><button class="outline-button" type="submit">Atualizar período</button><button class="outline-button" id="exportarPdf" type="button">Exportar PDF</button><button class="primary-action" id="exportar" type="button">Exportar CSV</button></div></form></section><nav class="report-tabs">${abas.map(botaoAba).join('')}</nav>${conteudo}`;
}

async function abrirDetalhamentoCategoria(categoria,tipo){
  const detalhe=await api('relatorios:detalharCategoria',{categoria,tipo,...periodoRelatorio});
  if(!detalhe.ok){aviso(detalhe.erro,true);return;}
  let modal=$('#modalDetalhamentoCategoria');
  if(!modal){
    modal=document.createElement('div');
    modal.className='modal-backdrop';
    modal.id='modalDetalhamentoCategoria';
    document.body.append(modal);
    modal.onclick=evento=>{if(evento.target===modal)modal.classList.remove('show');};
  }
  const realizado=tipo==='entrada'?'Arrecadado':'Gasto';
  modal.innerHTML=`<section class="modal category-detail-modal"><button type="button" class="close" id="fecharDetalhamentoCategoria">×</button><p class="eyebrow">RELATÓRIO POR CATEGORIA</p><h2>${esc(detalhe.categoria)}</h2><p class="subtitle">${dataPt(detalhe.inicio)} a ${dataPt(detalhe.fim)}</p><div class="metric-strip category-detail-totals"><span>${realizado}<b>${brl(detalhe.totais.realizado)}</b></span><span>${tipo==='entrada'?'A receber':'A pagar'}<b>${brl(detalhe.totais.pendente)}</b></span><span>Projetado<b>${brl(detalhe.totais.projetado)}</b></span></div><div class="category-detail-table"><h3>Movimentos realizados</h3>${tabelaFluxoFinanceiro(detalhe.movimentos)}<h3>Saldo em aberto</h3>${tabela(detalhe.pendencias.map(x=>({...x,valorCentavos:x.saldo,pagoCentavos:0,saldoCentavos:x.saldo})),{acao:false})}</div></section>`;
  $('#fecharDetalhamentoCategoria').onclick=()=>modal.classList.remove('show');
  modal.classList.add('show');
}

async function configuracoes(){
  const versao=APP_VERSION;
  return `<section class="panel settings"><nav class="settings-tabs"><button class="active" data-aba="senha">Segurança</button><button data-aba="backup">Backup</button><button data-aba="atualizacao">Atualização</button></nav><article data-painel="senha"><h3>Trocar senha</h3><form id="formSenha" class="stack"><label>Senha atual<input name="atual" type="password" required></label><label>Nova senha<input name="nova" type="password" minlength="8" required></label><label>Confirmar senha<input name="confirmacao" type="password" minlength="8" required></label><button class="primary-action">Salvar nova senha</button></form></article><article data-painel="backup" hidden><h3>Proteção dos dados</h3><p class="subtitle">Escolha onde guardar a cópia do banco e selecione exatamente qual backup restaurar. Cada arquivo é validado antes da operação.</p><div class="toolbar-actions"><button class="primary-action" id="criarBackup">Escolher destino e criar backup</button><button class="outline-button" id="restaurarBackup">Selecionar backup para restaurar</button></div></article><article data-painel="atualizacao" hidden><h3>Atualização do sistema</h3><p class="subtitle">Versão instalada: <b>${versao}</b>. A consulta é feita automaticamente no canal oficial do CELC; não há configuração técnica exposta.</p><button class="primary-action" id="verificar">Verificar agora</button><button class="outline-button" id="instalar" disabled>Instalar atualização</button><p id="statusAtualizacao" class="form-feedback"></p></article></section>`;
}

async function render(){
  hoje=hojeLocal();
  const meta=telas[tela]||telas.dashboard;
  $('#rotulo').textContent=meta.rotulo;
  $('#titulo').textContent=meta.titulo;
  $('#subtitulo').textContent=meta.subtitulo;
  try{
    $('#conteudo').innerHTML=await meta.montar();
  }catch(erro){
    console.error(erro);
    $('#conteudo').innerHTML=`<section class="panel"><h3>Falha ao abrir esta página</h3><p class="subtitle">${esc(erro.message||erro)}</p></section>`;
  }
  $$('[data-tela]').forEach(botao=>botao.classList.toggle('active',botao.dataset.tela===tela));
  ligarEventos();
}

function irPara(nome){
  if(!telas[nome])return;
  tela=nome;
  render();
}

async function preencherCategorias(valor=''){
  const cats=await api('categorias:listar');
  const form=$('#formLancamento');
  const tipo=form.tipo.value;
  form.categoriaId.innerHTML=cats.filter(cat=>cat.tipo===tipo).map(cat=>`<option value="${esc(cat.id)}" ${cat.id===valor?'selected':''}>${esc(cat.nome)}</option>`).join('');
}

async function atualizarSugestoesDescricao(){
  const form=$('#formLancamento'),lista=$('#sugestoesDescricao');
  if(!form||!lista)return;
  const termo=form.descricao.value.trim(),consulta=++consultaDescricao;
  if(!termo){lista.innerHTML='';return;}
  const sugestoes=await api('lancamentos:sugerirDescricoes',{tipo:form.tipo.value,termo,limite:8});
  if(consulta!==consultaDescricao)return;
  lista.innerHTML=sugestoes.map(item=>`<option value="${esc(item.descricao)}" label="${esc(item.categoria||'Sem categoria')}"></option>`).join('');
}

function abrirModal(item=null,predefinido={}){
  edicao=item;
  const form=$('#formLancamento');
  form.reset();
  $('#erroLancamento').textContent='';
  form.competencia.value=hoje;
  form.tipo.value=item?.tipo||predefinido.tipo||(['despesas','pagar'].includes(tela)?'despesa':['entradas','receber'].includes(tela)?'entrada':'entrada');
  form.tipo.disabled=Boolean(item)||['despesas','pagar','entradas','receber'].includes(tela)||Boolean(predefinido.tipo);
  form.tipo.options[1].textContent='Saída';
  form.dataset.tipoFixo=form.tipo.disabled?form.tipo.value:'';
  form.liquidacao.value=item&&liquidado(item)?'realizado':'aberto';
  form.recorrencia.value=item?.recorrencia||predefinido.recorrencia||'avulso';
  if(item){
    form.descricao.value=item.descricao;
    form.valor.value=(item.valorCentavos/100).toFixed(2).replace('.',',');
    form.competencia.value=item.competencia;
    form.vencimento.value=item.vencimento||'';
    $('#modalTitulo').textContent='Editar lançamento';
  }else{
    $('#modalTitulo').textContent='Registrar movimentação';
  }
  atualizarTextoRecorrencia();
  preencherCategorias(item?.categoriaId);
  atualizarSugestoesDescricao();
  prepararPagamentos(form,item);
  $('#modal').classList.add('show');
}

function prepararPagamentos(form,item){
  $('#pagamentosDespesa')?.remove();
  $('#campoFavorecido')?.remove();
  $('#campoDataLiquidacao')?.remove();
  form.liquidacao.disabled=false;
  form.valor.closest('label').firstChild.textContent=form.tipo.value==='despesa'?'Valor integral (R$)':'Valor (R$)';
  form.liquidacao.innerHTML=form.tipo.value==='despesa'?'<option value="aberto">Sem pagamento agora</option><option value="realizado">Pagamento integral</option><option value="parcial">Pagamentos parciais</option>':'<option value="aberto">Ainda não recebido</option><option value="realizado">Recebido</option>';
  if(form.tipo.value!=='despesa'){
    form.liquidacao.value=item&&liquidado(item)?'realizado':'aberto';
    form.liquidacao.closest('label').insertAdjacentHTML('afterend',`<label id="campoDataLiquidacao">Data do recebimento<input name="dataLiquidacao" type="date" max="${hoje}" value="${esc(item?.liquidadoEm?.slice(0,10)||(form.competencia.value&&form.competencia.value<hoje?form.competencia.value:hoje))}"></label>`);
    const campo=$('#campoDataLiquidacao');campo.hidden=form.liquidacao.value!=='realizado';
    const dataRec=form.dataLiquidacao;dataRec.oninput=()=>{dataRec.dataset.manual='1';};
    if(!item)form.competencia.onchange=()=>{if(form.dataLiquidacao&&form.dataLiquidacao.dataset.manual!=='1')form.dataLiquidacao.value=form.competencia.value&&form.competencia.value<hoje?form.competencia.value:hoje;};
    form.liquidacao.onchange=()=>{campo.hidden=form.liquidacao.value!=='realizado';};
    return;
  }
  form.descricao.closest('label').insertAdjacentHTML('afterend',`<label id="campoFavorecido">Favorecido<input name="favorecido" maxlength="120" value="${esc(item?favorecidoDaDespesa(banco,item.id):'')}"></label>`);
  const pagamentos=item?pagamentosDaDespesa(banco,item):[],pago=item?valorRealizado(banco,item):0;
  form.insertAdjacentHTML('beforeend',`<section id="pagamentosDespesa"><div class="metric-strip"><span>Total pago <b>${brl(pago)}</b></span><span>Saldo <b id="saldoDespesa">${brl((item?.valorCentavos||0)-pago)}</b></span></div>${pagamentos.length?`<h3>Pagamentos registrados</h3><div class="payment-history">${pagamentos.map(p=>`<p>${dataPt(p.data)} · ${brl(p.valorCentavos)} · ${esc(p.formaPagamento)}</p>`).join('')}</div>`:''}<div id="novosPagamentos" hidden><div id="linhasPagamentos"></div><button type="button" id="adicionarPagamento" class="outline-button">Adicionar pagamento</button></div></section>`);
  form.dataset.pagoAnterior=String(pago);
  const atualizarSaldo=()=>atualizarLinhasPagamento();
  form.valor.oninput=atualizarSaldo;
  form.liquidacao.value='aberto';
  form.liquidacao.disabled=Boolean(item&&saldoDoLancamento(banco,item)===0);
  form.liquidacao.onchange=()=>{
    const area=$('#novosPagamentos');area.hidden=form.liquidacao.value==='aberto';$('#linhasPagamentos').innerHTML='';
    if(!area.hidden)adicionarLinhaPagamento(form.liquidacao.value==='realizado'?Math.max(0,centavosDe(form.valor.value||0)-pago):0);
    $('#adicionarPagamento').hidden=form.liquidacao.value!=='parcial';
    atualizarLinhasPagamento();
  };
  $('#adicionarPagamento').onclick=()=>adicionarLinhaPagamento();
  form.liquidacao.closest('.two-columns').insertAdjacentElement('afterend',$('#pagamentosDespesa'));
}

function adicionarLinhaPagamento(valor=0){
  const linha=document.createElement('div');linha.className='payment-row';
  linha.innerHTML=`<label>Data<input data-pagamento-data type="date" value="${hoje}" required></label><label>Valor pago (R$)<input data-pagamento-valor type="text" inputmode="decimal" autocomplete="off" value="${valor?(valor/100).toFixed(2).replace('.',','):''}"></label><label>Forma<select data-pagamento-forma><option value="">Selecione</option><option>Dinheiro</option><option>Pix</option><option>Transferência</option><option>Cartão</option><option>Boleto</option><option>Cheque compensado</option><option>Não informado</option></select></label><button type="button" class="text-button danger" aria-label="Remover pagamento">Remover</button>`;
  linha.querySelector('button').onclick=()=>{linha.remove();atualizarLinhasPagamento();};
  linha.querySelector('[data-pagamento-valor]').oninput=atualizarLinhasPagamento;
  $('#linhasPagamentos').append(linha);
}

function atualizarLinhasPagamento(){
  const form=$('#formLancamento');if(!$('#saldoDespesa'))return;
  const linhas=$$('#linhasPagamentos .payment-row'),totalNovo=linhas.reduce((s,l)=>s+centavosDe(l.querySelector('[data-pagamento-valor]').value||0),0),saldo=centavosDe(form.valor.value||0)-Number(form.dataset.pagoAnterior||0)-totalNovo;
  $('#saldoDespesa').textContent=brl(saldo);
  if(saldo<=0)linhas.filter(l=>l.querySelector('[data-pagamento-valor]').value==='').forEach(l=>l.remove());
  if(form.liquidacao.value==='parcial'&&saldo>0&&(!linhas.length||linhas.at(-1).querySelector('[data-pagamento-valor]').value))adicionarLinhaPagamento();
  $('#adicionarPagamento').hidden=form.liquidacao.value!=='parcial'||saldo<=0;
}

async function preencherHistoricoDescricao(){
  const form=$('#formLancamento');if(edicao)return;
  const tipo=form.tipo.value,nome=form.descricao.value.trim().toLocaleLowerCase('pt-BR');
  const ultimo=banco.listarLancamentos().filter(x=>x.tipo===tipo&&x.descricao.trim().toLocaleLowerCase('pt-BR')===nome).sort((a,b)=>(b.atualizadoEm||b.criadoEm||b.competencia).localeCompare(a.atualizadoEm||a.criadoEm||a.competencia))[0];
  if(!ultimo)return;
  await preencherCategorias(ultimo.categoriaId||banco.listarCategorias().find(c=>c.tipo===tipo&&c.nome===ultimo.categoria)?.id);
  if(form.tipo.value!==tipo||form.descricao.value.trim().toLocaleLowerCase('pt-BR')!==nome)return;
  if(!form.valor.value)form.valor.value=(ultimo.valorCentavos/100).toFixed(2).replace('.',',');
  if(ultimo.vencimento&&!form.vencimento.value){const mes=form.competencia.value.slice(0,7),periodo=periodoMensal(mes);form.vencimento.value=`${mes}-${String(Math.min(Number(ultimo.vencimento.slice(8,10)),Number(periodo.fim.slice(8,10)))).padStart(2,'0')}`;}
  atualizarTextoRecorrencia();form.valor.dispatchEvent(new Event('input'));
}

function atualizarTextoRecorrencia(){
  const form=$('#formLancamento');
  const mensal=form.tipo.value==='despesa'?'Pagamento fixo mensal':'Repetir mensalmente';
  form.recorrencia.options[0].textContent=form.tipo.value==='despesa'?'Pagamento avulso':'Lançamento avulso';
  form.recorrencia.options[1].textContent=mensal;
}

async function filtrarTabela(){
  const alvo=$('#tabelaModulo');
  const busca=$('#busca')?.value||'';
  if(!alvo)return;
  const situacoes=alvo.dataset.situacoes?alvo.dataset.situacoes.split(',').filter(Boolean):[];
  const itens=await api('lancamentos:listar',{tipo:alvo.dataset.tipo,situacoes,busca});
  alvo.innerHTML=tabela(itens);
  ligarEventos();
}

function ligarEventos(){
  $('#mesDashboard')&&($('#mesDashboard').onchange=e=>{if(/^\d{4}-\d{2}$/.test(e.target.value)){mesDashboard=e.target.value;render();}});
  $('#formContagemEspecie')?.addEventListener('submit',async evento=>{
    evento.preventDefault();
    const form=evento.currentTarget,dados=new FormData(form),botao=form.querySelector('button');
    botao.disabled=true;
    try{
      const r=await api('caixa:salvarContagem',{data:dados.get('data'),valorCentavos:centavosDe(dados.get('valor'))});
      if(!r.ok){aviso(r.erro,true);return;}
      aviso('Contagem salva.');await render();
    }catch(erro){aviso(erro.message||'Não foi possível salvar a contagem.',true);}
    finally{botao.disabled=false;}
  });
  $$('[data-historico-categoria]').forEach(botao=>botao.onclick=()=>abrirHistoricoCategoria(botao.dataset.historicoCategoria));
  $$('[data-baixar]').forEach(botao=>botao.onclick=async()=>{
    const item=banco.listarLancamentos().find(x=>x.id===botao.dataset.baixar);
    if(item?.tipo==='despesa'){abrirModal(item);return;}
    const resposta=await api('lancamentos:baixar',{id:botao.dataset.baixar});
    aviso(resposta.ok?'Lançamento liquidado.':resposta.erro,!resposta.ok);
    render();
  });
  $$('[data-editar]').forEach(botao=>botao.onclick=()=>{
    const item=banco.listarLancamentos().find(lancamento=>lancamento.id===botao.dataset.editar);
    if(item)abrirModal(item);
  });
  $$('[data-excluir]').forEach(botao=>botao.onclick=async()=>{
    const item=banco.listarLancamentos().find(x=>x.id===botao.dataset.excluir);
    const pagos=item?banco.listarCaixaDiario().filter(x=>x.lancamentoId===item.id).length:0;
    if(!await confirmarExclusao('Excluir lançamento?',item?`${item.descricao} — ${brl(item.valorCentavos)} (${dataPt(item.competencia)})${pagos?` e ${pagos} registro(s) vinculado(s) no caixa`:''}.`:'Lançamento selecionado.'))return;
    const resposta=await api('lancamentos:excluir',{id:botao.dataset.excluir});
    aviso(resposta.ok?'Lançamento excluído.':resposta.erro,!resposta.ok);
    render();
  });
  $('#novoModulo')&&($('#novoModulo').onclick=()=>abrirModal(null,{tipo:$('#tabelaModulo').dataset.tipo}));
  $('#busca')&&($('#busca').oninput=filtrarTabela);
  $('#exportar')&&($('#exportar').onclick=async()=>{
    const resposta=await api('relatorios:exportar',periodoRelatorio);
    aviso(resposta.ok?'Relatório exportado.':resposta.erro,!resposta.ok);
  });
  $('#exportarPdf')&&($('#exportarPdf').onclick=async()=>{
    const resposta=await api('relatorios:exportarPdf',periodoRelatorio);
    aviso(resposta.ok?'Relatório em PDF exportado.':resposta.erro,!resposta.ok);
  });
  $('#filtroRelatorio')&&($('#filtroRelatorio').onsubmit=evento=>{
    evento.preventDefault();
    periodoRelatorio=Object.fromEntries(new FormData(evento.currentTarget));
    if(periodoRelatorio.inicio>periodoRelatorio.fim){aviso('A data inicial não pode ser maior que a data final.',true);return;}
    render();
  });
  $$('[data-periodo-relatorio]').forEach(botao=>botao.onclick=()=>{
    const ano=hoje.slice(0,4),mes=hoje.slice(5,7);
    periodoRelatorio=botao.dataset.periodoRelatorio==='ano'?{inicio:`${ano}-01-01`,fim:`${ano}-12-31`}:periodoMensal(`${ano}-${mes}`);
    render();
  });
  $$('[data-relatorio-aba]').forEach(botao=>botao.onclick=()=>{relatorioAba=botao.dataset.relatorioAba;render();});
  $$('[data-detalhar-categoria]').forEach(botao=>botao.onclick=()=>abrirDetalhamentoCategoria(botao.dataset.detalharCategoria,botao.dataset.tipoCategoria));
  $('#formCategoria')&&($('#formCategoria').onsubmit=async evento=>{
    evento.preventDefault();
    const resposta=await api('categorias:criar',Object.fromEntries(new FormData(evento.currentTarget)));
    aviso(resposta.ok?'Categoria cadastrada.':resposta.erro,!resposta.ok);
    if(resposta.ok)render();
  });
  $$('[data-editar-categoria]').forEach(botao=>botao.onclick=()=>{
    categoriaEmEdicao=botao.dataset.editarCategoria;
    render();
  });
  $$('[data-form-editar]').forEach(form=>form.onsubmit=async evento=>{
    evento.preventDefault();
    const resposta=await api('categorias:editar',{id:form.dataset.formEditar,...Object.fromEntries(new FormData(form))});
    aviso(resposta.ok?'Categoria atualizada.':resposta.erro,!resposta.ok);
    if(resposta.ok){categoriaEmEdicao=null;render();}
  });
  $$('[data-cancelar-edicao]').forEach(botao=>botao.onclick=()=>{categoriaEmEdicao=null;render();});
  $('#formCaixa')&&($('#formCaixa').data.onchange=evento=>{if(evento.target.value){dataCaixa=evento.target.value;render();}});
  $('#formCaixa')&&($('#formCaixa').onsubmit=async evento=>{
    evento.preventDefault();
    const dados=Object.fromEntries(new FormData(evento.currentTarget));
    dataCaixa=dados.data||dataCaixa;
    const resposta=await api('caixa:registrar',{...dados,formaPagamento:'Não informado',receitasCentavos:centavosDe(dados.receita||0),despesasCentavos:centavosDe(dados.despesa||0)});
    aviso(resposta.ok?'Fechamento diário registrado.':resposta.erro,!resposta.ok);
    if(resposta.ok)render();
  });
  $('#abrirDetalhamento')&&($('#abrirDetalhamento').onclick=abrirDetalhamentoCaixa);
  $$('[data-excluir-caixa]').forEach(botao=>botao.onclick=async()=>{
    const item=banco.listarCaixaDiario().find(x=>x.id===botao.dataset.excluirCaixa);
    if(!await confirmarExclusao('Excluir movimentação do caixa?',item?`${item.tipo==='despesa'?'Despesa':'Receita'} ${item.origem||''} — ${brl(item.valorCentavos)} (${dataPt(item.data)}). O lançamento vinculado também será ajustado.`:'Movimentação selecionada.'))return;
    const resposta=await api('caixa:excluir',{id:botao.dataset.excluirCaixa});
    aviso(resposta.ok?'Movimentação excluída e saldo ajustado.':resposta.erro,!resposta.ok);
    if(resposta.ok)render();
  });
  $('#formDevedor')&&($('#formDevedor').onsubmit=async evento=>{
    evento.preventDefault();
    const dados=Object.fromEntries(new FormData(evento.currentTarget));
    const resposta=await api('devedores:registrar',{...dados,valorCentavos:centavosDe(dados.valor)});
    aviso(resposta.ok?'Aluno devedor registrado.':resposta.erro,!resposta.ok);
    if(resposta.ok)render();
  });
  $$('[data-receber-devedor]').forEach(botao=>botao.onclick=()=>abrirRecebimentoDevedor(botao.dataset.receberDevedor,Number(botao.dataset.saldoDevedor)));
  $$('[data-arquivar]').forEach(botao=>botao.onclick=async()=>{
    const resposta=await api('categorias:arquivar',{id:botao.dataset.arquivar});
    aviso(resposta.ok?'Categoria arquivada.':resposta.erro,!resposta.ok);
    render();
  });
  $$('[data-excluir-categoria]').forEach(botao=>botao.onclick=async()=>{
    if(botao.dataset.confirma!=='1'){
      botao.dataset.confirma='1';
      botao.textContent='Confirmar exclusão';
      setTimeout(()=>{if(botao.isConnected&&botao.dataset.confirma==='1'){botao.dataset.confirma='0';botao.textContent='Excluir';}},3500);
      return;
    }
    const resposta=await api('categorias:excluir',{id:botao.dataset.excluirCategoria});
    aviso(resposta.ok?'Categoria excluída.':resposta.erro,!resposta.ok);
    if(resposta.ok)render();
  });
  $('#formSenha')&&($('#formSenha').onsubmit=async evento=>{
    evento.preventDefault();
    const resposta=await api('acesso:trocarSenha',Object.fromEntries(new FormData(evento.currentTarget)));
    aviso(resposta.ok?'Senha alterada.':resposta.erro,!resposta.ok);
    if(resposta.ok)evento.currentTarget.reset();
  });
  $$('[data-aba]').forEach(botao=>botao.onclick=()=>{
    $$('[data-aba]').forEach(item=>item.classList.toggle('active',item===botao));
    $$('[data-painel]').forEach(painel=>painel.hidden=painel.dataset.painel!==botao.dataset.aba);
  });
  $('#criarBackup')&&($('#criarBackup').onclick=async()=>{
    try{const destino=await escolherDestinoBackup();if(!destino)return;const resposta=await api('backup:criar',{destino});aviso(resposta.ok?'Backup criado no local escolhido.':resposta.erro,!resposta.ok);}catch{aviso('Não foi possível abrir a seleção de destino.',true);}
  });
  $('#restaurarBackup')&&($('#restaurarBackup').onclick=async evento=>{
    if(evento.currentTarget.dataset.ok!=='1'){
      evento.currentTarget.dataset.ok='1';
      evento.currentTarget.textContent='Confirmar restauração';
      return;
    }
    try{const caminho=await escolherArquivoBackup();if(!caminho){evento.currentTarget.dataset.ok='0';evento.currentTarget.textContent='Selecionar backup para restaurar';return;}const resposta=await api('backup:restaurar',{caminho});resposta.ok?location.reload():aviso(resposta.erro,true);}catch{aviso('Não foi possível abrir a seleção de backup.',true);}
  });
  $('#verificar')&&($('#verificar').onclick=async()=>{
    const botao=$('#verificar');botao.disabled=true;const versao=APP_VERSION;
    try{const resposta=await verificarAtualizacao(window.Neutralino,banco,versao);$('#statusAtualizacao').textContent=resposta.ok?(resposta.disponivel?`Nova versão ${resposta.atualizacao.version} disponível.`:resposta.mensagem):resposta.erro;$('#instalar').disabled=!resposta.disponivel;$('#instalar').dataset.disponivel=resposta.disponivel?'1':'0';aviso(resposta.ok?(resposta.disponivel?`Atualização ${resposta.atualizacao.version} encontrada. Clique em Instalar atualização.`:resposta.mensagem):resposta.erro,!resposta.ok);}catch(erro){$('#statusAtualizacao').textContent='Não foi possível consultar atualizações agora.';aviso('Não foi possível consultar atualizações agora. Tente novamente.',true);}finally{botao.disabled=false;}
  });
  $('#instalar')&&($('#instalar').onclick=async evento=>{
    if(evento.currentTarget.dataset.disponivel!=='1')return;
    const botao=evento.currentTarget,versao=APP_VERSION;botao.disabled=true;$('#verificar').disabled=true;$('#statusAtualizacao').textContent='Preparando backup e download da atualização...';aviso('Preparando backup e download. O aplicativo será reaberto ao concluir.');
    try{const resposta=await instalarAtualizacao(window.Neutralino,banco,versao);if(!resposta.ok){$('#statusAtualizacao').textContent=resposta.erro;aviso(resposta.erro,true);botao.disabled=false;$('#verificar').disabled=false;return;}$('#statusAtualizacao').textContent='Download concluído. O aplicativo será fechado e reaberto automaticamente.';}catch(erro){const mensagem='A atualização não pôde ser iniciada. Nenhum arquivo foi trocado.';$('#statusAtualizacao').textContent=mensagem;aviso(mensagem,true);botao.disabled=false;$('#verificar').disabled=false;}
  });
}

function ligarBase(){
  $('#versaoRodape').textContent=`Versão ${APP_VERSION}`;
  $$('[data-tela]').forEach(botao=>botao.onclick=()=>irPara(botao.dataset.tela));
  $('#novo').onclick=()=>abrirModal();
  $('#backup').onclick=async()=>{
    try{const destino=await escolherDestinoBackup();if(!destino)return;const resposta=await api('backup:criar',{destino});aviso(resposta.ok?'Backup criado no local escolhido.':resposta.erro,!resposta.ok);}catch{aviso('Não foi possível abrir a seleção de destino.',true);}
  };
  $('#fechar').onclick=()=>$('#modal').classList.remove('show');
  $('#modal').onclick=evento=>{
    if(evento.target.id==='modal')$('#modal').classList.remove('show');
  };
  $('#formLancamento').tipo.onchange=()=>{
    const form=$('#formLancamento');
    atualizarTextoRecorrencia();
    preencherCategorias();
    atualizarSugestoesDescricao();
    prepararPagamentos(form,edicao);
  };
  $('#formLancamento').descricao.oninput=()=>{atualizarSugestoesDescricao();};
  $('#formLancamento').descricao.onchange=preencherHistoricoDescricao;
  $('#formLancamento').onsubmit=async evento=>{
    evento.preventDefault();
    const form=evento.currentTarget;
    const dadosForm=Object.fromEntries(new FormData(form));
    const categoria=(await api('categorias:listar')).find(item=>item.id===dadosForm.categoriaId);
    const tipo=form.dataset.tipoFixo||form.tipo.value;
    const dados={...dadosForm,tipo,categoria:categoria?.nome||'',liquidado:dadosForm.liquidacao==='realizado',valorCentavos:centavosDe(dadosForm.valor)};
    const pagamentos=tipo==='despesa'&&form.liquidacao.value!=='aberto'?$$('#linhasPagamentos .payment-row').filter(l=>l.querySelector('[data-pagamento-valor]').value!=='').map(l=>({data:l.querySelector('[data-pagamento-data]').value,valorCentavos:centavosDe(l.querySelector('[data-pagamento-valor]').value),formaPagamento:l.querySelector('[data-pagamento-forma]').value})):[];
    if(tipo==='despesa'&&form.liquidacao.value!=='aberto'&&!form.liquidacao.disabled&&!pagamentos.length){$('#erroLancamento').textContent='Adicione pelo menos um pagamento.';return;}
    if(tipo==='despesa'&&form.liquidacao.value==='realizado'&&pagamentos.reduce((s,p)=>s+p.valorCentavos,0)!==dados.valorCentavos-(edicao?valorRealizado(banco,edicao):0)){$('#erroLancamento').textContent='O pagamento integral deve corresponder ao saldo da despesa.';return;}
    const botao=form.querySelector('button.primary-action');botao.disabled=true;
    let resposta;
    try{resposta=tipo==='despesa'?await api('despesas:salvar',{...dados,id:edicao?.id,pagamentos}):edicao?await api('lancamentos:editar',{...dados,id:edicao.id}):await api('lancamentos:criar',dados);}catch(erro){$('#erroLancamento').textContent=`Não foi possível salvar: ${erro.message||erro}`;return;}finally{botao.disabled=false;}
    if(!resposta.ok){
      $('#erroLancamento').textContent=resposta.erro;
      return;
    }
    $('#modal').classList.remove('show');
    aviso(edicao?'Lançamento atualizado.':'Lançamento registrado.');
    render();
  };
  $('#formLogin').onsubmit=async evento=>{
    evento.preventDefault();
    const ok=await validarAcesso(banco,$('#loginUsuario').value,$('#loginSenha').value);
    if(ok){
      $('#login').classList.remove('show');
      render();
    }else{
      $('#loginErro').textContent='Usuário ou senha inválidos.';
    }
  };
}

// Janela sempre visível: tamanho fixo 1280 x 960 centralizado (mínimo 800 x 600; maximizada = monitor inteiro).
// O Windows grava -32000/32767 como posição de janela minimizada; se ela voltar fora da tela, traz para o centro.
const JANELA_NORMAL={width:1280,height:960};
const JANELA_MINIMA={width:800,height:600};
function janelaForaDaTela(pos,tam,tela){
  const x=Number(pos?.x),y=Number(pos?.y),w=Number(tam?.width),h=Number(tam?.height);
  if(![x,y,w,h].every(Number.isFinite)||w<200||h<150)return true;
  if(Math.abs(x)>=30000||Math.abs(y)>=30000)return true;
  const sw=Number(tela?.width||0),sh=Number(tela?.height||0);
  if(!(sw>0&&sh>0))return false;
  const left=Number(tela.left||0),top=Number(tela.top||0);
  const visivel=Math.min(x+w,left+sw)-Math.max(x,left);
  return visivel<120||y<top-10||y>top+sh-60;
}
async function garantirJanelaNaTela(){
  const janela=window.Neutralino?.window;
  if(!janela?.getPosition)return;
  try{
    if(await janela.isMinimized?.().catch(()=>false))return;
    const [pos,tam]=await Promise.all([janela.getPosition(),janela.getSize()]);
    const s=window.screen||{};
    const tela=s.isExtended===true?{width:0,height:0}:{left:Number(s.availLeft||0),top:Number(s.availTop||0),width:Number(s.availWidth||s.width||0),height:Number(s.availHeight||s.height||0)};
    if(!janelaForaDaTela(pos,tam,tela))return;
    await janela.setSize({...JANELA_NORMAL,minWidth:JANELA_MINIMA.width,minHeight:JANELA_MINIMA.height}).catch(()=>{});
    await janela.center();
  }catch{}
}
function vigiarJanela(){
  garantirJanelaNaTela();
  window.Neutralino?.events?.on?.('windowFocus',()=>garantirJanelaNaTela())?.catch?.(()=>{});
}

function ativarBackupNoFechamento(){
  const neutralino=window.Neutralino;
  if(!neutralino?.events?.on)return;
  const oferecerFechamento=()=>{
    const dialogo=document.createElement('dialog');
    dialogo.className='modal';
    dialogo.innerHTML='<h2>Backup não concluído</h2><p>O backup automático falhou. Você pode continuar no programa ou fechá-lo sem esse backup.</p><div class="row-actions"><button type="button" class="outline-button">Continuar no programa</button><button type="button" class="primary-action">Fechar mesmo assim</button></div>';
    const [continuar,fechar]=dialogo.querySelectorAll('button');
    dialogo.addEventListener('close',()=>{dialogo.remove();fechamentoEmAndamento=false;},{once:true});
    continuar.onclick=()=>dialogo.close();
    fechar.onclick=async()=>{
      fechar.disabled=true;
      try{await neutralino.app.exit(0);}catch{aviso('Não foi possível fechar o aplicativo.',true);dialogo.close();}
    };
    document.body.append(dialogo);dialogo.showModal();
  };
  neutralino.events.on('windowClose',async()=>{
    if(fechamentoEmAndamento)return;
    fechamentoEmAndamento=true;
    try{
      await banco.aguardarPersistencia();
      const resposta=await api('backup:criar');
      if(!resposta.ok){oferecerFechamento();return;}
      await neutralino.app.exit(0);
    }catch{oferecerFechamento();}
  });
}

async function iniciar(){
  try{
    window.Neutralino?.init?.();
    if(window.Neutralino){
      await new Promise(resolve=>window.addEventListener('ready',resolve,{once:true}));
      vigiarJanela();
    }
    banco=await abrirBancoSeguro();
    await garantirAcesso(banco);
    api=criarApi({banco,Neutralino:window.Neutralino});
    ativarBackupNoFechamento();
    $('#loginUsuario').value='admin';
    ligarBase();
    await api('lancamentos:recorrencias',{referencia:hoje});
    await api('lancamentos:atualizarVencidos',{referencia:hoje});
    await render();
  }catch(erro){
    console.error(erro);
    $('#conteudo').innerHTML=`<section class="panel"><h3>Falha na inicialização</h3><p class="subtitle">${esc(erro.message||erro)}</p></section>`;
  }
}

iniciar();
