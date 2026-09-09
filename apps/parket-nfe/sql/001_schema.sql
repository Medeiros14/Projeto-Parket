-- parket-nfe · schema fiscal (parket-pg-local)
-- Migration 001: schema base + seed dos emitentes Parket

CREATE SCHEMA IF NOT EXISTS fiscal;

-- ─── Emitentes ────────────────────────────────────────────────────────
-- Filiais Parket que emitem NFe. CNPJ é chave natural (14 dígitos).
-- Populado por seed, atualizado manualmente conforme filiais novas.
CREATE TABLE IF NOT EXISTS fiscal.emitentes (
  cnpj        TEXT PRIMARY KEY,             -- 14 dígitos, só números
  nome_curto  TEXT NOT NULL,                -- "Parket SP", "Mundial PR"
  nome_razao  TEXT NOT NULL,                -- razão social completa (xNome)
  uf          TEXT NOT NULL,
  ie          TEXT,                         -- inscrição estadual (opcional)
  ativo       BOOLEAN NOT NULL DEFAULT TRUE
);

-- ─── Notas fiscais ────────────────────────────────────────────────────
-- Uma linha por chNFe (44 dígitos). Dedup natural pela SEFAZ.
-- Vínculo à obra: obra_projeto_id + status_vinculo. Regra:
--   status_vinculo='vinculado' ⇒ obra_projeto_id NOT NULL
--   status_vinculo='pendente'  ⇒ obra_projeto_id pode ser NULL
CREATE TABLE IF NOT EXISTS fiscal.notas (
  ch_nfe            TEXT PRIMARY KEY,        -- chNFe 44 dígitos
  numero            INTEGER NOT NULL,
  serie             INTEGER NOT NULL,
  modelo            TEXT NOT NULL DEFAULT '55',   -- 55=NFe, 65=NFCe
  dh_emissao        TIMESTAMPTZ NOT NULL,
  natureza_op       TEXT,
  tp_nf             INTEGER NOT NULL DEFAULT 1,   -- 0=entrada 1=saída

  -- Emitente (FK pra fiscal.emitentes)
  emit_cnpj         TEXT NOT NULL REFERENCES fiscal.emitentes(cnpj),
  emit_nome         TEXT NOT NULL,

  -- Destinatário (cliente)
  dest_cnpj_cpf     TEXT NOT NULL,
  dest_nome         TEXT NOT NULL,
  dest_uf           TEXT,

  -- Valores (do bloco total/ICMSTot)
  valor_produtos    NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_desc        NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_nf          NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_difal       NUMERIC(14,2) NOT NULL DEFAULT 0,

  -- Protocolo SEFAZ (do bloco protNFe)
  n_protocolo       TEXT,
  dh_recbto         TIMESTAMPTZ,
  c_stat            INTEGER,                  -- 100 = autorizado

  -- Vínculo obra (regra de negócio principal)
  obra_projeto_id   UUID REFERENCES gestao.projetos(id),
  status_vinculo    TEXT NOT NULL DEFAULT 'pendente'
                    CHECK (status_vinculo IN ('vinculado','pendente')),
  vinculado_por     TEXT,
  vinculado_em      TIMESTAMPTZ,

  -- Info complementar (pode ter "OBRA XXX" pra auto-match futuro)
  info_complementar TEXT,

  -- XML íntegro pra reemitir DANFE ou reprocessar depois
  xml_raw           TEXT NOT NULL,

  -- Auditoria
  uploaded_by       TEXT NOT NULL,
  uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Invariante: vinculada ⇒ tem projeto
  CONSTRAINT vinculado_tem_projeto CHECK (
    status_vinculo = 'pendente' OR obra_projeto_id IS NOT NULL
  )
);
CREATE INDEX IF NOT EXISTS ix_notas_projeto  ON fiscal.notas(obra_projeto_id);
CREATE INDEX IF NOT EXISTS ix_notas_status   ON fiscal.notas(status_vinculo);
CREATE INDEX IF NOT EXISTS ix_notas_emissao  ON fiscal.notas(dh_emissao DESC);
CREATE INDEX IF NOT EXISTS ix_notas_dest_cnpj ON fiscal.notas(dest_cnpj_cpf);

-- ─── Itens ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fiscal.notas_itens (
  ch_nfe    TEXT NOT NULL REFERENCES fiscal.notas(ch_nfe) ON DELETE CASCADE,
  n_item    INTEGER NOT NULL,
  c_prod    TEXT,
  x_prod    TEXT,
  ncm       TEXT,
  cfop      TEXT,
  u_com     TEXT,
  q_com     NUMERIC(15,4),
  v_un_com  NUMERIC(15,4),
  v_prod    NUMERIC(14,2),
  PRIMARY KEY (ch_nfe, n_item)
);

-- ─── Duplicatas (parcelas de cobrança do bloco cobr/dup) ─────────────
CREATE TABLE IF NOT EXISTS fiscal.notas_duplicatas (
  ch_nfe   TEXT NOT NULL REFERENCES fiscal.notas(ch_nfe) ON DELETE CASCADE,
  n_dup    TEXT NOT NULL,
  dh_venc  DATE,
  valor    NUMERIC(14,2),
  PRIMARY KEY (ch_nfe, n_dup)
);

-- ─── Auditoria de eventos ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fiscal.notas_eventos (
  id     BIGSERIAL PRIMARY KEY,
  ch_nfe TEXT NOT NULL REFERENCES fiscal.notas(ch_nfe) ON DELETE CASCADE,
  tipo   TEXT NOT NULL,     -- upload | vincular | revincular | marcar_pendente
  ator   TEXT,
  dados  JSONB DEFAULT '{}',
  at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_eventos_nota ON fiscal.notas_eventos(ch_nfe, at DESC);

-- ─── Seed dos emitentes conhecidos (Parket SP + Mundial PR) ──────────
-- Extraídos dos XMLs de exemplo em 2026-08-28.
INSERT INTO fiscal.emitentes (cnpj, nome_curto, nome_razao, uf, ie) VALUES
  ('29872616000215', 'Parket SP',   'MUNDIAL EXPORT ASSESSORIA COMERCIO EXTERIOR IMPORTACAO E EXP', 'SP', '132576060119'),
  ('29872616000134', 'Mundial PR',  'MUNDIAL EXPORT ASSESSORIA COMERCIO EXTERIOR IMPORTACAO E EXP', 'PR', '9085485900')
ON CONFLICT (cnpj) DO NOTHING;
