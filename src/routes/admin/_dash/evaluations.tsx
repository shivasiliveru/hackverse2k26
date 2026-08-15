import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AlertTriangle, Download, Loader2, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  ActionButton,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  DataPanel,
  SearchField,
  SelectField,
  Toolbar,
} from "@/components/hv/admin-chrome";
import { LiveDot, Metric } from "@/components/hv/chrome";
import { ScoreSheet } from "@/components/hv/judge-chrome";
import {
  adminEvaluationSettingsQuery,
  adminEvaluationsQuery,
  adminJudgesQuery,
} from "@/lib/admin.queries";
import { adminDeleteEvaluation, adminUpdateEvaluation } from "@/lib/admin.functions";
import { criteriaTotal, formatScore } from "@/lib/hackverse-types";
import type { CriterionScores, EvaluationLogRow } from "@/lib/hackverse-types";
import { downloadFile, formatStamp, toCsv } from "@/lib/live";

export const Route = createFileRoute("/admin/_dash/evaluations")({
  component: AdminEvaluations,
});

function AdminEvaluations() {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery(adminEvaluationsQuery);
  const judges = useQuery(adminJudgesQuery);
  const settings = useQuery(adminEvaluationSettingsQuery);
  const runUpdate = useServerFn(adminUpdateEvaluation);
  const runDelete = useServerFn(adminDeleteEvaluation);

  const [search, setSearch] = useState("");
  const [judge, setJudge] = useState("all");
  const [editing, setEditing] = useState<EvaluationLogRow | null>(null);
  const [scores, setScores] = useState<CriterionScores | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<EvaluationLogRow | null>(null);

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-evaluations"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-leaderboard"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-judges"] }),
    ]);
  }

  const update = useMutation({
    mutationFn: (input: { id: string } & CriterionScores) => runUpdate({ data: input }),
    onSuccess: async (result) => {
      if (!result.ok) {
        setError(result.message ?? "Could not update these marks.");
        return;
      }
      await refresh();
      toast.success(`Marks updated \u2014 ${formatScore(result.score ?? 0)}/10`);
      setEditing(null);
      setError(null);
    },
    onError: () => setError("Could not update these marks. Please try again."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => runDelete({ data: { id } }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.message ?? "Could not delete this evaluation.");
        return;
      }
      await refresh();
      setConfirmDelete(null);
      toast.success("Evaluation deleted");
    },
    onError: () => toast.error("Could not delete this evaluation."),
  });

  const rows = useMemo(() => data ?? [], [data]);

  const judgeOptions = useMemo(
    () => [
      { value: "all", label: "All judges" },
      ...(judges.data ?? [])
        .filter((j) => j.status !== "deleted" || j.evaluations > 0)
        .map((j) => ({ value: j.id, label: j.name })),
    ],
    [judges.data],
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (judge !== "all" && row.judge_id !== judge) return false;
      if (!term) return true;
      return `${row.team_code} ${row.team_name} ${row.ps_code ?? ""} ${row.judge_name} ${row.judge_username}`
        .toLowerCase()
        .includes(term);
    });
  }, [rows, search, judge]);

  const stats = useMemo(() => {
    const scores = rows.map((r) => r.score);
    return {
      total: rows.length,
      judges: new Set(rows.map((r) => r.judge_id)).size,
      teams: new Set(rows.map((r) => r.team_code)).size,
      average: scores.length
        ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2))
        : 0,
    };
  }, [rows]);

  function exportEvaluations() {
    const csv = toCsv(
      [
        "Judge",
        "Team ID",
        "Team Name",
        "Problem Statement",
        "Problem Understanding (2)",
        "Innovation (3)",
        "Technical (3)",
        "Presentation (2)",
        "Total Score",
        "Submitted At",
      ],
      rows.map((r) => [
        r.judge_name,
        r.team_code,
        r.team_name,
        r.ps_code ?? "",
        formatScore(r.criteria.problem),
        formatScore(r.criteria.innovation),
        formatScore(r.criteria.technical),
        formatScore(r.criteria.presentation),
        formatScore(r.score),
        r.submitted_at,
      ]),
    );
    downloadFile("hackverse-evaluation-report.csv", csv);
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Evaluations"
        subtitle="Judge activity log"
        right={
          <>
            <LiveDot />
            <ActionButton
              variant="outline"
              onClick={exportEvaluations}
              disabled={rows.length === 0}
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </ActionButton>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Evaluations" value={stats.total} hint="Submitted" tone="primary" />
        <Metric label="Judges Active" value={stats.judges} hint="Have scored" />
        <Metric label="Teams Scored" value={stats.teams} hint="At least once" />
        <Metric label="Average Score" value={stats.average.toFixed(2)} hint="of 10" />
      </div>

      <DataPanel
        title="Evaluation Log"
        hint={`${visible.length} of ${rows.length} shown — newest first`}
      >
        <Toolbar>
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Search team, PS ID or judge…"
          />
          <SelectField value={judge} onChange={setJudge} options={judgeOptions} label="Judge" />
        </Toolbar>

        {isPending ? (
          <AdminLoading />
        ) : visible.length === 0 ? (
          <AdminEmpty>
            {rows.length === 0
              ? "No evaluations have been submitted yet."
              : "No evaluations match these filters."}
          </AdminEmpty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border">
                  {["Submitted", "Judge", "Team ID", "Team", "PS ID", "Score", ""].map(
                    (heading, index) => (
                      <th key={index} className="hv-label px-4 py-2.5 whitespace-nowrap">
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border last:border-b-0 hover:bg-surface-raised"
                  >
                    <td className="hv-mono px-4 py-3 text-[11px] whitespace-nowrap text-muted-foreground">
                      {formatStamp(row.submitted_at)}
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {row.judge_name}
                      <span className="hv-mono ml-2 text-[10px] text-muted-foreground">
                        {row.judge_username}
                      </span>
                    </td>
                    <td className="hv-mono px-4 py-3 text-xs font-bold whitespace-nowrap">
                      {row.team_code}
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-xs">{row.team_name}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {row.ps_code ? (
                        <span className="hv-mono border border-border-strong px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                          {row.ps_code}
                        </span>
                      ) : (
                        <span className="hv-mono text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="hv-mono border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                        {formatScore(row.score)}/10
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setError(null);
                            setScores(row.criteria);
                            setEditing(row);
                          }}
                          className="hv-mono inline-flex items-center gap-1.5 border border-border-strong px-2.5 py-1.5 text-[10px] font-bold tracking-widest uppercase transition-colors hover:bg-accent"
                        >
                          <Pencil className="h-3 w-3" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(row)}
                          aria-label="Delete evaluation"
                          className="hv-mono inline-flex items-center border border-destructive/60 px-2.5 py-1.5 text-[10px] font-bold tracking-widest text-destructive uppercase transition-colors hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataPanel>

      {/* ------------------------------------------------------ edit marks */}
      {editing && scores ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm sm:p-8"
          onClick={() => setEditing(null)}
        >
          <div
            className="hv-panel w-full max-w-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <p className="hv-label">Edit marks</p>
                <h2 className="font-display mt-1.5 text-xl font-black tracking-tight uppercase">
                  {editing.team_name}
                </h2>
                <p className="hv-mono mt-1.5 text-[11px] text-muted-foreground">
                  {editing.team_code} &middot; scored by {editing.judge_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                aria-label="Close"
                className="shrink-0 p-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="px-5 py-4">
              <ScoreSheet
                scores={scores}
                onChange={setScores}
                increment={settings.data?.score_increment ?? 0.5}
                disabled={update.isPending}
              />

              <p className="hv-mono mt-4 border-l-2 border-warning bg-warning/10 px-3 py-2.5 text-[11px] text-warning">
                Editing a judge&apos;s marks is recorded in the audit log with the previous and new
                totals, and updates the leaderboard immediately.
              </p>

              {error ? (
                <p className="hv-mono mt-3 flex items-start gap-2 border-l-2 border-destructive bg-destructive/10 px-3 py-2.5 text-[11px] text-destructive">
                  <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                  {error}
                </p>
              ) : null}
            </div>

            <footer className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <ActionButton variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </ActionButton>
              <ActionButton
                disabled={update.isPending}
                onClick={() => update.mutate({ id: editing.id, ...scores })}
              >
                {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Save marks ({formatScore(criteriaTotal(scores))}/10)
              </ActionButton>
            </footer>
          </div>
        </div>
      ) : null}

      {/* --------------------------------------------------------- delete */}
      {confirmDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-4 backdrop-blur-sm">
          <div className="hv-panel w-full max-w-md" role="dialog" aria-modal="true">
            <header className="border-b border-border px-5 py-4">
              <p className="hv-label text-destructive">Confirm</p>
              <h2 className="font-display mt-1.5 text-xl font-black tracking-tight uppercase">
                Delete this evaluation?
              </h2>
            </header>
            <div className="px-5 py-4">
              <p className="text-sm text-muted-foreground">
                {confirmDelete.judge_name}&apos;s score of{" "}
                <span className="text-foreground">{formatScore(confirmDelete.score)}/10</span> for{" "}
                <span className="text-foreground">{confirmDelete.team_name}</span> will be removed
                and the team&apos;s total recalculated. That judge will be able to evaluate this
                team again.
              </p>
            </div>
            <footer className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <ActionButton variant="outline" onClick={() => setConfirmDelete(null)}>
                Cancel
              </ActionButton>
              <ActionButton
                variant="danger"
                disabled={remove.isPending}
                onClick={() => remove.mutate(confirmDelete.id)}
              >
                {remove.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Delete evaluation
              </ActionButton>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
