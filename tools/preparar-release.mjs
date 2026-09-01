import {copyFile,mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const raiz=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const config=JSON.parse(await readFile(path.join(raiz,'neutralino.config.json'),'utf8'));
const versao=config.version;
const tag=`v${versao}`;
const repositorio='mlopesdesign/celc-financeiro';
const origem=path.join(raiz,'dist','CELC Financeiro');
const destino=path.join(raiz,'Release',tag);
const ler=arquivo=>readFile(arquivo).then(conteudo=>Buffer.from(conteudo));
const sha256=conteudo=>createHash('sha256').update(conteudo).digest('hex').toUpperCase();

await mkdir(destino,{recursive:true});
await copyFile(path.join(origem,'resources.neu'),path.join(destino,'resources.neu'));
await copyFile(path.join(raiz,'Release',`CELC-Financeiro-Setup-${versao}.exe`),path.join(destino,`CELC-Financeiro-Setup-${versao}.exe`));

const recursos=await ler(path.join(destino,'resources.neu'));
const setup=await ler(path.join(destino,`CELC-Financeiro-Setup-${versao}.exe`));
const latest={
  applicationId:config.applicationId,
  version:versao,
  resourcesURL:`https://github.com/${repositorio}/releases/download/${tag}/resources.neu`
};
const titulo=`CELC Financeiro ${tag} — instalador oficial e atualização online`;
const notas=`# ${titulo}\n\n## Entregáveis\n\n- Instalador Windows x64: \`CELC-Financeiro-Setup-${versao}.exe\`\n- Atualização online: \`resources.neu\`\n- Manifesto: \`latest.json\`\n\n## Atualização online\n\nA consulta e o download da atualização usam o canal nativo do Windows. Antes da troca do pacote, o aplicativo salva o banco e cria um backup; somente \`resources.neu\` é atualizado.\n\n## Publicação no GitHub\n\n1. Crie a release com a tag \`${tag}\`.\n2. Use este título: **${titulo}**.\n3. Anexe \`resources.neu\`, \`latest.json\`, \`SHA256SUMS.txt\` e o Setup desta pasta.\n4. Confirme que \`latest.json\` está anexado à release para que a atualização automática o encontre.\n\n## Integridade\n\n- \`resources.neu\`: \`${sha256(recursos)}\`\n- \`CELC-Financeiro-Setup-${versao}.exe\`: \`${sha256(setup)}\`\n`;
const checksums=`${sha256(recursos)}  resources.neu\n${sha256(setup)}  CELC-Financeiro-Setup-${versao}.exe\n`;

await writeFile(path.join(destino,'latest.json'),`${JSON.stringify(latest,null,2)}\n`,'utf8');
await writeFile(path.join(destino,'RELEASE.md'),notas,'utf8');
await writeFile(path.join(destino,'SHA256SUMS.txt'),checksums,'utf8');
console.log(`Release ${tag} preparada em ${destino}`);
