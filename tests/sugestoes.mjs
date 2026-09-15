import assert from 'node:assert/strict';
import {sugerirDescricoesLancamentos} from '../src/js/backend/core/lancamentos.js';

const itens=[
  {tipo:'despesa',descricao:'Marcio Silva',categoria:'Pessoal'},
  {tipo:'despesa',descricao:'Material pedagógico',categoria:'Material'},
  {tipo:'despesa',descricao:'marcio silva',categoria:'Pessoal'},
  {tipo:'entrada',descricao:'Matrícula 2026',categoria:'Matrículas'},
  {tipo:'despesa',descricao:'Energia',categoria:'Utilidades'}
];
const db={listarLancamentos:()=>itens};
const resultado=sugerirDescricoesLancamentos(db,{tipo:'despesa',termo:'m'});
assert.equal(resultado.length,2);
assert.equal(resultado[0].descricao,'Marcio Silva');
assert.equal(resultado[0].categoria,'Pessoal');
assert.equal(resultado.some(item=>item.descricao==='Matrícula 2026'),false);
assert.deepEqual(sugerirDescricoesLancamentos(db,{tipo:'entrada',termo:'matr'}),[{descricao:'Matrícula 2026',categoria:'Matrículas'}]);
assert.deepEqual(sugerirDescricoesLancamentos(db,{tipo:'invalido',termo:'m'}),[]);
console.log('6 asserções aprovadas — sugestões de descrições sem duplicidade e por tipo.');
