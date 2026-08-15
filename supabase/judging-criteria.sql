-- =========================================================================
-- HackVerse 2K26 — split the 0-10 score into the four official criteria
--
--   Problem Understanding & Relevance      2
--   Innovation & Creativity                3
--   Technical Implementation & Prototype   3
--   Presentation & Feasibility             2
--                                         --
--   Total                                 10
--
-- Run AFTER judging-system.sql. Re-runnable.
--
-- !! Drops and rebuilds the evaluations.score column, so any existing
-- !! evaluations must be re-entered. Safe only before judging starts.
-- =========================================================================

-- The leaderboard view reads evaluations.score, so it has to go first.
drop view if exists public.leaderboard;

alter table public.evaluations drop column if exists score;

alter table public.evaluations
  add column if not exists score_problem      numeric(3,1) not null default 0,
  add column if not exists score_innovation   numeric(3,1) not null default 0,
  add column if not exists score_technical    numeric(3,1) not null default 0,
  add column if not exists score_presentation numeric(3,1) not null default 0;

-- Each criterion is capped at its own maximum in the database, so no
-- combination of API calls can produce an over-weighted total.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'evaluations_problem_range') then
    alter table public.evaluations add constraint evaluations_problem_range
      check (score_problem >= 0 and score_problem <= 2);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'evaluations_innovation_range') then
    alter table public.evaluations add constraint evaluations_innovation_range
      check (score_innovation >= 0 and score_innovation <= 3);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'evaluations_technical_range') then
    alter table public.evaluations add constraint evaluations_technical_range
      check (score_technical >= 0 and score_technical <= 3);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'evaluations_presentation_range') then
    alter table public.evaluations add constraint evaluations_presentation_range
      check (score_presentation >= 0 and score_presentation <= 2);
  end if;
end $$;

-- Generated, not written: the total can never disagree with its parts.
alter table public.evaluations
  add column if not exists score numeric(4,1)
  generated always as (
    score_problem + score_innovation + score_technical + score_presentation
  ) stored;


-- ============ LEADERBOARD VIEW (rebuilt) ============
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
  coalesce(sum(e.score), 0)::numeric(6,1)           as total_score,
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


-- ============ EVALUATION RPC (per-criterion) ============
drop function if exists public.submit_evaluation(uuid, text, numeric);

create or replace function public.submit_evaluation(
  p_judge_id uuid,
  p_team_code text,
  p_problem numeric,
  p_innovation numeric,
  p_technical numeric,
  p_presentation numeric
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_judge public.judges;
  v_team public.teams;
  v_settings public.event_settings;
  v_existing public.evaluations;
  v_total numeric;
  v_now timestamptz := now();
  v_bad text;
begin
  select * into v_settings from public.event_settings where id = 1;

  select * into v_judge from public.judges where id = p_judge_id;
  if v_judge.id is null then
    return jsonb_build_object('ok', false, 'code', 'JUDGE_NOT_FOUND');
  end if;
  if v_judge.status <> 'active' then
    return jsonb_build_object('ok', false, 'code', 'JUDGE_INACTIVE');
  end if;

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

  select * into v_team from public.teams where team_id = p_team_code;
  if v_team.id is null then
    return jsonb_build_object('ok', false, 'code', 'TEAM_NOT_FOUND');
  end if;
  if v_team.is_sample then
    return jsonb_build_object('ok', false, 'code', 'TEAM_NOT_ELIGIBLE');
  end if;

  if p_problem is null or p_innovation is null or p_technical is null or p_presentation is null then
    return jsonb_build_object('ok', false, 'code', 'SCORE_REQUIRED');
  end if;

  -- Each criterion against its own ceiling, reported by name so the judge
  -- is told which one is wrong rather than just "invalid score".
  v_bad := case
    when p_problem      < 0 or p_problem      > 2 then 'Problem Understanding & Relevance (max 2)'
    when p_innovation   < 0 or p_innovation   > 3 then 'Innovation & Creativity (max 3)'
    when p_technical    < 0 or p_technical    > 3 then 'Technical Implementation & Prototype (max 3)'
    when p_presentation < 0 or p_presentation > 2 then 'Presentation & Feasibility (max 2)'
    else null
  end;
  if v_bad is not null then
    return jsonb_build_object('ok', false, 'code', 'SCORE_OUT_OF_RANGE', 'criterion', v_bad);
  end if;

  foreach v_total in array array[p_problem, p_innovation, p_technical, p_presentation]
  loop
    if (v_total / v_settings.score_increment) <> floor(v_total / v_settings.score_increment) then
      return jsonb_build_object('ok', false, 'code', 'SCORE_BAD_INCREMENT',
        'increment', v_settings.score_increment);
    end if;
  end loop;

  v_total := p_problem + p_innovation + p_technical + p_presentation;

  select * into v_existing from public.evaluations
    where judge_id = p_judge_id and team_id = v_team.id;

  if v_existing.id is not null then
    if not v_settings.allow_score_editing then
      return jsonb_build_object('ok', false, 'code', 'ALREADY_EVALUATED', 'score', v_existing.score);
    end if;

    update public.evaluations
      set score_problem = p_problem,
          score_innovation = p_innovation,
          score_technical = p_technical,
          score_presentation = p_presentation,
          updated_at = v_now,
          status = 'submitted'
      where id = v_existing.id;

    insert into public.audit_log (event, team_ref, actor, metadata)
    values ('evaluation_updated', v_team.team_id, v_judge.username,
            jsonb_build_object('score', v_total, 'previous_score', v_existing.score,
                               'judge', v_judge.name));

    return jsonb_build_object('ok', true, 'updated', true, 'score', v_total,
      'team_name', v_team.team_name, 'team_id', v_team.team_id);
  end if;

  begin
    insert into public.evaluations
      (judge_id, team_id, score_problem, score_innovation, score_technical, score_presentation)
    values (p_judge_id, v_team.id, p_problem, p_innovation, p_technical, p_presentation);
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'ALREADY_EVALUATED');
  end;

  insert into public.audit_log (event, team_ref, actor, metadata)
  values ('evaluation_submitted', v_team.team_id, v_judge.username,
          jsonb_build_object('score', v_total, 'judge', v_judge.name));

  return jsonb_build_object('ok', true, 'updated', false, 'score', v_total,
    'team_name', v_team.team_name, 'team_id', v_team.team_id);
end;
$$;

revoke all on function public.submit_evaluation(uuid, text, numeric, numeric, numeric, numeric)
  from public, anon, authenticated;
grant execute on function public.submit_evaluation(uuid, text, numeric, numeric, numeric, numeric)
  to service_role;
