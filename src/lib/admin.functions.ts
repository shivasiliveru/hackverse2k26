import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

import {
  allotProblemStatementCore,
  assertAdmin,
  deleteDomainCore,
  fetchAdminAllocations,
  fetchAdminDomains,
  fetchAdminOverview,
  fetchAdminTeams,
  fetchAuditLog,
  finalizeDisqualificationsCore,
  registerAdminCore,
  saveDomain,
  setTeamStatusCore,
  updateSettingsCore,
  upsertProblemStatement,
} from "./hackverse.server";

export const registerAdminAccount = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        email: z.string().trim().email().max(200),
        password: z.string().min(8, "Password must be at least 8 characters").max(200),
        accessCode: z.string().trim().min(4).max(120),
      })
      .parse(data),
  )
  .handler(async ({ data }) => registerAdminCore(data.email, data.password, data.accessCode));

// Never throws for a signed-in non-admin: the admin shell needs to tell
// "not signed in" apart from "signed in without the admin role".
export const adminWhoami = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return {
      email: (context.claims.email as string | undefined) ?? null,
      isAdmin: data === true,
    };
  });

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    return fetchAdminOverview();
  });

export const adminTeams = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    return fetchAdminTeams();
  });

export const adminAllocations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    return fetchAdminAllocations();
  });

export const adminDomains = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    return fetchAdminDomains();
  });

export const adminAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    return fetchAuditLog(300);
  });

export const saveProblemStatement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        code: z
          .string()
          .trim()
          .min(2)
          .max(20)
          .regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers and dashes only"),
        title: z.string().trim().min(3).max(200),
        description: z.string().trim().max(600).default(""),
        full_description: z.string().trim().max(6000).default(""),
        requirements: z.string().trim().max(4000).default(""),
        expected_solution: z.string().trim().max(4000).default(""),
        domain_id: z.string().uuid(),
        capacity: z.number().int().min(0).max(50),
        status: z.enum(["active", "inactive"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    return upsertProblemStatement({ ...data, actor: context.claims.email ?? context.userId });
  });

export const saveDomainRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(2).max(160),
        description: z.string().trim().max(600).default(""),
        display_order: z.number().int().min(0).max(999),
        is_active: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    return saveDomain({ ...data, actor: context.claims.email ?? context.userId });
  });

export const deleteDomainRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    return deleteDomainCore(data.id, context.claims.email ?? context.userId);
  });

export const updateEventSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        event_name: z.string().trim().min(2).max(120),
        selection_status: z.enum(["open", "paused", "closed"]),
        max_allocated_teams: z.number().int().min(0).max(10000),
        default_capacity: z.number().int().min(1).max(50),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    return updateSettingsCore({ ...data, actor: context.claims.email ?? context.userId });
  });

export const finalizeDisqualifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    return finalizeDisqualificationsCore(context.claims.email ?? context.userId);
  });

/* ------------------------------------------------------------- judging */

import {
  adminAddMarksCore,
  adminDeleteEvaluationCore,
  adminUpdateEvaluationCore,
  createJudgeCore,
  fetchEvaluationLogCore,
  fetchEvaluationSettings,
  fetchJudgesCore,
  fetchLeaderboardCore,
  fetchTeamEvaluationsCore,
  freezeLeaderboardCore,
  resetJudgePasswordCore,
  setJudgeStatusCore,
  updateEvaluationSettingsCore,
} from "./judging.server";

export const adminJudges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    return fetchJudgesCore();
  });

export const adminLeaderboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    return fetchLeaderboardCore();
  });

export const adminEvaluations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    return fetchEvaluationLogCore();
  });

export const adminEvaluationSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    return fetchEvaluationSettings();
  });

export const adminTeamEvaluations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ teamCode: z.string().trim().min(1).max(40) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    return fetchTeamEvaluationsCore(data.teamCode);
  });

export const createJudge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        username: z
          .string()
          .trim()
          .min(3)
          .max(40)
          .regex(/^[a-zA-Z0-9._-]+$/, "Use letters, numbers, dots, dashes and underscores only"),
        password: z.string().min(8, "Password must be at least 8 characters").max(200),
        name: z.string().trim().min(2).max(120),
        email: z.string().trim().email().max(200).optional().or(z.literal("")),
        organization: z.string().trim().max(160).optional().or(z.literal("")),
        phone: z.string().trim().max(40).optional().or(z.literal("")),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    return createJudgeCore({
      username: data.username,
      password: data.password,
      name: data.name,
      email: data.email || undefined,
      organization: data.organization || undefined,
      phone: data.phone || undefined,
      actor: context.claims.email ?? context.userId,
    });
  });

export const setJudgeStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ id: z.string().uuid(), status: z.enum(["active", "disabled", "deleted"]) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    return setJudgeStatusCore(data.id, data.status, context.claims.email ?? context.userId);
  });

export const resetJudgePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), password: z.string().min(8).max(200) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    return resetJudgePasswordCore(data.id, data.password, context.claims.email ?? context.userId);
  });

export const updateEvaluationSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        evaluation_status: z.enum(["open", "paused", "closed"]).optional(),
        score_increment: z.union([z.literal(0.5), z.literal(1)]).optional(),
        allow_score_editing: z.boolean().optional(),
        evaluation_start: z.string().nullable().optional(),
        evaluation_end: z.string().nullable().optional(),
        leaderboard_public: z.boolean().optional(),
        ranking_method: z.enum(["total", "average"]).optional(),
        judges_see_others: z.boolean().optional(),
        max_judges: z.number().int().min(1).max(500).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    return updateEvaluationSettingsCore({ ...data, actor: context.claims.email ?? context.userId });
  });

export const freezeLeaderboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ freeze: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    return freezeLeaderboardCore(data.freeze, context.claims.email ?? context.userId);
  });

export const adminUpdateEvaluation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        // Same ceilings the judge form uses; the CHECK constraints per column
        // remain the final authority.
        problem: z.number().min(0).max(2),
        innovation: z.number().min(0).max(3),
        technical: z.number().min(0).max(3),
        presentation: z.number().min(0).max(2),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    return adminUpdateEvaluationCore(
      data.id,
      {
        problem: data.problem,
        innovation: data.innovation,
        technical: data.technical,
        presentation: data.presentation,
      },
      context.claims.email ?? context.userId,
    );
  });

export const adminDeleteEvaluation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    return adminDeleteEvaluationCore(data.id, context.claims.email ?? context.userId);
  });

/** Per-team disqualify / reinstate. Never deletes the allocation record. */
export const setTeamStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        teamCode: z.string().trim().min(1).max(40),
        status: z.enum(["eligible", "disqualified", "inactive"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    return setTeamStatusCore(data.teamCode, data.status, context.claims.email ?? context.userId);
  });

/** Admin override: hand a problem statement to a team directly. */
export const allotProblemStatement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        teamCode: z.string().trim().min(1).max(40),
        psCode: z.string().trim().min(1).max(40),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    return allotProblemStatementCore(
      data.teamCode,
      data.psCode,
      context.claims.email ?? context.userId,
    );
  });

/** Organiser-entered marks for a team, straight from the leaderboard. */
export const adminAddMarks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        teamCode: z.string().trim().min(1).max(40),
        problem: z.number().min(0).max(2),
        innovation: z.number().min(0).max(3),
        technical: z.number().min(0).max(3),
        presentation: z.number().min(0).max(2),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    return adminAddMarksCore(
      data.teamCode,
      {
        problem: data.problem,
        innovation: data.innovation,
        technical: data.technical,
        presentation: data.presentation,
      },
      context.claims.email ?? context.userId,
    );
  });
