-- Remove coluna "Pagamento / Retenção" do Kanban PMO (produtividade)
-- Move cards existentes para a coluna "aceite" antes de deletar

UPDATE kanban_cards
SET column_id = (
  SELECT id FROM kanban_columns
  WHERE dept_id = 'produtividade' AND slug = 'aceite'
  LIMIT 1
)
WHERE column_id IN (
  SELECT id FROM kanban_columns
  WHERE dept_id = 'produtividade' AND slug = 'pagamento'
);

DELETE FROM kanban_columns
WHERE dept_id = 'produtividade' AND slug = 'pagamento';
