import {createRequire} from 'node:module';
import {readFile,writeFile,rename,rm,mkdir,mkdtemp,stat,readdir,copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {abrirBancoSeguro} from '../src/js/backend/db.js';
import {criarApiFinanceira} from '../src/js/backend/servidor.js';

const vendor=path.resolve('src/js/vendor'),arquivo=path.join(vendor,'sql-wasm.js'),modulo={exports:{}};
vm.runInNewContext(await readFile(arquivo,'utf8'),{module:modulo,exports:modulo.exports,require:createRequire(import.meta.url),__dirname:vendor,__filename:arquivo,console,process,Buffer,URL,TextDecoder,TextEncoder,WebAssembly,setTimeout,clearTimeout},{filename:arquivo});
const SQL=await modulo.exports({locateFile:a=>path.join(vendor,a)});
export const faltando=()=>Object.assign(new Error('Caminho inexistente'),{code:'NE_FS_NOPATHE'});
export const bloqueado=()=>Object.assign(new Error('EBUSY simulado no sistema de arquivos'),{code:'EBUSY'});

export async function fixture(fn){
  const raiz=await mkdtemp(path.join(tmpdir(),'celc-p0-teste-'));
  const hooks={};
  const resolver=p=>{
    const x=path.resolve(p.replaceAll('\\',path.sep)),rel=path.relative(raiz,x);
    assert.ok(!rel.startsWith('..')&&!path.isAbsolute(rel),'Teste tentou acessar arquivo fora do banco isolado');
    return x;
  };
  const io=async(tipo,fn,...p)=>{
    hooks[tipo]?.(...p);
    try{return await fn();}catch(e){if(e.code==='ENOENT')throw faltando();throw e;}
  };
  const Neutralino={os:{getEnv:async()=>raiz},filesystem:{
    createDirectory:p=>io('mkdir',()=>mkdir(resolver(p),{recursive:true}),p),
    readBinaryFile:p=>io('read',async()=>Uint8Array.from(await readFile(resolver(p))).buffer,p),
    writeBinaryFile:(p,b)=>io('write',()=>writeFile(resolver(p),Buffer.from(b)),p),
    move:(a,b)=>io('move',()=>rename(resolver(a),resolver(b)),a,b),
    copy:(a,b)=>io('copy',()=>copyFile(resolver(a),resolver(b)),a,b),
    remove:p=>io('remove',()=>rm(resolver(p),{force:true}),p),
    getStats:p=>io('stat',async()=>{const s=await stat(resolver(p));return {isFile:s.isFile(),size:s.size,modifiedAt:s.mtimeMs};},p),
    readDirectory:p=>io('list',async()=> (await readdir(resolver(p))).map(entry=>({entry})),p)
  }};
  const globals={window:globalThis.window,Neutralino:globalThis.Neutralino};
  globalThis.window={Neutralino,initSqlJs:async()=>SQL};globalThis.Neutralino=Neutralino;
  const caminho=path.join(raiz,'CELC Financeiro','dados','celc-financeiro.db');
  const abrir=async()=>{const banco=await abrirBancoSeguro();return {banco,api:criarApiFinanceira({banco,Neutralino})};};
  const criar=async(api,descricao,valorCentavos=1000)=>assert.equal((await api('lancamentos:criar',{tipo:'entrada',descricao,categoria:'Receitas escolares',categoriaId:'cat-receitas',competencia:'2026-11-10',valorCentavos,liquidado:false})).ok,true);
  try{await fn({raiz,caminho,Neutralino,abrir,criar,hooks,SQL});}
  finally{Object.assign(globalThis,globals);assert.ok(path.dirname(raiz)===path.resolve(tmpdir())&&path.basename(raiz).startsWith('celc-p0-teste-'));await rm(raiz,{recursive:true,force:true});}
}
