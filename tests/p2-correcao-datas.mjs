import assert from 'node:assert/strict';
import {stat} from 'node:fs/promises';
import {fixture} from './p0-fixture.mjs';
import {CHAVE_CORRECAO_DATAS} from '../src/js/backend/core/correcoes.js';
let n=0;
await fixture(async({abrir,caminho})=>{
  let {banco}=await abrir();
  // Simula o banco do cliente antes da 0.2.34: correção ainda não aplicada.
  await banco.executar('DELETE FROM configuracoes WHERE chave=?',[CHAVE_CORRECAO_DATAS]);
  const ins=(id,desc,comp,liq,criado,tipo='entrada',situacao='recebido')=>banco.executar('INSERT INTO lancamentos (id,descricao,tipo,categoria_id,categoria,valor_centavos,competencia,vencimento,liquidado_em,situacao,recorrencia,criado_em,atualizado_em,usuario_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[id,desc,tipo,'cat-receitas','Receitas escolares',100000,comp,null,liq,situacao,'avulso',criado,criado,'u']);
  await ins('a','Caixa diário - receita','2026-11-09','2026-11-10T14:05:10.652Z','2026-11-10T14:05:07.800Z');   // corrigir
  await ins('b','debitos','2026-10-31','2026-11-04T13:00:00.000Z','2026-11-04T13:00:00.000Z');                // corrigir
  await ins('c','mens','2026-09-01','2026-09-01T12:00:00.000Z','2026-09-01T15:00:00.000Z');                   // já certo
  await ins('d','Mensalidade nova','2026-11-05','2026-11-20T12:00:00.000Z','2026-11-20T15:00:00.000Z');      // depois do corte: escolhida pelo usuário
  await ins('e','Prevista','2026-11-01',null,'2026-11-02T10:00:00.000Z','entrada','previsto');                // não recebida
  await ins('f','Pagamento de aluno','2026-11-03','2026-11-05T12:00:00.000Z','2026-11-05T12:00:00.000Z');    // vinculada ao caixa
  await banco.executar("INSERT INTO caixa_diario (id,data,competencia,tipo,origem,aluno,responsavel,forma_pagamento,valor_centavos,observacao,lancamento_id,criado_em,usuario_id) VALUES ('cx','2026-11-05','2026-11-03','entrada','Recebimento de pendência','','','Pix',100000,'','f','2026-11-05T12:00:00.000Z','u')");
  ({banco}=await abrir());
  const l=id=>banco.listarLancamentos().find(x=>x.id===id).liquidadoEm;
  assert.equal(l('a'),'2026-11-09T12:00:00.000Z');assert.equal(l('b'),'2026-10-31T12:00:00.000Z');n++;
  assert.equal(l('c'),'2026-09-01T12:00:00.000Z');assert.equal(l('d'),'2026-11-20T12:00:00.000Z');assert.equal(l('e'),null);assert.equal(l('f'),'2026-11-05T12:00:00.000Z');n++;
  const aud=banco.linhas?banco.linhas("SELECT entidade_id FROM auditoria WHERE acao='corrigir_data_recebimento' ORDER BY entidade_id"):null;
  if(aud)assert.equal(aud.map(x=>x.entidade_id).join(','),'a,b');n++;
  assert.ok(JSON.parse(banco.obterConfiguracao(CHAVE_CORRECAO_DATAS)).quantidade===2);n++;
  assert.ok((await stat(caminho.replace(/\.db$/,'')+'-antes-correcao-datas.db')).size>100,'backup antes da correção');n++;
  // Roda uma vez só: mudança manual depois da correção é respeitada.
  await banco.executar("UPDATE lancamentos SET liquidado_em='2026-11-10T12:00:00.000Z' WHERE id='a'");
  ({banco}=await abrir());
  assert.equal(banco.listarLancamentos().find(x=>x.id==='a').liquidadoEm,'2026-11-10T12:00:00.000Z');n++;
});
console.log(`Correção automática das datas de recebimento: ${n} grupos aprovados — corrige só entradas antigas sem caixa, faz backup, registra auditoria e roda uma vez.`);
