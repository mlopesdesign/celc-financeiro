import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {bloqueado,fixture} from './p0-fixture.mjs';
import {instalarAtualizacao} from '../src/js/backend/atualizador.js';
import {assuntoDeEscrita,mensagemFalhaGravacao} from '../src/js/backend/servidor.js';

const erroOriginal=console.error;
console.error=()=>{};

async function descricoesDoArquivo(SQL,arquivo){
  const bytes=await readFile(arquivo);
  assert.equal(new TextDecoder().decode(bytes.subarray(0,16)),'SQLite format 3\u0000','Backup deve ser um SQLite válido');
  const db=new SQL.Database(bytes);
  try{
    assert.equal(db.exec('PRAGMA integrity_check')[0].values[0][0],'ok');
    return Array.from(db.exec('SELECT descricao FROM lancamentos ORDER BY descricao')[0]?.values||[],([d])=>String(d));
  }finally{db.close();}
}

// Deixa a fila de persistência da segunda janela rejeitada com CELC_BANCO_ALTERADO.
async function filaRejeitadaPorOutraJanela({abrir,criar}){
  const primeira=await abrir(),segunda=await abrir();
  await criar(primeira.api,'Salvo pela primeira janela');
  let falha;
  try{await criar(segunda.api,'Escrita obsoleta da segunda janela');}catch(erro){falha=erro;}
  assert.equal(falha?.code,'CELC_BANCO_ALTERADO','A segunda janela precisa receber o conflito real');
  await assert.rejects(segunda.banco.aguardarPersistencia(),/alterado por outra instância/i,'A fila fica rejeitada após a falha');
  return {primeira,segunda,falha};
}

const casos={};

casos['BKP-01 conflito de outra janela não impede backup']=()=>fixture(async({raiz,abrir,criar,SQL})=>{
  const {segunda}=await filaRejeitadaPorOutraJanela({abrir,criar});
  const destino=path.join(raiz,'backup-apos-conflito.db');
  const resposta=await segunda.api('backup:criar',{destino});
  assert.equal(resposta.ok,true,resposta.erro);
  assert.equal(resposta.caminho,destino);
  assert.deepEqual(await descricoesDoArquivo(SQL,destino),['Salvo pela primeira janela'],'O backup copia o banco salvo em disco');
});

casos['BKP-02 três falhas de E/S não impedem backup']=()=>fixture(async({raiz,abrir,criar,hooks,SQL})=>{
  const {api,banco}=await abrir();
  await criar(api,'Movimento confirmado');
  hooks.write=p=>{if(p.endsWith('.db.tmp'))throw bloqueado();};
  await assert.rejects(()=>criar(api,'Não gravado'),/EBUSY/);
  await assert.rejects(banco.aguardarPersistencia(),/EBUSY/);
  delete hooks.write;
  const destino=path.join(raiz,'backup-apos-ebusy.db');
  const resposta=await api('backup:criar',{destino});
  assert.equal(resposta.ok,true,resposta.erro);
  assert.deepEqual(await descricoesDoArquivo(SQL,destino),['Movimento confirmado']);
});

casos['BKP-03 backup:criar não abre transação nem regrava o banco']=()=>fixture(async({raiz,caminho,abrir,criar,hooks})=>{
  const {api,banco}=await abrir();
  await criar(api,'Movimento');
  assert.equal(assuntoDeEscrita('backup:criar'),false);
  assert.equal(assuntoDeEscrita('categorias:criar'),true,'Demais escritas continuam em transação');
  let transacoes=0;const emTransacao=banco.emTransacao;
  banco.emTransacao=tarefa=>{transacoes++;return emTransacao(tarefa);};
  const escritas=[];hooks.write=p=>escritas.push(p);
  const antes=await readFile(caminho);
  const destino=path.join(raiz,'backup-sem-transacao.db');
  assert.equal((await api('backup:criar',{destino})).ok,true);
  assert.equal(transacoes,0,'backup:criar não pode passar por emTransacao');
  assert.deepEqual(escritas,[destino],'Somente o arquivo de destino é gravado');
  assert.deepEqual(await readFile(caminho),antes,'O banco principal não é alterado');
  await criar(api,'Depois do backup');
  assert.equal(transacoes,1,'Escrita comum continua usando emTransacao');
});

casos['BKP-04 atualização não aborta só pela fila rejeitada']=()=>fixture(async({raiz,caminho,abrir,criar,Neutralino,SQL})=>{
  const {segunda}=await filaRejeitadaPorOutraJanela({abrir,criar});
  const manifesto={applicationId:'com.mllopesdesign.celcfinanceiro',version:'9.9.9',resourcesURL:'https://github.com/mlopesdesign/celc-financeiro/releases/download/v9.9.9/resources.neu',resourcesSha256:'0'.repeat(64)};
  const comandos=[];
  Neutralino.os.execCommand=async comando=>{comandos.push(comando);return comando.includes('latest.json')?{exitCode:0,stdOut:JSON.stringify(manifesto)}:{exitCode:7,stdErr:'download simulado indisponível'};};
  globalThis.window.NL_PATH=path.join(raiz,'app');
  try{
    const resposta=await instalarAtualizacao(Neutralino,segunda.banco,'0.2.38');
    assert.equal(resposta.ok,false);
    assert.match(resposta.erro,/download simulado indisponível/,'Deve passar do backup e falhar só no download simulado');
    assert.equal(comandos.length,2,'Consultou o manifesto e tentou baixar o pacote');
    const pasta=path.join(path.dirname(caminho),'backups'),backups=(await readdir(pasta)).filter(x=>x.endsWith('.db'));
    assert.equal(backups.length,1,'Backup pré-atualização criado');
    assert.deepEqual(await descricoesDoArquivo(SQL,path.join(pasta,backups[0])),['Salvo pela primeira janela']);
  }finally{delete globalThis.window.NL_PATH;}
});

casos['BKP-05 atualização ainda aborta se o backup falhar']=()=>fixture(async({abrir,criar,Neutralino,hooks})=>{
  const {banco}=await abrir();
  await criar((await abrir()).api,'Movimento');
  const manifesto={applicationId:'com.mllopesdesign.celcfinanceiro',version:'9.9.9',resourcesURL:'https://github.com/mlopesdesign/celc-financeiro/releases/download/v9.9.9/resources.neu',resourcesSha256:'0'.repeat(64)};
  const comandos=[];
  Neutralino.os.execCommand=async comando=>{comandos.push(comando);return {exitCode:0,stdOut:JSON.stringify(manifesto)};};
  hooks.write=p=>{if(p.includes('\\backups\\')||p.includes('/backups/'))throw bloqueado();};
  const resposta=await instalarAtualizacao(Neutralino,banco,'0.2.38');
  assert.equal(resposta.ok,false);
  assert.match(resposta.erro,/backup antes da atualização/);
  assert.equal(comandos.length,1,'Nenhum download sem backup');
});

casos['BKP-06 mensagem de falha de gravação']=async()=>{
  const conflito=Object.assign(new Error('Banco alterado por outra instância. A gravação foi cancelada.'),{code:'CELC_BANCO_ALTERADO'});
  assert.equal(mensagemFalhaGravacao(conflito),'Não foi possível gravar no banco: O banco foi alterado por outra janela do CELC Financeiro aberta. Feche as outras janelas. A tela foi recarregada com os dados salvos.');
  assert.equal(mensagemFalhaGravacao(new Error('EBUSY simulado')),'Não foi possível gravar no banco: EBUSY simulado. A tela foi recarregada com os dados salvos.');
};

let falhas=0;
for(const [nome,caso] of Object.entries(casos)){
  try{await caso();erroOriginal.call(console,`ok   ${nome}`);}
  catch(erro){falhas++;erroOriginal.call(console,`FALHA ${nome}`,erro);}
}
console.error=erroOriginal;
if(falhas){console.error(`${falhas} caso(s) falharam`);process.exit(1);}
console.log(`p4-backup: ${Object.keys(casos).length} casos ok`);
