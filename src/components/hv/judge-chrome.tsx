import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Lock, X } from "lucide-react";

import type { CriterionScores, EvaluationSettings, JudgeTeamRow } from "@/lib/hackverse-types";
import {
  BLANK_CRITERIA,
  SCORE_CRITERIA,
  criteriaTotal,
  formatScore,
  scoreOptions,
} from "@/lib/hackverse-types";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------- stats */

export function JudgeStat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "primary" | "success" | "warning";
}) {
  return (
    <div className="hv-panel px-4 py-3.5">
      <p className="hv-label">{label}</p>
      <p
        className={cn(
          "font-display mt-1.5 text-2xl leading-none font-black tabular-nums sm:text-3xl",
          tone === "primary" && "text-primary",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning",
        )}
      >
        {value}
      </p>
      {hint ? <p className="hv-mono mt-1.5 text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/* --------------------------------------------------------- countdown */

/** §29 — display only. The deadline is enforced again in the RPC. */
export function useCountdown(deadline: string | null): string | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadline]);

  if (!deadline) return null;
  const remaining = new Date(deadline).getTime() - now;
  if (remaining <= 0) return "00:00:00";

  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, "0")).join(":");
}

export function EvaluationBanner({ settings }: { settings: EvaluationSettings }) {
  const countdown = useCountdown(settings.evaluation_end);

  if (settings.evaluation_status === "paused") {
    return (
      <p className="hv-mono border-l-2 border-warning bg-warning/10 px-4 py-3 text-[11px] text-warning">
        Evaluation is temporarily paused by the organizers.
      </p>
    );
  }
  if (settings.evaluation_status === "closed") {
    return (
      <p className="hv-mono border-l-2 border-destructive bg-destructive/10 px-4 py-3 text-[11px] text-destructive">
        Evaluation is closed. You can review your submitted scores but cannot submit new ones.
      </p>
    );
  }
  if (countdown) {
    return (
      <p className="hv-mono border-l-2 border-primary bg-primary/10 px-4 py-3 text-[11px] text-primary">
        Evaluation closes in <span className="font-bold tabular-nums">{countdown}</span>
      </p>
    );
  }
  return null;
}

/* ----------------------------------------------------- score selector */

export function CriterionRow({
  label,
  max,
  value,
  onChange,
  increment,
  disabled,
}: {
  label: string;
  max: number;
  value: number;
  onChange: (value: number) => void;
  increment: number;
  disabled?: boolean | undefined;
}) {
  const options = useMemo(() => scoreOptions(increment, max), [increment, max]);

  return (
    <div className="border border-border-strong px-3 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold">{label}</span>
        <span className="hv-mono shrink-0 text-sm font-bold tabular-nums">
          {formatScore(value)}
          <span className="text-muted-foreground"> / {max}</span>
        </span>
      </div>

      {/* Large tap targets: judges score from phones and tablets (§31). */}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option)}
            className={cn(
              "hv-mono min-h-11 min-w-11 flex-1 border px-1 py-2 text-sm font-bold tabular-nums transition-colors disabled:opacity-40",
              option === value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border-strong bg-surface hover:bg-surface-raised",
            )}
          >
            {formatScore(option)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ScoreSheet({
  scores,
  onChange,
  increment,
  disabled,
}: {
  scores: CriterionScores;
  onChange: (scores: CriterionScores) => void;
  increment: number;
  disabled?: boolean | undefined;
}) {
  const total = criteriaTotal(scores);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="hv-label">Marking criteria</span>
        <span className="font-display text-3xl leading-none font-black tabular-nums">
          {formatScore(total)}
          <span className="text-muted-foreground"> / 10</span>
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {SCORE_CRITERIA.map((criterion) => (
          <CriterionRow
            key={criterion.key}
            label={criterion.label}
            max={criterion.max}
            increment={increment}
            disabled={disabled}
            value={scores[criterion.key]}
            onChange={(value) => onChange({ ...scores, [criterion.key]: value })}
          />
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------- evaluate UI */

export function EvaluateDialog({
  team,
  settings,
  onClose,
  onSubmit,
  pending,
  error,
}: {
  team: JudgeTeamRow;
  settings: EvaluationSettings;
  onClose: () => void;
  onSubmit: (scores: CriterionScores) => void;
  pending: boolean;
  error: string | null;
}) {
  const [scores, setScores] = useState<CriterionScores>(team.my_criteria ?? BLANK_CRITERIA);
  const [touched, setTouched] = useState(team.evaluated);
  const [confirming, setConfirming] = useState(false);

  const total = criteriaTotal(scores);
  const locked = team.evaluated && !settings.allow_score_editing;
  const windowOpen = settings.evaluation_status === "open";
  // Requiring a deliberate touch stops an accidental straight-zero submission.
  const canSubmit = !locked && windowOpen && touched && !pending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/85 p-4 backdrop-blur-sm sm:p-8"
      onClick={onClose}
    >
      <div
        className="hv-panel w-full max-w-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Evaluate ${team.team_name}`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="hv-mono text-[11px] font-bold tracking-widest text-primary">
              {team.team_code}
            </p>
            <h2 className="font-display mt-1.5 text-xl font-black tracking-tight uppercase">
              {team.team_name}
            </h2>
            {team.ps_code ? (
              <p className="mt-2 text-xs text-muted-foreground">
                <span className="hv-mono font-bold text-foreground">{team.ps_code}</span>
                <span className="ml-2">{team.ps_title}</span>
              </p>
            ) : (
              <p className="hv-mono mt-2 text-[11px] text-muted-foreground">
                No problem statement selected
              </p>
            )}
            {team.domain_name ? (
              <p className="hv-mono mt-1 text-[10px] text-muted-foreground">{team.domain_name}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="px-5 py-5">
          {locked ? (
            <div className="flex items-center gap-3 border border-border-strong bg-surface-raised px-4 py-4">
              <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="hv-mono text-[11px] font-bold tracking-widest uppercase">
                  Evaluation locked
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  You scored this team {formatScore(team.my_score ?? 0)} / 10. Scores cannot be
                  changed once submitted.
                </p>
              </div>
            </div>
          ) : (
            <ScoreSheet
              scores={scores}
              onChange={(next) => {
                setScores(next);
                setTouched(true);
                setConfirming(false);
              }}
              increment={settings.score_increment}
              disabled={!windowOpen || pending}
            />
          )}

          {!windowOpen && !locked ? (
            <p className="hv-mono mt-4 border-l-2 border-warning bg-warning/10 px-3 py-2.5 text-[11px] text-warning">
              {settings.evaluation_status === "paused"
                ? "Evaluation is temporarily paused by the organizers."
                : "Evaluation is closed. No further scores can be submitted."}
            </p>
          ) : null}

          {error ? (
            <p className="hv-mono mt-4 flex items-start gap-2 border-l-2 border-destructive bg-destructive/10 px-3 py-2.5 text-[11px] text-destructive">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          ) : null}

          {confirming ? (
            <p className="hv-mono mt-4 border-l-2 border-primary bg-primary/10 px-3 py-2.5 text-[11px]">
              You are about to give <span className="font-bold">{team.team_name}</span> a score of{" "}
              <span className="font-bold">{formatScore(total)}/10</span>.
              {team.evaluated
                ? " This replaces your previous score."
                : " This cannot be changed afterwards."}
            </p>
          ) : null}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="hv-mono min-h-11 border border-border-strong px-5 py-2.5 text-[11px] font-bold tracking-widest uppercase transition-colors hover:bg-accent"
          >
            {locked ? "Close" : "Cancel"}
          </button>
          {locked ? null : confirming ? (
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => onSubmit(scores)}
              className="hv-mono inline-flex min-h-11 items-center justify-center gap-2 bg-primary px-5 py-2.5 text-[11px] font-bold tracking-widest text-primary-foreground uppercase disabled:opacity-50"
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              Confirm &amp; submit
            </button>
          ) : (
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => setConfirming(true)}
              className="hv-mono min-h-11 bg-primary px-5 py-2.5 text-[11px] font-bold tracking-widest text-primary-foreground uppercase disabled:opacity-50"
            >
              Submit evaluation
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
