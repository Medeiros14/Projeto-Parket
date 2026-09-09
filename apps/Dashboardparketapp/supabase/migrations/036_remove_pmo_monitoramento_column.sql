-- Remove coluna "Monitoramento" do Kanban PMO (produtividade)
-- Coluna estava vazia (sem cards), pode ser deletada diretamente

DELETE FROM kanban_columns
WHERE dept_id = 'produtividade' AND slug = 'monitoramento';
