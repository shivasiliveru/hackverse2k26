-- =========================================================================
-- HackVerse 2K26 — Judging, Evaluation & Leaderboard System
--
-- Additive only. Touches nothing the problem-statement selection flow uses:
-- teams, problem_statements, domains, allocations and allocate_problem_statement
-- are read but never altered. Safe to run on the live event database.
--
-- Run once in the Supabase SQL Editor. Re-running is safe (idempotent).
-- =========================================================================

-- ============ JUDGES ============
-- Authentication is delegated to Supabase Auth: each judge is an auth.users
-- row, so passwords are bcrypt-hashed and sessions are real JWTs. This table
-- holds only the profile. Judges deliberately get NO user_roles entry, so
-- has_role(uid,'admin') is false for them and every admin route rejects them.
create table if not exists public.judges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  username text not null unique,
  name text not null,
  email text,
  organization text,
  phone text,
  -- 'deleted' is a soft delete: §6 requires evaluations to survive for audit,
  -- and a hard delete would take the judge's name with them.
  status text not null default 'active' check (status in ('active','disabled','deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.judges enable row level security;
grant all on public.judges to service_role;

drop policy if exists "judges admin read" on public.judges;
create policy "judges admin read" on public.judges
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "judges self read" on public.judges;
create policy "judges self read" on public.judges
  for select to authenticated using (user_id = auth.uid());

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'judges_touch') then
    create trigger judges_touch before update on public.judges
      for each row execute function public.touch_updated_at();
  end if;
end $$;


-- ============ EVALUATIONS ============
-- score is capped at 10 by a table constraint as well as in the RPC, so an
-- out-of-range value cannot be written even by a direct service-role insert.
create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  judge_id uuid not null references public.judges(id) on delete restrict,
  team_id uuid not null references public.teams(id) on delete cascade,
  score numeric(4,1) not null check (score >= 0 and score <= 10),
  status text not null default 'submitted' check (status in ('submitted','revoked')),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- §14 / §42: one evaluation per judge per team. This is what makes a
  -- double-clicked submit safe — the second insert simply loses.
  constraint evaluations_one_per_judge_team unique (judge_id, team_id)
);

create index if not exists evaluations_team_idx on public.evaluations (team_id);
create index if not exists evaluations_judge_idx on public.evaluations (judge_id);
create index if not exists evaluations_submitted_idx on public.evaluations (submitted_at desc);

alter table public.evaluations enable row level security;
grant all on public.evaluations to service_role;

drop policy if exists "evaluations admin read" on public.evaluations;
create policy "evaluations admin read" on public.evaluations
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- §39: by default a judge sees only their own scores.
drop policy if exists "evaluations own read" on public.evaluations;
create policy "evaluations own read" on public.evaluations
  for select to authenticated using (
    judge_id in (select id from public.judges where user_id = auth.uid())
  );

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'evaluations_touch') then
    create trigger evaluations_touch before update on public.evaluations
      for each row execute function public.touch_updated_at();
  end if;
end $$;


-- ============ SETTINGS ============
-- Extends the existing single settings row rather than adding a second table,
-- so there is still one place to read event state from.
alter table public.event_settings
  add column if not exists evaluation_status text not null default 'closed',
  add column if not exists score_increment numeric(2,1) not null default 0.5,
  add column if not exists allow_score_editing boolean not null default false,
  add column if not exists evaluation_start timestamptz,
  add column if not exists evaluation_end timestamptz,
  add column if not exists leaderboard_public boolean not null default false,
  add column if not exists leaderboard_frozen boolean not null default false,
  add column if not exists leaderboard_frozen_at timestamptz,
  add column if not exists ranking_method text not null default 'total',
  add column if not exists judges_see_others boolean not null default false,
  add column if not exists max_judges int;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'event_settings_evaluation_status_check') then
    alter table public.event_settings add constraint event_settings_evaluation_status_check
      check (evaluation_status in ('open','paused','closed'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'event_settings_score_increment_check') then
    alter table public.event_settings add constraint event_settings_score_increment_check
      check (score_increment in (0.5, 1));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'event_settings_ranking_method_check') then
    alter table public.event_settings add constraint event_settings_ranking_method_check
      check (ranking_method in ('total','average'));
  end if;
end $$;


-- ============ LEADERBOARD VIEW ============
-- §40: evaluations remain the single source of truth; nothing is duplicated.
-- Runs as owner so the admin dashboard reads consistent aggregates.
create or replace view public.leaderboard
with (security_invoker = false) as
select
  t.id                                   as team_uuid,
  t.team_id                              as team_code,
  t.team_name,
  t.status                               as team_status,
  t.allocation_status,
  ps.problem_statement_id                as ps_code,
  ps.title                               as ps_title,
  d.name                                 as domain_name,
  coalesce(sum(e.score), 0)::numeric(6,1)  as total_score,
  coalesce(round(avg(e.score), 2), 0)::numeric(4,2) as average_score,
  count(e.id)::int                       as judge_count,
  max(e.submitted_at)                    as last_evaluated_at
from public.teams t
left join public.problem_statements ps on ps.id = t.selected_problem_statement_id
left join public.domains d              on d.id = ps.domain_id
left join public.evaluations e          on e.team_id = t.id and e.status = 'submitted'
where t.is_sample = false
group by t.id, t.team_id, t.team_name, t.status, t.allocation_status,
         ps.problem_statement_id, ps.title, d.name;

grant select on public.leaderboard to service_role;


-- ============ FROZEN RESULTS ============
-- §36/§37: freezing snapshots the ranking so later evaluations cannot change
-- the official result. The snapshot is the record, not a recomputation.
create table if not exists public.leaderboard_freeze (
  id uuid primary key default gen_random_uuid(),
  rank int not null,
  team_uuid uuid not null references public.teams(id),
  team_code text not null,
  team_name text not null,
  ps_code text,
  ps_title text,
  total_score numeric(6,1) not null,
  average_score numeric(4,2) not null,
  judge_count int not null,
  frozen_at timestamptz not null default now(),
  frozen_by text
);

alter table public.leaderboard_freeze enable row level security;
grant all on public.leaderboard_freeze to service_role;


-- ============ EVALUATION RPC ============
-- §41: every rule is enforced here, server-side. The frontend re-states some
-- of these for UX only; this function is the authority.
create or replace function public.submit_evaluation(
  p_judge_id uuid,
  p_team_code text,
  p_score numeric
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_judge public.judges;
  v_team public.teams;
  v_settings public.event_settings;
  v_existing public.evaluations;
  v_now timestamptz := now();
begin
  select * into v_settings from public.event_settings where id = 1;

  -- 1-2. judge exists and is active
  select * into v_judge from public.judges where id = p_judge_id;
  if v_judge.id is null then
    return jsonb_build_object('ok', false, 'code', 'JUDGE_NOT_FOUND');
  end if;
  if v_judge.status <> 'active' then
    return jsonb_build_object('ok', false, 'code', 'JUDGE_INACTIVE');
  end if;

  -- 3. evaluation window
  if v_settings.evaluation_status = 'paused' then
    return jsonb_build_object('ok', false, 'code', 'EVAL_PAUSED');
  elsif v_settings.evaluation_status = 'closed' then
    return jsonb_build_object('ok', false, 'code', 'EVAL_CLOSED');
  end if;
  if v_settings.evaluation_start is not null and v_now < v_settings.evaluation_start then
    return jsonb_build_object('ok', false, 'code', 'EVAL_NOT_STARTED');
  end if;
  if v_settings.evaluation_end is not null and v_now > v_settings.evaluation_end then
    return jsonb_build_object('ok', false, 'code', 'EVAL_ENDED');
  end if;

  -- 4-5. team exists and is judgeable
  select * into v_team from public.teams where team_id = p_team_code;
  if v_team.id is null then
    return jsonb_build_object('ok', false, 'code', 'TEAM_NOT_FOUND');
  end if;
  if v_team.is_sample then
    return jsonb_build_object('ok', false, 'code', 'TEAM_NOT_ELIGIBLE');
  end if;

  -- 7-9. score present, in range, on the configured increment
  if p_score is null then
    return jsonb_build_object('ok', false, 'code', 'SCORE_REQUIRED');
  end if;
  if p_score < 0 or p_score > 10 then
    return jsonb_build_object('ok', false, 'code', 'SCORE_OUT_OF_RANGE');
  end if;
  if (p_score / v_settings.score_increment) <> floor(p_score / v_settings.score_increment) then
    return jsonb_build_object('ok', false, 'code', 'SCORE_BAD_INCREMENT',
      'increment', v_settings.score_increment);
  end if;

  -- 6. one evaluation per judge per team, unless the admin allows editing
  select * into v_existing from public.evaluations
    where judge_id = p_judge_id and team_id = v_team.id;

  if v_existing.id is not null then
    if not v_settings.allow_score_editing then
      return jsonb_build_object('ok', false, 'code', 'ALREADY_EVALUATED',
        'score', v_existing.score);
    end if;

    update public.evaluations
      set score = p_score, updated_at = v_now, status = 'submitted'
      where id = v_existing.id;

    insert into public.audit_log (event, team_ref, actor, metadata)
    values ('evaluation_updated', v_team.team_id, v_judge.username,
            jsonb_build_object('score', p_score, 'previous_score', v_existing.score,
                               'judge', v_judge.name));

    return jsonb_build_object('ok', true, 'updated', true, 'score', p_score,
      'team_name', v_team.team_name, 'team_id', v_team.team_id);
  end if;

  -- §42: a double-clicked submit races here; the unique constraint settles it.
  begin
    insert into public.evaluations (judge_id, team_id, score)
    values (p_judge_id, v_team.id, p_score);
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'ALREADY_EVALUATED');
  end;

  insert into public.audit_log (event, team_ref, actor, metadata)
  values ('evaluation_submitted', v_team.team_id, v_judge.username,
          jsonb_build_object('score', p_score, 'judge', v_judge.name));

  return jsonb_build_object('ok', true, 'updated', false, 'score', p_score,
    'team_name', v_team.team_name, 'team_id', v_team.team_id);
end;
$$;

revoke all on function public.submit_evaluation(uuid, text, numeric) from public, anon, authenticated;
grant execute on function public.submit_evaluation(uuid, text, numeric) to service_role;


-- ============ REALTIME ============
-- §20: the admin leaderboard recalculates without a refresh.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

do $$
declare t text;
begin
  foreach t in array array['evaluations','judges','leaderboard_freeze']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
