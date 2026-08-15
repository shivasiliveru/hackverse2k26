import { queryOptions } from "@tanstack/react-query";

import {
  adminAllocations,
  adminAuditLog,
  adminDomains,
  adminOverview,
  adminEvaluations,
  adminEvaluationSettings,
  adminJudges,
  adminLeaderboard,
  adminTeams,
  adminWhoami,
} from "./admin.functions";

/**
 * Admin data is fetched client-side, never in a route loader: the Supabase
 * session lives in localStorage, so the bearer token only exists in the
 * browser. Every key here is invalidated by the realtime subscription in the
 * admin layout, which is what makes the dashboard track the live event.
 */

export const ADMIN_QUERY_KEYS = [
  ["admin-overview"],
  ["admin-allocations"],
  ["admin-teams"],
  ["admin-domains"],
  ["admin-audit"],
  ["admin-judges"],
  ["admin-leaderboard"],
  ["admin-evaluations"],
  ["admin-eval-settings"],
] as const;

export const adminWhoamiQuery = queryOptions({
  queryKey: ["admin-whoami"],
  queryFn: () => adminWhoami(),
  staleTime: 60_000,
  retry: false,
});

export const adminOverviewQuery = queryOptions({
  queryKey: ["admin-overview"],
  queryFn: () => adminOverview(),
  staleTime: 5_000,
});

export const adminAllocationsQuery = queryOptions({
  queryKey: ["admin-allocations"],
  queryFn: () => adminAllocations(),
  staleTime: 5_000,
});

export const adminTeamsQuery = queryOptions({
  queryKey: ["admin-teams"],
  queryFn: () => adminTeams(),
  staleTime: 5_000,
});

export const adminDomainsQuery = queryOptions({
  queryKey: ["admin-domains"],
  queryFn: () => adminDomains(),
  staleTime: 5_000,
});

export const adminAuditQuery = queryOptions({
  queryKey: ["admin-audit"],
  queryFn: () => adminAuditLog(),
  staleTime: 5_000,
});

/* ------------------------------------------------------------- judging */

export const adminJudgesQuery = queryOptions({
  queryKey: ["admin-judges"],
  queryFn: () => adminJudges(),
  staleTime: 5_000,
});

export const adminLeaderboardQuery = queryOptions({
  queryKey: ["admin-leaderboard"],
  queryFn: () => adminLeaderboard(),
  staleTime: 2_000,
});

export const adminEvaluationsQuery = queryOptions({
  queryKey: ["admin-evaluations"],
  queryFn: () => adminEvaluations(),
  staleTime: 5_000,
});

export const adminEvaluationSettingsQuery = queryOptions({
  queryKey: ["admin-eval-settings"],
  queryFn: () => adminEvaluationSettings(),
  staleTime: 5_000,
});
