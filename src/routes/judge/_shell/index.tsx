import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";

import { EvaluationBanner, JudgeStat } from "@/components/hv/judge-chrome";
import { formatScore } from "@/lib/hackverse-types";
import { judgeTeamsQuery } from "@/lib/judge.queries";
import { formatStamp } from "@/lib/live";

export const Route = createFileRoute("/judge/_shell/")({
  component: JudgeDashboard,
});

function JudgeDashboard() {
  const { data, isPending } = useQuery(judgeTeamsQuery);

  if (isPending || !data) {
    return (
      <p className="hv-mono px-4 py-16 text-center text-xs tracking-widest text-muted-foreground uppercase">
        Loading…
      </p>
    );
  }

  const { judge, teams, settings } = data;
  const evaluated = teams.filter((t) => t.evaluated);
  const remaining = teams.length - evaluated.length;
  const progress = teams.length > 0 ? (evaluated.length / teams.length) * 100 : 0;
  const recent = [...evaluated]
    .sort((a, b) => (b.submitted_at ?? "").localeCompare(a.submitted_at ?? ""))
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <div>
        <p className="hv-label">Judge Evaluation</p>
        <h1 className="font-display mt-2 text-2xl font-black tracking-tighter uppercase sm:text-3xl">
          Welcome, {judge.name}
        </h1>
      </div>

      <EvaluationBanner settings={settings} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <JudgeStat label="Total Teams" value={teams.length} hint="Eligible for judging" />
        <JudgeStat label="Evaluated" value={evaluated.length} hint="By you" tone="primary" />
        <JudgeStat
          label="Remaining"
          value={remaining}
          hint="Still to score"
          tone={remaining > 0 ? "warning" : "success"}
        />
        <JudgeStat
          label="Evaluations Submitted"
          value={evaluated.length}
          hint={evaluated.length ? "Locked" : "None yet"}
        />
      </div>

      <section className="hv-panel">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="font-display text-sm font-extrabold tracking-tight uppercase">
              Your Progress
            </h2>
            <p className="hv-mono mt-1 text-[10px] text-muted-foreground">
              {evaluated.length} / {teams.length} teams evaluated
            </p>
          </div>
          <Link
            to="/judge/teams"
            className="hv-mono inline-flex min-h-11 items-center gap-2 bg-primary px-4 py-2.5 text-[11px] font-bold tracking-widest text-primary-foreground uppercase"
          >
            {remaining > 0 ? "Continue evaluating" : "Review teams"}{" "}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </header>

        <div className="px-4 py-5">
          <div className="flex items-end justify-between gap-4">
            <p className="font-display text-3xl leading-none font-black tabular-nums">
              {evaluated.length}
              <span className="text-muted-foreground"> / {teams.length}</span>
            </p>
            <p className="hv-mono text-[11px] text-muted-foreground">
              {Math.round(progress)}% complete
            </p>
          </div>
          <div className="mt-3 h-2 w-full bg-surface-raised">
            <div
              className="h-full bg-primary transition-[width] duration-500"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
        </div>
      </section>

      {recent.length > 0 ? (
        <section className="hv-panel">
          <header className="border-b border-border px-4 py-3">
            <h2 className="font-display text-sm font-extrabold tracking-tight uppercase">
              Your Recent Evaluations
            </h2>
            <p className="hv-mono mt-1 text-[10px] text-muted-foreground">
              Only your own scores are shown
            </p>
          </header>
          <ul className="divide-y divide-border">
            {recent.map((team) => (
              <li
                key={team.team_uuid}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3"
              >
                <span className="hv-mono text-[11px] font-bold">{team.team_code}</span>
                <span className="min-w-0 flex-1 truncate text-xs">{team.team_name}</span>
                <span className="hv-mono text-[10px] text-muted-foreground">
                  {formatStamp(team.submitted_at)}
                </span>
                <span className="hv-mono border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                  {formatScore(team.my_score ?? 0)}/10
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
