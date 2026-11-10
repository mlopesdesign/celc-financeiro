// Abre uma CÓPIA do banco pelo caminho real do programa (abrirBancoSeguro) e compara antes/depois.
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';
const raiz=process.argv[2],copia=process.argv[3],pasta=path.dirname(path.dirname(path.dirname(copia)));
const require=createRequire(import.meta.url);const arq=path.join(raiz,'src/js/vendor/sql-wasm.js'),m={exports:{}};
vm.runInNewContext(fs.readFileSync(arq,'utf8'),{module:m,exports:m.exports,require,__dirname:path.dirname(arq),__filename:arq,console,process,Buffer,URL,TextDecoder,TextEncoder,WebAssembly,setTimeout,clearTimeout});
const SQL=await m.exports({locateFile:a=>path.join(raiz,'src/js/vendor',a)});
const nao=()=>Object.assign(new Error('nao existe'),{code:'NE_FS_NOPATHE'});const P=p=>p;
const fsx={getStats:async p=>{try{const s=fs.statSync(P(p));return {size:s.size,isFile:s.isFile(),modifiedAt:s.mtimeMs};}catch{throw nao();}},readBinaryFile:async p=>{try{const b=fs.readFileSync(P(p));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}catch{throw nao();}},writeBinaryFile:async(p,b)=>fs.writeFileSync(P(p),Buffer.from(b)),writeFile:async(p,t)=>fs.writeFileSync(P(p),t),move:async(a,b)=>fs.renameSync(P(a),P(b)),copy:async(a,b)=>fs.copyFileSync(P(a),P(b)),remove:async p=>fs.rmSync(P(p),{force:true}),createDirectory:async p=>fs.mkdirSync(P(p),{recursive:true}),readDirectory:async p=>fs.readdirSync(P(p)).map(entry=>({entry}))};
globalThis.Neutralino={os:{getEnv:async()=>pasta},filesystem:fsx};globalThis.window={Neutralino:globalThis.Neutralino,initSqlJs:async()=>SQL};
const ler=()=>{const s=new SQL.Database(fs.readFileSync(copia));const q=t=>s.exec(t)[0]?.values||[];return {n:q('SELECT COUNT(*) FROM lancamentos')[0][0],soma:q("SELECT SUM(valor_centavos) FROM lancamentos")[0][0],cx:q('SELECT COUNT(*) FROM caixa_diario')[0][0],dev:q('SELECT COUNT(*) FROM alunos_devedores')[0][0]};};
const {resumirDashboard}=await import(pathToFileURL(path.join(raiz,'src/js/backend/core/dashboard.js')));
const brl=c=>(c/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const antes=ler();
const {abrirBancoSeguro}=await import(pathToFileURL(path.join(raiz,'src/js/backend/db.js')));
const banco=await abrirBancoSeguro();await banco.aguardarPersistencia?.();
const depois=ler();
console.log('Registros antes',JSON.stringify(antes),'| depois',JSON.stringify(depois),'| iguais:',JSON.stringify(antes)===JSON.stringify(depois));
console.log('Correção:',banco.obterConfiguracao('correcao:data-recebimento-caixa:v1'));
for(const ref of ['2026-09','2026-10','2026-11']){const r=resumirDashboard(banco,{referencia:ref,hoje:'2026-11-10'});console.log(ref,'entradas',brl(r.entradas),'saidas',brl(r.saidas),'saldo final',brl(r.saldoFinal));}
const r=resumirDashboard(banco,{referencia:'2026-11',hoje:'2026-11-10'});r.entradasPorDia.slice(0,6).forEach(d=>console.log('  ',d.data,brl(d.total)));
console.log('Backup criado:',fs.existsSync(copia.replace(/\.db$/,'')+'-antes-correcao-datas.db'));
