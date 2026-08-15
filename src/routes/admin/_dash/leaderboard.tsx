import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Download, Loader2, Lock, LockOpen, Trophy, X } from "lucide-react";
import { toast } from "sonner";

import {
  ActionButton,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  DataPanel,
  FilterTabs,
  Pill,
  SearchField,
  SelectField,
  Toolbar,
} from "@/components/hv/admin-chrome";
import { LiveDot, Metric } from "@/components/hv/chrome";
import { adminLeaderboardQuery } from "@/lib/admin.queries";
import { adminTeamEvaluations, freezeLeaderboard } from "@/lib/admin.functions";
import { formatScore } from "@/lib/hackverse-types";
import type { EvaluationLogRow, LeaderboardRow } from "@/lib/hackverse-types";
import { downloadFile, formatStamp, toCsv } from "@/lib/live";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/_dash/leaderboard")({
  component: AdminLeaderboard,
});

type Filter = "all" | "evaluated" | "pending";
type Sort = "rank" | "total" | "average" | "judges" | "name";

function AdminLeaderboard() {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery(adminLeaderboardQuery);
  const runFreeze = useServerFn(freezeLeaderboard);
  const runBreakdown = useServerFn(adminTeamEvaluations);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("rank");
  const [confirmFreeze, setConfirmFreeze] = useState(false);
  const [detail, setDetail] = useState<{ row: LeaderboardRow; rows: EvaluationLogRow[] } | null>(
    null,
  );

  const settings = data?.settings;
  const frozen = settings?.leaderboard_frozen === true;
  // Once frozen the snapshot is the official result; live scores no longer move it.
  const rows = useMemo(
    () => (frozen && data?.frozen ? data.frozen : (data?.rows ?? [])),
    [data, frozen],
  );

  const counts = useMemo(
    () => ({
      all: rows.length,
      evaluated: rows.filter((r) => r.judge_count > 0).length,
      pending: rows.filter((r) => r.judge_count === 0).length,
    }),
    [rows],
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      if (filter === "evaluated" && row.judge_count === 0) return false;
      if (filter === "pending" && row.judge_count > 0) return false;
      if (!term) return true;
      return `${row.team_code} ${row.team_name} ${row.ps_code ?? ""} ${row.domain_name ?? ""}`
        .toLowerCase()
        .includes(term);
    });

    const sorted = [...filtered];
    if (sort === "total") sorted.sort((a, b) => b.total_score - a.total_score);
    else if (sort === "average") sorted.sort((a, b) => b.average_score - a.average_score);
    else if (sort === "judges") sorted.sort((a, b) => b.judge_count - a.judge_count);
    else if (sort === "name") sorted.sort((a, b) => a.team_name.localeCompare(b.team_name));
    else sorted.sort((a, b) => a.rank - b.rank);
    return sorted;
  }, [rows, search, filter, sort]);

  const podium = useMemo(() => rows.filter((r) => r.judge_count > 0).slice(0, 3), [rows]);

  const freeze = useMutation({
    mutationFn: (value: boolean) => runFreeze({ data: { freeze: value } }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-leaderboard"] });
      setConfirmFreeze(false);
      toast.success(
        result.count > 0 ? `Leaderboard frozen — ${result.count} teams` : "Leaderboard unfrozen",
      );
    },
    onError: () => toast.error("Could not update the leaderboard freeze."),
  });

  const breakdown = useMutation({
    mutationFn: (row: LeaderboardRow) =>
      runBreakdown({ data: { teamCode: row.team_code } }).then((rows) => ({ row, rows })),
    onSuccess: (result) => setDetail(result),
    onError: () => toast.error("Could not load the evaluation breakdown."),
  });

  function exportLeaderboard() {
    const csv = toCsv(
      [
        "Rank",
        "Team ID",
        "Team Name",
        "Problem Statement",
        "Total Score",
        "Average Score",
        "Number of Judges",
      ],
      visible.map((r) => [
        r.rank,
        r.team_code,
        r.team_name,
        r.ps_code ? `${r.ps_code} — ${r.ps_title ?? ""}` : "",
        formatScore(r.total_score),
        r.average_score.toFixed(2),
        r.judge_count,
      ]),
    );
    downloadFile("hackverse-leaderboard.csv", csv);
  }

  if (isPending || !data || !settings) return <AdminLoading label="Loading leaderboard" />;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={frozen ? "Final Results" : "Leaderboard"}
        subtitle={frozen ? "HackVerse 2K26 — Official" : "Live standings"}
        right={
          <>
            {frozen ? <Pill label="Leaderboard frozen" tone="danger" /> : <LiveDot />}
            <ActionButton
              variant="outline"
              onClick={exportLeaderboard}
              disabled={visible.length === 0}
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </ActionButton>
            <ActionButton
              variant={frozen ? "outline" : "danger"}
              onClick={() => (frozen ? freeze.mutate(false) : setConfirmFreeze(true))}
              disabled={freeze.isPending}
            >
              {freeze.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : frozen ? (
                <LockOpen className="h-3.5 w-3.5" />
              ) : (
                <Lock className="h-3.5 w-3.5" />
              )}
              {frozen ? "Unfreeze" : "Freeze"}
            </ActionButton>
          </>
        }
      />

      {frozen ? (
        <p className="hv-mono border-l-2 border-destructive bg-destructive/10 px-4 py-3 text-[11px] text-destructive">
          LEADERBOARD FROZEN — these rankings are final. New evaluations no longer change the
          official result.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Metric label="Teams" value={data.stats.teams} hint="Eligible" />
        <Metric label="Judges" value={data.stats.judges} hint="Active" />
        <Metric
          label="Evaluations"
          value={data.stats.evaluations}
          hint="Submitted"
          tone="primary"
        />
        <Metric
          label="Average Score"
          value={`${data.stats.averageScore.toFixed(2)}`}
          hint="of 10"
        />
        <Metric
          label="Highest Total"
          value={formatScore(data.stats.highestTotal)}
          hint="Top team"
          tone="signal"
        />
      </div>

      {/* ------------------------------------------------------- podium */}
      {podium.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {/* Visual order 2-1-3 on desktop, but ranked order on mobile. */}
          {[podium[1], podium[0], podium[2]].map((row, index) =>
            row ? (
              <div
                key={row.team_uuid}
                className={cn(
                  "hv-panel relative px-4 py-5",
                  row.rank === 1 && "border-primary/60 bg-primary/5 sm:-mt-3",
                  index === 0 && "order-2 sm:order-1",
                  index === 1 && "order-1 sm:order-2",
                  index === 2 && "order-3",
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "font-display text-2xl leading-none font-black",
                      row.rank === 1 ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    #{row.rank}
                  </span>
                  {row.rank === 1 ? <Trophy className="h-4 w-4 text-primary" /> : null}
                </div>
                <p className="mt-3 truncate text-sm font-bold">{row.team_name}</p>
                <p className="hv-mono mt-1 text-[10px] text-muted-foreground">{row.team_code}</p>
                <p className="font-display mt-3 text-3xl leading-none font-black tabular-nums">
                  {formatScore(row.total_score)}
                </p>
                <p className="hv-mono mt-1.5 text-[10px] text-muted-foreground">
                  {row.judge_count} judge{row.judge_count === 1 ? "" : "s"} · avg{" "}
                  {row.average_score.toFixed(2)}
                </p>
              </div>
            ) : null,
          )}
        </div>
      ) : null}

      <DataPanel title="Rankings" hint={`${visible.length} of ${rows.length} shown`}>
        <Toolbar>
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Search team, ID or PS ID…"
          />
          <FilterTabs
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All", count: counts.all },
              { value: "evaluated", label: "Evaluated", count: counts.evaluated },
              { value: "pending", label: "Not evaluated", count: counts.pending },
            ]}
          />
          <SelectField
            value={sort}
            onChange={(value) => setSort(value as Sort)}
            label="Sort"
            options={[
              { value: "rank", label: "Rank" },
              { value: "total", label: "Total score" },
              { value: "average", label: "Average score" },
              { value: "judges", label: "Number of judges" },
              { value: "name", label: "Team name" },
            ]}
          />
        </Toolbar>

        {visible.length === 0 ? (
          <AdminEmpty>
            {rows.length === 0 ? "No teams are available yet." : "No teams match these filters."}
          </AdminEmpty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border">
                  {[
                    "Rank",
                    "Team",
                    "Team ID",
                    "PS ID",
                    "Problem Statement",
                    "Judges",
                    "Avg",
                    "Total",
                  ].map((heading) => (
                    <th key={heading} className="hv-label px-4 py-2.5 whitespace-nowrap">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr
                    key={row.team_uuid}
                    onClick={() => breakdown.mutate(row)}
                    className={cn(
                      "cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-surface-raised",
                      row.rank <= 3 && row.judge_count > 0 && "bg-primary/[0.03]",
                    )}
                  >
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "font-display text-base font-black tabular-nums",
                          row.rank === 1 && row.judge_count > 0 && "text-primary",
                        )}
                      >
                        {row.judge_count > 0 ? `#${row.rank}` : "—"}
                      </span>
                      {row.tie_broken ? (
                        <span
                          className="hv-mono ml-1.5 text-[9px] text-muted-foreground"
                          title="Tie broken by average, then judge count"
                        >
                          TIE
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold whitespace-nowrap">
                      {row.team_name}
                    </td>
                    <td className="hv-mono px-4 py-3 text-xs whitespace-nowrap text-muted-foreground">
                      {row.team_code}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {row.ps_code ? (
                        <span className="hv-mono border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                          {row.ps_code}
                        </span>
                      ) : (
                        <span className="hv-mono text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="max-w-[260px] truncate px-4 py-3 text-xs text-muted-foreground">
                      {row.ps_title ?? "—"}
                    </td>
                    {/* §22 — never hide how many judges produced the total. */}
                    <td className="hv-mono px-4 py-3 text-xs tabular-nums">{row.judge_count}</td>
                    <td className="hv-mono px-4 py-3 text-xs tabular-nums text-muted-foreground">
                      {row.judge_count > 0 ? row.average_score.toFixed(2) : "—"}
                    </td>
                    <td className="font-display px-4 py-3 text-base font-black tabular-nums">
                      {formatScore(row.total_score)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataPanel>

      {/* ------------------------------------------------------ breakdown */}
      {detail ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm sm:p-8"
          onClick={() => setDetail(null)}
        >
          <div
            className="hv-panel w-full max-w-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <p className="hv-mono text-[11px] font-bold tracking-widest text-primary">
                  #{detail.row.rank} · {detail.row.team_code}
                </p>
                <h2 className="font-display mt-1.5 text-xl font-black tracking-tight uppercase">
                  {detail.row.team_name}
                </h2>
                {detail.row.ps_code ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    <span className="hv-mono font-bold text-foreground">{detail.row.ps_code}</span>
                    <span className="ml-2">{detail.row.ps_title}</span>
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                aria-label="Close"
                className="shrink-0 p-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="px-5 py-4">
              <p className="hv-label">Evaluation breakdown</p>
              {detail.rows.length === 0 ? (
                <p className="hv-mono mt-2 text-xs text-muted-foreground">
                  No judge has evaluated this team yet.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-border border border-border">
                  {detail.rows.map((row) => (
                    <li
                      key={row.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
                    >
                      <span className="text-xs font-semibold">
                        {row.judge_name}
                        <span className="hv-mono ml-2 text-[10px] text-muted-foreground">
                          {row.judge_username}
                        </span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="hv-mono text-[10px] text-muted-foreground">
                          {formatStamp(row.submitted_at)}
                        </span>
                        <span className="hv-mono border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                          {formatScore(row.score)}/10
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-4 grid grid-cols-3 gap-px bg-border">
                {[
                  { label: "Total score", value: formatScore(detail.row.total_score) },
                  { label: "Average", value: detail.row.average_score.toFixed(2) },
                  { label: "Judges", value: String(detail.row.judge_count) },
                ].map((item) => (
                  <div key={item.label} className="bg-surface px-3 py-3">
                    <p className="font-display text-xl leading-none font-extrabold tabular-nums">
                      {item.value}
                    </p>
                    <p className="hv-label mt-1.5">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* --------------------------------------------------- freeze confirm */}
      {confirmFreeze ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-4 backdrop-blur-sm">
          <div className="hv-panel w-full max-w-md" role="dialog" aria-modal="true">
            <header className="border-b border-border px-5 py-4">
              <p className="hv-label text-destructive">Finalize</p>
              <h2 className="font-display mt-1.5 text-xl font-black tracking-tight uppercase">
                Freeze the leaderboard?
              </h2>
            </header>
            <div className="px-5 py-4">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to freeze the leaderboard? This will finalize the current
                rankings. New evaluations will still be recorded but will not change the official
                result until you unfreeze.
              </p>
            </div>
            <footer className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <ActionButton variant="outline" onClick={() => setConfirmFreeze(false)}>
                Cancel
              </ActionButton>
              <ActionButton
                variant="danger"
                disabled={freeze.isPending}
                onClick={() => freeze.mutate(true)}
              >
                {freeze.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Lock className="h-3.5 w-3.5" />
                )}
                Freeze leaderboard
              </ActionButton>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
