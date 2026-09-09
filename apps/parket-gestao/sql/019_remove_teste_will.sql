-- 019_remove_teste_will.sql — tira o prestador de teste da base.
--
-- "WILL" / categoria "Simulação Teste" foi um teste do próprio Will na época em
-- que o instala.parket.works estava sendo montado. Ele não é instalador, mas os
-- 22 total_checks / 1 total_ok que ficaram na linha entram nas estatísticas da
-- tela /equipes e derrubam a média geral.
--
-- Auditado antes de rodar: a linha não tem NADA pendurada nela. Zero em
-- prestador_card, prestador_termos, prestador_avaliacoes, prestador_eventos,
-- campo_checkins, instala_* (checkins/conferencias/item_checks/ocorrencias/
-- material/updates), obras_check_diario, obras_diarios, contrato_assinaturas,
-- fechamentos, pagamentos, e zero kanban_cards citando o id. Os 22 checks eram
-- só contador denormalizado herdado do import, sem registro por trás.
--
-- Por isso o delete é limpo. Os outros nomes estranhos ("2024", "- Kaka",
-- "- Osmar") ficam: são prestadores reais, só com cadastro mal digitado.
--
-- Backup do estado anterior: public._equipes_backup_018 (65 linhas, criado no
-- 018) e sql/_backup_equipes_parket_20260831.json.

begin;

-- Credencial primeiro (FK aponta pro prestador).
delete from public.prestador_credenciais
where prestador_id in (
  select prestador_id from public.equipes_parket
  where nome = 'WILL' and categoria = 'Simulação Teste'
);

delete from public.prestadores
where id in (
  select prestador_id from public.equipes_parket
  where nome = 'WILL' and categoria = 'Simulação Teste'
);

delete from public.equipes_parket
where nome = 'WILL' and categoria = 'Simulação Teste';

commit;
