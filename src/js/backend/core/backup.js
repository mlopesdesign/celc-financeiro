async function validarBanco(dados) {
  if (!(dados instanceof Uint8Array) || dados.length < 100 || new TextDecoder().decode(dados.slice(0, 16)) !== 'SQLite format 3\u0000') return false;
  if (!window.initSqlJs) return false;
try { const SQL=await initSqlJs({locateFile:(arquivo)=>`js/vendor/${arquivo}`}); const db=new SQL.Database(dados); const tabelas=db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('lancamentos','auditoria','acesso')"); const movimentos=db.exec('SELECT COUNT(*) FROM lancamentos'); return Boolean(tabelas[0] && tabelas[0].values.length===3 && movimentos[0] && Number(movimentos[0].values[0][0])>0); } catch { return false; }
}

async function substituirComSeguranca(Neutralino, destino, dados) {
  const temporario=`${destino}.tmp`, anterior=`${destino}.old`;
  await Neutralino.filesystem.writeBinaryFile(temporario,dados);
  try { await Neutralino.filesystem.remove(anterior); } catch { /* não havia cópia antiga */ }
  try { await Neutralino.filesystem.move(destino,anterior); } catch { /* não havia banco anterior */ }
  try { await Neutralino.filesystem.move(temporario,destino); } catch (erro) { try { await Neutralino.filesystem.move(anterior,destino); } catch { /* preserva o diagnóstico */ } throw erro; }
  try { await Neutralino.filesystem.remove(anterior); } catch { /* sem cópia anterior */ }
}

export async function criarBackup(Neutralino, caminhoBanco) {
  if (!caminhoBanco || !Neutralino) return { ok:false, erro:'Backup disponível somente no aplicativo Windows.' };
  const pasta=caminhoBanco.slice(0,caminhoBanco.lastIndexOf('\\')), destinoPasta=`${pasta}\\backups`, nome=`celc-financeiro-${new Date().toISOString().replaceAll(':','-').slice(0,19)}.db`;
  try { await Neutralino.filesystem.createDirectory(destinoPasta); } catch { /* pasta existente */ }
  try {
    const dados=await Neutralino.filesystem.readBinaryFile(caminhoBanco);
    if (!(await validarBanco(dados))) return { ok:false, erro:'O banco atual não passou na validação de integridade.' };
    await Neutralino.filesystem.writeBinaryFile(`${destinoPasta}\\${nome}`,dados);
    return { ok:true,caminho:`${destinoPasta}\\${nome}` };
  } catch (erro) {
    console.error('Falha ao criar backup antes da atualização.',erro);
    return { ok:false, erro:'Não foi possível criar o backup antes da atualização. Nenhum arquivo do aplicativo foi trocado.' };
  }
}

export async function restaurarBackupMaisRecente(Neutralino, caminhoBanco) {
  if (!caminhoBanco || !Neutralino) return { ok:false, erro:'Restauração disponível somente no aplicativo Windows.' };
  const pasta=`${caminhoBanco.slice(0,caminhoBanco.lastIndexOf('\\'))}\\backups`;
  const arquivos=await Neutralino.filesystem.readDirectory(pasta), backups=arquivos.filter((item)=>item.entry.endsWith('.db')).sort((a,b)=>b.entry.localeCompare(a.entry));
  if (!backups.length) return { ok:false, erro:'Nenhum backup encontrado.' };
  const origem=`${pasta}\\${backups[0].entry}`, dados=await Neutralino.filesystem.readBinaryFile(origem);
  if (!(await validarBanco(dados))) return { ok:false, erro:'O backup mais recente não passou na validação de integridade.' };
  await substituirComSeguranca(Neutralino,caminhoBanco,dados);
  return { ok:true,caminho:origem };
}
