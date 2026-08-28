import assert from 'node:assert/strict';
import { compararVersoes } from '../src/js/backend/core/atualizador.js';
assert.equal(compararVersoes('0.1.4','0.1.5'),1);
assert.equal(compararVersoes('v1.2.0','1.2.0'),0);
assert.equal(compararVersoes('2.10.0','2.9.9'),-1);
assert.equal(compararVersoes('1.0','1.0.0'),0);
console.log('4 asserções aprovadas — comparação de versões.');
