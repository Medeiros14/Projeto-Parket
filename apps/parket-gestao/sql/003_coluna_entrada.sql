-- Coluna "entrada" espelha o dept PMO/Produtividade do Space (Natalia).
-- É a fase inicial onde projetos entram na gestão de projetos —
-- "Novo Projeto Recebido" no slaLabel do Space.
-- Ordem 0 (antes de 'projeto') pra ser a primeira do kanban.

INSERT INTO gestao.colunas_kanban (id, titulo, cor, ordem)
VALUES ('entrada', 'Entrada · Novo Projeto Recebido', '#6B7280', 0)
ON CONFLICT (id) DO UPDATE SET
  titulo = EXCLUDED.titulo, cor = EXCLUDED.cor, ordem = EXCLUDED.ordem;
