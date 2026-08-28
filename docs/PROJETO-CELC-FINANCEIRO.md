# CELC Financeiro — especificação do produto

## 1. Propósito

Aplicativo desktop instalável para a Direção do Colégio CELC controlar entradas, despesas, contas a pagar, contas a receber, categorias, relatórios, backups e atualizações. O produto deve abrir como um programa Windows, nunca como site ou navegador.

O foco é operação financeira diária com leitura rápida, segurança e acabamento visual institucional premium.

## 2. Usuário principal

| Perfil | Responsabilidades |
|---|---|
| Diretor do Colégio CELC | Consulta indicadores, registra lançamentos, baixa contas, cria backup, troca senha e acompanha atualizações. |

Há um único perfil administrador na primeira versão.

## 3. Identidade e experiência

- Nome: **CELC Financeiro**.
- Paleta: azul-marinho como cor estrutural, branco como plano principal, turquesa da marca como acento; vermelho institucional somente para alertas críticos ou identidade aprovada.
- A barra lateral é fixa em todas as telas, inclusive Configurações.
- Rolagens devem ser discretas ou ocultas visualmente, sem prejudicar navegação por mouse, teclado ou touchpad.
- Não usar emojis, ícones de bibliotecas ou símbolos genéricos como solução visual final.
- O ícone nativo do `.exe`, da janela e da barra de tarefas deve usar a identidade CELC. A interface não deve ser alterada apenas para acomodar esse ícone.
- Componentes devem ter hierarquia, espaço, tipografia e estados de interação consistentes. Não aceitar telas provisórias, campos técnicos expostos ao diretor ou módulos sem função real.

## 4. Fluxos obrigatórios

### 4.1 Abertura e acesso

1. O executável inicia na tela de login, sem qualquer dado financeiro visível atrás dela.
2. Primeiro acesso: usuário `admin`, senha `admin123`.
3. A senha deve ser alterável em Configurações.
4. A credencial deve ser derivada com PBKDF2 e salva no banco externo, nunca em texto simples ou apenas em armazenamento do navegador.

### 4.2 Dashboard

Após login, mostrar:

- saldo disponível;
- entradas do mês;
- despesas do mês;
- resultado do mês;
- últimas movimentações;
- contas a vencer e pendências;
- visão de fluxo de caixa e despesas por categoria.

Todos os números exibidos devem ser calculados a partir do banco, não valores estáticos de demonstração.

### 4.3 Categorias

Módulo próprio no menu, não apenas campo de texto.

- listar categorias de entrada e saída;
- cadastrar categoria com nome e tipo;
- impedir duplicidade por nome e tipo;
- usar as categorias cadastradas ao registrar lançamentos;
- permitir, em versão posterior, editar, arquivar e ordenar categorias.

Categorias iniciais:

| Entradas | Saídas |
|---|---|
| Receitas escolares | Recursos humanos |
| Matrículas | Serviços e utilidades |
| Doações e eventos | Material pedagógico |

### 4.4 Entradas

- tela dedicada com apenas receitas;
- registrar receita recebida ou prevista;
- data de competência, categoria, descrição, valor e recorrência;
- baixar uma entrada prevista como recebida;
- refletir imediatamente no dashboard e relatórios.

### 4.5 Despesas e saídas

- tela dedicada com apenas despesas;
- registrar despesa paga, pendente ou prevista;
- data de competência, categoria, descrição, valor e recorrência;
- baixar uma pendência como paga;
- refletir imediatamente no dashboard e relatórios.

### 4.6 Contas a pagar e receber

São módulos separados, não filtros genéricos.

| Módulo | Exibe | Ação principal |
|---|---|---|
| Contas a pagar | despesas pendentes, previstas e vencidas | Baixar como paga |
| Contas a receber | entradas previstas, pendentes e vencidas | Baixar como recebida |

Cada baixa deve registrar data/hora, usuário e auditoria.

### 4.7 Recorrência mensal

- um lançamento recorrente gera a próxima competência automaticamente;
- despesas recorrentes nascem como pendentes;
- receitas recorrentes nascem como previstas;
- não pode haver duplicação da mesma recorrência na mesma competência.

### 4.8 Relatórios

Módulo de Relatórios deve abrir uma tela própria com período e tipo de relatório. A primeira entrega deve exportar CSV de fluxo de caixa contendo:

- data;
- descrição;
- tipo;
- categoria;
- situação;
- recorrência;
- valor.

Evoluções previstas: PDF, resumo mensal, contas em aberto e comparativo por categoria.

### 4.9 Configurações

Página de conteúdo mantendo a barra lateral do aplicativo visível. Abas em cartões horizontais, no padrão institucional aprovado.

Abas mínimas:

1. Segurança — troca de senha.
2. Backup — criar e restaurar cópias validadas.
3. Atualizações — versão instalada, verificar atualização, instalar quando disponível e histórico de mudanças.

O diretor nunca deve informar URL, manifesto ou outro detalhe técnico. A atualização é configurada internamente pelo produto.

## 5. Dados, segurança e recuperação

| Item | Regra |
|---|---|
| Banco | `%APPDATA%\CELC Financeiro\dados\celc-financeiro.db` |
| Tecnologia | SQLite via sql.js |
| Gravação | `.tmp` → banco atual para `.old` → `.tmp` para banco → remover `.old` |
| Backup | Validar tabelas essenciais e ao menos uma movimentação antes de aceitar restauração |
| Auditoria | Registrar criação e baixa de lançamentos |
| Atualização | Nunca substituir a pasta de dados; substituir somente `resources.neu` |

## 6. Atualização online

- Repositório oficial: `mlopesdesign/celc-financeiro`.
- Manifesto fixo no aplicativo: `https://github.com/mlopesdesign/celc-financeiro/releases/latest/download/latest.json`.
- Só instalar versão maior que a instalada.
- Antes de atualizar: salvar fila de persistência e criar backup validado.
- Depois de atualizar: reiniciar o aplicativo.
- A tela deve informar apenas estado humano: atualizado, atualização disponível, baixando, instalado ou indisponível.

Manifesto esperado:

```json
{
  "applicationId": "com.mllopesdesign.celcfinanceiro",
  "version": "0.1.12",
  "resourcesURL": "https://github.com/mlopesdesign/celc-financeiro/releases/download/v0.1.12/resources.neu"
}
```

## 7. Arquitetura

```text
src/
├── index.html
├── assets/
│   ├── celc-logo.png
│   └── celc-app-icon.png
├── css/
├── js/
│   ├── app.js
│   ├── auth.js
│   ├── backend/
│   │   ├── db.js
│   │   ├── atualizador.js
│   │   └── core/
│   │       ├── lancamentos.js
│   │       ├── categorias.js
│   │       ├── backup.js
│   │       ├── relatorios.js
│   │       └── atualizador.js
│   └── vendor/
├── schema.sql
docs/
tests/
```

## 8. Critérios de aceite antes de nova entrega

Uma versão só pode ser enviada para teste quando todos os itens abaixo forem comprovados:

- [ ] Executável abre sem tela de erro, página 404 ou console de erro.
- [ ] Ícone CELC aparece no `.exe` e na barra de tarefas.
- [ ] Login bloqueia o dashboard até autenticação válida.
- [ ] Categorias criadas aparecem no formulário de lançamento após reinício.
- [ ] Entrada, despesa, conta a pagar e conta a receber operam em telas distintas.
- [ ] Baixa altera situação, totalizadores e auditoria.
- [ ] Lançamento mensal não duplica recorrência.
- [ ] Backup criado é restaurável; backup inválido é recusado.
- [ ] Relatório é exportado com dados reais.
- [ ] Configurações preserva barra lateral, não exibe URL técnica e exibe atualização em linguagem humana.
- [ ] Todos os testes automatizados passam.
- [ ] Abertura manual do `.exe` foi validada após o build.

## 9. Situação de entrega

O projeto deve ser tratado como **em reconstrução funcional** até que a lista de aceite acima seja validada ponta a ponta em um único executável. Nenhuma melhoria visual isolada substitui esses testes.
