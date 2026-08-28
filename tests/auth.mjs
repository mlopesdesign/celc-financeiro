import assert from 'node:assert/strict';
import { garantirAcesso, validarAcesso, trocarSenha } from '../src/js/auth.js';

const dados = { acesso:null };
const banco = { obterCredencial:() => dados.acesso, salvarCredencial:async(item) => { dados.acesso=item; } };
await garantirAcesso(banco);
assert.equal(await validarAcesso(banco, 'admin', 'admin123'), true);
assert.equal(await validarAcesso(banco, 'admin', 'senha-errada'), false);
assert.equal((await trocarSenha(banco, 'admin123', 'nova-senha-2026', 'nova-senha-2026')).ok, true);
assert.equal(await validarAcesso(banco, 'admin', 'nova-senha-2026'), true);
assert.equal(await validarAcesso(banco, 'admin', 'admin123'), false);
console.log('5 asserções aprovadas — autenticação e troca de senha.');
