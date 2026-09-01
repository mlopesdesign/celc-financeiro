import {abrirBanco} from './backend/db.js';
import {garantirAcesso,validarAcesso} from './auth.js';
import {criarApi} from './backend/servidor.js';
import {verificarAtualizacao,instalarAtualizacao} from './backend/atualizador.js';

const APP_VERSION='0.2.9';
const hoje=new Date().toISOString().slice(0,10);
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
let periodoRelatorio={inicio:`${hoje.slice(0,7)}-01`,fim:hoje};

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

function aviso(texto,erro=false){
  document.querySelectorAll('.toast-celc').forEach(item=>item.remove());
  const toast=document.createElement('div');
  toast.className='toast-celc show'+(erro?' erro':'');toast.setAttribute('role','alert');toast.setAttribute('aria-live','assertive');
  toast.innerHTML=`<b>${erro?'Atenção':'CELC Financeiro'}</b><span>${esc(texto)}</span>`;
  document.body.append(toast);
  setTimeout(()=>toast.remove(),4200);
}

function dataPt(data){
  return data?new Date(`${data}T12:00`).toLocaleDateString('pt-BR'):'-';
}

function tabela(itens,{acao=true}={}){
  const vazio=`<tr><td colspan="${acao?7:6}" class="empty">Nenhum lançamento encontrado.</td></tr>`;
  return `<div class="table-wrap"><table><thead><tr><th>DESCRIÇÃO</th><th>CATEGORIA</th><th>COMPETÊNCIA</th><th>VENCIMENTO</th><th>VALOR</th><th>SITUAÇÃO</th>${acao?'<th>AÇÕES</th>':''}</tr></thead><tbody>${itens.map(item=>`<tr><td><div class="title-stack"><b>${esc(item.descricao)}</b>${item.recorrencia==='mensal'?'<small>Fixo mensal</small>':''}</div></td><td>${esc(item.categoria)}</td><td>${dataPt(item.competencia)}</td><td>${dataPt(item.vencimento)}</td><td class="amount ${item.tipo==='entrada'?'in':'out'}">${item.tipo==='entrada'?'+':'-'} ${brl(item.valorCentavos)}</td><td><span class="status ${liquidado(item)?'received':'pending'}">${esc(item.situacao)}</span></td>${acao?`<td><div class="row-actions">${liquidado(item)?'<span class="action-note">Liquidado</span>':`<button data-baixar="${esc(item.id)}" class="text-button">${item.tipo==='entrada'?'Receber':'Pagar'}</button>`}<button data-editar="${esc(item.id)}" class="text-button">Editar</button><button data-excluir="${esc(item.id)}" class="text-button danger">Excluir</button></div></td>`:''}</tr>`).join('')||vazio}</tbody></table></div>`;
}

async function dashboard(){
  const resumo=await api('painel:resumo',{referencia:hoje});
  const pendentes=resumo.recentes.filter(item=>!liquidado(item));
  const porCategoria=resumo.doMes.filter(item=>item.tipo==='despesa'&&liquidado(item)).reduce((total,item)=>{
    total[item.categoria]=(total[item.categoria]||0)+item.valorCentavos;
    return total;
  },{});
  return `<section class="summary-grid"><article class="summary-card"><div><p>Saldo disponível</p><h2>${brl(resumo.saldoDisponivel)}</h2><span class="neutral">Somente valores realizados</span></div></article><article class="summary-card"><div><p>Entradas realizadas</p><h2>${brl(resumo.entradas)}</h2><span class="positive">No mês</span></div></article><article class="summary-card"><div><p>Despesas realizadas</p><h2>${brl(resumo.despesas)}</h2><span class="negative">No mês</span></div></article><article class="summary-card"><div><p>Projeção mensal</p><h2>${brl(resumo.projecao)}</h2><span class="neutral">Inclui pendências e previsões</span></div></article></section><section class="content-grid"><article class="panel"><div class="panel-heading"><div><h3>Resultado do mês</h3><p>Realizado: ${brl(resumo.resultado)} · Projetado: ${brl(resumo.previsto)}</p></div></div><div class="metric-strip"><span>Recebido <b>${brl(resumo.entradas)}</b></span><span>Pago <b>${brl(resumo.despesas)}</b></span><span>Pendente <b>${brl(pendentes.reduce((s,item)=>s+item.valorCentavos,0))}</b></span></div></article><article class="panel"><div class="panel-heading"><div><h3>Despesas por categoria</h3><p>Valores pagos no mês</p></div></div><div class="category-list">${Object.entries(porCategoria).map(([nome,valor])=>`<span>${esc(nome)} <b>${brl(valor)}</b></span>`).join('')||'<span>Sem despesas pagas no período.</span>'}</div></article></section><section class="panel"><div class="panel-heading"><div><h3>Últimas movimentações</h3><p>${pendentes.length} pendência(s) aguardando baixa</p></div></div>${tabela(resumo.recentes.slice(0,8))}</section>`;
}

async function lista(tipo,situacoes){
  const itens=await api('lancamentos:listar',{tipo,situacoes});
  return `<section class="panel"><div class="toolbar"><input id="busca" placeholder="Buscar descrição ou categoria"><div class="toolbar-actions"><button class="primary-action" id="novoModulo">Novo ${tipo==='entrada'?'recebimento':'pagamento'}</button></div></div><div id="tabelaModulo" data-tipo="${tipo}" data-situacoes="${esc(situacoes.join(','))}">${tabela(itens)}</div></section>`;
}

function tabelaCaixa(itens){
  return `<div class="table-wrap"><table><thead><tr><th>DATA</th><th>TIPO</th><th>DETALHE</th><th>RECEITAS</th><th>DESPESAS</th><th>AÇÕES</th></tr></thead><tbody>${itens.map(x=>`<tr><td>${dataPt(x.data)}</td><td><span class="type-badge ${x.tipo||'entrada'}">${(x.tipo||'entrada')==='entrada'?'receita':'despesa'}</span></td><td><div class="title-stack"><b>${esc(x.origem||'Fechamento diário')}</b><small>${esc(x.formaPagamento||'Dinheiro')}${x.observacao?` · ${esc(x.observacao)}`:''}</small></div></td><td class="amount in">${(x.tipo||'entrada')==='entrada'?brl(x.valorCentavos):'-'}</td><td class="amount out">${x.tipo==='despesa'?brl(x.valorCentavos):'-'}</td><td>${x.tipo==='despesa'?`<button class="text-button danger" data-excluir-caixa="${esc(x.id)}">Excluir</button>`:'—'}</td></tr>`).join('')||'<tr><td colspan="6" class="empty">Nenhum fechamento registrado neste caixa.</td></tr>'}</tbody></table></div>`;
}

async function caixaDiario(){
  const resumo=await api('caixa:resumo',{data:hoje});
  return `<section class="content-grid"><article class="panel"><h3>Fechamento do caixa diário</h3><p class="subtitle">Registre receitas e apenas despesas sem detalhamento. Use o detalhamento para localizar pagamentos já cadastrados ou incluir uma despesa pontual.</p><form id="formCaixa" class="stack wide-form"><div class="two-columns"><label>Data<input name="data" type="date" value="${hoje}" required></label><label>Receitas recebidas (R$)<input name="receita" type="number" step="0.01" min="0" placeholder="0,00"></label></div><label>Despesas sem detalhamento (R$)<input name="despesa" type="number" step="0.01" min="0" placeholder="0,00"></label><button class="outline-button" id="abrirDetalhamento" type="button">Detalhar despesas</button><button class="primary-action">Salvar fechamento diário</button></form></article><article class="panel"><h3>Resumo do dia</h3><div class="metric-strip school-metrics"><span>Receitas <b>${brl(resumo.receitas)}</b></span><span>Pagamentos <b>${brl(resumo.despesas)}</b></span><span>Saldo do dia <b>${brl(resumo.saldo)}</b></span></div><p class="subtitle">${resumo.quantidade} registro(s) financeiro(s) no fechamento de ${dataPt(hoje)}.</p></article></section><section class="panel"><div class="panel-heading"><div><h3>Movimentação do caixa</h3><p>${dataPt(hoje)}</p></div></div>${tabelaCaixa(resumo.itens)}</section>`;
}

async function abrirDetalhamentoCaixa(){
  let modal=$('#modalDetalhamentoCaixa');
  if(!modal){
    modal=document.createElement('div');modal.className='modal-backdrop';modal.id='modalDetalhamentoCaixa';
    modal.innerHTML=`<section class="modal stack caixa-detalhamento"><button type="button" class="close" id="fecharDetalhamento">×</button><p class="eyebrow">CAIXA DIÁRIO</p><h2>Detalhar despesas</h2><p class="subtitle">Localize despesas cadastradas, inclusive pagamentos fixos, ou registre uma despesa pontual. O pagamento padrão é em dinheiro.</p><label>Buscar despesa cadastrada<input id="buscaDespesaCaixa" placeholder="Descrição ou categoria"></label><div id="resultadosDespesaCaixa" class="expense-search-results"></div><hr class="form-separator"><h3>Despesa não cadastrada</h3><form id="formDespesaAvulsaCaixa" class="stack"><label>Descrição<input name="origem" placeholder="Ex.: compra emergencial de material" required></label><div class="two-columns"><label>Valor (R$)<input name="valor" type="number" min="0.01" step="0.01" required></label><label>Pagamento<select name="formaPagamento"><option selected>Dinheiro</option><option>Pix</option><option>Cartão</option><option>Boleto</option><option>Transferência</option></select></label></div><label>Observação opcional<input name="observacao" placeholder="Anotação interna"></label><div class="row-actions"><button class="outline-button" id="fecharDetalhamentoSecundario" type="button">Fechar</button><button class="primary-action" type="submit">Registrar despesa no caixa</button></div></form></section>`;
    document.body.append(modal);
    const fechar=()=>modal.classList.remove('show');$('#fecharDetalhamento').onclick=fechar;$('#fecharDetalhamentoSecundario').onclick=fechar;modal.onclick=evento=>{if(evento.target===modal)fechar()};
    $('#buscaDespesaCaixa').oninput=()=>listarDespesasDoCaixa();
    $('#formDespesaAvulsaCaixa').onsubmit=async evento=>{evento.preventDefault();const dados=Object.fromEntries(new FormData(evento.currentTarget)),resposta=await api('caixa:registrar',{data:modal.dataset.data,origem:dados.origem,formaPagamento:dados.formaPagamento,observacao:dados.observacao,despesasCentavos:Math.round(Number(dados.valor)*100)});aviso(resposta.ok?'Despesa pontual registrada no caixa.':resposta.erro,!resposta.ok);if(resposta.ok){fechar();render();}};
  }
  modal.dataset.data=$('#formCaixa')?.data.value||hoje;modal.classList.add('show');await listarDespesasDoCaixa();
}

async function listarDespesasDoCaixa(){
  const modal=$('#modalDetalhamentoCaixa'),alvo=$('#resultadosDespesaCaixa');if(!modal||!alvo)return;
  const busca=$('#buscaDespesaCaixa')?.value||'',itens=(await api('lancamentos:listar',{tipo:'despesa',busca})).filter(item=>!liquidado(item));
  alvo.innerHTML=itens.slice(0,8).map(item=>`<article class="expense-search-result"><div><b>${esc(item.descricao)}</b><small>${esc(item.categoria)}${item.recorrencia==='mensal'?' · Pagamento fixo mensal':''} · ${dataPt(item.vencimento||item.competencia)}</small></div><div><strong>${brl(item.valorCentavos)}</strong><button class="text-button" data-pagar-despesa-caixa="${esc(item.id)}">Registrar pagamento</button></div></article>`).join('')||'<p class="subtitle">Nenhuma despesa em aberto encontrada.</p>';
  $$('[data-pagar-despesa-caixa]').forEach(botao=>botao.onclick=async()=>{const resposta=await api('caixa:pagarDespesa',{id:botao.dataset.pagarDespesaCaixa,data:modal.dataset.data,formaPagamento:$('#formDespesaAvulsaCaixa').formaPagamento.value||'Dinheiro'});aviso(resposta.ok?'Despesa cadastrada paga e incluída no caixa.':resposta.erro,!resposta.ok);if(resposta.ok){modal.classList.remove('show');render();}});
}

function tabelaDevedores(itens){
  return `<div class="table-wrap"><table><thead><tr><th>ALUNO</th><th>TURMA</th><th>RESPONSÁVEL</th><th>VENCIMENTO</th><th>SALDO</th><th>SITUAÇÃO</th><th>AÇÕES</th></tr></thead><tbody>${itens.map(x=>{const saldo=Math.max(0,x.valorCentavos-Number(x.valorPagoCentavos||0));return `<tr><td><div class="title-stack"><b>${esc(x.aluno)}</b><small>${esc(x.descricao)}</small></div></td><td>${esc(x.turma||'-')}</td><td>${esc(x.responsavel||'-')}<br><small>${esc(x.contato||'')}</small></td><td>${dataPt(x.vencimento)}</td><td class="amount out">${brl(saldo)}${Number(x.valorPagoCentavos||0)?`<small>Recebido ${brl(x.valorPagoCentavos)}</small>`:''}</td><td><span class="status ${x.situacao==='quitado'?'received':'pending'}">${x.situacao==='quitado'?'quitado':x.situacao==='parcial'?'parcial':'em aberto'}</span></td><td>${x.situacao==='quitado'?'Liquidado':`<button class="text-button" data-receber-devedor="${esc(x.id)}" data-saldo-devedor="${saldo}">Receber pagamento</button>`}</td></tr>`;}).join('')||'<tr><td colspan="7" class="empty">Nenhum aluno devedor registrado.</td></tr>'}</tbody></table></div>`;
}

async function alunosDevedores(){
  const itens=await api('devedores:listar',{});
  const aberto=itens.filter(x=>x.situacao!=='quitado'),saldoAberto=aberto.reduce((s,x)=>s+Math.max(0,x.valorCentavos-Number(x.valorPagoCentavos||0)),0);
  return `<section class="content-grid"><article class="panel"><h3>Novo aluno devedor</h3><form id="formDevedor" class="stack wide-form"><div class="two-columns"><label>Aluno<input name="aluno" required></label><label>Turma<input name="turma" placeholder="Ex.: 6º ano A"></label></div><div class="two-columns"><label>Responsável<input name="responsavel"></label><label>Contato<input name="contato" placeholder="Telefone ou WhatsApp"></label></div><label>Pendência<input name="descricao" placeholder="Ex.: mensalidade de agosto, matrícula, material" required></label><div class="two-columns"><label>Vencimento<input name="vencimento" type="date" value="${hoje}" required></label><label>Valor em aberto (R$)<input name="valor" type="number" step="0.01" min="0.01" required></label></div><label>Observação<input name="observacao" placeholder="Acordo, histórico ou anotação interna"></label><button class="primary-action">Registrar devedor</button></form></article><article class="panel"><h3>Resumo de cobrança</h3><div class="metric-strip school-metrics"><span>Em aberto <b>${aberto.length}</b></span><span>Saldo pendente <b>${brl(saldoAberto)}</b></span></div><p class="subtitle">Recebimentos totais ou parciais atualizam o saldo do aluno, o Caixa diário e as Entradas.</p></article></section><section class="panel"><div class="panel-heading"><div><h3>Alunos com pendência</h3><p>${aberto.length} registro(s) em aberto ou parcial</p></div></div>${tabelaDevedores(itens)}</section>`;
}

function abrirRecebimentoDevedor(id,saldo){let modal=$('#modalRecebimentoDevedor');if(!modal){modal=document.createElement('div');modal.className='modal-backdrop';modal.id='modalRecebimentoDevedor';modal.innerHTML=`<form class="modal stack" id="formRecebimentoDevedor"><p class="eyebrow">ALUNOS DEVEDORES</p><h2>Receber pagamento</h2><p class="subtitle" id="saldoDevedorModal"></p><label>Data<input name="data" type="date" value="${hoje}" required></label><label>Valor recebido (R$)<input name="valor" type="number" step="0.01" min="0.01" required></label><label>Forma de pagamento<select name="formaPagamento"><option value="">Não informar</option><option>Dinheiro</option><option>Pix</option><option>Cartão</option><option>Boleto</option><option>Transferência</option></select></label><label>Observação opcional<input name="observacao"></label><div class="row-actions"><button class="outline-button" id="cancelarRecebimento" type="button">Cancelar</button><button class="primary-action" type="submit">Confirmar recebimento</button></div></form>`;document.body.append(modal);$('#cancelarRecebimento').onclick=()=>modal.classList.remove('show');modal.onclick=evento=>{if(evento.target===modal)modal.classList.remove('show')};$('#formRecebimentoDevedor').onsubmit=async evento=>{evento.preventDefault();const dados=Object.fromEntries(new FormData(evento.currentTarget)),resposta=await api('devedores:baixar',{id:modal.dataset.devedorId,...dados,valorCentavos:Math.round(Number(dados.valor)*100)});aviso(resposta.ok?(resposta.situacao==='quitado'?'Pendência quitada e entrada registrada.':'Pagamento parcial registrado.'):resposta.erro,!resposta.ok);if(resposta.ok){modal.classList.remove('show');render();}};}modal.dataset.devedorId=id;$('#saldoDevedorModal').textContent=`Saldo atual: ${brl(saldo)}. Informe o valor total ou parcial recebido.`;const form=$('#formRecebimentoDevedor');form.valor.value=(saldo/100).toFixed(2);form.data.value=hoje;modal.classList.add('show');}

async function categorias(){
  const itens=await api('categorias:listar');
  return `<section class="content-grid categories-layout"><article class="panel"><h3>Nova categoria</h3><form id="formCategoria" class="stack"><label>Nome<input name="nome" required></label><label>Tipo<select name="tipo"><option value="entrada">Entrada</option><option value="despesa">Despesa</option></select></label><button class="primary-action">Cadastrar categoria</button></form></article><article class="panel"><h3>Categorias ativas</h3><div class="category-list category-rows">${itens.map(item=>categoriaEmEdicao===item.id?`<form class="category-row category-edit" data-form-editar="${esc(item.id)}"><label>Nome<input name="nome" value="${esc(item.nome)}" required></label><label>Tipo<select name="tipo"><option value="entrada" ${item.tipo==='entrada'?'selected':''}>Entrada</option><option value="despesa" ${item.tipo==='despesa'?'selected':''}>Despesa</option></select></label><div class="row-actions"><button class="text-button" type="submit">Salvar</button><button class="text-button" type="button" data-cancelar-edicao>Cancelar</button></div></form>`:`<div class="category-row"><div><b>${esc(item.nome)}</b><small class="type-badge ${esc(item.tipo)}">${esc(item.tipo)}</small></div><div class="row-actions"><button class="text-button" data-editar-categoria="${esc(item.id)}">Editar</button><button class="text-button" data-arquivar="${esc(item.id)}">Arquivar</button><button class="text-button danger" data-excluir-categoria="${esc(item.id)}">Excluir</button></div></div>`).join('')||'<span>Nenhuma categoria ativa.</span>'}</div></article></section>`;
}

async function relatorios(){
  const relatorio=await api('relatorios:resumo',periodoRelatorio),t=relatorio.totais,abas=[['geral','Visão geral'],['entradas','Entradas'],['despesas','Despesas'],['fluxo','Fluxo de caixa'],['inadimplencia','Inadimplência']],botaoAba=([id,nome])=>`<button class="report-tab ${relatorioAba===id?'active':''}" data-relatorio-aba="${id}">${nome}</button>`,linhaCategoria=(item,tipo)=>`<article class="report-category"><div><b>${esc(item.categoria)}</b><span class="type-badge ${tipo}">${tipo==='entrada'?'entrada':'despesa'}</span></div><div class="report-numbers"><span>Realizado <b>${brl(item.realizado)}</b></span><span>${tipo==='entrada'?'A receber':'A pagar'} <b>${brl(item.pendente)}</b></span><span>Projetado <b>${brl(item.projetado)}</b></span></div></article>`,conteudo={geral:`<section class="report-metrics"><article><span>Entradas realizadas</span><b class="in">${brl(t.entradasRealizadas)}</b><small>Valores efetivamente recebidos</small></article><article><span>Despesas realizadas</span><b class="out">${brl(t.despesasRealizadas)}</b><small>Valores efetivamente pagos</small></article><article><span>Resultado realizado</span><b>${brl(t.resultadoRealizado)}</b><small>Entradas menos despesas realizadas</small></article><article><span>Resultado projetado</span><b>${brl(t.resultadoProjetado)}</b><small>Inclui contas a receber e a pagar</small></article></section><section class="report-cards"><article class="panel"><h3>Compromissos do período</h3><div class="metric-strip report-strip"><span>A receber <b>${brl(t.aReceber)}</b></span><span>A pagar <b>${brl(t.aPagar)}</b></span></div><p class="subtitle">Valores pendentes não são somados ao realizado; aparecem somente na projeção.</p></article><article class="panel"><h3>Leitura financeira</h3><p class="subtitle">O resultado realizado mede caixa confirmado. O resultado projetado considera lançamentos ainda pendentes dentro do período selecionado.</p></article></section>`,entradas:`<section class="panel report-list"><div class="panel-heading"><div><h3>Entradas por categoria</h3><p>Recebido, a receber e projeção por origem de receita.</p></div></div>${relatorio.categoriasEntrada.map(item=>linhaCategoria(item,'entrada')).join('')||'<p class="subtitle">Nenhuma entrada no período selecionado.</p>'}</section>`,despesas:`<section class="panel report-list"><div class="panel-heading"><div><h3>Despesas por categoria</h3><p>Pago, a pagar e projeção por centro de custo.</p></div></div>${relatorio.categoriasDespesa.map(item=>linhaCategoria(item,'despesa')).join('')||'<p class="subtitle">Nenhuma despesa no período selecionado.</p>'}</section>`,fluxo:`<section class="panel"><div class="panel-heading"><div><h3>Fluxo de caixa realizado</h3><p>Movimentações em data de baixa: apenas recebido ou pago.</p></div></div>${tabela(relatorio.fluxo.map(item=>({id:item.data+item.descricao,descricao:item.descricao,categoria:item.categoria,competencia:item.data,vencimento:'',valorCentavos:item.valorCentavos,tipo:item.tipo,situacao:item.tipo==='entrada'?'recebido':'pago',recorrencia:'avulso'})),{acao:false})}</section>`,inadimplencia:`<section class="report-metrics"><article><span>Alunos em aberto</span><b>${relatorio.devedores.quantidade}</b><small>Pendências registradas</small></article><article><span>Valor em aberto</span><b class="out">${brl(relatorio.devedores.valor)}</b><small>Total pendente de alunos</small></article><article><span>Vencidos</span><b>${relatorio.devedores.vencidos}</b><small>Vencimento anterior a hoje</small></article><article><span>Valor vencido</span><b class="out">${brl(relatorio.devedores.valorVencido)}</b><small>Prioridade de cobrança</small></article></section><section class="panel"><div class="panel-heading"><div><h3>Relação de inadimplência</h3><p>Alunos em aberto, ordenados pelo vencimento.</p></div></div>${tabelaDevedores(relatorio.devedores.itens)}</section>`}[relatorioAba]||'';
  return `<section class="panel report-filter"><form id="filtroRelatorio"><div><label>De<input name="inicio" type="date" value="${relatorio.inicio}" required></label><label>Até<input name="fim" type="date" value="${relatorio.fim}" required></label></div><div class="toolbar-actions"><button class="outline-button" type="submit">Atualizar período</button><button class="outline-button" id="exportarPdf" type="button">Exportar PDF</button><button class="primary-action" id="exportar" type="button">Exportar CSV</button></div></form></section><nav class="report-tabs">${abas.map(botaoAba).join('')}</nav>${conteudo}`;
}

async function configuracoes(){
  const versao=APP_VERSION;
  return `<section class="panel settings"><nav class="settings-tabs"><button class="active" data-aba="senha">Segurança</button><button data-aba="backup">Backup</button><button data-aba="atualizacao">Atualização</button></nav><article data-painel="senha"><h3>Trocar senha</h3><form id="formSenha" class="stack"><label>Senha atual<input name="atual" type="password" required></label><label>Nova senha<input name="nova" type="password" minlength="8" required></label><label>Confirmar senha<input name="confirmacao" type="password" minlength="8" required></label><button class="primary-action">Salvar nova senha</button></form></article><article data-painel="backup" hidden><h3>Proteção dos dados</h3><p class="subtitle">O banco está separado do executável. O backup só é aceito quando passa pela validação de integridade.</p><button class="primary-action" id="criarBackup">Criar backup agora</button><button class="outline-button" id="restaurarBackup">Restaurar último backup</button></article><article data-painel="atualizacao" hidden><h3>Atualização do sistema</h3><p class="subtitle">Versão instalada: <b>${versao}</b>. A consulta é feita automaticamente no canal oficial do CELC; não há configuração técnica exposta.</p><button class="primary-action" id="verificar">Verificar agora</button><button class="outline-button" id="instalar" disabled>Instalar atualização</button><p id="statusAtualizacao" class="form-feedback"></p></article></section>`;
}

async function render(){
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

function abrirModal(item=null,predefinido={}){
  edicao=item;
  const form=$('#formLancamento');
  form.reset();
  $('#erroLancamento').textContent='';
  form.competencia.value=hoje;
  form.tipo.value=item?.tipo||predefinido.tipo||'entrada';
  form.liquidacao.value=item&&liquidado(item)?'realizado':'aberto';
  form.recorrencia.value=item?.recorrencia||predefinido.recorrencia||'avulso';
  if(item){
    form.descricao.value=item.descricao;
    form.valor.value=(item.valorCentavos/100).toFixed(2);
    form.competencia.value=item.competencia;
    form.vencimento.value=item.vencimento||'';
    $('#modalTitulo').textContent='Editar lançamento';
  }else{
    $('#modalTitulo').textContent='Registrar movimentação';
  }
  atualizarTextoRecorrencia();
  preencherCategorias(item?.categoriaId);
  $('#modal').classList.add('show');
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
  $$('[data-baixar]').forEach(botao=>botao.onclick=async()=>{
    const resposta=await api('lancamentos:baixar',{id:botao.dataset.baixar});
    aviso(resposta.ok?'Lançamento liquidado.':resposta.erro,!resposta.ok);
    render();
  });
  $$('[data-editar]').forEach(botao=>botao.onclick=()=>{
    const item=banco.listarLancamentos().find(lancamento=>lancamento.id===botao.dataset.editar);
    if(item)abrirModal(item);
  });
  $$('[data-excluir]').forEach(botao=>botao.onclick=async()=>{
    if(botao.dataset.confirma!=='1'){
      botao.dataset.confirma='1';
      botao.textContent='Confirmar';
      setTimeout(()=>{if(botao.isConnected&&botao.dataset.confirma==='1'){botao.dataset.confirma='0';botao.textContent='Excluir';}},3500);
      return;
    }
    const resposta=await api('lancamentos:excluir',{id:botao.dataset.excluir});
    aviso(resposta.ok?'Lançamento excluído.':resposta.erro,!resposta.ok);
    render();
  });
  $('#novoModulo')&&($('#novoModulo').onclick=()=>abrirModal());
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
  $$('[data-relatorio-aba]').forEach(botao=>botao.onclick=()=>{relatorioAba=botao.dataset.relatorioAba;render();});
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
  $('#formCaixa')&&($('#formCaixa').onsubmit=async evento=>{
    evento.preventDefault();
    const dados=Object.fromEntries(new FormData(evento.currentTarget));
    const resposta=await api('caixa:registrar',{...dados,formaPagamento:'Dinheiro',receitasCentavos:Math.round(Number(dados.receita||0)*100),despesasCentavos:Math.round(Number(dados.despesa||0)*100)});
    aviso(resposta.ok?'Fechamento diário registrado.':resposta.erro,!resposta.ok);
    if(resposta.ok)render();
  });
  $('#abrirDetalhamento')&&($('#abrirDetalhamento').onclick=abrirDetalhamentoCaixa);
  $$('[data-excluir-caixa]').forEach(botao=>botao.onclick=async()=>{
    if(botao.dataset.confirma!=='1'){
      botao.dataset.confirma='1';botao.textContent='Confirmar exclusão';
      setTimeout(()=>{if(botao.isConnected&&botao.dataset.confirma==='1'){botao.dataset.confirma='0';botao.textContent='Excluir';}},3500);
      return;
    }
    const resposta=await api('caixa:excluir',{id:botao.dataset.excluirCaixa});
    aviso(resposta.ok?'Movimentação excluída e saldo ajustado.':resposta.erro,!resposta.ok);
    if(resposta.ok)render();
  });
  $('#formDevedor')&&($('#formDevedor').onsubmit=async evento=>{
    evento.preventDefault();
    const dados=Object.fromEntries(new FormData(evento.currentTarget));
    const resposta=await api('devedores:registrar',{...dados,valorCentavos:Math.round(Number(dados.valor)*100)});
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
    const resposta=await api('backup:criar');
    aviso(resposta.ok?'Backup criado.':resposta.erro,!resposta.ok);
  });
  $('#restaurarBackup')&&($('#restaurarBackup').onclick=async evento=>{
    if(evento.currentTarget.dataset.ok!=='1'){
      evento.currentTarget.dataset.ok='1';
      evento.currentTarget.textContent='Confirmar restauração';
      return;
    }
    const resposta=await api('backup:restaurar');
    resposta.ok?location.reload():aviso(resposta.erro,true);
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
  $$('[data-tela]').forEach(botao=>botao.onclick=()=>irPara(botao.dataset.tela));
  $('#novo').onclick=()=>abrirModal();
  $('#backup').onclick=async()=>{
    const resposta=await api('backup:criar');
    aviso(resposta.ok?'Backup criado.':resposta.erro,!resposta.ok);
  };
  $('#fechar').onclick=()=>$('#modal').classList.remove('show');
  $('#modal').onclick=evento=>{
    if(evento.target.id==='modal')$('#modal').classList.remove('show');
  };
  $('#formLancamento').tipo.onchange=()=>{
    const form=$('#formLancamento');
    atualizarTextoRecorrencia();
    preencherCategorias();
  };
  $('#formLancamento').onsubmit=async evento=>{
    evento.preventDefault();
    const form=evento.currentTarget;
    const dadosForm=Object.fromEntries(new FormData(form));
    const categoria=(await api('categorias:listar')).find(item=>item.id===dadosForm.categoriaId);
    const dados={...dadosForm,categoria:categoria?.nome||'',liquidado:dadosForm.liquidacao==='realizado',valorCentavos:Math.round(Number(dadosForm.valor)*100)};
    const resposta=edicao?await api('lancamentos:editar',{...dados,id:edicao.id}):await api('lancamentos:criar',dados);
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

async function iniciar(){
  try{
    window.Neutralino?.init?.();
    if(window.Neutralino){
      await new Promise(resolve=>window.addEventListener('ready',resolve,{once:true}));
    }
    banco=await abrirBanco();
    await garantirAcesso(banco);
    api=criarApi({banco,Neutralino:window.Neutralino});
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
