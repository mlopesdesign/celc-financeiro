import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const raiz=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const extensoes=new Set(['.js','.mjs','.html','.css','.md','.sql','.json']);
const coletar=async pasta=>{const itens=await readdir(pasta,{withFileTypes:true});return (await Promise.all(itens.map(item=>item.isDirectory()?coletar(path.join(pasta,item.name)):extensoes.has(path.extname(item.name))?[path.join(pasta,item.name)]:[]))).flat();};
const arquivos=(await Promise.all(['src','tests','docs'].map(pasta=>coletar(path.join(raiz,pasta))))).flat();
const decodificador=new TextDecoder('utf-8',{fatal:true}),mojibake=new RegExp(`${String.fromCharCode(0xC3)}[\u0080-\u00BF]|${String.fromCharCode(0xC2)}[\u0080-\u00BF]|${String.fromCharCode(0xFFFD)}`);
for(const arquivo of arquivos){const texto=decodificador.decode(await readFile(arquivo));assert.equal(mojibake.test(texto),false,`Sequência corrompida em ${path.relative(raiz,arquivo)}`);}
console.log(`${arquivos.length} arquivos de texto validados em UTF-8.`);
