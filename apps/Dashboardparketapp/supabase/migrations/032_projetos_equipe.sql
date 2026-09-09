-- ═══ PROJETOS — Equipe, Demandas e SLA Templates ═══

-- Equipe de projetistas
create table if not exists projetos_equipe (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  email       text default '',
  especialidade text default '',
  ativo       boolean default true,
  created_at  timestamptz default now()
);

alter table projetos_equipe enable row level security;
create policy "auth_all_projetos_equipe" on projetos_equipe for all using (auth.role() = 'authenticated');

-- Demandas por projetista (kanban interno)
create table if not exists projetos_demandas (
  id             uuid primary key default gen_random_uuid(),
  projetista_id  uuid references projetos_equipe(id) on delete cascade,
  obra_code      text not null,
  titulo         text default '',
  status         text default 'backlog' check (status in ('backlog','em_andamento','revisao','aprovado')),
  prazo          date,
  tipo           text default 'Piso',
  tamanho        text default 'medio' check (tamanho in ('pequeno','medio','grande')),
  prioridade     text default 'normal' check (prioridade in ('normal','urgente','baixa')),
  created_at     timestamptz default now()
);

alter table projetos_demandas enable row level security;
create policy "auth_all_projetos_demandas" on projetos_demandas for all using (auth.role() = 'authenticated');

-- SLA templates (dias úteis por tipo × tamanho)
create table if not exists projetos_sla_templates (
  id       uuid primary key default gen_random_uuid(),
  tipo     text not null,
  tamanho  text not null check (tamanho in ('pequeno','medio','grande')),
  dias     integer not null default 7,
  unique (tipo, tamanho)
);

alter table projetos_sla_templates enable row level security;
create policy "auth_all_projetos_sla" on projetos_sla_templates for all using (auth.role() = 'authenticated');
