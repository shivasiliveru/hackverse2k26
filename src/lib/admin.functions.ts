import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

import {
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
