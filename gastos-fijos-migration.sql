-- Gastos Fijos migration
-- Run in Supabase SQL Editor

create table if not exists gastos_fijos (
  id text primary key,
  pais text not null default 'CO' check (pais in ('CO','MX')),
  ubicacion text not null,
  servicio text not null,
  referencia text default '',
  mes text not null,                 -- 'YYYY-MM'
  valor numeric,
  fecha_limite date,
  estado text default 'pendiente' check (estado in ('al_dia','por_pagar','sin_actualizacion','sin_usar','pendiente')),
  notas text default '',
  created_at timestamptz default now(),
  updated_at timestamptz
);

alter table gastos_fijos enable row level security;

create policy "gastos_read_all"   on gastos_fijos for select using (true);
create policy "gastos_insert_all" on gastos_fijos for insert with check (true);
create policy "gastos_update_all" on gastos_fijos for update using (true) with check (true);
