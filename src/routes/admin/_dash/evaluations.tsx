import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";

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
import { adminEvaluationsQuery, adminJudgesQuery } from "@/lib/admin.queries";
import { formatScore } from "@/lib/hackverse-types";
import { downloadFile, formatStamp, toCsv } from "@/lib/live";

export const Route = createFileRoute("/admin/_dash/evaluations")({
  component: AdminEvaluations,
});

function AdminEvaluations() {
  const { data, isPending } = useQuery(adminEvaluationsQuery);
  const judges = useQuery(adminJudgesQuery);

  const [search, setSearch] = useState("");
  const [judge, setJudge] = useState("all");

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
      ["Judge", "Team ID", "Team Name", "Problem Statement", "Score", "Submitted At"],
      rows.map((r) => [
        r.judge_name,
        r.team_code,
        r.team_name,
        r.ps_code ?? "",
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
                  {["Submitted", "Judge", "Team ID", "Team", "PS ID", "Score"].map((heading) => (
                    <th key={heading} className="hv-label px-4 py-2.5 whitespace-nowrap">
                      {heading}
                    </th>
                  ))}
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataPanel>
    </div>
  );
}
