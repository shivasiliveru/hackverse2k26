import type { SupabaseClient } from "@supabase/supabase-js";

import { admin, audit } from "./hackverse.server";
import type {
  CriterionScores,
  EvaluationLogRow,
  EvaluationSettings,
  JudgeRow,
  JudgeTeamRow,
  JudgeWhoami,
  LeaderboardRow,
  LeaderboardStats,
  RankingMethod,
} from "./hackverse-types";
import { EVALUATION_ERROR_MESSAGES, criteriaTotal } from "./hackverse-types";

/* ------------------------------------------------------------ helpers */

function one<T>(value: unknown): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return (value[0] as T) ?? null;
  return value as T;
}

const num = (value: unknown): number => Number(value ?? 0);

/**
 * Judge accounts are Supabase Auth users with a row in `judges`. The username
 * is not an email, so it is mapped to a stable synthetic address purely to
 * satisfy Auth — judges never see or type it.
 */
export function judgeEmail(username: string): string {
  return `${username.trim().toLowerCase()}@judges.hackverse.local`;
}

/** Judges deliberately hold no admin role, so this is the only judge gate. */
export async function requireJudge(
  userId: string,
): Promise<{ id: string; name: string; username: string }> {
  const db = await admin();
  const { data } = await db
    .from("judges")
    .select("id,name,username,status")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) throw new Error("Forbidden");
  if (data.status !== "active") throw new Error("JudgeInactive");
  return { id: data.id as string, name: data.name as string, username: data.username as string };
}

export async function judgeWhoamiCore(
  userId: string,
  email: string | null,
): Promise<JudgeWhoami | null> {
  const db = await admin();
  const { data } = await db
    .from("judges")
    .select("id,username,name,status")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return { id: "", username: email ?? "", name: "", status: "deleted", isJudge: false };
  return {
    id: data.id as string,
    username: data.username as string,
    name: data.name as string,
    status: data.status as JudgeWhoami["status"],
    isJudge: data.status === "active",
  };
}

/* ----------------------------------------------------------- settings */

const SETTINGS_COLUMNS =
  "evaluation_status,score_increment,allow_score_editing,evaluation_start,evaluation_end," +
  "leaderboard_public,leaderboard_frozen,leaderboard_frozen_at,ranking_method,judges_see_others,max_judges";

export async function fetchEvaluationSettings(): Promise<EvaluationSettings> {
  const db = await admin();
  const { data: row } = await db
    .from("event_settings")
    .select(SETTINGS_COLUMNS)
    .eq("id", 1)
    .maybeSingle();
  const data = row as Record<string, unknown> | null;
  return {
    evaluation_status:
      (data?.["evaluation_status"] as EvaluationSettings["evaluation_status"]) ?? "closed",
    score_increment: num(data?.["score_increment"]) || 0.5,
    allow_score_editing: data?.["allow_score_editing"] === true,
    evaluation_start: (data?.["evaluation_start"] as string | null) ?? null,
    evaluation_end: (data?.["evaluation_end"] as string | null) ?? null,
    leaderboard_public: data?.["leaderboard_public"] === true,
    leaderboard_frozen: data?.["leaderboard_frozen"] === true,
    leaderboard_frozen_at: (data?.["leaderboard_frozen_at"] as string | null) ?? null,
    ranking_method: (data?.["ranking_method"] as RankingMethod) ?? "total",
    judges_see_others: data?.["judges_see_others"] === true,
    max_judges: (data?.["max_judges"] as number | null) ?? null,
  };
}

// Written out rather than Partial<> because exactOptionalPropertyTypes makes
// an optional key and an explicitly-undefined value different types.
type SettingsPatch = { [K in keyof EvaluationSettings]?: EvaluationSettings[K] | undefined };

export async function updateEvaluationSettingsCore(
  input: SettingsPatch & { actor: string },
): Promise<{ ok: boolean; message?: string }> {
  const { actor, ...patch } = input;
  const db = await admin();
  const { error } = await db
    .from("event_settings")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) return { ok: false, message: error.message };

  await audit({
    event: "admin_updated_evaluation_settings",
    actor,
    metadata: Object.fromEntries(
      Object.entries(patch).map(([k, v]) => [k, v as string | number | boolean | null]),
    ),
  });
  return { ok: true };
}

/* ------------------------------------------------------------- judges */

export async function createJudgeCore(input: {
  username: string;
  password: string;
  name: string;
  email?: string | undefined;
  organization?: string | undefined;
  phone?: string | undefined;
  actor: string;
}): Promise<{ ok: boolean; message?: string }> {
  const db = await admin();
  const username = input.username.trim().toLowerCase();

  const { data: existing } = await db
    .from("judges")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (existing) return { ok: false, message: "That username is already taken." };

  const settings = await fetchEvaluationSettings();
  if (settings.max_judges !== null) {
    const { data: active } = await db.from("judges").select("id").neq("status", "deleted");
    if ((active ?? []).length >= settings.max_judges) {
      return { ok: false, message: `The judge limit of ${settings.max_judges} has been reached.` };
    }
  }

  // Supabase Auth owns the password; it is hashed there and never stored by us.
  const created = await db.auth.admin.createUser({
    email: judgeEmail(username),
    password: input.password,
    email_confirm: true,
    user_metadata: { judge: true, name: input.name },
  });
  if (created.error || !created.data.user) {
    return { ok: false, message: created.error?.message ?? "Could not create the judge account." };
  }

  const { error } = await db.from("judges").insert({
    user_id: created.data.user.id,
    username,
    name: input.name.trim(),
    email: input.email?.trim() || null,
    organization: input.organization?.trim() || null,
    phone: input.phone?.trim() || null,
  });

  if (error) {
    // Do not leave an orphan auth user behind if the profile insert fails.
    await db.auth.admin.deleteUser(created.data.user.id);
    return { ok: false, message: error.message };
  }

  await audit({
    event: "admin_created_judge",
    actor: input.actor,
    metadata: { username, name: input.name },
  });
  return { ok: true };
}

export async function setJudgeStatusCore(
  id: string,
  status: "active" | "disabled" | "deleted",
  actor: string,
): Promise<{ ok: boolean; message?: string }> {
  const db = await admin();
  const { data: judge } = await db
    .from("judges")
    .select("username,user_id")
    .eq("id", id)
    .maybeSingle();
  if (!judge) return { ok: false, message: "Judge not found." };

  const { error } = await db.from("judges").update({ status }).eq("id", id);
  if (error) return { ok: false, message: error.message };

  // Soft delete only: §6 requires the evaluations and the judge's name to
  // survive for audit, so the auth user is signed out but the row remains.
  if (status !== "active") {
    await db.auth.admin.updateUserById(judge.user_id as string, { ban_duration: "876000h" });
  } else {
    await db.auth.admin.updateUserById(judge.user_id as string, { ban_duration: "none" });
  }

  await audit({
    event: status === "deleted" ? "admin_deleted_judge" : `admin_${status}_judge`,
    actor,
    metadata: { username: judge.username as string },
  });
  return { ok: true };
}

export async function resetJudgePasswordCore(
  id: string,
  password: string,
  actor: string,
): Promise<{ ok: boolean; message?: string }> {
  const db = await admin();
  const { data: judge } = await db
    .from("judges")
    .select("username,user_id")
    .eq("id", id)
    .maybeSingle();
  if (!judge) return { ok: false, message: "Judge not found." };

  const { error } = await db.auth.admin.updateUserById(judge.user_id as string, { password });
  if (error) return { ok: false, message: error.message };

  await audit({
    event: "admin_reset_judge_password",
    actor,
    metadata: { username: judge.username as string },
  });
  return { ok: true };
}

export async function fetchJudgesCore(): Promise<JudgeRow[]> {
  const db = await admin();
  const [judgesRes, evalsRes, teamsRes] = await Promise.all([
    db.from("judges").select("*").order("created_at"),
    db.from("evaluations").select("judge_id,score,submitted_at").eq("status", "submitted"),
    db.from("teams").select("id").eq("is_sample", false),
  ]);

  const totalTeams = (teamsRes.data ?? []).length;

  return (judgesRes.data ?? []).map((j) => {
    const mine = (evalsRes.data ?? []).filter((e) => e.judge_id === j.id);
    const scores = mine.map((e) => num(e.score));
    return {
      id: j.id as string,
      username: j.username as string,
      name: j.name as string,
      email: (j.email as string | null) ?? null,
      organization: (j.organization as string | null) ?? null,
      phone: (j.phone as string | null) ?? null,
      status: j.status as JudgeRow["status"],
      created_at: j.created_at as string,
      evaluations: mine.length,
      remaining: Math.max(0, totalTeams - mine.length),
      average_score: scores.length
        ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2))
        : null,
      min_score: scores.length ? Math.min(...scores) : null,
      max_score: scores.length ? Math.max(...scores) : null,
      last_activity: mine.length
        ? mine
            .map((e) => e.submitted_at as string)
            .sort()
            .at(-1)!
        : null,
    };
  });
}

/* -------------------------------------------------------- judge views */

export async function fetchJudgeTeamsCore(judgeId: string): Promise<JudgeTeamRow[]> {
  const db = await admin();
  const [teamsRes, minesRes] = await Promise.all([
    db
      .from("teams")
      .select("id,team_id,team_name,problem_statements(problem_statement_id,title,domains(name))")
      .eq("is_sample", false)
      .order("team_id"),
    // Only this judge's rows are ever fetched — §39.
    db
      .from("evaluations")
      .select(
        "team_id,score,submitted_at,score_problem,score_innovation,score_technical,score_presentation",
      )
      .eq("judge_id", judgeId),
  ]);

  return (teamsRes.data ?? []).map((t) => {
    const ps = one<{ problem_statement_id: string; title: string; domains: unknown }>(
      t.problem_statements,
    );
    const mine = (minesRes.data ?? []).find((e) => e.team_id === t.id);
    return {
      team_uuid: t.id as string,
      team_code: t.team_id as string,
      team_name: t.team_name as string,
      ps_code: ps?.problem_statement_id ?? null,
      ps_title: ps?.title ?? null,
      domain_name: one<{ name: string }>(ps?.domains)?.name ?? null,
      my_score: mine ? num(mine.score) : null,
      my_criteria: mine ? readCriteria(mine) : null,
      evaluated: Boolean(mine),
      submitted_at: (mine?.submitted_at as string | undefined) ?? null,
    };
  });
}

export async function submitEvaluationCore(
  judgeId: string,
  teamCode: string,
  criteria: CriterionScores,
): Promise<{ ok: boolean; code?: string; message?: string; score?: number; team_name?: string }> {
  const db = await admin();
  const { data, error } = await db.rpc("submit_evaluation", {
    p_judge_id: judgeId,
    p_team_code: teamCode,
    p_problem: criteria.problem,
    p_innovation: criteria.innovation,
    p_technical: criteria.technical,
    p_presentation: criteria.presentation,
  });

  if (error) {
    console.error("evaluation failed", error);
    return { ok: false, code: "UNKNOWN", message: EVALUATION_ERROR_MESSAGES["UNKNOWN"]! };
  }

  const result = data as Record<string, unknown>;
  if (result?.["ok"] === true) {
    return {
      ok: true,
      score: num(result["score"]),
      team_name: result["team_name"] as string,
    };
  }

  const code = (result?.["code"] as string) ?? "UNKNOWN";
  const criterion = result?.["criterion"] as string | undefined;
  return {
    ok: false,
    code,
    message: criterion
      ? `${criterion} is out of range.`
      : (EVALUATION_ERROR_MESSAGES[code] ?? EVALUATION_ERROR_MESSAGES["UNKNOWN"]!),
  };
}

/** Shared shape reader so the four columns are mapped in exactly one place. */
function readCriteria(row: Record<string, unknown>): CriterionScores {
  return {
    problem: num(row["score_problem"]),
    innovation: num(row["score_innovation"]),
    technical: num(row["score_technical"]),
    presentation: num(row["score_presentation"]),
  };
}

/* -------------------------------------------------------- leaderboard */

/**
 * §23 tie-breaking, applied in order: total (or average when the admin has
 * switched ranking method), then average, then judge count, then whoever
 * reached their score first.
 */
export function rankLeaderboard(
  rows: Omit<LeaderboardRow, "rank" | "tie_broken">[],
  method: RankingMethod,
): LeaderboardRow[] {
  const primary = (r: Omit<LeaderboardRow, "rank" | "tie_broken">) =>
    method === "average" ? r.average_score : r.total_score;

  const sorted = [...rows].sort((a, b) => {
    if (primary(b) !== primary(a)) return primary(b) - primary(a);
    if (b.average_score !== a.average_score) return b.average_score - a.average_score;
    if (b.judge_count !== a.judge_count) return b.judge_count - a.judge_count;
    const at = a.last_evaluated_at ?? "9999";
    const bt = b.last_evaluated_at ?? "9999";
    if (at !== bt) return at < bt ? -1 : 1;
    return a.team_code.localeCompare(b.team_code);
  });

  return sorted.map((row, index) => {
    const prev = sorted[index - 1];
    return {
      ...row,
      rank: index + 1,
      // Flagged only when the primary metric alone would not have separated them.
      tie_broken: prev !== undefined && primary(prev) === primary(row),
    };
  });
}

export async function fetchLeaderboardCore(): Promise<{
  rows: LeaderboardRow[];
  stats: LeaderboardStats;
  settings: EvaluationSettings;
  frozen: LeaderboardRow[] | null;
}> {
  const db = await admin();
  const settings = await fetchEvaluationSettings();

  const [boardRes, judgeRes, freezeRes] = await Promise.all([
    db.from("leaderboard").select("*"),
    db.from("judges").select("id").eq("status", "active"),
    settings.leaderboard_frozen
      ? db.from("leaderboard_freeze").select("*").order("rank")
      : Promise.resolve({ data: null }),
  ]);

  const base = (boardRes.data ?? []).map((r) => ({
    team_uuid: r.team_uuid as string,
    team_code: r.team_code as string,
    team_name: r.team_name as string,
    ps_code: (r.ps_code as string | null) ?? null,
    ps_title: (r.ps_title as string | null) ?? null,
    domain_name: (r.domain_name as string | null) ?? null,
    total_score: num(r.total_score),
    average_score: num(r.average_score),
    judge_count: num(r.judge_count),
    last_evaluated_at: (r.last_evaluated_at as string | null) ?? null,
  }));

  const rows = rankLeaderboard(base, settings.ranking_method);
  const evaluated = base.filter((r) => r.judge_count > 0);
  const totalScore = evaluated.reduce((sum, r) => sum + r.total_score, 0);
  const totalEvaluations = base.reduce((sum, r) => sum + r.judge_count, 0);

  return {
    rows,
    stats: {
      teams: base.length,
      judges: (judgeRes.data ?? []).length,
      evaluations: totalEvaluations,
      averageScore: totalEvaluations ? Number((totalScore / totalEvaluations).toFixed(2)) : 0,
      highestTotal: base.reduce((max, r) => Math.max(max, r.total_score), 0),
    },
    settings,
    frozen: freezeRes.data
      ? (freezeRes.data as Record<string, unknown>[]).map((r) => ({
          rank: num(r["rank"]),
          team_uuid: r["team_uuid"] as string,
          team_code: r["team_code"] as string,
          team_name: r["team_name"] as string,
          ps_code: (r["ps_code"] as string | null) ?? null,
          ps_title: (r["ps_title"] as string | null) ?? null,
          domain_name: null,
          total_score: num(r["total_score"]),
          average_score: num(r["average_score"]),
          judge_count: num(r["judge_count"]),
          last_evaluated_at: null,
          tie_broken: false,
        }))
      : null,
  };
}

export async function fetchEvaluationLogCore(): Promise<EvaluationLogRow[]> {
  const db = await admin();
  const { data } = await db
    .from("evaluations")
    .select(
      "id,score,submitted_at,updated_at,judges(id,name,username),teams(team_id,team_name,problem_statements(problem_statement_id))",
    )
    .eq("status", "submitted")
    .order("submitted_at", { ascending: false })
    .limit(1000);

  return (data ?? []).map((r) => {
    const judge = one<{ id: string; name: string; username: string }>(r.judges);
    const team = one<{ team_id: string; team_name: string; problem_statements: unknown }>(r.teams);
    const ps = one<{ problem_statement_id: string }>(team?.problem_statements);
    return {
      id: r.id as string,
      judge_id: judge?.id ?? "",
      judge_name: judge?.name ?? "—",
      judge_username: judge?.username ?? "—",
      team_code: team?.team_id ?? "—",
      team_name: team?.team_name ?? "—",
      ps_code: ps?.problem_statement_id ?? null,
      score: num(r.score),
      criteria: readCriteria(r as unknown as Record<string, unknown>),
      submitted_at: r.submitted_at as string,
      updated_at: r.updated_at as string,
    };
  });
}

/** Per-team breakdown for the admin drill-down (§25). */
export async function fetchTeamEvaluationsCore(teamCode: string): Promise<EvaluationLogRow[]> {
  const all = await fetchEvaluationLogCore();
  return all
    .filter((r) => r.team_code === teamCode)
    .sort((a, b) => a.submitted_at.localeCompare(b.submitted_at));
}

export async function freezeLeaderboardCore(
  freeze: boolean,
  actor: string,
): Promise<{ ok: boolean; count: number }> {
  const db = await admin();

  if (!freeze) {
    await db.from("leaderboard_freeze").delete().neq("rank", -1);
    await db
      .from("event_settings")
      .update({ leaderboard_frozen: false, leaderboard_frozen_at: null })
      .eq("id", 1);
    await audit({ event: "admin_unfroze_leaderboard", actor });
    return { ok: true, count: 0 };
  }

  const { rows } = await fetchLeaderboardCore();
  await db.from("leaderboard_freeze").delete().neq("rank", -1);

  const snapshot = rows.map((r) => ({
    rank: r.rank,
    team_uuid: r.team_uuid,
    team_code: r.team_code,
    team_name: r.team_name,
    ps_code: r.ps_code,
    ps_title: r.ps_title,
    total_score: r.total_score,
    average_score: r.average_score,
    judge_count: r.judge_count,
    frozen_by: actor,
  }));
  if (snapshot.length) await db.from("leaderboard_freeze").insert(snapshot);

  await db
    .from("event_settings")
    .update({ leaderboard_frozen: true, leaderboard_frozen_at: new Date().toISOString() })
    .eq("id", 1);
  await audit({ event: "admin_froze_leaderboard", actor, metadata: { teams: snapshot.length } });
  return { ok: true, count: snapshot.length };
}

/* ------------------------------------------------------------- public */

/** §35 — no judge identities, no individual scores, and off unless enabled. */
export async function fetchPublicLeaderboardCore(): Promise<{
  enabled: boolean;
  frozen: boolean;
  rows: { rank: number; team_code: string; team_name: string; total_score: number }[];
}> {
  const settings = await fetchEvaluationSettings();
  if (!settings.leaderboard_public) return { enabled: false, frozen: false, rows: [] };

  const { rows, frozen } = await fetchLeaderboardCore();
  const source = frozen ?? rows;
  return {
    enabled: true,
    frozen: settings.leaderboard_frozen,
    rows: source
      .filter((r) => r.judge_count > 0 || settings.leaderboard_frozen)
      .map((r) => ({
        rank: r.rank,
        team_code: r.team_code,
        team_name: r.team_name,
        total_score: r.total_score,
      })),
  };
}

export async function assertAdminClient(supabase: SupabaseClient, userId: string): Promise<void> {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || data !== true) throw new Error("Forbidden");
}

/* --------------------------------------------------- admin score edits */

/**
 * Admin override of a judge's marks. Deliberately separate from the judge
 * RPC: it ignores the evaluation window and the one-per-judge lock, because
 * an organiser correcting a mis-keyed score must not be blocked by rules
 * meant for judges. Every change is written to the audit log with the old
 * and new totals.
 */
export async function adminUpdateEvaluationCore(
  id: string,
  criteria: CriterionScores,
  actor: string,
): Promise<{ ok: boolean; message?: string; score?: number }> {
  const db = await admin();

  const { data: existing } = await db
    .from("evaluations")
    .select("id,score,judges(name,username),teams(team_id)")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { ok: false, message: "That evaluation no longer exists." };

  const { error } = await db
    .from("evaluations")
    .update({
      score_problem: criteria.problem,
      score_innovation: criteria.innovation,
      score_technical: criteria.technical,
      score_presentation: criteria.presentation,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    // The per-criterion CHECK constraints are the real ceiling; surface a
    // readable message rather than the raw Postgres violation.
    return {
      ok: false,
      message: /violates check constraint/i.test(error.message)
        ? "One of the marks is above its maximum for that criterion."
        : error.message,
    };
  }

  const total = criteriaTotal(criteria);
  const judge = one<{ name: string; username: string }>(existing.judges);
  const team = one<{ team_id: string }>(existing.teams);

  await audit({
    event: "admin_edited_evaluation",
    team_ref: team?.team_id ?? null,
    actor,
    metadata: {
      judge: judge?.name ?? "—",
      previous_score: num(existing.score),
      score: total,
    },
  });

  return { ok: true, score: total };
}

export async function adminDeleteEvaluationCore(
  id: string,
  actor: string,
): Promise<{ ok: boolean; message?: string }> {
  const db = await admin();

  const { data: existing } = await db
    .from("evaluations")
    .select("id,score,judges(name),teams(team_id)")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { ok: false, message: "That evaluation no longer exists." };

  const { error } = await db.from("evaluations").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };

  await audit({
    event: "admin_deleted_evaluation",
    team_ref: one<{ team_id: string }>(existing.teams)?.team_id ?? null,
    actor,
    metadata: {
      judge: one<{ name: string }>(existing.judges)?.name ?? "—",
      score: num(existing.score),
    },
  });
  return { ok: true };
}
