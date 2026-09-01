# Atualização online pelo GitHub

O CELC Financeiro usa o atualizador nativo do Neutralino e substitui somente `resources.neu`. O banco em `%APPDATA%\CELC Financeiro\dados` nunca é incluído na atualização.

## Manifesto de uma release

Publique no GitHub Releases o arquivo `latest.json` produzido em `Release/vX.Y.Z/`. Para a v0.2.4, o manifesto é:

```json
{
  "applicationId": "com.mllopesdesign.celcfinanceiro",
  "version": "0.2.4",
  "resourcesURL": "https://github.com/mlopesdesign/celc-financeiro/releases/download/v0.2.4/resources.neu"
}
```

Na mesma release, publique `resources.neu`, o Setup, `SHA256SUMS.txt` e `latest.json`. A URL informada em **Configurações > Atualizações online** aponta para a versão pública de `latest.json`:

```text
https://github.com/ORGANIZACAO/REPOSITORIO/releases/latest/download/latest.json
```

## Regras aplicadas pelo aplicativo

- O manifesto precisa ser HTTPS.
- A versão publicada precisa ser maior que a instalada.
- Antes da instalação o aplicativo salva o banco e cria um backup validado.
- Após instalar `resources.neu`, o aplicativo reinicia.
