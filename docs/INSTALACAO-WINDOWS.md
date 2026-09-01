# Instalação profissional — CELC Financeiro

O arquivo `CELC-Financeiro-Setup-0.2.7.exe` é a distribuição oficial para Windows 10/11 x64.

## O que o Setup faz

- Instala o aplicativo em `%LOCALAPPDATA%\Programs\CELC Financeiro`, sem exigir conta de administrador.
- Cria atalhos no Menu Iniciar e na Área de Trabalho.
- Inclui o Microsoft Edge WebView2 Runtime x64 offline, para abrir mesmo em uma máquina nova sem Internet.
- Registra a instalação e reconhece automaticamente uma versão anterior do CELC Financeiro.
- Ao atualizar, reutiliza a pasta já instalada e nunca remove os dados externos.
- Ao desinstalar, remove apenas arquivos do programa. O banco, senha, exportações e backups permanecem em `%APPDATA%\CELC Financeiro`.

## Atualização a partir do portátil

A versão portátil e a instalada usam a mesma identidade e a mesma pasta de dados. Basta instalar o Setup: o banco já existente é reutilizado automaticamente.

## Validação de entrega

1. Em uma conta Windows sem CELC Financeiro, execute o Setup.
2. Confirme os atalhos e abra o aplicativo.
3. Reexecute o mesmo Setup e confirme a mensagem de versão anterior reconhecida.
4. Desinstale e confirme que `%APPDATA%\CELC Financeiro\dados\celc-financeiro.db` continua presente.
