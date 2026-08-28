export function compararVersoes(atual, candidata) {
  const partes=(valor)=>String(valor).replace(/^v/i,'').split('.').map((item)=>Number.parseInt(item,10)||0);
  const esquerda=partes(atual),direita=partes(candidata);
  for(let indice=0;indice<Math.max(esquerda.length,direita.length);indice+=1){if((esquerda[indice]||0)!==(direita[indice]||0))return (direita[indice]||0)>(esquerda[indice]||0)?1:-1;}
  return 0;
}
