import { compararVersoes } from './core/atualizador.js';
import { criarBackup } from './core/backup.js';

const MANIFESTO_GITHUB='https://github.com/mlopesdesign/celc-financeiro/releases/latest/download/latest.json';

export async function verificarAtualizacao(Neutralino,banco,versaoAtual){
  try{const atualizacao=await Neutralino.updater.checkForUpdates(MANIFESTO_GITHUB);if(compararVersoes(versaoAtual,atualizacao.version)<=0)return {ok:true,disponivel:false,mensagem:'O CELC Financeiro está atualizado.'};return {ok:true,disponivel:true,atualizacao};}catch{return {ok:false,erro:'Não foi possível consultar atualizações agora. Tente novamente mais tarde.'};}
}
export async function instalarAtualizacao(Neutralino,banco,versaoAtual){
  const consulta=await verificarAtualizacao(Neutralino,banco,versaoAtual);if(!consulta.ok||!consulta.disponivel)return consulta;
  await banco.aguardarPersistencia?.();const backup=await criarBackup(Neutralino,banco.caminho);if(!backup.ok)return {ok:false,erro:backup.erro};
  await Neutralino.updater.install();await Neutralino.app.restartProcess();return {ok:true};
}
