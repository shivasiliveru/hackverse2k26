-- =========================================================================
-- HackVerse 2K26 — make the maximum marks per criterion admin-configurable
--
-- The four maxima were baked into CHECK constraints (2/3/3/2 = 10). They now
-- live in event_settings as the event default, and each judge may carry an
-- override. submit_evaluation resolves the effective ceiling per judge as
-- coalesce(judge override, event default) and enforces it there.
--
-- ADDITIVE AND NON-DESTRUCTIVE:
--   * adds four columns, defaulting to today's values, so behaviour is
--     unchanged until an organiser edits them
--   * replaces the per-criterion CHECKs with a permissive bound; no row is
--     read, rewritten or deleted, and every existing score stays valid
--   * no table is dropped, no data is touched
--
-- Run AFTER judging-system.sql and judging-criteria.sql. Re-runnable.
-- =========================================================================

-- ============ CONFIGURABLE MAXIMA ============
alter table public.event_settings
  add column if not exists max_problem      numeric(5,1) not null default 2,
  add column if not exists max_innovation   numeric(5,1) not null default 3,
  add column if not exists max_technical    numeric(5,1) not null default 3,
  add column if not exists max_presentation numeric(5,1) not null default 2;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'event_settings_maxima_positive') then
    alter table public.event_settings add constraint event_settings_maxima_positive
      check (
        max_problem      >= 0 and max_problem      <= 100 and
        max_innovation   >= 0 and max_innovation   <= 100 and
        max_technical    >= 0 and max_technical    <= 100 and
        max_presentation >= 0 and max_presentation <= 100
      );
  end if;
end $$;


-- ============ PER-JUDGE OVERRIDES ============
-- Nullable on purpose: NULL means "use the event default", so adding these
-- columns changes nothing until an organiser sets one. Every existing judge
-- keeps the event-wide scheme.
alter table public.judges
  add column if not exists max_problem      numeric(5,1),
  add column if not exists max_innovation   numeric(5,1),
  add column if not exists max_technical    numeric(5,1),
  add column if not exists max_presentation numeric(5,1);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'judges_maxima_sane') then
    alter table public.judges add constraint judges_maxima_sane
      check (
        (max_problem      is null or (max_problem      >= 0 and max_problem      <= 100)) and
        (max_innovation   is null or (max_innovation   >= 0 and max_innovation   <= 100)) and
        (max_technical    is null or (max_technical    >= 0 and max_technical    <= 100)) and
        (max_presentation is null or (max_presentation >= 0 and max_presentation <= 100))
      );
  end if;
end $$;


-- ============ RELAX THE PER-CRITERION CHECKS ============
-- The old constraints hard-coded 2/3/3/2, which would reject any raised
-- ceiling. They are replaced by a wide sanity bound; the real per-criterion
-- limit is applied in submit_evaluation against the configured settings, so
-- a score can still never exceed what the organiser allows.
alter table public.evaluations drop constraint if exists evaluations_problem_range;
alter table public.evaluations drop constraint if exists evaluations_innovation_range;
alter table public.evaluations drop constraint if exists evaluations_technical_range;
alter table public.evaluations drop constraint if exists evaluations_presentation_range;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'evaluations_scores_sane') then
    alter table public.evaluations add constraint evaluations_scores_sane
      check (
        score_problem      >= 0 and score_problem      <= 100 and
        score_innovation   >= 0 and score_innovation   <= 100 and
        score_technical    >= 0 and score_technical    <= 100 and
        score_presentation >= 0 and score_presentation <= 100
      );
  end if;
end $$;

-- score is a generated column (the sum of the four); numeric(4,1) caps it at
-- 999.9, which is comfortably above four criteria at 100 each in practice but
-- widened here so a high ceiling cannot overflow it.
alter table public.evaluations
  alter column score type numeric(6,1);


-- ============ EVALUATION RPC (reads the configured maxima) ============
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
  -- Effective ceilings: a judge's own limit when set, otherwise the event
  -- default. Resolved once so the checks and the messages agree.
  v_max_p numeric;
  v_max_i numeric;
  v_max_t numeric;
  v_max_r numeric;
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
  if v_team.status = 'disqualified' then
    return jsonb_build_object('ok', false, 'code', 'TEAM_NOT_ELIGIBLE');
  end if;

  if p_problem is null or p_innovation is null or p_technical is null or p_presentation is null then
    return jsonb_build_object('ok', false, 'code', 'SCORE_REQUIRED');
  end if;

  v_max_p := coalesce(v_judge.max_problem,      v_settings.max_problem);
  v_max_i := coalesce(v_judge.max_innovation,   v_settings.max_innovation);
  v_max_t := coalesce(v_judge.max_technical,    v_settings.max_technical);
  v_max_r := coalesce(v_judge.max_presentation, v_settings.max_presentation);

  -- Each criterion against its configured ceiling, named so the judge is told
  -- which mark is wrong rather than just "invalid score".
  v_bad := case
    when p_problem      < 0 or p_problem      > v_max_p
      then format('Problem Understanding & Relevance (max %s)', v_max_p)
    when p_innovation   < 0 or p_innovation   > v_max_i
      then format('Innovation & Creativity (max %s)', v_max_i)
    when p_technical    < 0 or p_technical    > v_max_t
      then format('Technical Implementation & Prototype (max %s)', v_max_t)
    when p_presentation < 0 or p_presentation > v_max_r
      then format('Presentation & Feasibility (max %s)', v_max_r)
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
