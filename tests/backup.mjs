import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {validarBanco,validarBancoParaAtualizacao} from '../src/js/backend/core/backup.js';

const raiz=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const arquivoSql=path.join(raiz,'src','js','vendor','sql-wasm.js');
const modulo={exports:{}};
const contexto={
  module:modulo,
  exports:modulo.exports,
  require:createRequire(import.meta.url),
  __dirname:path.dirname(arquivoSql),
  __filename:arquivoSql,
  console,
  process,
  Buffer,
  URL,
  TextDecoder,
  TextEncoder,
  WebAssembly,
  setTimeout,
  clearTimeout
};
vm.runInNewContext(await readFile(arquivoSql,'utf8'),contexto,{filename:arquivoSql});
const iniciarSql=modulo.exports;
const SQL=await iniciarSql({locateFile:arquivo=>path.join(raiz,'src','js','vendor',arquivo)});

function criarBanco({comMovimento=true}={}){
  const db=new SQL.Database();
  db.run('CREATE TABLE lancamentos (id TEXT); CREATE TABLE auditoria (id TEXT); CREATE TABLE acesso (id TEXT);');
  if(comMovimento)db.run("INSERT INTO lancamentos (id) VALUES ('teste')");
  const bytes=db.export();
  db.close();
  return bytes;
}

globalThis.window={initSqlJs:async()=>SQL};
const bancoValido=Uint8Array.from(criarBanco());
const arrayBuffer=bancoValido.buffer.slice(bancoValido.byteOffset,bancoValido.byteOffset+bancoValido.byteLength);
assert.equal(await validarBanco(arrayBuffer),true,'aceita o ArrayBuffer devolvido pelo Neutralino');
assert.equal(await validarBanco(bancoValido),true,'mantém compatibilidade com Uint8Array');
assert.equal(await validarBanco(Uint8Array.from(criarBanco({comMovimento:false}))),false,'rejeita banco sem movimentações');
assert.equal(await validarBancoParaAtualizacao(Uint8Array.from(criarBanco({comMovimento:false}))),true,'aceita banco estruturalmente íntegro e ainda sem movimentações na atualização');
assert.equal(await validarBanco(new Uint8Array(256)),false,'rejeita conteúdo sem cabeçalho SQLite');
delete globalThis.window;

console.log('5 asserções aprovadas — validação real de SQLite, banco vazio na atualização e Uint8Array.');
