import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = process.cwd();
const source = join(root, 'src');

async function listar(diretorio) {
  const itens = await readdir(diretorio, { withFileTypes: true });
  const arquivos = await Promise.all(itens.map(async (item) => item.isDirectory()
    ? listar(join(diretorio, item.name))
    : [join(diretorio, item.name)]));
  return arquivos.flat();
}

const arquivos = await listar(source).catch(() => []);
const javascript = arquivos.filter((arquivo) => arquivo.endsWith('.js'));
const modulos = await Promise.all(javascript.map(async (arquivo) => ({
  arquivo: relative(root, arquivo).replaceAll('\\', '/'),
  conteudo: await readFile(arquivo, 'utf8'),
})));
const rotas = modulos.flatMap(({ arquivo, conteudo }) => [...conteudo.matchAll(/['"]([a-z]+:[A-Za-z*]+)['"]/g)]
  .map((encontro) => `| \`${encontro[1]}\` | ${arquivo} |`));

const linhas = [
  '# GRAPHIFY — CELC Financeiro',
  '',
  '> Gerado automaticamente por `node tools/graphify.js`. Não editar manualmente.',
  '',
  '## Arquivos mapeados',
  '',
  ...modulos.map(({ arquivo }) => `- \`${arquivo}\``),
  '',
  '## Canais encontrados',
  '',
  '| Canal | Origem |',
  '|---|---|',
  ...(rotas.length ? rotas : ['| Nenhum canal implementado | — |']),
  '',
  '## Invariantes',
  '',
  '- Banco fora do diretório atualizável do aplicativo.',
  '- Atualização exige backup válido e versão superior.',
  '- Regras financeiras ficam no backend/core, nunca na interface.',
  '',
];

await writeFile(join(root, 'GRAPHIFY.md'), `${linhas.join('\n')}\n`, 'utf8');
