import { queryOptions } from "@tanstack/react-query";

import { judgeTeams, judgeWhoami } from "./judge.functions";

/**
 * Mirrors judgeEmail() in judging.server.ts. Duplicated deliberately: that
 * module imports the service-role client and must never reach the browser.
 */
export function judgeEmailFor(username: string): string {
  return `${username.trim().toLowerCase()}@judges.hackverse.local`;
}

export const JUDGE_QUERY_KEYS = [["judge-whoami"], ["judge-teams"]] as const;

export const judgeWhoamiQuery = queryOptions({
  queryKey: ["judge-whoami"],
  queryFn: () => judgeWhoami(),
  staleTime: 60_000,
  retry: false,
});

export const judgeTeamsQuery = queryOptions({
  queryKey: ["judge-teams"],
  queryFn: () => judgeTeams(),
  staleTime: 5_000,
});
