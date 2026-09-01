import { compararVersoes } from './core/atualizador.js';
import { criarBackup } from './core/backup.js';

const MANIFESTO_GITHUB='https://github.com/mlopesdesign/celc-financeiro/releases/latest/download/latest.json';

function validarManifesto(atualizacao){
  if(atualizacao?.applicationId!=='com.mllopesdesign.celcfinanceiro'||!atualizacao?.version||!atualizacao?.resourcesURL||!/^https:\/\/github\.com\/mlopesdesign\/celc-financeiro\/releases\/download\/v[^/]+\/resources\.neu$/i.test(atualizacao.resourcesURL))throw Error('Manifesto incompatível.');
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
  let consulta;
  try{consulta=await verificarAtualizacao(Neutralino,banco,versaoAtual);if(!consulta.ok||!consulta.disponivel)return consulta;await banco.aguardarPersistencia?.();const backup=await criarBackup(Neutralino,banco.caminho);if(!backup.ok)return {ok:false,erro:backup.erro};
    const destino=`${window.NL_PATH}\\resources.neu`,temporario=`${destino}.download`,seguro=valor=>String(valor).replaceAll('"','""'),comando=`curl.exe -L --fail --silent --show-error --output "${seguro(temporario)}" "${consulta.atualizacao.resourcesURL}"`,resultado=await Neutralino.os.execCommand(comando);
    if(Number(resultado.exitCode??0)!==0)throw Error(resultado.stdErr||'Falha ao baixar atualização.');
    const pacote=await Neutralino.filesystem.readBinaryFile(temporario);if(!(pacote instanceof ArrayBuffer||pacote instanceof Uint8Array)||pacote.byteLength<1024)throw Error('O pacote baixado está vazio ou incompleto.');
    const executavel=await Neutralino.os.getPath('exe'),ps=valor=>String(valor).replaceAll("'","''"),script=`$ErrorActionPreference='Stop';$destino='${ps(destino)}';$temporario='${ps(temporario)}';$executavel='${ps(executavel)}';$log="$destino.update.log";function Registrar($texto){Add-Content -LiteralPath $log -Value ((Get-Date -Format o)+' '+$texto)};Registrar 'Pacote baixado; aguardando encerramento do aplicativo.';for($i=0;$i -lt 20;$i++){try{Move-Item -LiteralPath $temporario -Destination $destino -Force;Registrar 'resources.neu substituido.';Start-Process -FilePath $executavel;Registrar 'Aplicativo reaberto.';exit 0}catch{Registrar ('Tentativa '+($i+1)+' falhou: '+$_.Exception.Message);Start-Sleep -Milliseconds 500}};Registrar 'Falha definitiva ao substituir resources.neu.';exit 1`,utf16=new Uint8Array(script.length*2);for(let i=0;i<script.length;i+=1){utf16[i*2]=script.charCodeAt(i)&255;utf16[i*2+1]=script.charCodeAt(i)>>8;}const codificado=btoa(String.fromCharCode(...utf16)),auxiliar=`powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -EncodedCommand ${codificado}`;
    await Neutralino.os.execCommand(auxiliar,{background:true});await Neutralino.app.exit(0);return {ok:true};
  }catch(erro){console.error('Falha ao instalar atualização online.',erro);return {ok:false,erro:erro?.message==='O pacote baixado está vazio ou incompleto.'?erro.message:'A atualização foi encontrada, mas não pôde ser instalada. O sistema permanece nesta versão.'};}
}
