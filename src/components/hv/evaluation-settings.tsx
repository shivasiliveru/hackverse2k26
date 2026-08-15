import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { ActionButton, AdminLoading, DataPanel, Pill } from "./admin-chrome";
import { adminEvaluationSettingsQuery } from "@/lib/admin.queries";
import { updateEvaluationSettings } from "@/lib/admin.functions";
import type { EvaluationStatus, RankingMethod } from "@/lib/hackverse-types";
import { cn } from "@/lib/utils";

const STATUS_COPY: Record<EvaluationStatus, string> = {
  open: "Judges can browse teams and submit scores.",
  paused: "Judges can sign in and review, but cannot submit new scores.",
  closed: "Judges can view their submitted evaluations only.",
};

/** Datetime-local needs "YYYY-MM-DDTHH:mm" in local time, not an ISO string. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function EvaluationSettingsPanels() {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery(adminEvaluationSettingsQuery);
  const runUpdate = useServerFn(updateEvaluationSettings);

  const [status, setStatus] = useState<EvaluationStatus>("closed");
  const [increment, setIncrement] = useState<0.5 | 1>(0.5);
  const [allowEditing, setAllowEditing] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [ranking, setRanking] = useState<RankingMethod>("total");
  const [publicBoard, setPublicBoard] = useState(false);
  const [seeOthers, setSeeOthers] = useState(false);
  const [maxJudges, setMaxJudges] = useState("");

  useEffect(() => {
    if (!data) return;
    setStatus(data.evaluation_status);
    setIncrement(data.score_increment === 1 ? 1 : 0.5);
    setAllowEditing(data.allow_score_editing);
    setStart(toLocalInput(data.evaluation_start));
    setEnd(toLocalInput(data.evaluation_end));
    setRanking(data.ranking_method);
    setPublicBoard(data.leaderboard_public);
    setSeeOthers(data.judges_see_others);
    setMaxJudges(data.max_judges === null ? "" : String(data.max_judges));
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      runUpdate({
        data: {
          evaluation_status: status,
          score_increment: increment,
          allow_score_editing: allowEditing,
          evaluation_start: start ? new Date(start).toISOString() : null,
          evaluation_end: end ? new Date(end).toISOString() : null,
          ranking_method: ranking,
          leaderboard_public: publicBoard,
          judges_see_others: seeOthers,
          max_judges: maxJudges.trim() === "" ? null : Number(maxJudges),
        },
      }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.message ?? "Could not save evaluation settings.");
        return;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-eval-settings"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-leaderboard"] }),
      ]);
      toast.success("Evaluation settings saved");
    },
    onError: () => toast.error("Could not save evaluation settings."),
  });

  if (isPending || !data) return <AdminLoading label="Loading evaluation settings" />;

  return (
    <>
      <DataPanel
        title="Evaluation Settings"
        hint="Controls the judge portal — enforced by the backend, not just the UI"
        right={
          <Pill
            label={data.evaluation_status}
            tone={
              data.evaluation_status === "open"
                ? "success"
                : data.evaluation_status === "paused"
                  ? "warning"
                  : "danger"
            }
          />
        }
      >
        <div className="grid gap-px bg-border sm:grid-cols-3">
          {(["open", "paused", "closed"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setStatus(option)}
              className={cn(
                "bg-surface px-4 py-4 text-left transition-colors hover:bg-surface-raised",
                status === option && "bg-surface-raised",
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-3 w-3 border",
                    status === option
                      ? option === "open"
                        ? "border-success bg-success"
                        : option === "paused"
                          ? "border-warning bg-warning"
                          : "border-destructive bg-destructive"
                      : "border-border-strong",
                  )}
                />
                <span className="hv-mono text-[11px] font-bold tracking-widest uppercase">
                  {option}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{STATUS_COPY[option]}</p>
            </button>
          ))}
        </div>

        <div className="grid gap-4 px-4 py-4 sm:grid-cols-2">
          <label className="block">
            <span className="hv-label mb-2 block">Score increment</span>
            <select
              value={increment}
              onChange={(e) => setIncrement(Number(e.target.value) === 1 ? 1 : 0.5)}
              className="w-full border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            >
              <option value={0.5}>Half points — 0, 0.5, 1 … 10</option>
              <option value={1}>Whole numbers — 0, 1, 2 … 10</option>
            </select>
          </label>

          <label className="block">
            <span className="hv-label mb-2 block">Maximum judges (blank = unlimited)</span>
            <input
              type="number"
              value={maxJudges}
              onChange={(e) => setMaxJudges(e.target.value)}
              min={1}
              max={500}
              placeholder="Unlimited"
              className="hv-mono w-full border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </label>

          <label className="block">
            <span className="hv-label mb-2 block">Evaluation start (optional)</span>
            <input
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="hv-mono w-full border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </label>

          <label className="block">
            <span className="hv-label mb-2 block">Evaluation end (optional)</span>
            <input
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="hv-mono w-full border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
            <span className="hv-mono mt-1.5 block text-[10px] text-muted-foreground">
              Outside this window the backend refuses submissions
            </span>
          </label>

          <Toggle
            label="Allow score editing"
            hint="Off by default — a submitted score is locked (§15)"
            value={allowEditing}
            onChange={setAllowEditing}
          />
          <Toggle
            label="Judges can see other judges' scores"
            hint="Off by default — each judge sees only their own"
            value={seeOthers}
            onChange={setSeeOthers}
          />
        </div>
      </DataPanel>

      <DataPanel title="Leaderboard Settings" hint="Ranking method and public visibility">
        <div className="grid gap-4 px-4 py-4 sm:grid-cols-2">
          <label className="block">
            <span className="hv-label mb-2 block">Official ranking method</span>
            <select
              value={ranking}
              onChange={(e) => setRanking(e.target.value as RankingMethod)}
              className="w-full border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            >
              <option value="total">Total score — sum of all judges (default)</option>
              <option value="average">Average score across judges</option>
            </select>
            <span className="hv-mono mt-1.5 block text-[10px] text-muted-foreground">
              Ties break on average, then judge count, then who got there first
            </span>
          </label>

          <Toggle
            label="Enable public leaderboard"
            hint="Publishes /leaderboard with ranks and totals only — no judge names or individual scores"
            value={publicBoard}
            onChange={setPublicBoard}
          />
        </div>

        <footer className="flex justify-end border-t border-border px-4 py-3">
          <ActionButton onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save evaluation settings
          </ActionButton>
        </footer>
      </DataPanel>
    </>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex items-start gap-3 border border-border-strong px-3 py-3 text-left transition-colors hover:bg-surface-raised"
    >
      <span
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border",
          value ? "border-primary bg-primary" : "border-border-strong",
        )}
      >
        {value ? <span className="h-1.5 w-1.5 bg-primary-foreground" /> : null}
      </span>
      <span className="min-w-0">
        <span className="hv-mono block text-[11px] font-bold tracking-widest uppercase">
          {label}
        </span>
        <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}
