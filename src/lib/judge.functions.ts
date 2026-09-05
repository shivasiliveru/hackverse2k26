import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

import { CRITERION_HARD_MAX } from "./hackverse-types";
import {
  fetchEvaluationSettings,
  fetchJudgeTeamsCore,
  judgeMaxima,
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
    const [teams, settings, maxima] = await Promise.all([
      fetchJudgeTeamsCore(judge.id),
      fetchEvaluationSettings(),
      judgeMaxima(judge.id),
    ]);
    // Override with this judge's own ceilings so the score sheet shows
    // exactly the marks they are allowed to give.
    return { judge, teams, settings: { ...settings, maxima } };
  });

export const submitEvaluation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        teamCode: z.string().trim().min(1).max(40),
        // Sanity bounds only. The per-criterion ceiling is configurable, so
        // the authority is submit_evaluation reading event_settings, backed
        // by the database sanity constraint — never the frontend.
        problem: z.number().min(0).max(CRITERION_HARD_MAX),
        innovation: z.number().min(0).max(CRITERION_HARD_MAX),
        technical: z.number().min(0).max(CRITERION_HARD_MAX),
        presentation: z.number().min(0).max(CRITERION_HARD_MAX),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const judge = await requireJudge(context.userId);
    return submitEvaluationCore(judge.id, data.teamCode, {
      problem: data.problem,
      innovation: data.innovation,
      technical: data.technical,
      presentation: data.presentation,
    });
  });
