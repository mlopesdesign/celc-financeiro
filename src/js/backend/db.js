const SCHEMA = `
CREATE TABLE IF NOT EXISTS lancamentos (id TEXT PRIMARY KEY, descricao TEXT NOT NULL, tipo TEXT NOT NULL, categoria_id TEXT, categoria TEXT NOT NULL, valor_centavos INTEGER NOT NULL, competencia TEXT NOT NULL, vencimento TEXT, liquidado_em TEXT, situacao TEXT NOT NULL, recorrencia TEXT NOT NULL DEFAULT 'avulso', criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL, usuario_id TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS categorias (id TEXT PRIMARY KEY, nome TEXT NOT NULL, tipo TEXT NOT NULL, ativa INTEGER NOT NULL DEFAULT 1, criado_em TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS auditoria (id INTEGER PRIMARY KEY AUTOINCREMENT, usuario_id TEXT NOT NULL, acao TEXT NOT NULL, entidade TEXT NOT NULL, entidade_id TEXT NOT NULL, criado_em TEXT NOT NULL, detalhes TEXT);
CREATE TABLE IF NOT EXISTS acesso (id INTEGER PRIMARY KEY CHECK(id=1), usuario TEXT NOT NULL, sal TEXT NOT NULL, hash TEXT NOT NULL, iteracoes INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS configuracoes (chave TEXT PRIMARY KEY, valor TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS caixa_diario (id TEXT PRIMARY KEY, data TEXT NOT NULL, competencia TEXT NOT NULL DEFAULT '', tipo TEXT NOT NULL DEFAULT 'entrada', origem TEXT NOT NULL, aluno TEXT, responsavel TEXT, forma_pagamento TEXT NOT NULL, valor_centavos INTEGER NOT NULL, observacao TEXT, lancamento_id TEXT, criado_em TEXT NOT NULL, usuario_id TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS alunos_devedores (id TEXT PRIMARY KEY, aluno TEXT NOT NULL, turma TEXT, responsavel TEXT, contato TEXT, descricao TEXT NOT NULL, valor_centavos INTEGER NOT NULL, valor_pago_centavos INTEGER NOT NULL DEFAULT 0, vencimento TEXT NOT NULL, situacao TEXT NOT NULL, observacao TEXT, criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL, usuario_id TEXT NOT NULL);`;
const PADRAO=[['cat-receitas','Receitas escolares','entrada'],['cat-matriculas','Matrículas','entrada'],['cat-eventos','Eventos e doações','entrada'],['cat-pessoal','Pessoal','despesa'],['cat-utilidades','Serviços e utilidades','despesa'],['cat-pedagogico','Material pedagógico','despesa']];
const agora=()=>new Date().toISOString();
function normalizarBytes(dados){
  if(ArrayBuffer.isView(dados))return new Uint8Array(dados.buffer,dados.byteOffset,dados.byteLength);
  if(Object.prototype.toString.call(dados)==='[object ArrayBuffer]')return new Uint8Array(dados);
  return null;
}
function mesmosBytes(esperado,gravado){return esperado.length===gravado.length&&esperado.every((byte,indice)=>byte===gravado[indice])}
const mesmoBanco=(a,b)=>a===null||b===null?a===b:mesmosBytes(a,b);
const conflitoBanco=()=>Object.assign(new Error('Banco alterado por outra instância. A gravação foi cancelada.'),{code:'CELC_BANCO_ALTERADO'});
const temCabecalho=bytes=>bytes?.length>=100&&new TextDecoder().decode(bytes.slice(0,16))==='SQLite format 3\u0000';
const erroBancoBloqueado=()=>new Error('Banco bloqueado; feche outros programas e reabra');
async function lerBancoSeExiste(arquivos,caminho){
  try{await arquivos.getStats(caminho);}
  catch(erro){
    if(erro?.code!=='NE_FS_NOPATHE')throw erroBancoBloqueado();
    const separador=caminho.lastIndexOf('\\'),nome=caminho.slice(separador+1).toLowerCase();
    let entradas;
    try{entradas=await arquivos.readDirectory(caminho.slice(0,separador));}catch{throw erroBancoBloqueado();}
    if(!Array.isArray(entradas)||entradas.some(x=>x.entry?.toLowerCase()===nome))throw erroBancoBloqueado();
    return null;
  }
  try{return normalizarBytes(await arquivos.readBinaryFile(caminho))||new Uint8Array();}
  catch{throw erroBancoBloqueado();}
}
function integro(Database,bytes){
  if(!temCabecalho(bytes))return false;
  let verificacao;
  try{
    verificacao=new Database(bytes);
    const linhas=verificacao.exec('PRAGMA integrity_check')[0]?.values;
    return linhas?.length===1&&linhas[0][0]==='ok';
  }catch{return false;}finally{verificacao?.close();}
}

async function gravarVerificando(arquivos,caminho,bytes){
  await arquivos.writeBinaryFile(caminho,bytes);
  const gravado=normalizarBytes(await arquivos.readBinaryFile(caminho));
  if(!gravado||!mesmosBytes(bytes,gravado))throw new Error('A gravação do SQLite não foi confirmada no disco.');
  return gravado;
}

async function recuperarBanco(arquivos,caminho,Database){
  let encontrouCopia=false;
  for(const sufixo of ['.tmp','.old','.bak']){
    const bytes=await lerBancoSeExiste(arquivos,caminho+sufixo);
    if(!bytes)continue;
    encontrouCopia=true;
    if(!integro(Database,bytes))continue;
    const recuperacao=caminho+'.recuperacao';
    await gravarVerificando(arquivos,recuperacao,bytes);
    await arquivos.move(recuperacao,caminho);
    const confirmado=await lerBancoSeExiste(arquivos,caminho);
    if(!confirmado||!mesmosBytes(bytes,confirmado))throw new Error('A recuperação do SQLite não foi confirmada.');
    return confirmado;
  }
  if(encontrouCopia)throw new Error('Nenhuma cópia SQLite válida para recuperação. Os arquivos foram preservados.');
  return null;
}

async function salvarComSeguranca(caminho,bytes,Database,ultimoConfirmado){
  const arquivos=window.Neutralino?.filesystem,esperado=normalizarBytes(bytes);
  if(!arquivos)throw new Error('A API de arquivos do Windows não está disponível.');
  if(!temCabecalho(esperado))throw new Error('O SQLite não gerou dados válidos para gravação.');
  const anterior=await lerBancoSeExiste(arquivos,caminho);
  if(anterior&&mesmosBytes(anterior,esperado))return anterior;
  if(!mesmoBanco(anterior,ultimoConfirmado))throw conflitoBanco();
  const temporario=caminho+'.tmp';
  const gravado=await gravarVerificando(arquivos,temporario,esperado);
  if(!integro(Database,gravado))throw new Error('O banco temporário não passou na verificação de integridade.');
  if(anterior){
    if(!integro(Database,anterior))throw new Error('O banco anterior está inválido. Os arquivos foram preservados.');
    await gravarVerificando(arquivos,caminho+'.bak',anterior);
  }
  const pronto=await lerBancoSeExiste(arquivos,temporario);
  if(!pronto||!mesmosBytes(pronto,esperado)||!mesmoBanco(await lerBancoSeExiste(arquivos,caminho),anterior))throw conflitoBanco();
  await arquivos.move(temporario,caminho);
  const confirmado=await lerBancoSeExiste(arquivos,caminho);
  if(!confirmado||!mesmosBytes(esperado,confirmado))throw new Error('A troca do SQLite não foi confirmada no disco.');
  return confirmado;
}
function adaptador(sql,modo,caminho='',estado={}){
  let fila=Promise.resolve(),ultimoConfirmado=estado.inicial||null;
  const Database=sql.constructor;
  async function recarregar(estrito=false){
    let bytes;
    try{bytes=await lerBancoSeExiste(window.Neutralino.filesystem,caminho);}catch(erro){if(estrito)throw erro;}
    if(estrito&&!integro(Database,bytes))throw new Error('O banco restaurado não pôde ser recarregado.');
    bytes=integro(Database,bytes)?bytes:ultimoConfirmado;
    if(!bytes)return;
    const novo=new Database(bytes);
    sql.close();sql=novo;
    ultimoConfirmado=bytes;
    estado.aoRecarregar?.(novo);
  }
  const persistir=()=>{
    if(modo!=='sqlite'||estado.transacaoAtiva)return Promise.resolve();
    fila=fila.catch(()=>{}).then(async()=>{
      if(estado.transacaoAtiva)throw new Error('Persistência solicitada durante uma transação SQLite.');
      const bytes=sql.export();
      for(let i=0;i<3;i++){
        try{
          ultimoConfirmado=await salvarComSeguranca(caminho,bytes,Database,ultimoConfirmado);
          return;
        }catch(erro){
          if(i===2||erro.code==='CELC_BANCO_ALTERADO'){await recarregar();throw erro;}
          await new Promise(resolve=>setTimeout(resolve,50*(i+1)));
        }
      }
    });
    return fila;
  };
  const executar=(q,p=[])=>{sql.run(q,p);persistir().catch(()=>{});return Promise.resolve();};
  const linhas=(q,p=[])=>{const r=sql.exec(q,p);return r[0]?r[0].values.map(v=>Object.fromEntries(r[0].columns.map((c,i)=>[c,v[i]]))):[]};const banco={modo,caminho,proximoId:(p='id')=>`${p}-${crypto.randomUUID()}`,executar,linhas,aguardarPersistencia:()=>fila,recarregarPersistencia:()=>recarregar(true),listarLancamentos:()=>linhas('SELECT * FROM lancamentos ORDER BY competencia DESC, criado_em DESC').map(x=>({id:x.id,descricao:x.descricao,tipo:x.tipo,categoriaId:x.categoria_id,categoria:x.categoria,valorCentavos:x.valor_centavos,competencia:x.competencia,vencimento:x.vencimento,liquidadoEm:x.liquidado_em,situacao:x.situacao,recorrencia:x.recorrencia,criadoEm:x.criado_em,atualizadoEm:x.atualizado_em,usuarioId:x.usuario_id})),listarCategorias:(ativas=true)=>linhas(`SELECT * FROM categorias ${ativas?'WHERE ativa=1':''} ORDER BY tipo,nome`).map(x=>({id:x.id,nome:x.nome,tipo:x.tipo,ativa:Boolean(x.ativa)})),listarCaixaDiario:()=>linhas('SELECT * FROM caixa_diario ORDER BY data DESC, criado_em DESC').map(x=>({id:x.id,data:x.data,competencia:x.competencia||'',tipo:x.tipo||'entrada',origem:x.origem,aluno:x.aluno,responsavel:x.responsavel,formaPagamento:x.forma_pagamento,valorCentavos:x.valor_centavos,observacao:x.observacao,lancamentoId:x.lancamento_id,devedorId:x.devedor_id||'',criadoEm:x.criado_em,usuarioId:x.usuario_id})),listarDevedores:()=>linhas('SELECT * FROM alunos_devedores ORDER BY situacao, vencimento ASC, criado_em DESC').map(x=>({id:x.id,aluno:x.aluno,turma:x.turma,responsavel:x.responsavel,contato:x.contato,descricao:x.descricao,valorCentavos:x.valor_centavos,valorPagoCentavos:x.valor_pago_centavos||0,vencimento:x.vencimento,situacao:x.situacao,observacao:x.observacao,criadoEm:x.criado_em,atualizadoEm:x.atualizado_em,usuarioId:x.usuario_id})),obterCredencial:()=>linhas('SELECT usuario,sal,hash,iteracoes FROM acesso WHERE id=1')[0]||null,salvarCredencial:x=>banco.executar('INSERT OR REPLACE INTO acesso (id,usuario,sal,hash,iteracoes) VALUES (1,?,?,?,?)',[x.usuario,x.sal,x.hash,x.iteracoes]),obterConfiguracao:k=>linhas('SELECT valor FROM configuracoes WHERE chave=?',[k])[0]?.valor||'',salvarConfiguracao:(k,v)=>banco.executar('INSERT OR REPLACE INTO configuracoes (chave,valor) VALUES (?,?)',[k,v])};return banco;
}
function preparar(sql){
  const bancoNovo=!sql.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='categorias'")[0];
  sql.run(SCHEMA);
  const cols=sql.exec('PRAGMA table_info(lancamentos)')[0]?.values.map(x=>x[1])||[],caixaCols=sql.exec('PRAGMA table_info(caixa_diario)')[0]?.values.map(x=>x[1])||[],devedorCols=sql.exec('PRAGMA table_info(alunos_devedores)')[0]?.values.map(x=>x[1])||[];
  if(!cols.includes('categoria_id'))sql.run('ALTER TABLE lancamentos ADD COLUMN categoria_id TEXT');
  if(!cols.includes('vencimento'))sql.run('ALTER TABLE lancamentos ADD COLUMN vencimento TEXT');
  if(!cols.includes('liquidado_em'))sql.run('ALTER TABLE lancamentos ADD COLUMN liquidado_em TEXT');
  if(!caixaCols.includes('competencia'))sql.run("ALTER TABLE caixa_diario ADD COLUMN competencia TEXT NOT NULL DEFAULT ''");
  if(!caixaCols.includes('tipo'))sql.run("ALTER TABLE caixa_diario ADD COLUMN tipo TEXT NOT NULL DEFAULT 'entrada'");
  if(!caixaCols.includes('devedor_id'))sql.run('ALTER TABLE caixa_diario ADD COLUMN devedor_id TEXT');
  if(!devedorCols.includes('valor_pago_centavos'))sql.run('ALTER TABLE alunos_devedores ADD COLUMN valor_pago_centavos INTEGER NOT NULL DEFAULT 0');
  if(bancoNovo)PADRAO.forEach(([id,nome,tipo])=>sql.run('INSERT INTO categorias VALUES (?,?,?,?,?)',[id,nome,tipo,1,agora()]));
}
function bancoPreview(){const d={lancamentos:[],caixa:[],devedores:[],categorias:PADRAO.map(([id,nome,tipo])=>({id,nome,tipo,ativa:true})),configuracoes:{},acesso:null},normalizar=p=>({id:p[0],descricao:p[1],tipo:p[2],categoriaId:p[3],categoria:p[4],valorCentavos:p[5],competencia:p[6],vencimento:p[7],liquidadoEm:p[8],situacao:p[9],recorrencia:p[10],criadoEm:p[11],atualizadoEm:p[12],usuarioId:p[13]});return {modo:'preview',caminho:'',proximoId:(p='id')=>`${p}-${crypto.randomUUID()}`,aguardarPersistencia:async()=>{},listarLancamentos:()=>[...d.lancamentos].sort((a,b)=>`${b.competencia}${b.criadoEm}`.localeCompare(`${a.competencia}${a.criadoEm}`)),listarCategorias:(a=true)=>d.categorias.filter(x=>!a||x.ativa),listarCaixaDiario:()=>[...d.caixa].sort((a,b)=>`${b.data}${b.criadoEm}`.localeCompare(`${a.data}${a.criadoEm}`)),listarDevedores:()=>[...d.devedores].sort((a,b)=>`${a.situacao}${a.vencimento}`.localeCompare(`${b.situacao}${b.vencimento}`)),obterCredencial:()=>d.acesso,salvarCredencial:async x=>{d.acesso=x},obterConfiguracao:k=>d.configuracoes[k]||'',salvarConfiguracao:async(k,v)=>{d.configuracoes[k]=v},executar:async(q,p=[])=>{if(q.startsWith('INSERT INTO lancamentos')){d.lancamentos.push(normalizar(p));return}if(q.startsWith('INSERT INTO caixa_diario')){d.caixa.push({id:p[0],data:p[1],tipo:p[2],origem:p[3],aluno:p[4],responsavel:p[5],formaPagamento:p[6],valorCentavos:p[7],observacao:p[8],lancamentoId:p[9],criadoEm:p[10],usuarioId:p[11]});return}if(q.startsWith('INSERT INTO alunos_devedores')){d.devedores.push({id:p[0],aluno:p[1],turma:p[2],responsavel:p[3],contato:p[4],descricao:p[5],valorCentavos:p[6],valorPagoCentavos:0,vencimento:p[7],situacao:p[8],observacao:p[9],criadoEm:p[10],atualizadoEm:p[11],usuarioId:p[12]});return}if(q.startsWith('UPDATE alunos_devedores SET situacao=')){const x=d.devedores.find(i=>i.id===p[3]);if(x)Object.assign(x,{situacao:p[0],valorPagoCentavos:p[1],atualizadoEm:p[2]});return}if(q.startsWith('UPDATE lancamentos SET categoria=')){d.lancamentos.filter(i=>i.categoriaId===p[1]).forEach(i=>i.categoria=p[0]);return}if(q.startsWith('UPDATE lancamentos SET descricao=')){const x=d.lancamentos.find(i=>i.id===p[10]);if(x)Object.assign(x,{descricao:p[0],tipo:p[1],categoriaId:p[2],categoria:p[3],valorCentavos:p[4],competencia:p[5],vencimento:p[6],situacao:p[7],recorrencia:p[8],atualizadoEm:p[9]});return}if(q.startsWith('UPDATE lancamentos SET situacao=')){const x=d.lancamentos.find(i=>i.id===p[3]);if(x)Object.assign(x,{situacao:p[0],liquidadoEm:p[1],atualizadoEm:p[2]});return}if(q.startsWith('DELETE FROM lancamentos')){d.lancamentos=d.lancamentos.filter(x=>x.id!==p[0]);return}if(q.startsWith('INSERT INTO categorias')){d.categorias.push({id:p[0],nome:p[1],tipo:p[2],ativa:Boolean(p[3])});return}if(q.startsWith('UPDATE categorias SET nome=')){const x=d.categorias.find(i=>i.id===p[2]);if(x)Object.assign(x,{nome:p[0],tipo:p[1]});return}if(q.startsWith('UPDATE categorias SET ativa=0')){const x=d.categorias.find(i=>i.id===p[0]);if(x)x.ativa=false;return}if(q.startsWith('DELETE FROM categorias')){d.categorias=d.categorias.filter(x=>x.id!==p[0]);return}if(q.startsWith('INSERT OR REPLACE INTO configuracoes')){d.configuracoes[p[0]]=p[1];return}if(q.startsWith('INSERT OR REPLACE INTO acesso')){d.acesso={usuario:p[0],sal:p[1],hash:p[2],iteracoes:p[3]};return}},linhas:()=>[]}}
export async function abrirBanco(){if(!window.Neutralino||!window.initSqlJs)return bancoPreview();try{const appdata=await Neutralino.os.getEnv('APPDATA'),raiz=`${appdata}\\CELC Financeiro`,pasta=`${raiz}\\dados`,caminho=`${pasta}\\celc-financeiro.db`;try{await Neutralino.filesystem.createDirectory(raiz)}catch{}try{await Neutralino.filesystem.createDirectory(pasta)}catch{}const SQL=await initSqlJs({locateFile:a=>`js/vendor/${a}`});let bytes;try{bytes=await Neutralino.filesystem.readBinaryFile(caminho)}catch{bytes=null}const sql=new SQL.Database(bytes||undefined);preparar(sql);const banco=adaptador(sql,'sqlite',caminho);await banco.executar("UPDATE lancamentos SET categoria=COALESCE(NULLIF(categoria,''),'Sem categoria')");return banco}catch(erro){console.error('Banco externo indisponível; prévia local ativada.',erro);return bancoPreview()}}
// O aplicativo distribuído só inicia depois de gravar e reler o SQLite externo.
// Não há fallback em memória para instalações Windows.
export async function abrirBancoSeguro(){
  if(!window.Neutralino || !window.initSqlJs) throw new Error('Serviço local de dados indisponível. Nenhum lançamento foi salvo.');
  try{
    const appdata=await Neutralino.os.getEnv('APPDATA');
    if(!appdata) throw new Error('A pasta de dados do Windows não foi encontrada.');
    const raiz=`${appdata}\\CELC Financeiro`,pasta=`${raiz}\\dados`,caminho=`${pasta}\\celc-financeiro.db`;
    try{await Neutralino.filesystem.createDirectory(raiz)}catch{}
    try{await Neutralino.filesystem.createDirectory(pasta)}catch{}
    const carregarSql=window.initSqlJs;
    if(typeof carregarSql!=='function') throw new Error('O mecanismo SQLite não foi carregado.');
    const SQL=await carregarSql({locateFile:arquivo=>`js/vendor/${arquivo}`});
    const bytesSql=await lerBancoSeExiste(Neutralino.filesystem,caminho)??await recuperarBanco(Neutralino.filesystem,caminho,SQL.Database);
    if(bytesSql&&!temCabecalho(bytesSql))throw new Error('Cabeçalho SQLite inválido. O arquivo não foi alterado.');
    let sql=new SQL.Database(bytesSql||undefined);
    preparar(sql);
    const estado={inicial:bytesSql,aoRecarregar:novo=>{sql=novo;},transacaoAtiva:false};
    const banco=adaptador(sql,'sqlite',caminho,estado);
    const executar=banco.executar;
    banco.executar=async(...args)=>{await executar(...args);await banco.aguardarPersistencia();};
    banco.emTransacao=async tarefa=>{
      await banco.aguardarPersistencia().catch(()=>{});
      const executarPersistente=banco.executar;
      sql.run('BEGIN IMMEDIATE');
      estado.transacaoAtiva=true;
      banco.executar=async(q,p=[])=>{sql.run(q,p);};
      try{
        const resultado=await tarefa();
        if(resultado?.ok===false){sql.run('ROLLBACK');return resultado;}
        sql.run('COMMIT');
        estado.transacaoAtiva=false;
        await executarPersistente('SELECT 1');
        return resultado;
      }catch(erro){
        try{sql.run('ROLLBACK');}catch{}
        throw erro;
      }finally{estado.transacaoAtiva=false;banco.executar=executarPersistente;}
    };
    await banco.executar("UPDATE lancamentos SET categoria=COALESCE(NULLIF(categoria,''),'Sem categoria')");
    const confirmado=await Neutralino.filesystem.readBinaryFile(caminho);
    const binario=normalizarBytes(confirmado);
    if(!binario || binario.length<100 || new TextDecoder().decode(binario.slice(0,16))!=='SQLite format 3\u0000') throw new Error('O arquivo de dados não foi confirmado no disco.');
    return banco;
  }catch(erro){
    console.error('Banco externo indisponível.',erro);
    throw new Error(`Banco de dados indisponível: ${erro.message||erro}`);
  }
}
