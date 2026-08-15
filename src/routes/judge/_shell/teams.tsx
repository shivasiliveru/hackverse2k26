import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";

import { EvaluateDialog, EvaluationBanner } from "@/components/hv/judge-chrome";
import { formatScore } from "@/lib/hackverse-types";
import type { JudgeTeamRow } from "@/lib/hackverse-types";
import { submitEvaluation } from "@/lib/judge.functions";
import { judgeTeamsQuery } from "@/lib/judge.queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/judge/_shell/teams")({
  component: JudgeTeams,
});

type Filter = "all" | "not_evaluated" | "evaluated";

function JudgeTeams() {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery(judgeTeamsQuery);
  const runSubmit = useServerFn(submitEvaluation);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [active, setActive] = useState<JudgeTeamRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const teams = useMemo(() => data?.teams ?? [], [data]);

  const counts = useMemo(
    () => ({
      all: teams.length,
      evaluated: teams.filter((t) => t.evaluated).length,
      not_evaluated: teams.filter((t) => !t.evaluated).length,
    }),
    [teams],
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return teams.filter((team) => {
      if (filter === "evaluated" && !team.evaluated) return false;
      if (filter === "not_evaluated" && team.evaluated) return false;
      if (!term) return true;
      // §10: partial or exact, on team name or team ID.
      return `${team.team_code} ${team.team_name} ${team.ps_code ?? ""} ${team.ps_title ?? ""}`
        .toLowerCase()
        .includes(term);
    });
  }, [teams, search, filter]);

  const submit = useMutation({
    mutationFn: (input: { teamCode: string; score: number }) => runSubmit({ data: input }),
    onSuccess: async (result) => {
      if (!result.ok) {
        setError(result.message ?? "Could not submit this evaluation.");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["judge-teams"] });
      toast.success(`Evaluation submitted — ${formatScore(result.score ?? 0)}/10`);
      setActive(null);
      setError(null);
    },
    onError: () => setError("Could not submit this evaluation. Please try again."),
  });

  if (isPending || !data) {
    return (
      <p className="hv-mono px-4 py-16 text-center text-xs tracking-widest text-muted-foreground uppercase">
        Loading teams…
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="hv-label">Evaluation</p>
        <h1 className="font-display mt-2 text-2xl font-black tracking-tighter uppercase sm:text-3xl">
          Teams
        </h1>
      </div>

      <EvaluationBanner settings={data.settings} />

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search Team Name or Team ID..."
          className="hv-mono min-h-12 w-full border border-input bg-background py-3 pr-3 pl-10 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-primary"
        />
      </div>

      <div className="flex flex-wrap gap-px bg-border">
        {(
          [
            { value: "all", label: "All Teams", count: counts.all },
            { value: "not_evaluated", label: "Not Evaluated", count: counts.not_evaluated },
            { value: "evaluated", label: "Evaluated", count: counts.evaluated },
          ] as const
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value)}
            className={cn(
              "hv-mono min-h-11 flex-1 px-3 py-2.5 text-[10px] font-bold tracking-widest uppercase transition-colors",
              option.value === filter
                ? "bg-primary text-primary-foreground"
                : "bg-surface text-muted-foreground hover:bg-surface-raised hover:text-foreground",
            )}
          >
            {option.label}
            <span className={cn("ml-1.5", option.value !== filter && "text-muted-foreground/70")}>
              {option.count}
            </span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="hv-mono px-4 py-12 text-center text-xs tracking-wide text-muted-foreground">
          {teams.length === 0
            ? "No teams are available for judging yet."
            : "No teams match your search."}
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((team) => (
            <li key={team.team_uuid} className="hv-panel">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="hv-mono text-[11px] font-bold text-primary">
                      {team.team_code}
                    </span>
                    {team.ps_code ? (
                      <span className="hv-mono border border-border-strong px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                        {team.ps_code}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 truncate text-sm font-semibold">{team.team_name}</p>
                  {team.ps_title ? (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{team.ps_title}</p>
                  ) : null}
                </div>

                <div className="flex items-center gap-3">
                  {team.evaluated ? (
                    <span className="hv-mono border border-success/50 bg-success/10 px-2.5 py-1 text-[11px] font-bold text-success">
                      {formatScore(team.my_score ?? 0)}/10
                    </span>
                  ) : (
                    <span className="hv-mono border border-border-strong px-2.5 py-1 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                      Not evaluated
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setActive(team);
                    }}
                    className={cn(
                      "hv-mono min-h-11 px-4 py-2.5 text-[11px] font-bold tracking-widest uppercase transition-colors",
                      team.evaluated
                        ? "border border-border-strong hover:bg-accent"
                        : "bg-primary text-primary-foreground hover:bg-primary/90",
                    )}
                  >
                    {team.evaluated ? "View" : "Evaluate"}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {active ? (
        <EvaluateDialog
          team={active}
          settings={data.settings}
          pending={submit.isPending}
          error={error}
          onClose={() => {
            setActive(null);
            setError(null);
          }}
          onSubmit={(score) => submit.mutate({ teamCode: active.team_code, score })}
        />
      ) : null}
    </div>
  );
}
