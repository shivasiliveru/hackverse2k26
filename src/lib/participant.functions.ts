import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { allocateCore, fetchPublicState, verifyTeamCore } from "./hackverse.server";

export const getPublicState = createServerFn({ method: "GET" }).handler(async () => fetchPublicState());

export const verifyTeam = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        teamName: z.string().trim().min(1, "Team name is required").max(120),
        teamId: z.string().trim().min(2, "Team ID is required").max(40),
      })
      .parse(data),
  )
  .handler(async ({ data }) => verifyTeamCore(data.teamName, data.teamId));

export const confirmAllocation = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        teamId: z.string().trim().min(2).max(40),
        problemStatementId: z.string().trim().min(2).max(40),
      })
      .parse(data),
  )
  .handler(async ({ data }) => allocateCore(data.teamId, data.problemStatementId));

/**
 * §35 — public standings. Returns enabled:false unless the admin has switched
 * it on, and never carries judge identities or individual scores.
 */
export const getPublicLeaderboard = createServerFn({ method: "GET" }).handler(async () => {
  const { fetchPublicLeaderboardCore } = await import("./judging.server");
  return fetchPublicLeaderboardCore();
});
