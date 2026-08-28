CREATE TABLE configuracoes (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

CREATE TABLE usuarios (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  perfil TEXT NOT NULL CHECK (perfil IN ('diretor', 'financeiro', 'consulta')),
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL
);

CREATE TABLE categorias (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'despesa')),
  ativa INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE lancamentos (
  id TEXT PRIMARY KEY,
  descricao TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'despesa')),
  categoria_id TEXT NOT NULL,
  valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
  competencia TEXT NOT NULL,
  vencimento TEXT,
  liquidado_em TEXT,
  situacao TEXT NOT NULL CHECK (situacao IN ('previsto', 'pendente', 'pago', 'recebido', 'vencido')),
  recorrencia TEXT NOT NULL DEFAULT 'avulso' CHECK (recorrencia IN ('avulso', 'mensal')),
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL,
  usuario_id TEXT NOT NULL
);

CREATE TABLE auditoria (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL,
  acao TEXT NOT NULL,
  entidade TEXT NOT NULL,
  entidade_id TEXT NOT NULL,
  criado_em TEXT NOT NULL,
  detalhes TEXT
);

CREATE TABLE caixa_diario (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'despesa')),
  origem TEXT NOT NULL,
  aluno TEXT,
  responsavel TEXT,
  forma_pagamento TEXT NOT NULL,
  valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
  observacao TEXT,
  lancamento_id TEXT,
  criado_em TEXT NOT NULL,
  usuario_id TEXT NOT NULL
);

CREATE TABLE alunos_devedores (
  id TEXT PRIMARY KEY,
  aluno TEXT NOT NULL,
  turma TEXT,
  responsavel TEXT,
  contato TEXT,
  descricao TEXT NOT NULL,
  valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
  valor_pago_centavos INTEGER NOT NULL DEFAULT 0 CHECK (valor_pago_centavos >= 0),
  vencimento TEXT NOT NULL,
  situacao TEXT NOT NULL CHECK (situacao IN ('em_aberto', 'parcial', 'quitado')),
  observacao TEXT,
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL,
  usuario_id TEXT NOT NULL
);
