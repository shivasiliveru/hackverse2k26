import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  AdminAllocationRow,
  AdminOverview,
  AdminTeamRow,
  AllocateResult,
  AuditEntry,
  PublicDomain,
  PublicProblemStatement,
  PublicState,
  PublicStats,
  VerifyResult,
} from "./hackverse-types";
import { ALLOCATION_ERROR_MESSAGES } from "./hackverse-types";

/* ------------------------------------------------------------ helpers */

function one<T>(value: unknown): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return (value[0] as T) ?? null;
  return value as T;
}

/* -------------------------------------------------------------- clients */

export async function admin(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

export function publicClient(): SupabaseClient {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/* ------------------------------------------------------- rate limiting */

const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

/* -------------------------------------------------------------- audit */

export async function audit(entry: {
  event: string;
  team_ref?: string | null;
  problem_statement_ref?: string | null;
  actor?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
}): Promise<void> {
  const db = await admin();
  await db.from("audit_log").insert({
    event: entry.event,
    team_ref: entry.team_ref ?? null,
    problem_statement_ref: entry.problem_statement_ref ?? null,
    actor: entry.actor ?? null,
    metadata: entry.metadata ?? {},
  });
}

/* -------------------------------------------------------- public state */

export async function fetchPublicState(): Promise<PublicState> {
  const db = publicClient();
  const [statsRes, domainsRes, psRes] = await Promise.all([
    db.from("public_stats").select("*").maybeSingle(),
    db.from("domains").select("id,name,description,display_order").eq("is_active", true).order("display_order"),
    db
      .from("problem_statements")
      .select(
        "id,problem_statement_id,title,description,full_description,requirements,expected_solution,domain_id,capacity,allocated_count,remaining_slots",
      )
      .eq("status", "active")
      .order("problem_statement_id"),
  ]);

  const stats = (statsRes.data ?? {
    allocated_teams: 0,
    max_allocated_teams: 50,
    selection_status: "open",
    total_problem_statements: 0,
    available_ps_slots: 0,
    total_registered_teams: 80,
  }) as PublicStats;

  const problemStatements: PublicProblemStatement[] = (psRes.data ?? []).map((row) => ({
    id: row.id as string,
    code: row.problem_statement_id as string,
    title: row.title as string,
    description: (row.description as string) ?? "",
    full_description: (row.full_description as string) ?? "",
    requirements: (row.requirements as string) ?? "",
    expected_solution: (row.expected_solution as string) ?? "",
    domain_id: row.domain_id as string,
    capacity: row.capacity as number,
    allocated_count: row.allocated_count as number,
    remaining_slots: row.remaining_slots as number,
  }));

  const domains: PublicDomain[] = (domainsRes.data ?? []).map((d) => {
    const items = problemStatements.filter((p) => p.domain_id === d.id);
    const remaining = items.reduce((sum, p) => sum + Math.max(0, p.remaining_slots), 0);
    return {
      id: d.id as string,
      name: d.name as string,
      description: (d.description as string) ?? null,
      display_order: d.display_order as number,
      ps_count: items.length,
      remaining_slots: remaining,
      is_full: items.length === 0 || remaining === 0,
    };
  });

  return { stats, domains, problemStatements };
}

/* ---------------------------------------------------- team verification */

export async function verifyTeamCore(teamName: string, teamCode: string): Promise<VerifyResult> {
  const db = await admin();
  const code = teamCode.trim().toUpperCase();
  const { data: team } = await db
    .from("teams")
    .select("id,team_id,team_name,leader_name,status,allocation_status")
    .eq("team_id", code)
    .maybeSingle();

  if (!team || team.team_name.trim().toLowerCase() !== teamName.trim().toLowerCase()) {
    await audit({ event: "team_verification_failed", team_ref: code, actor: "participant", metadata: { teamName } });
    return { status: "not_found" };
  }

  if (team.status === "disqualified" || team.status === "inactive") {
    await audit({ event: "team_verification_ineligible", team_ref: code, actor: "participant" });
    return { status: "ineligible" };
  }

  if (team.allocation_status === "allocated") {
    const { data: alloc } = await db
      .from("allocations")
      .select("allocation_number,selected_at,problem_statements(problem_statement_id,title),domains(name)")
      .eq("team_id", team.id)
      .maybeSingle();
    const ps = one<{ problem_statement_id: string; title: string }>(alloc?.problem_statements);
    const dom = one<{ name: string }>(alloc?.domains);
    await audit({ event: "team_verification_already_allocated", team_ref: code, actor: "participant" });
    return {
      status: "already_allocated",
      team: { team_id: team.team_id, team_name: team.team_name },
      allocation: {
        problem_statement_id: ps?.problem_statement_id ?? "—",
        title: ps?.title ?? "—",
        domain: dom?.name ?? "—",
        allocation_number: alloc?.allocation_number ?? 0,
        selected_at: alloc?.selected_at ?? new Date().toISOString(),
      },
    };
  }

  await audit({ event: "team_verified", team_ref: code, actor: "participant" });
  return {
    status: "ok",
    team: { team_id: team.team_id, team_name: team.team_name, leader_name: team.leader_name },
  };
}

/* ------------------------------------------------------------ allocate */

export async function allocateCore(teamCode: string, psCode: string): Promise<AllocateResult> {
  const code = teamCode.trim().toUpperCase();
  if (!rateLimit(`alloc:${code}`, 10, 60_000)) {
    return { ok: false, code: "RATE_LIMITED", message: ALLOCATION_ERROR_MESSAGES["RATE_LIMITED"]! };
  }

  const db = await admin();
  const { data, error } = await db.rpc("allocate_problem_statement", {
    p_team_code: code,
    p_ps_code: psCode,
  });

  if (error) {
    console.error("allocation failed", error);
    await audit({
      event: "allocation_error",
      team_ref: code,
      problem_statement_ref: psCode,
      actor: "participant",
      metadata: { message: error.message },
    });
    return { ok: false, code: "UNKNOWN", message: ALLOCATION_ERROR_MESSAGES["UNKNOWN"]! };
  }

  const result = data as Record<string, unknown>;
  if (result?.["ok"] === true) {
    return {
      ok: true,
      receipt: {
        allocation_number: result["allocation_number"] as number,
        team_name: result["team_name"] as string,
        team_id: result["team_id"] as string,
        problem_statement_id: result["problem_statement_id"] as string,
        title: result["title"] as string,
        domain: result["domain"] as string,
        selected_at: result["selected_at"] as string,
      },
    };
  }

  const failCode = (result?.["code"] as string) ?? "UNKNOWN";
  await audit({
    event: "allocation_failed",
    team_ref: code,
    problem_statement_ref: psCode,
    actor: "participant",
    metadata: { reason: failCode },
  });
  return {
    ok: false,
    code: failCode,
    message: ALLOCATION_ERROR_MESSAGES[failCode] ?? ALLOCATION_ERROR_MESSAGES["UNKNOWN"]!,
  };
}

/* --------------------------------------------------------------- admin */

export async function assertAdmin(supabase: SupabaseClient, userId: string): Promise<void> {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || data !== true) throw new Error("Forbidden");
}

export async function registerAdminCore(
  email: string,
  password: string,
  accessCode: string,
): Promise<{ ok: boolean; message?: string }> {
  if (!rateLimit(`admin-register:${email}`, 5, 300_000)) {
    return { ok: false, message: "Too many attempts. Please wait before trying again." };
  }
  const db = await admin();
  const { data: setup } = await db.from("admin_setup").select("access_code").eq("id", 1).maybeSingle();
  if (!setup || setup.access_code !== accessCode) {
    await audit({ event: "admin_register_rejected", actor: email });
    return { ok: false, message: "Invalid organiser access code." };
  }

  const created = await db.auth.admin.createUser({ email, password, email_confirm: true });
  let userId = created.data.user?.id;
  if (created.error) {
    if (!/already/i.test(created.error.message)) return { ok: false, message: created.error.message };
    const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    userId = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
    if (!userId) return { ok: false, message: "Could not register this account." };
    await db.auth.admin.updateUserById(userId, { password });
  }

  await db.from("user_roles").upsert({ user_id: userId!, role: "admin" }, { onConflict: "user_id,role" });
  await audit({ event: "admin_registered", actor: email });
  return { ok: true };
}

export async function fetchAdminOverview(): Promise<AdminOverview> {
  const db = await admin();
  const [teams, allocs, ps, domains, settings, activity] = await Promise.all([
    db.from("teams").select("status,allocation_status"),
    db.from("allocations").select("id").eq("status", "confirmed"),
    db.from("problem_statements").select("id").eq("status", "active"),
    db.from("domains").select("id"),
    db.from("event_settings").select("*").eq("id", 1).maybeSingle(),
    db.from("audit_log").select("*").order("created_at", { ascending: false }).limit(40),
  ]);

  const teamRows = teams.data ?? [];
  const max = (settings.data?.max_allocated_teams as number) ?? 50;
  const allocated = (allocs.data ?? []).length;

  return {
    totalTeams: teamRows.length,
    allocated,
    remainingSlots: Math.max(0, max - allocated),
    maxAllocatedTeams: max,
    problemStatements: (ps.data ?? []).length,
    domains: (domains.data ?? []).length,
    disqualified: teamRows.filter((t) => t.status === "disqualified").length,
    eligible: teamRows.filter((t) => t.status === "eligible").length,
    selectionStatus: (settings.data?.selection_status as AdminOverview["selectionStatus"]) ?? "open",
    eventName: (settings.data?.event_name as string) ?? "HackVerse 2K26",
    defaultCapacity: (settings.data?.default_capacity as number) ?? 2,
    activity: (activity.data ?? []) as AuditEntry[],
  };
}

export async function fetchAdminTeams(): Promise<AdminTeamRow[]> {
  const db = await admin();
  const { data } = await db
    .from("teams")
    .select(
      "id,team_id,team_name,leader_name,status,allocation_status,selected_at,problem_statements(problem_statement_id,title,domains(name))",
    )
    .order("team_id");
  return (data ?? []).map((row) => {
    const ps = one<{ problem_statement_id: string; title: string; domains: unknown }>(row.problem_statements);
    const psDomain = one<{ name: string }>(ps?.domains);
    return {
      id: row.id as string,
      team_id: row.team_id as string,
      team_name: row.team_name as string,
      leader_name: row.leader_name as string | null,
      status: row.status as string,
      allocation_status: row.allocation_status as string,
      selected_at: row.selected_at as string | null,
      problem_statement_code: ps?.problem_statement_id ?? null,
      problem_statement_title: ps?.title ?? null,
      domain_name: psDomain?.name ?? null,
    };
  });
}

export async function fetchAdminAllocations(): Promise<AdminAllocationRow[]> {
  const db = await admin();
  const [psRes, allocRes] = await Promise.all([
    db
      .from("problem_statements")
      .select(
        "id,problem_statement_id,title,description,full_description,requirements,expected_solution,capacity,allocated_count,remaining_slots,status,domain_id,domains(name)",
      )
      .order("problem_statement_id"),
    db.from("allocations").select("problem_statement_id,selected_at,teams(team_id,team_name)").eq("status", "confirmed"),
  ]);

  return (psRes.data ?? []).map((row) => ({
    id: row.id as string,
    code: row.problem_statement_id as string,
    title: row.title as string,
    domain_name: one<{ name: string }>(row.domains)?.name ?? "—",
    domain_id: row.domain_id as string,
    capacity: row.capacity as number,
    allocated_count: row.allocated_count as number,
    remaining_slots: row.remaining_slots as number,
    status: row.status as string,
    description: (row.description as string) ?? "",
    full_description: (row.full_description as string) ?? "",
    requirements: (row.requirements as string) ?? "",
    expected_solution: (row.expected_solution as string) ?? "",
    teams: (allocRes.data ?? [])
      .filter((a) => a.problem_statement_id === row.id)
      .map((a) => {
        const t = one<{ team_id: string; team_name: string }>(a.teams);
        return {
          team_id: t?.team_id ?? "—",
          team_name: t?.team_name ?? "—",
          selected_at: a.selected_at as string,
        };
      }),
  }));
}

export async function fetchAdminDomains(): Promise<
  {
    id: string;
    name: string;
    description: string | null;
    display_order: number;
    is_active: boolean;
    ps_count: number;
  }[]
> {
  const db = await admin();
  const [domains, ps] = await Promise.all([
    db.from("domains").select("*").order("display_order"),
    db.from("problem_statements").select("domain_id"),
  ]);
  return (domains.data ?? []).map((d) => ({
    id: d.id as string,
    name: d.name as string,
    description: d.description as string | null,
    display_order: d.display_order as number,
    is_active: d.is_active as boolean,
    ps_count: (ps.data ?? []).filter((p) => p.domain_id === d.id).length,
  }));
}

export async function fetchAuditLog(limit: number): Promise<AuditEntry[]> {
  const db = await admin();
  const { data } = await db
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(Math.min(limit, 500));
  return (data ?? []) as AuditEntry[];
}

export async function upsertProblemStatement(input: {
  id?: string | undefined;
  code: string;
  title: string;
  description: string;
  full_description: string;
  requirements: string;
  expected_solution: string;
  domain_id: string;
  capacity: number;
  status: string;
  actor: string;
}): Promise<{ ok: boolean; message?: string }> {
  const db = await admin();
  const payload = {
    problem_statement_id: input.code.trim().toUpperCase(),
    title: input.title.trim(),
    description: input.description,
    full_description: input.full_description,
    requirements: input.requirements,
    expected_solution: input.expected_solution,
    domain_id: input.domain_id,
    capacity: input.capacity,
    status: input.status,
  };

  if (input.id) {
    const { data: existing } = await db
      .from("problem_statements")
      .select("allocated_count,problem_statement_id")
      .eq("id", input.id)
      .maybeSingle();
    if (existing && input.capacity < (existing.allocated_count as number)) {
      return { ok: false, message: "Capacity cannot be lower than the number of existing allocations." };
    }
    const { error } = await db.from("problem_statements").update(payload).eq("id", input.id);
    if (error) return { ok: false, message: error.message };
    await audit({
      event: "admin_edited_problem_statement",
      problem_statement_ref: payload.problem_statement_id,
      actor: input.actor,
    });
    return { ok: true };
  }

  const { error } = await db.from("problem_statements").insert(payload);
  if (error) {
    return {
      ok: false,
      message: /duplicate/i.test(error.message) ? "That Problem Statement ID already exists." : error.message,
    };
  }
  await audit({
    event: "admin_created_problem_statement",
    problem_statement_ref: payload.problem_statement_id,
    actor: input.actor,
  });
  return { ok: true };
}

export async function saveDomain(input: {
  id?: string | undefined;
  name: string;
  description: string;
  display_order: number;
  is_active: boolean;
  actor: string;
}): Promise<{ ok: boolean; message?: string }> {
  const db = await admin();
  const payload = {
    name: input.name.trim(),
    description: input.description,
    display_order: input.display_order,
    is_active: input.is_active,
  };
  const query = input.id
    ? db.from("domains").update(payload).eq("id", input.id)
    : db.from("domains").insert(payload);
  const { error } = await query;
  if (error) {
    return {
      ok: false,
      message: /duplicate/i.test(error.message) ? "A domain with that name already exists." : error.message,
    };
  }
  await audit({
    event: input.id ? "admin_edited_domain" : "admin_created_domain",
    actor: input.actor,
    metadata: { name: payload.name },
  });
  return { ok: true };
}

export async function deleteDomainCore(id: string, actor: string): Promise<{ ok: boolean; message?: string }> {
  const db = await admin();
  const { data: ps } = await db.from("problem_statements").select("id").eq("domain_id", id).limit(1);
  if ((ps ?? []).length > 0) {
    return { ok: false, message: "This domain contains problem statements and cannot be deleted." };
  }
  const { error } = await db.from("domains").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  await audit({ event: "admin_deleted_domain", actor });
  return { ok: true };
}

export async function updateSettingsCore(input: {
  event_name: string;
  selection_status: string;
  max_allocated_teams: number;
  default_capacity: number;
  actor: string;
}): Promise<{ ok: boolean; message?: string }> {
  const db = await admin();
  const { error } = await db
    .from("event_settings")
    .update({
      event_name: input.event_name,
      selection_status: input.selection_status,
      max_allocated_teams: input.max_allocated_teams,
      default_capacity: input.default_capacity,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) return { ok: false, message: error.message };
  await audit({
    event: `admin_set_selection_${input.selection_status}`,
    actor: input.actor,
    metadata: { max_allocated_teams: input.max_allocated_teams },
  });
  return { ok: true };
}

export async function finalizeDisqualificationsCore(actor: string): Promise<{ ok: boolean; count: number }> {
  const db = await admin();
  const { data } = await db
    .from("teams")
    .update({ status: "disqualified" })
    .eq("status", "eligible")
    .eq("allocation_status", "not_allocated")
    .select("team_id");
  await audit({
    event: "admin_finalized_disqualifications",
    actor,
    metadata: { count: (data ?? []).length },
  });
  return { ok: true, count: (data ?? []).length };
}
