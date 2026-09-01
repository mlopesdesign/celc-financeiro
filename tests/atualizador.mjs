import assert from 'node:assert/strict';
import { compararVersoes } from '../src/js/backend/core/atualizador.js';
import { verificarAtualizacao } from '../src/js/backend/atualizador.js';
assert.equal(compararVersoes('0.1.4','0.1.5'),1);
assert.equal(compararVersoes('v1.2.0','1.2.0'),0);
assert.equal(compararVersoes('2.10.0','2.9.9'),-1);
assert.equal(compararVersoes('1.0','1.0.0'),0);

const manifesto={applicationId:'com.mllopesdesign.celcfinanceiro',version:'0.2.3',resourcesURL:'https://example.test/resources.neu'};
const nativo={os:{execCommand:async comando=>{
  assert.match(comando,/curl\.exe/);
  return {exitCode:0,stdOut:JSON.stringify(manifesto)};
}}};
const disponivel=await verificarAtualizacao(nativo,{},'0.2.2');
assert.equal(disponivel.ok,true);
assert.equal(disponivel.disponivel,true);
const atualizado=await verificarAtualizacao(nativo,{},'0.2.3');
assert.equal(atualizado.ok,true);
assert.equal(atualizado.disponivel,false);
const erroOriginal=console.error;
console.error=()=>{};
const indisponivel=await verificarAtualizacao({os:{execCommand:async()=>({exitCode:22,stdErr:'HTTP 404'})}}, {}, '0.2.2');
console.error=erroOriginal;
assert.equal(indisponivel.ok,false);
console.log('9 asserções aprovadas — comparação e consulta nativa de versões.');
