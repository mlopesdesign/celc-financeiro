const ITERACOES = 120000;
const encoder = new TextEncoder();

function paraBase64(bytes) { return btoa(String.fromCharCode(...new Uint8Array(bytes))); }
async function derivar(senha, sal) {
  const chave = await crypto.subtle.importKey('raw', encoder.encode(senha), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name:'PBKDF2', hash:'SHA-256', salt:Uint8Array.from(atob(sal), (c) => c.charCodeAt(0)), iterations:ITERACOES }, chave, 256);
  return paraBase64(bits);
}
async function novaCredencial(usuario, senha) { const sal=paraBase64(crypto.getRandomValues(new Uint8Array(16))); return { usuario, sal, hash:await derivar(senha, sal), iteracoes:ITERACOES }; }

export async function garantirAcesso(banco) { if (!banco.obterCredencial()) await banco.salvarCredencial(await novaCredencial('admin', 'admin123')); }
export async function validarAcesso(banco, usuario, senha) { const acesso=banco.obterCredencial(); if (!acesso || !usuario || !senha) return false; return usuario.trim()===acesso.usuario && (await derivar(senha, acesso.sal))===acesso.hash; }
export async function trocarSenha(banco, atual, nova, confirmar) { const acesso=banco.obterCredencial(); if (!acesso || !(await validarAcesso(banco, acesso.usuario, atual))) return { ok:false, erro:'A senha atual não confere.' }; if (nova.length<8) return { ok:false, erro:'Use pelo menos 8 caracteres.' }; if (nova!==confirmar) return { ok:false, erro:'A confirmação não confere.' }; await banco.salvarCredencial(await novaCredencial(acesso.usuario, nova)); return { ok:true }; }
