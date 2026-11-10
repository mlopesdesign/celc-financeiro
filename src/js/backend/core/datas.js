const doisDigitos=n=>String(n).padStart(2,'0');
export const hojeLocal=(d=new Date())=>`${d.getFullYear()}-${doisDigitos(d.getMonth()+1)}-${doisDigitos(d.getDate())}`;
export const dataValidaISO=valor=>typeof valor==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(valor)&&new Date(`${valor}T12:00:00Z`).toISOString().slice(0,10)===valor;
export const dataEfetiva=dia=>`${dia}T12:00:00.000Z`;
export const ultimoDiaDoMes=mes=>new Date(Date.UTC(Number(mes.slice(0,4)),Number(mes.slice(5,7)),0)).getUTCDate();
export const proximoMes=mes=>{const a=Number(mes.slice(0,4)),m=Number(mes.slice(5,7));return m===12?`${a+1}-01`:`${a}-${doisDigitos(m+1)}`;};
export const diaNoMes=(mes,dia)=>`${mes}-${doisDigitos(Math.min(Math.max(1,Number(dia)||1),ultimoDiaDoMes(mes)))}`;
