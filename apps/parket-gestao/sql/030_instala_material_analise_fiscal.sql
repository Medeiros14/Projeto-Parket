-- 030_instala_material_analise_fiscal.sql : pedido de material do INSTALADOR
-- passa pela analise do FISCAL antes de virar solicitacao de compras.
--
-- Will 08/09: "o formulario de solicitacao de compras do instalador, vamos
-- precisar que a solicitacao de compras caia para o Fiscal no verifica
-- analisar, e se aprovado pode subir com a estrutura que temos de solicitacao
-- de compras que e aqui no verifica".
--
-- RODA NO CLOUD (hbx...), nao no PG local: a tabela instala_material_solicitacoes
-- vive no Supabase Cloud. Aplicado manualmente em 08/09 via psql.
--
-- payload       : form completo de compras que o instalador preencheu no app
--                 (departamento, materiais com justificativa, prazo, projeto...).
--                 O fiscal aprova sem redigitar: o modal do verifica abre
--                 pre-preenchido a partir daqui.
-- motivo_recusa : quando o fiscal recusa, o motivo aparece na lista do
--                 instalador (via /api/instala/material/minhas).

alter table instala_material_solicitacoes
  add column if not exists payload jsonb,
  add column if not exists motivo_recusa text;
