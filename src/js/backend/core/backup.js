async function validarBancoInterno(dados,exigirMovimentacao=true) {
  const bytes=dados instanceof Uint8Array?dados:dados instanceof ArrayBuffer?new Uint8Array(dados):null;
  if (!bytes || bytes.length < 100 || new TextDecoder().decode(bytes.slice(0, 16)) !== 'SQLite format 3\u0000') return false;
  const carregarSql=globalThis.window?.initSqlJs||globalThis.initSqlJs;
  if (typeof carregarSql!=='function') return false;
  try { const SQL=await carregarSql({locateFile:(arquivo)=>`js/vendor/${arquivo}`}); const db=new SQL.Database(bytes); const tabelas=db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('lancamentos','auditoria','acesso')"); const movimentos=db.exec('SELECT COUNT(*) FROM lancamentos'); const valido=Boolean(tabelas[0] && tabelas[0].values.length===3 && movimentos[0] && (!exigirMovimentacao||Number(movimentos[0].values[0][0])>0)); db.close(); return valido; } catch { return false; }
}

export function validarBanco(dados){return validarBancoInterno(dados,true);}
export function validarBancoParaAtualizacao(dados){return validarBancoInterno(dados,false);}

const tabelasRestauracao=['lancamentos','categorias','auditoria','acesso','configuracoes','caixa_diario','alunos_devedores'];
const bytesDe=dados=>ArrayBuffer.isView(dados)?new Uint8Array(dados.buffer,dados.byteOffset,dados.byteLength):new Uint8Array(dados);
const iguais=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
async function validarRestauracao(dados){
  if(!(await validarBancoParaAtualizacao(dados)))return false;
  const carregarSql=globalThis.window?.initSqlJs||globalThis.initSqlJs;
  let db;
  try{
    const SQL=await carregarSql({locateFile:a=>`js/vendor/${a}`});
    db=new SQL.Database(bytesDe(dados));
    const integridade=db.exec('PRAGMA integrity_check')[0]?.values;
    const nomes=new Set(db.exec("SELECT name FROM sqlite_master WHERE type='table'")[0]?.values.map(([nome])=>nome));
    return integridade?.length===1&&integridade[0][0]==='ok'&&tabelasRestauracao.every(nome=>nomes.has(nome));
  }catch{return false;}finally{db?.close();}
}

async function gravarCopia(arquivos,destino,bytes){
  await arquivos.writeBinaryFile(destino,bytes);
  if(!iguais(bytes,bytesDe(await arquivos.readBinaryFile(destino))))throw new Error('Cópia não confirmada no disco.');
}

export async function criarBackup(Neutralino, caminhoBanco, { permitirVazio=true, destino='' } = {}) {
  if (!caminhoBanco || !Neutralino) return { ok:false, erro:'Backup disponível somente no aplicativo Windows.' };
  const pasta=caminhoBanco.slice(0,caminhoBanco.lastIndexOf('\\')), destinoPasta=`${pasta}\\backups`, nome=`celc-financeiro-${new Date().toISOString().replaceAll(':','-').slice(0,19)}.db`, destinoFinal=destino||`${destinoPasta}\\${nome}`;
  if(!destino)try { await Neutralino.filesystem.createDirectory(destinoPasta); } catch { /* pasta existente */ }
  try {
    const dados=await Neutralino.filesystem.readBinaryFile(caminhoBanco);
    const valido=permitirVazio?await validarBancoParaAtualizacao(dados):await validarBanco(dados);
    if (!valido) return { ok:false, erro:'O banco atual não passou na validação de integridade.' };
    await Neutralino.filesystem.writeBinaryFile(destinoFinal,dados);
    return { ok:true,caminho:destinoFinal };
  } catch (erro) {
    console.error('Falha ao criar backup antes da atualização.',erro);
    return { ok:false, erro:'Não foi possível criar o backup antes da atualização. Nenhum arquivo do aplicativo foi trocado.' };
  }
}

export async function restaurarBackup(Neutralino, caminhoBanco, caminhoBackup) {
  if (!caminhoBanco || !Neutralino) return { ok:false, erro:'Restauração disponível somente no aplicativo Windows.' };
  if(!caminhoBackup)return { ok:false, erro:'Selecione um arquivo de backup para restaurar.' };
  try{
    const dados=await Neutralino.filesystem.readBinaryFile(caminhoBackup);
    if (!(await validarRestauracao(dados))) return { ok:false, erro:'O backup não passou na verificação de integridade ou está sem tabelas do sistema.' };
    const arquivos=Neutralino.filesystem,atual=bytesDe(await arquivos.readBinaryFile(caminhoBanco));
    if(!(await validarRestauracao(atual)))return {ok:false,erro:'O banco atual não pode ser copiado com segurança. Nenhum arquivo foi trocado.'};
    const pasta=caminhoBanco.slice(0,caminhoBanco.lastIndexOf('\\'))+'\\backups';
    const data=new Date().toISOString().replaceAll(':','-').replace('.','-');
    const pre=`${pasta}\\pre-restauracao-${data}-${crypto.randomUUID()}.db`;
    try{
      try{await arquivos.createDirectory(pasta);}catch{}
      await gravarCopia(arquivos,pre,atual);
    }catch{return {ok:false,erro:'Não foi possível criar o backup pré-restauração. Nenhum arquivo foi trocado.'};}
    const temporario=caminhoBanco+'.restauracao.tmp',novo=bytesDe(dados);
    await gravarCopia(arquivos,temporario,novo);
    if(!iguais(atual,bytesDe(await arquivos.readBinaryFile(caminhoBanco))))return {ok:false,erro:'Banco alterado durante a restauração. Nenhum arquivo foi trocado.'};
    await arquivos.move(temporario,caminhoBanco);
    if(!iguais(novo,bytesDe(await arquivos.readBinaryFile(caminhoBanco))))throw new Error('Restauração não confirmada no disco.');
    return { ok:true,caminho:caminhoBackup,backupAnterior:pre };
  }catch(erro){
    console.error('Falha ao restaurar backup.',erro);
    return {ok:false,erro:'Não foi possível restaurar o arquivo selecionado.'};
  }
}

export async function restaurarBackupMaisRecente(Neutralino, caminhoBanco) {
  if (!caminhoBanco || !Neutralino) return { ok:false, erro:'Restauração disponível somente no aplicativo Windows.' };
  const pasta=`${caminhoBanco.slice(0,caminhoBanco.lastIndexOf('\\'))}\\backups`;
  try{
    const arquivos=await Neutralino.filesystem.readDirectory(pasta), backups=arquivos.filter((item)=>item.entry.endsWith('.db')&&!item.entry.startsWith('pre-restauracao-')).sort((a,b)=>b.entry.localeCompare(a.entry));
    if (!backups.length) return { ok:false, erro:'Nenhum backup encontrado.' };
    return restaurarBackup(Neutralino,caminhoBanco,`${pasta}\\${backups[0].entry}`);
  }catch(erro){return {ok:false,erro:'Não foi possível localizar o backup automático.'};}
}
