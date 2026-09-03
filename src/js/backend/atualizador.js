import { compararVersoes } from './core/atualizador.js';
import { criarBackup } from './core/backup.js';

const MANIFESTO_GITHUB='https://github.com/mlopesdesign/celc-financeiro/releases/latest/download/latest.json';

export function caminhoExecutavelAtualizacao(pastaAplicativo=globalThis.window?.NL_PATH){
  if(!pastaAplicativo)throw Error('Pasta do aplicativo indisponível.');
  return `${pastaAplicativo}${/[\\/]$/.test(pastaAplicativo)?'':'\\'}CELC Financeiro.exe`;
}

export function comandoAplicadorAtualizacao(caminhoScript){
  if(!caminhoScript)throw Error('Script do aplicador indisponível.');
  const seguro=String(caminhoScript).replaceAll('"','""');
  return `cmd.exe /d /c start "" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "${seguro}"`;
}

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
  try{consulta=await verificarAtualizacao(Neutralino,banco,versaoAtual);if(!consulta.ok||!consulta.disponivel)return consulta;await banco.aguardarPersistencia?.();
    const backup=await criarBackup(Neutralino,banco.caminho,{permitirVazio:true});if(!backup.ok)return {ok:false,erro:backup.erro};
    const pastaAplicativo=globalThis.window?.NL_PATH;if(!pastaAplicativo)throw Error('Pasta do aplicativo indisponível.');
    const basePath=pastaAplicativo.replace(/[\\/]$/,''),destino=`${basePath}\\resources.neu`,temporario=`${destino}.new`,seguro=valor=>String(valor).replaceAll('"','""'),comando=`curl.exe -L --fail --silent --show-error --output "${seguro(temporario)}" "${consulta.atualizacao.resourcesURL}"`,resultado=await Neutralino.os.execCommand(comando);
    if(Number(resultado.exitCode??0)!==0)throw Error(resultado.stdErr||'Falha ao baixar atualização.');
    const pacote=await Neutralino.filesystem.readBinaryFile(temporario);if(!(pacote instanceof ArrayBuffer||pacote instanceof Uint8Array)||pacote.byteLength<1024)throw Error('O pacote baixado está vazio ou incompleto.');
    const executavel=caminhoExecutavelAtualizacao(basePath),scriptPath=`${basePath}\\aplicar-atualizacao.ps1`,backupPacote=`${destino}.bak`,ps=valor=>String(valor).replaceAll("'","''"),script=[
      "$ErrorActionPreference = 'Stop'",
      `$destino = '${ps(destino)}'`,
      `$temporario = '${ps(temporario)}'`,
      `$backupPacote = '${ps(backupPacote)}'`,
      `$executavel = '${ps(executavel)}'`,
      `$log = '${ps(destino)}.update.log'`,
      "function Registrar($texto){Add-Content -LiteralPath $log -Value ((Get-Date -Format o)+' '+$texto)}",
      "Registrar 'Aplicador iniciado; aguardando encerramento do aplicativo.'",
      'Start-Sleep -Milliseconds 1500',
      '$ok = $false',
      'for($i=0;$i -lt 60;$i++){',
      '  try {',
      '    if(Test-Path -LiteralPath $backupPacote){Remove-Item -LiteralPath $backupPacote -Force}',
      '    if(Test-Path -LiteralPath $destino){Move-Item -LiteralPath $destino -Destination $backupPacote -Force}',
      '    Move-Item -LiteralPath $temporario -Destination $destino -Force',
      '    $ok = $true; Registrar "resources.neu substituido na tentativa $($i+1)."; break',
      '  } catch {',
      '    if((Test-Path -LiteralPath $backupPacote) -and !(Test-Path -LiteralPath $destino)){Move-Item -LiteralPath $backupPacote -Destination $destino -Force -ErrorAction SilentlyContinue}',
      '    Registrar "Tentativa $($i+1) falhou: $($_.Exception.Message)"',
      '    Start-Sleep -Seconds 1',
      '  }',
      '}',
      'if($ok){Remove-Item -LiteralPath $backupPacote -Force -ErrorAction SilentlyContinue; Registrar "Troca concluida; reabrindo aplicativo."}else{Registrar "Falha definitiva; versao anterior mantida."; if((Test-Path -LiteralPath $backupPacote) -and !(Test-Path -LiteralPath $destino)){Move-Item -LiteralPath $backupPacote -Destination $destino -Force -ErrorAction SilentlyContinue}; Remove-Item -LiteralPath $temporario -Force -ErrorAction SilentlyContinue}',
      'Start-Sleep -Milliseconds 500',
      'Start-Process -FilePath $executavel',
      'Remove-Item -LiteralPath $PSCommandPath -Force -ErrorAction SilentlyContinue'
    ].join('\r\n');
    await Neutralino.filesystem.writeFile(scriptPath,script);await Neutralino.os.execCommand(comandoAplicadorAtualizacao(scriptPath),{background:true});await new Promise(resolve=>setTimeout(resolve,1200));await Neutralino.app.exit(0);return {ok:true};
  }catch(erro){console.error('Falha ao instalar atualização online.',erro);const detalhe=erro?.code||erro?.message;return {ok:false,erro:erro?.message==='O pacote baixado está vazio ou incompleto.'?erro.message:`A atualização foi encontrada, mas não pôde ser instalada. O sistema permanece nesta versão.${detalhe?` Detalhe: ${detalhe}`:''}`};}
}
