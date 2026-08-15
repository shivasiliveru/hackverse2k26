import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

import {
  fetchEvaluationSettings,
  fetchJudgeTeamsCore,
  judgeWhoamiCore,
  requireJudge,
  submitEvaluationCore,
} from "./judging.server";

/**
 * Never throws for a signed-in non-judge: the judge shell needs to tell
 * "not signed in" apart from "signed in without a judge account".
 */
export const judgeWhoami = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    judgeWhoamiCore(context.userId, (context.claims.email as string | undefined) ?? null),
  );

export const judgeTeams = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const judge = await requireJudge(context.userId);
    const [teams, settings] = await Promise.all([
      fetchJudgeTeamsCore(judge.id),
      fetchEvaluationSettings(),
    ]);
    return { judge, teams, settings };
  });

export const submitEvaluation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        teamCode: z.string().trim().min(1).max(40),
        // Backend range guard. The RPC and a table CHECK enforce it again —
        // §2 requires this never rely on the frontend alone.
        score: z.number().min(0).max(10),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const judge = await requireJudge(context.userId);
    return submitEvaluationCore(judge.id, data.teamCode, data.score);
  });
