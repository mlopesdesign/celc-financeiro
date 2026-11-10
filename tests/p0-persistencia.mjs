import assert from 'node:assert/strict';
import {readFile,writeFile,rename,rm,readdir} from 'node:fs/promises';
import path from 'node:path';
import {bloqueado,faltando,fixture} from './p0-fixture.mjs';
import {garantirAcesso,validarAcesso} from '../src/js/auth.js';

const casos={};
casos['DADOS-02']=()=>fixture(async({caminho,abrir,criar,hooks})=>{
  const {api}=await abrir();await criar(api,'Movimento original');
  const original=await readFile(caminho);
  let bloquear=true;
  hooks.read=p=>{if(bloquear&&p.endsWith('celc-financeiro.db')){bloquear=false;throw bloqueado();}};
  await assert.rejects(abrir,/Banco bloqueado; feche outros programas e reabra/);
  assert.deepEqual(await readFile(caminho),original);
  delete hooks.read;
  assert.equal((await (await abrir()).api('lancamentos:listar')).length,1);
  hooks.stat=p=>{if(p.endsWith('celc-financeiro.db'))throw faltando();};
  await assert.rejects(abrir,/Banco bloqueado; feche outros programas e reabra/,'getStats também pode retornar caminho inexistente quando não tem acesso');
  assert.deepEqual(await readFile(caminho),original);
  delete hooks.stat;
  const invalido=Buffer.alloc(4096);
  await writeFile(caminho,invalido);
  await assert.rejects(abrir,/SQLite|cabeçalho/i);
  assert.deepEqual(await readFile(caminho),invalido);
});

casos['DADOS-01']=()=>fixture(async({caminho,abrir,criar})=>{
  const {api}=await abrir();await criar(api,'Primeiro movimento');
  const anterior=await readFile(caminho);
  await criar(api,'Segundo movimento');
  const atual=await readFile(caminho);
  await rename(caminho,caminho+'.tmp');
  await writeFile(caminho+'.old',anterior);
  const recuperado=await abrir();
  assert.equal((await recuperado.api('lancamentos:listar')).length,2,'C2: prefere .tmp válido à cópia antiga');
  await criar(recuperado.api,'Terceiro movimento');
  assert.deepEqual(await readFile(caminho+'.bak'),atual,'O .bak preserva o último banco válido');
  await rm(caminho);
  await writeFile(caminho+'.tmp',Buffer.alloc(4096));
  const alternativo=await abrir();
  assert.equal((await alternativo.api('lancamentos:listar')).length,1,'Recupera .old válido se .tmp for inválido');
});

casos['DADOS-03']=()=>fixture(async({caminho,abrir,criar,hooks})=>{
  const {api}=await abrir();await criar(api,'Movimento confirmado');
  const anterior=await readFile(caminho);
  let tentativas=0;
  hooks.write=p=>{if(p.endsWith('.db.tmp')){tentativas++;throw bloqueado();}};
  await assert.rejects(()=>criar(api,'Falha de persistência'),/EBUSY/);
  assert.equal((await api('lancamentos:listar')).length,1,'C1: memória recarregada do disco após a falha');
  assert.deepEqual(await readFile(caminho),anterior);
  assert.equal(tentativas,3,'Três tentativas, sem confirmar a falha como sucesso');
  delete hooks.write;
  await criar(api,'Gravação seguinte');
  assert.deepEqual(Array.from(await (await abrir()).api('lancamentos:listar'),x=>x.descricao).sort(),['Gravação seguinte','Movimento confirmado'].sort());
});

casos['DADOS-04']=()=>fixture(async({caminho,abrir,criar})=>{
  const primeiro=await abrir(),segundo=await abrir();
  await criar(primeiro.api,'Confirmado pela primeira instância');
  const antes=await readFile(caminho),bak=await readFile(caminho+'.bak');
  await assert.rejects(()=>criar(segundo.api,'Escrita de uma versão obsoleta'),/alterado por outra instância/i);
  assert.deepEqual(await readFile(caminho),antes);
  assert.deepEqual(await readFile(caminho+'.bak'),bak);
  assert.equal((await segundo.api('lancamentos:listar'))[0].descricao,'Confirmado pela primeira instância');
  await criar(segundo.api,'Confirmado depois de recarregar');
  assert.equal((await (await abrir()).api('lancamentos:listar')).length,2);
});

casos['DADOS-05']=()=>fixture(async({raiz,caminho,abrir,criar,hooks,SQL})=>{
  const {api,banco}=await abrir();await criar(api,'Presente no backup');
  const destino=path.join(raiz,'backup-escolhido.db');
  assert.equal((await api('backup:criar',{destino})).ok,true);
  await criar(api,'Presente apenas no banco atual');
  const original=await readFile(caminho);
  hooks.write=p=>{if(p.includes('pre-restauracao-'))throw bloqueado();};
  assert.equal((await api('backup:restaurar',{caminho:destino})).ok,false,'Restauração deve abortar se não puder salvar a cópia do estado atual');
  assert.deepEqual(await readFile(caminho),original);
  delete hooks.write;
  let aguardou=false;
  const aguardar=banco.aguardarPersistencia;
  banco.aguardarPersistencia=()=>{aguardou=true;return aguardar();};
  assert.equal((await api('backup:restaurar',{caminho:destino})).ok,true);
  assert.ok(aguardou,'Aguarda persistência antes da troca');
  const pasta=path.join(path.dirname(caminho),'backups');
  const arquivos=(await readdir(pasta)).filter(x=>x.startsWith('pre-restauracao-'));
  assert.equal(arquivos.length,1);
  assert.deepEqual(await readFile(path.join(pasta,arquivos[0])),original);
  assert.equal((await api('lancamentos:listar')).length,1,'Mesmo adaptador foi atualizado com a restauração');
  const incompleto=new SQL.Database();
  incompleto.run('CREATE TABLE lancamentos(id TEXT); CREATE TABLE auditoria(id TEXT); CREATE TABLE acesso(id TEXT);');
  const reduzido=path.join(raiz,'incompleto.db');await writeFile(reduzido,incompleto.export());incompleto.close();
  assert.equal((await api('backup:restaurar',{caminho:reduzido})).ok,false,'Recusa SQLite que não tem todas as tabelas');
  assert.deepEqual(await readFile(caminho),await readFile(destino));
});

casos['CALC-01']=async()=>{
  const falhas=[];
  for(const favorecido of ['', 'Fornecedor X']){
    const rotulo=favorecido?'com favorecido':'sem favorecido';
    try{await fixture(async({abrir})=>{
      const {api,banco}=await abrir();
      await garantirAcesso(banco);await banco.aguardarPersistencia();
      const credencial=JSON.stringify(banco.obterCredencial());
      assert.ok(await validarAcesso(banco,'admin','admin123'));
      const r=await api('despesas:salvar',{descricao:'Despesa de teste',categoria:'Pessoal',categoriaId:'cat-pessoal',competencia:'2026-11-10',valorCentavos:6000,favorecido,pagamentos:[{valorCentavos:2000,data:'2026-11-10',formaPagamento:'Pix'}]});
      assert.equal(r.ok,true);
      const reaberto=await abrir();
      const [despesa]=await reaberto.api('lancamentos:listar',{tipo:'despesa'});
      assert.equal(despesa.saldoCentavos,4000);
      assert.equal(despesa.pagamentos.length,1);
      assert.equal(reaberto.banco.obterConfiguracao('favorecido_despesa:'+r.id),favorecido);
      assert.equal(JSON.stringify(reaberto.banco.obterCredencial()),credencial);
      assert.ok(await validarAcesso(reaberto.banco,'admin','admin123'));
      assert.equal(await validarAcesso(reaberto.banco,'admin','invalida'),false);
      console.log('CALC-01: despesa '+rotulo+' gravada; credencial preservada e validada após reabrir.');
    });}catch(e){falhas.push(rotulo+': '+e.message);}
  }
  try{await fixture(async({abrir})=>{
    const {api}=await abrir();
    assert.equal((await api('caixa:salvarContagem',{data:'2026-11-09',valorCentavos:12345})).ok,true);
    const r=await (await abrir()).api('painel:fluxo',{referencia:'2026-11',hoje:'2026-11-10'});
    assert.equal(r.especie.esperado,12345);
    console.log('CALC-01: contagem em espécie persistida e relida.');
  });}catch(e){falhas.push('contagem: '+e.message);}
  assert.deepEqual(falhas,[]);
};

const id=process.argv[2];
if(id)assert.ok(casos[id],'Caso inexistente: '+id);
assert.equal(new Date().getHours(),22);assert.equal(new Date().getMinutes(),30);
for(const caso of id?[id]:Object.keys(casos)){
  await casos[caso]();
  console.log(caso+' aprovado: API de produção, sql.js real e arquivos isolados.');
}
