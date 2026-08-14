-- =========================================================================
-- HackVerse 2K26 - full setup for a FRESH Supabase project
--
-- Paste this whole file into the Supabase SQL Editor and Run.
-- It is the three migrations in supabase/migrations/ concatenated in order:
--   1. schema, RLS, triggers, realtime publication, allocate RPC, seed data
--   2. function grant/revoke hardening
--   3. public_stats security_invoker fix
--
-- Seeds 5 domains, 25 problem statements and 80 sample teams (is_sample=true).
--
-- RE-RUNNABLE. The reset block below drops the objects this script owns, so a
-- partially-applied run (the SQL Editor commits statement by statement rather
-- than rolling the file back as one unit) can simply be re-run.
--
-- !! That reset DESTROYS all HackVerse data in this project — teams,
-- !! allocations and the audit log included. It is written for standing up a
-- !! fresh project. Do NOT run it against a live event database.
-- =========================================================================

-- ============ RESET (drops only what this script creates) ============
drop view if exists public.public_stats cascade;

drop table if exists public.audit_log cascade;
drop table if exists public.allocations cascade;
drop table if exists public.event_settings cascade;
drop table if exists public.teams cascade;
drop table if exists public.problem_statements cascade;
drop table if exists public.domains cascade;
drop table if exists public.admin_setup cascade;
drop table if exists public.user_roles cascade;

drop function if exists public.allocate_problem_statement(text, text) cascade;
drop function if exists public.touch_updated_at() cascade;

-- has_role is NOT dropped by name: its signature references public.app_role,
-- which does not exist on a first run, and naming a missing type is an error
-- even under `if exists`. Dropping the enum with cascade removes the function.
drop type if exists public.app_role cascade;


-- ----- 20260814164634_17160352-5b77-4360-9456-cdff0ab12af9.sql -----
-- ============ ROLES ============
create type public.app_role as enum ('admin');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "own roles readable" on public.user_roles for select to authenticated using (user_id = auth.uid());

-- secret setup code table (service_role only)
create table public.admin_setup (
  id int primary key default 1,
  access_code text not null,
  created_at timestamptz not null default now()
);
grant all on public.admin_setup to service_role;
alter table public.admin_setup enable row level security;
insert into public.admin_setup (id, access_code) values (1, 'HACKVERSE-ADMIN-2K26');

-- ============ TIMESTAMP HELPER ============
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- ============ DOMAINS ============
create table public.domains (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.domains to anon, authenticated;
grant all on public.domains to service_role;
alter table public.domains enable row level security;
create policy "domains public read" on public.domains for select to anon, authenticated using (true);
create policy "domains admin write" on public.domains for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create trigger domains_touch before update on public.domains for each row execute function public.touch_updated_at();

-- ============ PROBLEM STATEMENTS ============
create table public.problem_statements (
  id uuid primary key default gen_random_uuid(),
  problem_statement_id text not null unique,
  title text not null,
  description text not null default '',
  full_description text not null default '',
  requirements text not null default '',
  expected_solution text not null default '',
  domain_id uuid not null references public.domains(id),
  capacity int not null default 2 check (capacity >= 0),
  allocated_count int not null default 0 check (allocated_count >= 0),
  remaining_slots int generated always as (capacity - allocated_count) stored,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ps_capacity_not_exceeded check (allocated_count <= capacity)
);
grant select on public.problem_statements to anon, authenticated;
grant all on public.problem_statements to service_role;
alter table public.problem_statements enable row level security;
create policy "ps public read" on public.problem_statements for select to anon, authenticated using (true);
create policy "ps admin write" on public.problem_statements for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create trigger ps_touch before update on public.problem_statements for each row execute function public.touch_updated_at();
create index on public.problem_statements (domain_id);

-- ============ TEAMS ============
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  team_id text not null unique,
  team_name text not null,
  leader_name text,
  status text not null default 'eligible' check (status in ('eligible','allocated','disqualified','inactive')),
  allocation_status text not null default 'not_allocated' check (allocation_status in ('not_allocated','allocated')),
  selected_problem_statement_id uuid references public.problem_statements(id),
  selected_at timestamptz,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.teams to authenticated;
grant all on public.teams to service_role;
alter table public.teams enable row level security;
create policy "teams admin read" on public.teams for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "teams admin write" on public.teams for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create trigger teams_touch before update on public.teams for each row execute function public.touch_updated_at();

-- ============ ALLOCATIONS ============
create table public.allocations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null unique references public.teams(id),
  problem_statement_id uuid not null references public.problem_statements(id),
  domain_id uuid not null references public.domains(id),
  allocation_number int not null unique,
  selected_at timestamptz not null default now(),
  status text not null default 'confirmed' check (status in ('confirmed','revoked')),
  created_at timestamptz not null default now()
);
grant select on public.allocations to authenticated;
grant all on public.allocations to service_role;
alter table public.allocations enable row level security;
create policy "allocations admin read" on public.allocations for select to authenticated using (public.has_role(auth.uid(),'admin'));
create index on public.allocations (problem_statement_id);

-- ============ EVENT SETTINGS ============
create table public.event_settings (
  id int primary key default 1,
  event_name text not null default 'HackVerse 2K26',
  selection_status text not null default 'open' check (selection_status in ('open','paused','closed')),
  max_allocated_teams int not null default 50,
  default_capacity int not null default 2,
  total_registered_teams int not null default 80,
  updated_at timestamptz not null default now()
);
grant select on public.event_settings to anon, authenticated;
grant all on public.event_settings to service_role;
alter table public.event_settings enable row level security;
create policy "settings public read" on public.event_settings for select to anon, authenticated using (true);
create policy "settings admin write" on public.event_settings for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
insert into public.event_settings (id) values (1);

-- ============ AUDIT LOG ============
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  team_ref text,
  problem_statement_ref text,
  actor text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;
create policy "audit admin read" on public.audit_log for select to authenticated using (public.has_role(auth.uid(),'admin'));
create index on public.audit_log (created_at desc);

-- ============ PUBLIC COUNTERS VIEW ============
create or replace view public.public_stats
with (security_invoker = true) as
select
  (select count(*) from public.allocations where status='confirmed')::int as allocated_teams,
  (select max_allocated_teams from public.event_settings where id=1) as max_allocated_teams,
  (select selection_status from public.event_settings where id=1) as selection_status,
  (select count(*) from public.problem_statements where status='active')::int as total_problem_statements,
  (select coalesce(sum(remaining_slots),0) from public.problem_statements where status='active')::int as available_ps_slots,
  (select total_registered_teams from public.event_settings where id=1) as total_registered_teams;
grant select on public.public_stats to anon, authenticated;

-- ============ ATOMIC ALLOCATION ============
create or replace function public.allocate_problem_statement(p_team_code text, p_ps_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_team public.teams;
  v_ps public.problem_statements;
  v_settings public.event_settings;
  v_count int;
  v_number int;
begin
  select * into v_settings from public.event_settings where id = 1 for update;

  if v_settings.selection_status = 'paused' then
    return jsonb_build_object('ok', false, 'code', 'PAUSED');
  elsif v_settings.selection_status = 'closed' then
    return jsonb_build_object('ok', false, 'code', 'CLOSED');
  end if;

  select count(*) into v_count from public.allocations where status = 'confirmed';
  if v_count >= v_settings.max_allocated_teams then
    update public.event_settings set selection_status = 'closed' where id = 1 and selection_status <> 'closed';
    return jsonb_build_object('ok', false, 'code', 'LIMIT_REACHED');
  end if;

  select * into v_team from public.teams where team_id = p_team_code for update;
  if v_team.id is null then
    return jsonb_build_object('ok', false, 'code', 'TEAM_NOT_FOUND');
  end if;
  if v_team.status = 'disqualified' or v_team.status = 'inactive' then
    return jsonb_build_object('ok', false, 'code', 'TEAM_INELIGIBLE');
  end if;
  if exists (select 1 from public.allocations where team_id = v_team.id) then
    return jsonb_build_object('ok', false, 'code', 'ALREADY_ALLOCATED');
  end if;

  select * into v_ps from public.problem_statements where problem_statement_id = p_ps_code for update;
  if v_ps.id is null then
    return jsonb_build_object('ok', false, 'code', 'PS_NOT_FOUND');
  end if;
  if v_ps.status <> 'active' then
    return jsonb_build_object('ok', false, 'code', 'PS_INACTIVE');
  end if;
  if v_ps.allocated_count >= v_ps.capacity then
    return jsonb_build_object('ok', false, 'code', 'PS_FULL');
  end if;

  update public.problem_statements set allocated_count = allocated_count + 1 where id = v_ps.id;

  v_number := v_count + 1;
  loop
    begin
      insert into public.allocations (team_id, problem_statement_id, domain_id, allocation_number)
      values (v_team.id, v_ps.id, v_ps.domain_id, v_number);
      exit;
    exception when unique_violation then
      v_number := v_number + 1;
    end;
  end loop;

  update public.teams
    set status = 'allocated', allocation_status = 'allocated',
        selected_problem_statement_id = v_ps.id, selected_at = now()
    where id = v_team.id;

  if v_ps.allocated_count + 1 >= v_ps.capacity then
    insert into public.audit_log (event, problem_statement_ref, metadata)
    values ('ps_became_full', v_ps.problem_statement_id, jsonb_build_object('capacity', v_ps.capacity));
  end if;

  insert into public.audit_log (event, team_ref, problem_statement_ref, actor, metadata)
  values ('allocation_success', v_team.team_id, v_ps.problem_statement_id, 'participant',
          jsonb_build_object('allocation_number', v_number));

  if v_count + 1 >= v_settings.max_allocated_teams then
    update public.event_settings set selection_status = 'closed' where id = 1;
  end if;

  return jsonb_build_object(
    'ok', true,
    'allocation_number', v_number,
    'team_name', v_team.team_name,
    'team_id', v_team.team_id,
    'problem_statement_id', v_ps.problem_statement_id,
    'title', v_ps.title,
    'domain', (select name from public.domains where id = v_ps.domain_id),
    'selected_at', now()
  );
end $$;

revoke all on function public.allocate_problem_statement(text, text) from public, anon, authenticated;
grant execute on function public.allocate_problem_statement(text, text) to service_role;

-- ============ REALTIME ============
-- The SQL Editor runs this whole file in one transaction, so a bare
-- `alter publication ... add table` would roll back everything if the
-- supabase_realtime publication is absent (fresh projects) or already
-- carries the table (re-run). Create it if missing, then add idempotently.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array['problem_statements','allocations','teams','event_settings','audit_log']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ============ SEED DATA ============
insert into public.domains (name, description, display_order) values
('AI, Data Science & Smart Automation','Machine intelligence, analytics and autonomous systems',1),
('Smart Manufacturing, MSMEs & Industry 6.0','Factory intelligence, supply chains and small-industry digitisation',2),
('Healthcare, Agriculture & Sustainable Development','Clinical tech, agri-tech and climate resilience',3),
('Cyber Security, Cloud Computing & Digital Infrastructure','Defensive security, cloud-native platforms and resilient infra',4),
('Smart Education, Mobility & Digital Society','Learning systems, urban mobility and civic technology',5);

with d as (select id, display_order from public.domains)
insert into public.problem_statements (problem_statement_id, title, description, full_description, requirements, expected_solution, domain_id)
select v.code, v.title, v.descr,
  v.descr || ' Teams are expected to build a working prototype, demonstrate the core workflow end to end, and justify their technical decisions during evaluation. Sample dataset guidance and evaluation rubrics will be shared at the venue.',
  'Working prototype; clear data model; documented API or model pipeline; measurable accuracy or performance metric; live demo.',
  'A deployable prototype with a clean interface, reproducible results and a short technical write-up.',
  d.id
from (values
 ('PS-01','AI-Based Crop Disease Detection','Detect crop diseases from leaf imagery and recommend field-level remediation.',1),
 ('PS-02','Conversational Analytics for Government Data','Natural-language querying over open public datasets with verifiable citations.',1),
 ('PS-03','Predictive Maintenance from Sensor Streams','Forecast equipment failure windows from noisy multi-sensor telemetry.',1),
 ('PS-04','Document Intelligence for Regional Languages','Extract structured records from scanned Indic-language documents.',1),
 ('PS-05','Autonomous Workflow Agent for Back Offices','Agentic automation of repetitive multi-step administrative work.',1),
 ('PS-06','Digital Twin for a Small Production Line','Simulate throughput and bottlenecks for a low-cost shop floor.',2),
 ('PS-07','MSME Credit Readiness Engine','Score micro-enterprise credit readiness from informal transaction records.',2),
 ('PS-08','Vision-Based Quality Inspection','Detect surface defects on a moving line using commodity cameras.',2),
 ('PS-09','Resilient Supply Chain Visibility','Track multi-tier supplier risk and simulate disruption impact.',2),
 ('PS-10','Energy Optimisation for Industrial Units','Reduce power cost with load shifting and anomaly detection.',2),
 ('PS-11','Rural Tele-Triage Platform','Triage patients at rural access points with offline-first tooling.',3),
 ('PS-12','Medication Adherence Companion','Track and improve adherence for chronic-care patients.',3),
 ('PS-13','Precision Irrigation Advisory','Advise irrigation schedules from soil, weather and crop stage.',3),
 ('PS-14','Farm-to-Market Price Transparency','Give growers verifiable price discovery and demand signals.',3),
 ('PS-15','Carbon and Waste Accounting for Campuses','Measure, attribute and reduce institutional emissions and waste.',3),
 ('PS-16','Phishing and Social Engineering Defence','Detect and explain credential-harvesting attempts in real time.',4),
 ('PS-17','Zero-Trust Access for Small Teams','Practical zero-trust access control without enterprise budgets.',4),
 ('PS-18','Cloud Cost and Drift Guardrails','Detect infrastructure drift and runaway cloud spend early.',4),
 ('PS-19','Secure Log Forensics Console','Correlate multi-source logs into an investigable incident timeline.',4),
 ('PS-20','Tamper-Evident Records for Public Services','Verifiable audit trails for citizen-facing record systems.',4),
 ('PS-21','Adaptive Learning Paths','Personalise learning sequences from continuous assessment signals.',5),
 ('PS-22','Campus and City Mobility Optimiser','Optimise shared transport routes against live demand.',5),
 ('PS-23','Accessibility Layer for Public Services','Make civic digital services usable for low-literacy and disabled users.',5),
 ('PS-24','Skill-to-Employment Matching','Match learner skill graphs to real local employment demand.',5),
 ('PS-25','Civic Issue Reporting and Resolution','Crowd-sourced civic issue tracking with accountable resolution.',5)
) as v(code, title, descr, dorder)
join d on d.display_order = v.dorder;

insert into public.teams (team_id, team_name, leader_name, is_sample)
select 'HV' || (1000 + g),
       'Team ' || (array['Alpha','Nova','Vertex','Quantum','Cipher','Nexus','Orbit','Matrix','Pulse','Zenith','Titan','Helix','Vector','Fusion','Astra','Kernel'])[1 + (g-1) % 16] || ' ' || ((g-1)/16 + 1),
       'Leader ' || g,
       true
from generate_series(1, 80) g;

-- ----- 20260814164656_96c65269-3aa7-4dcd-abcf-3f255f426b0c.sql -----
revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

-- ----- 20260814170000_fix_public_stats_visibility.sql -----
-- public_stats is the anon-facing live counter for the participant pages.
-- It was created with security_invoker = true, so the view executed under the
-- caller's RLS. allocations and teams are admin-only, which meant anon read
-- allocated_teams = 0 no matter how many teams had locked a problem statement:
-- the landing progress bar, "N / 50 TEAMS ALLOCATED" and the client-side
-- closed gate were all permanently stuck at zero.
--
-- Running the view as its owner keeps the aggregate correct while the
-- underlying rows stay unreadable to anon — only these six scalars are exposed.
alter view public.public_stats set (security_invoker = false);

