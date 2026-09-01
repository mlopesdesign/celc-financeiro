import { compararVersoes } from './core/atualizador.js';
import { criarBackup } from './core/backup.js';

const MANIFESTO_GITHUB='https://github.com/mlopesdesign/celc-financeiro/releases/latest/download/latest.json';

function validarManifesto(atualizacao){
  if(atualizacao?.applicationId!=='com.mllopesdesign.celcfinanceiro'||!atualizacao?.version||!atualizacao?.resourcesURL)throw Error('Manifesto incompatível.');
  return atualizacao;
}

async function consultarManifestoNativo(Neutralino){
  if(!Neutralino?.os?.execCommand)throw Error('Canal nativo indisponível.');
  const resultado=await Neutralino.os.execCommand(`curl.exe -L --fail --silent --show-error "${MANIFESTO_GITHUB}"`);
  if(Number(resultado.exitCode||0)!==0)throw Error(resultado.stdErr||'Falha ao consultar o canal oficial.');
  return validarManifesto(JSON.parse(resultado.stdOut||resultado.stdout||''));
}

export async function verificarAtualizacao(Neutralino,banco,versaoAtual){
  try{const atualizacao=await consultarManifestoNativo(Neutralino);if(compararVersoes(versaoAtual,atualizacao.version)<=0)return {ok:true,disponivel:false,mensagem:'O CELC Financeiro está atualizado.',atualizacao};return {ok:true,disponivel:true,atualizacao};}catch(erro){console.error('Falha na atualização online.',erro);return {ok:false,erro:'Não foi possível consultar atualizações agora. Verifique sua conexão e tente novamente.'};}
}
export async function instalarAtualizacao(Neutralino,banco,versaoAtual){
  const consulta=await verificarAtualizacao(Neutralino,banco,versaoAtual);if(!consulta.ok||!consulta.disponivel)return consulta;
  await banco.aguardarPersistencia?.();const backup=await criarBackup(Neutralino,banco.caminho);if(!backup.ok)return {ok:false,erro:backup.erro};
  try{const destino=`${window.NL_PATH}\\resources.neu`,temporario=`${destino}.download`,seguro=valor=>String(valor).replaceAll('"','""'),comando=`curl.exe -L --fail --silent --show-error --output "${seguro(temporario)}" "${consulta.atualizacao.resourcesURL}"`,resultado=await Neutralino.os.execCommand(comando);if(Number(resultado.exitCode||0)!==0)throw Error(resultado.stdErr||'Falha ao baixar atualização.');const bytes=await Neutralino.filesystem.readBinaryFile(temporario);await Neutralino.filesystem.writeBinaryFile(destino,bytes);await Neutralino.filesystem.remove(temporario);await Neutralino.app.restartProcess();return {ok:true};}catch(erro){console.error('Falha ao instalar atualização online.',erro);return {ok:false,erro:'A atualização foi encontrada, mas não pôde ser instalada. Tente novamente.'};}
}
