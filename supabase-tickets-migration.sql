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

-- ── Seed tickets ──────────────────────────────────────────────────────────────
insert into compass_tickets (id, title, description, type, page, priority, status, submitted_by, submitted_by_name, created_at) values
('t_img_1',  'Tablero comisiones bodas',                          'Para Angelica, Alexandra y Julith. Tablero que muestre comisiones del equipo de bodas.',                                                                     'feature',  'Bodas',    'media',  'pendiente', 'michel@two.travel', 'Michel', now()),
('t_img_2',  'Filtro por propiedad — ampliar filtros múltiples',  'Sebastian necesita poder filtrar por propiedad con múltiples selecciones simultáneas.',                                                                        'feature',  'Compass',  'media',  'pendiente', 'michel@two.travel', 'Michel', now()),
('t_img_3',  'Créditos con bancos',                               'Julith: módulo o vista para gestionar créditos con bancos.',                                                                                                    'feature',  'Pagos',    'media',  'pendiente', 'michel@two.travel', 'Michel', now()),
('t_img_4',  'Bodas / Finance — hoja de cálculo interno y clientes','Ange, Alexandra y Lyna. Hoja de cálculo financiera para bodas: vista interna y vista para el cliente.',                                                     'feature',  'Bodas',    'media',  'pendiente', 'michel@two.travel', 'Michel', now()),
('t_img_5',  'Portfolio update info',                             'Actualizar información del portafolio de propiedades.',                                                                                                          'change',   'Compass',  'baja',   'pendiente', 'michel@two.travel', 'Michel', now()),
('t_img_6',  'HR — manejar horarios',                             'Gestión de horarios del equipo en Compass. Actualmente está en Notion, migrar o integrar.',                                                                    'feature',  'HR',       'media',  'pendiente', 'michel@two.travel', 'Michel', now()),
('t_img_7',  'Acceso Armando — calendario visual concierge + reglas horarios','Armando necesita acceso concierge con: dashboard visual calendario (?mode=dashboard), filtrar datos por concierge, y reglas de horarios.',          'feature',  'Compass',  'media',  'pendiente', 'michel@two.travel', 'Michel', now()),
('t_img_8',  'Comisiones — meeting con Lau y Julith',             'Reunión pendiente con Lau y Julith para definir / revisar el módulo de comisiones.',                                                                            'question', 'Pagos',    'media',  'pendiente', 'michel@two.travel', 'Michel', now()),
('t_voz_1',  'Revisar conexión con Hostable (afiliado)',          'Verificar que la integración / afiliación con Hostable esté correctamente conectada.',                                                                           'bug',      'Compass',  'media',  'pendiente', 'michel@two.travel', 'Michel', now()),
('t_voz_2',  'Asistente Luna — WhatsApp Search en chats',        'Agregar funcionalidad de búsqueda en los chats del asistente Luna en WhatsApp.',                                                                                 'feature',  'Bot',      'media',  'pendiente', 'michel@two.travel', 'Michel', now()),
-- From Phase II backlog:
('seed_0',   'Tier 2 pricing — itinerary shows wrong prices',    'Clients with Tier 2 see Tier 1 prices in the itinerary canvas. price_tier_1/price_tier_2 exist in catalog but canvas always uses Tier 1.',                      'bug',      'Compass',  'alta',   'pendiente', 'michel@two.travel', 'Michel', now()),
('seed_1',   'Reservations module — Xile & Genesis workflow',    'Full booking workflow. Meeting with Xile and Genesis pending. Ray flagged this as the next big phase.',                                                           'feature',  'Reservas', 'alta',   'pendiente', 'michel@two.travel', 'Michel', now()),
('seed_2',   'Finance dashboard — TRM, cash flow, reconciliation','10-feature finance spec: TRM widget, COP/USD cash flow, bank reconciliation, Payana/QB templates, payment requests CO+MX.',                                     'feature',  'Pagos',    'alta',   'pendiente', 'michel@two.travel', 'Michel', now()),
('seed_3',   'Unified client dashboard — replace Monday/HubSpot sheet','Single panel per client replacing the Monday board, HubSpot sidebar, and Concierge Sheet.',                                                               'feature',  'Compass',  'media',  'pendiente', 'michel@two.travel', 'Michel', now()),
('seed_4',   'Listas fijas — curated itinerary recommendation lists','Curated lists of activities/restaurants per city to suggest when building an itinerary. Architecture TBD.',                                                  'feature',  'Compass',  'media',  'pendiente', 'michel@two.travel', 'Michel', now()),
('seed_5',   'Pre-check-in form — improvements & template',      'Standardize the client message template sent with the Hotspot form link. Add per-kickoff checkInFormUrl field.',                                                 'feature',  'Compass',  'media',  'pendiente', 'michel@two.travel', 'Michel', now()),
('seed_6',   'Marketing board — content & filmación notes',      'Nueva sección Marketing: notas de filmación, consumer behavior, calendario de contenido, métricas de redes.',                                                    'feature',  'Compass',  'media',  'pendiente', 'michel@two.travel', 'Michel', now()),
('seed_7',   'QuickBooks follow-up — Concierge Sheet for Lyni',  'Verify Concierge Sheet is updated so Lyni can enter billing info. Follow up on QB integration status.',                                                          'feature',  'Compass',  'media',  'pendiente', 'michel@two.travel', 'Michel', now()),
('seed_8',   'Onboarding process — review Caro''s doc',          'Caro will send a doc to review before moving forward. Implement onboarding workflow in HR panel.',                                                                'change',   'HR',       'baja',   'pendiente', 'michel@two.travel', 'Michel', now()),
('seed_9',   'Fotos menú CTG — blurry images need replacement',  'CTG menu photo is blurry, breakfast photo looks bad. Marketing must provide new photos.',                                                                        'change',   'Compass',  'baja',   'pendiente', 'michel@two.travel', 'Michel', now()),
('seed_10',  'Language toggle — full platform i18n',             'Full React i18n for the platform (EN/ES). Very complex — requires extracting all strings. Item 28/45 from Phase II.',                                            'feature',  'Compass',  'baja',   'pendiente', 'michel@two.travel', 'Michel', now())
on conflict (id) do nothing;
