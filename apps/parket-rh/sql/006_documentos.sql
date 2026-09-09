-- ============================================================
-- Modelos de documento + emissão + assinatura virtual
-- Reutiliza signer.documentos (polimórfico) pra cada emissão.
-- ============================================================

-- Catálogo de modelos
CREATE TABLE IF NOT EXISTS rh.modelos_documento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,                       -- "advertencia", "contrato_clt", "termo_emprestimo", "nr_01"...
  variante text,                            -- "falta", "atraso", "saida_antecipada", "parket", "exclusive"
  titulo text NOT NULL,                     -- "Advertência por falta injustificada"
  descricao text,
  empresa_id uuid REFERENCES core.empresas(id),  -- null = todas as empresas
  -- Conteúdo: HTML com placeholders {{nome}}, {{cpf}}, {{data}} etc.
  conteudo_html text NOT NULL,
  -- Lista de placeholders e meta (label, type, required)
  campos jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Categoria pra agrupar na UI
  categoria text NOT NULL CHECK (categoria IN ('advertencia','contrato','termo','nr','rescisao','ficha','outro')),
  -- Ordem dentro da categoria
  ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tipo, variante, empresa_id)
);
CREATE INDEX IF NOT EXISTS modelos_categoria_idx ON rh.modelos_documento(categoria, ordem);


-- Documentos emitidos (instâncias dos modelos)
CREATE TABLE IF NOT EXISTS rh.documentos_emitidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modelo_id uuid REFERENCES rh.modelos_documento(id),
  colaborador_id uuid NOT NULL REFERENCES rh.colaboradores(id),
  empresa_id uuid REFERENCES core.empresas(id),
  contrato_id uuid REFERENCES rh.contratos(id),
  titulo text NOT NULL,
  -- Conteúdo final renderizado (HTML c/ placeholders preenchidos)
  conteudo_html text NOT NULL,
  -- Valores dos placeholders usados (pra audit)
  campos_valores jsonb DEFAULT '{}'::jsonb,
  -- Status
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','aguardando_assinatura','assinado','recusado','cancelado','legado_offline')),
  -- Token público pro colaborador assinar
  token text UNIQUE,
  token_expira_em timestamptz,
  -- Assinatura virtual (PNG base64 + meta)
  assinatura jsonb,
  -- PDF gerado (storage)
  storage_path_pdf text,
  -- Auditoria
  emitido_por uuid REFERENCES auth.users(id),
  emitido_em timestamptz NOT NULL DEFAULT now(),
  enviado_em timestamptz,
  assinado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Flag pra docs históricos importados (assinados em papel antes da plataforma)
  legado_origem text,                       -- "github_legado_2026"
  legado_pdf_path text                      -- path no bucket
);
CREATE INDEX IF NOT EXISTS docemt_colab_idx ON rh.documentos_emitidos(colaborador_id);
CREATE INDEX IF NOT EXISTS docemt_status_idx ON rh.documentos_emitidos(status);
CREATE INDEX IF NOT EXISTS docemt_token_idx ON rh.documentos_emitidos(token);


-- ── RPC público: pegar documento por token (signing page) ──
CREATE OR REPLACE FUNCTION rh.documento_public_get(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_doc rh.documentos_emitidos;
  v_colab rh.colaboradores;
  v_emp core.empresas;
BEGIN
  SELECT * INTO v_doc FROM rh.documentos_emitidos WHERE token = p_token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Token inválido' USING ERRCODE='P0002'; END IF;
  IF v_doc.token_expira_em IS NOT NULL AND v_doc.token_expira_em < now() THEN
    RAISE EXCEPTION 'Token expirado' USING ERRCODE='P0003';
  END IF;
  IF v_doc.status IN ('cancelado','recusado','assinado','legado_offline') THEN
    RAISE EXCEPTION 'Documento não está mais disponível pra assinatura (status: %)', v_doc.status USING ERRCODE='P0004';
  END IF;
  SELECT * INTO v_colab FROM rh.colaboradores WHERE id = v_doc.colaborador_id;
  SELECT * INTO v_emp FROM core.empresas WHERE id = v_doc.empresa_id;
  RETURN jsonb_build_object(
    'id', v_doc.id, 'titulo', v_doc.titulo,
    'conteudo_html', v_doc.conteudo_html,
    'status', v_doc.status,
    'colaborador', jsonb_build_object('nome', v_colab.nome, 'cpf', v_colab.cpf),
    'empresa', jsonb_build_object('razao_social', v_emp.razao_social, 'nome_fantasia', v_emp.nome_fantasia, 'cnpj', v_emp.cnpj)
  );
END $$;
GRANT EXECUTE ON FUNCTION rh.documento_public_get(text) TO anon, authenticated;


-- ── RPC público: assinar documento ──
CREATE OR REPLACE FUNCTION rh.documento_public_sign(p_token text, p_assinatura jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_id uuid;
  v_status text;
  v_now timestamptz := now();
BEGIN
  SELECT id, status INTO v_id, v_status FROM rh.documentos_emitidos WHERE token = p_token
    AND (token_expira_em IS NULL OR token_expira_em >= v_now);
  IF NOT FOUND THEN RAISE EXCEPTION 'Token inválido ou expirado' USING ERRCODE='P0002'; END IF;
  IF v_status NOT IN ('aguardando_assinatura','rascunho') THEN
    RAISE EXCEPTION 'Documento não disponível pra assinatura (%)', v_status USING ERRCODE='P0004';
  END IF;
  IF p_assinatura->>'png' IS NULL THEN
    RAISE EXCEPTION 'Assinatura obrigatória' USING ERRCODE='P0005';
  END IF;
  UPDATE rh.documentos_emitidos SET
    assinatura = p_assinatura,
    status = 'assinado',
    assinado_em = v_now,
    updated_at = v_now
  WHERE id = v_id;
  RETURN jsonb_build_object('id', v_id, 'status', 'assinado', 'assinado_em', v_now);
END $$;
GRANT EXECUTE ON FUNCTION rh.documento_public_sign(text, jsonb) TO anon, authenticated;


-- ── RPC: listar docs do colaborador (atualiza colaborador_documentos_get) ──
CREATE OR REPLACE FUNCTION rh.colaborador_documentos_get(p_colab_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_cpf text;
  v_admissoes jsonb;
  v_emitidos jsonb;
BEGIN
  SELECT regexp_replace(coalesce(cpf,''),'\D','','g') INTO v_cpf FROM rh.colaboradores WHERE id = p_colab_id;

  SELECT jsonb_agg(row_to_json(x) ORDER BY x.criado_em DESC) INTO v_admissoes FROM (
    SELECT a.id, 'admissao_form'::text AS tipo,
      'Formulário de admissão'::text AS titulo,
      a.etapa,
      CASE WHEN a.etapa IN ('aprovado_ativo','assinado','aguardando_aprovacao_rh') THEN 'assinado'
           WHEN a.etapa IN ('rejeitado','cancelado','expirado') THEN 'cancelado'
           ELSE 'pendente' END AS status,
      a.token, a.token_expira_em AS expira_em,
      a.created_at AS criado_em, a.preenchido_em, a.contrato_assinado_em AS assinado_em,
      a.telefone, a.email, a.nome,
      e.razao_social AS empresa_razao, e.nome_fantasia AS empresa_nome
    FROM rh.admissoes a
    LEFT JOIN core.empresas e ON e.id = a.empresa_id
    WHERE (v_cpf <> '' AND regexp_replace(coalesce(a.cpf,''),'\D','','g') = v_cpf)
       OR (a.contrato_id IN (SELECT id FROM rh.contratos WHERE colaborador_id = p_colab_id))
  ) x;

  SELECT jsonb_agg(row_to_json(x) ORDER BY x.criado_em DESC) INTO v_emitidos FROM (
    SELECT d.id, 'emitido'::text AS tipo, d.titulo,
      d.status::text AS etapa,
      CASE WHEN d.status = 'assinado' THEN 'assinado'
           WHEN d.status IN ('cancelado','recusado') THEN 'cancelado'
           WHEN d.status = 'legado_offline' THEN 'assinado'
           ELSE 'pendente' END AS status,
      d.token, d.token_expira_em AS expira_em,
      d.created_at AS criado_em, d.assinado_em,
      d.legado_origem, d.legado_pdf_path,
      m.categoria, m.tipo AS modelo_tipo, m.variante AS modelo_variante,
      e.razao_social AS empresa_razao, e.nome_fantasia AS empresa_nome
    FROM rh.documentos_emitidos d
    LEFT JOIN rh.modelos_documento m ON m.id = d.modelo_id
    LEFT JOIN core.empresas e ON e.id = d.empresa_id
    WHERE d.colaborador_id = p_colab_id
  ) x;

  RETURN jsonb_build_object(
    'admissoes', COALESCE(v_admissoes,'[]'::jsonb),
    'emitidos', COALESCE(v_emitidos,'[]'::jsonb)
  );
END $$;
GRANT EXECUTE ON FUNCTION rh.colaborador_documentos_get(uuid) TO authenticated;


-- ── Storage bucket pros PDFs gerados + legado ──
INSERT INTO storage.buckets (id, name, public)
  VALUES ('rh-documentos', 'rh-documentos', false)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "docs_anon_read_by_token" ON storage.objects;
CREATE POLICY "docs_anon_read_by_token" ON storage.objects
FOR SELECT TO anon
USING (
  bucket_id = 'rh-documentos'
  AND name LIKE 'doc/%/%'
  AND EXISTS (
    SELECT 1 FROM rh.documentos_emitidos d
    WHERE d.token = split_part(name, '/', 2)
      AND (d.token_expira_em IS NULL OR d.token_expira_em >= now())
  )
);

DROP POLICY IF EXISTS "docs_authenticated_all" ON storage.objects;
CREATE POLICY "docs_authenticated_all" ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'rh-documentos')
WITH CHECK (bucket_id = 'rh-documentos');


-- ── RLS nas tabelas novas ──
ALTER TABLE rh.modelos_documento ENABLE ROW LEVEL SECURITY;
ALTER TABLE rh.documentos_emitidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "modelos rh ver" ON rh.modelos_documento;
CREATE POLICY "modelos rh ver" ON rh.modelos_documento FOR SELECT TO authenticated USING (rh.is_rh());
DROP POLICY IF EXISTS "modelos rh edit" ON rh.modelos_documento;
CREATE POLICY "modelos rh edit" ON rh.modelos_documento FOR ALL TO authenticated USING (rh.is_admin()) WITH CHECK (rh.is_admin());

DROP POLICY IF EXISTS "emit rh full" ON rh.documentos_emitidos;
CREATE POLICY "emit rh full" ON rh.documentos_emitidos FOR ALL TO authenticated USING (rh.is_rh()) WITH CHECK (rh.is_rh());

GRANT SELECT, INSERT, UPDATE, DELETE ON rh.modelos_documento, rh.documentos_emitidos TO authenticated;

NOTIFY pgrst, 'reload schema';
