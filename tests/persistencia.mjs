import assert from 'node:assert/strict';
import {mkdtemp,readFile,rename,rm,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {createRequire} from 'node:module';

const raiz=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const arquivoSql=path.join(raiz,'src','js','vendor','sql-wasm.js');
const modulo={exports:{}};
const contexto={module:modulo,exports:modulo.exports,require:createRequire(import.meta.url),__dirname:path.dirname(arquivoSql),__filename:arquivoSql,console,process,Buffer,URL,TextDecoder,TextEncoder,WebAssembly,setTimeout,clearTimeout};
vm.runInNewContext(await readFile(arquivoSql,'utf8'),contexto,{filename:arquivoSql});
const SQL=await modulo.exports({locateFile:arquivo=>path.join(raiz,'src','js','vendor',arquivo)});
const pasta=await mkdtemp(path.join(tmpdir(),'celc-persistencia-'));
const paraDisco=caminho=>caminho.replaceAll('\\',path.sep);
const Neutralino={
  os:{getEnv:async nome=>nome==='APPDATA'?pasta:''},
  filesystem:{
    createDirectory:async caminho=>mkdir(paraDisco(caminho),{recursive:true}),
    readBinaryFile:async caminho=>{const dados=await readFile(paraDisco(caminho));return dados.buffer.slice(dados.byteOffset,dados.byteOffset+dados.byteLength);},
    writeBinaryFile:async(caminho,dados)=>writeFile(paraDisco(caminho),Buffer.from(dados)),
    move:async(origem,destino)=>rename(paraDisco(origem),paraDisco(destino)),
    remove:async caminho=>rm(paraDisco(caminho),{force:true})
  }
};
globalThis.window={Neutralino,initSqlJs:async()=>SQL};
globalThis.Neutralino=Neutralino;
const {abrirBancoSeguro}=await import('../src/js/backend/db.js');
const {cadastrarCategoria,excluirCategoria}=await import('../src/js/backend/core/categorias.js');
const primeiro=await abrirBancoSeguro();
const criado=await cadastrarCategoria(primeiro,'Categoria persistida','entrada');
assert.equal(criado.ok,true,'cadastra categoria no SQLite externo');
assert.equal(primeiro.listarCategorias().some(item=>item.nome==='Categoria persistida'),true,'categoria existe antes de fechar');
const caminhoBanco=path.join(pasta,'CELC Financeiro','dados','celc-financeiro.db');
const disco=new SQL.Database(await readFile(caminhoBanco));
assert.equal(disco.exec("SELECT nome FROM categorias WHERE nome='Categoria persistida'")[0]?.values.length||0,1,'categoria foi gravada no arquivo SQLite');
disco.close();
const segundo=await abrirBancoSeguro();
assert.equal(segundo.listarCategorias().some(item=>item.nome==='Categoria persistida'),true,'categoria permanece após reabrir o banco');
for(const categoria of segundo.listarCategorias(false))assert.equal((await excluirCategoria(segundo,categoria.id)).ok,true,'permite excluir categorias sem lançamentos');
const terceiro=await abrirBancoSeguro();
assert.equal(terceiro.listarCategorias(false).length,0,'não recria categorias após o usuário excluir todas');
await rm(pasta,{recursive:true,force:true});
delete globalThis.window;
delete globalThis.Neutralino;
console.log('6 asserções aprovadas — criação física, reabertura e exclusão permanente de categorias.');
