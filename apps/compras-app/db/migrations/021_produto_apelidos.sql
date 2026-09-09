-- 021: apelidos de produto — o nome da NF pode diferir do nome popular do mesmo
--      material (Will 21/08). Cadastro no Almoxarifado: produto tem o nome popular
--      + lista de apelidos (nomes que vêm na nota). Import XML/entrada manual e o
--      "Conferir estoque" do card casam por qualquer um dos nomes.

ALTER TABLE public.compras_produtos ADD COLUMN IF NOT EXISTS apelidos text[] NOT NULL DEFAULT '{}';
