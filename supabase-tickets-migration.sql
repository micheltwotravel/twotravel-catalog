-- Run this once in the Supabase Dashboard → SQL Editor
-- https://supabase.com/dashboard/project/zcgisoigfzytpanoaomq/sql

create table if not exists compass_tickets (
  id text primary key,
  title text not null,
  description text default '',
  type text check (type in ('bug','feature','change','question')) default 'bug',
  page text default 'Compass',
  priority text check (priority in ('alta','media','baja')) default 'media',
  status text check (status in ('pendiente','en_progreso','listo','cancelado')) default 'pendiente',
  submitted_by text default '',
  submitted_by_name text default '',
  created_at timestamptz default now(),
  updated_at timestamptz
);

alter table compass_tickets enable row level security;

create policy "read_all"   on compass_tickets for select using (true);
create policy "insert_all" on compass_tickets for insert with check (true);
create policy "update_all" on compass_tickets for update using (true);
