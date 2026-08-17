import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  ListPlus,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
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
  Toolbar,
  teamStatusTone,
} from "@/components/hv/admin-chrome";
import { adminAllocationsQuery, adminTeamsQuery } from "@/lib/admin.queries";
import { allotProblemStatement, setTeamStatus } from "@/lib/admin.functions";
import type { AdminTeamRow } from "@/lib/hackverse-types";
import { downloadFile, formatStamp, toCsv } from "@/lib/live";
import { downloadXlsx } from "@/lib/xlsx";

export const Route = createFileRoute("/admin/_dash/teams")({
  component: AdminTeams,
});

type Filter = "all" | "allocated" | "not_allocated" | "eligible" | "disqualified";

function AdminTeams() {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery(adminTeamsQuery);
  const runSetStatus = useServerFn(setTeamStatus);
  const runAllot = useServerFn(allotProblemStatement);
  const psList = useQuery(adminAllocationsQuery);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [confirming, setConfirming] = useState<AdminTeamRow | null>(null);
  const [allotting, setAllotting] = useState<AdminTeamRow | null>(null);
  const [chosenPs, setChosenPs] = useState("");
  const [allotError, setAllotError] = useState<string | null>(null);

  // Only statements with room can be offered; the backend enforces this
  // again, but an organiser should not be able to pick a full one at all.
  const openPs = useMemo(
    () => (psList.data ?? []).filter((p) => p.remaining_slots > 0 && p.status === "active"),
    [psList.data],
  );

  const allot = useMutation({
    mutationFn: (input: { teamCode: string; psCode: string }) => runAllot({ data: input }),
    onSuccess: async (result) => {
      if (!result.ok) {
        setAllotError(result.message ?? "Could not allot this problem statement.");
        return;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-teams"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-allocations"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-leaderboard"] }),
      ]);
      setAllotting(null);
      setChosenPs("");
      setAllotError(null);
      toast.success(`Allotted — allocation #${result.allocation_number}`);
    },
    onError: () => setAllotError("Could not allot this problem statement. Please try again."),
  });

  const changeStatus = useMutation({
    mutationFn: (input: { teamCode: string; status: "eligible" | "disqualified" }) =>
      runSetStatus({ data: input }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.message ?? "Could not update this team.");
        return;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-teams"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-leaderboard"] }),
      ]);
      setConfirming(null);
      toast.success(`Team is now ${result.status}`);
    },
    onError: () => toast.error("Could not update this team."),
  });

  const rows = useMemo(() => data ?? [], [data]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      allocated: rows.filter((row) => row.allocation_status === "allocated").length,
      not_allocated: rows.filter((row) => row.allocation_status !== "allocated").length,
      eligible: rows.filter((row) => row.status === "eligible").length,
      disqualified: rows.filter((row) => row.status === "disqualified").length,
    }),
    [rows],
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === "allocated" && row.allocation_status !== "allocated") return false;
      if (filter === "not_allocated" && row.allocation_status === "allocated") return false;
      if (filter === "eligible" && row.status !== "eligible") return false;
      if (filter === "disqualified" && row.status !== "disqualified") return false;
      if (!term) return true;
      // Includes the problem statement code and title so an organiser can type
      // "HV-AI-01" and immediately see which teams took it.
      return `${row.team_id} ${row.team_name} ${row.leader_name ?? ""} ${
        row.problem_statement_code ?? ""
      } ${row.problem_statement_title ?? ""} ${row.domain_name ?? ""}`
        .toLowerCase()
        .includes(term);
    });
  }, [rows, search, filter]);

  function exportTeams() {
    const csv = toCsv(
      [
        "Team ID",
        "Team Name",
        "Domain",
        "Problem Statement ID",
        "Problem Statement",
        "Selected At",
        "Status",
      ],
      rows.map((row) => [
        row.team_id,
        row.team_name,
        row.domain_name ?? "",
        row.problem_statement_code ?? "",
        row.problem_statement_title ?? "",
        row.selected_at ?? "",
        row.status,
      ]),
    );
    downloadFile("hackverse-team-allocations.csv", csv);
  }

  // Teams that actually locked a problem statement — the allocation record.
  const allocated = useMemo(
    () => rows.filter((row) => row.allocation_status === "allocated"),
    [rows],
  );
  const disqualified = useMemo(() => rows.filter((row) => row.status === "disqualified"), [rows]);

  function exportAllocatedXlsx() {
    downloadXlsx(
      "hackverse-allocated-teams.xlsx",
      "Allocated Teams",
      ["Team ID", "Team Name", "Problem Statement ID", "Problem Statement"],
      allocated.map((row) => [
        row.team_id,
        row.team_name,
        row.problem_statement_code ?? "",
        row.problem_statement_title ?? "",
      ]),
    );
  }

  function exportDisqualifiedXlsx() {
    downloadXlsx(
      "hackverse-disqualified-teams.xlsx",
      "Disqualified Teams",
      ["Team ID", "Team Name"],
      disqualified.map((row) => [row.team_id, row.team_name]),
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Teams"
        subtitle="Registered teams"
        right={
          <>
            <ActionButton
              variant="outline"
              onClick={exportAllocatedXlsx}
              disabled={allocated.length === 0}
              title={
                allocated.length === 0
                  ? "No team has locked a problem statement yet"
                  : `Export ${allocated.length} allocated teams`
              }
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Allocated ({allocated.length})
            </ActionButton>
            <ActionButton
              variant="outline"
              onClick={exportDisqualifiedXlsx}
              disabled={disqualified.length === 0}
              title={
                disqualified.length === 0
                  ? "No team has been disqualified yet"
                  : `Export ${disqualified.length} disqualified teams`
              }
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Disqualified ({disqualified.length})
            </ActionButton>
            <ActionButton variant="outline" onClick={exportTeams} disabled={rows.length === 0}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </ActionButton>
          </>
        }
      />

      <DataPanel title="Team Register" hint={`${visible.length} of ${rows.length} shown`}>
        <Toolbar>
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Search team ID, name, leader or PS ID (e.g. HV-AI-01)…"
          />
          <FilterTabs
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All", count: counts.all },
              { value: "allocated", label: "Allocated", count: counts.allocated },
              { value: "not_allocated", label: "Not allocated", count: counts.not_allocated },
              { value: "eligible", label: "Eligible", count: counts.eligible },
              { value: "disqualified", label: "Disqualified", count: counts.disqualified },
            ]}
          />
        </Toolbar>

        {isPending ? (
          <AdminLoading />
        ) : visible.length === 0 ? (
          <AdminEmpty>
            {rows.length === 0 ? "No teams are registered yet." : "No matching teams found."}
          </AdminEmpty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border">
                  {[
                    "Team ID",
                    "Team Name",
                    "Leader",
                    "Status",
                    "PS ID",
                    "Problem Statement",
                    "Domain",
                    "Selected At",
                    "Allocation",
                    "",
                  ].map((heading, index) => (
                    <th key={index} className="hv-label px-4 py-2.5 whitespace-nowrap">
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
                    <td className="hv-mono px-4 py-3 text-xs font-bold whitespace-nowrap">
                      {row.team_id}
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">{row.team_name}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap text-muted-foreground">
                      {row.leader_name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Pill label={row.status} tone={teamStatusTone(row.status)} />
                    </td>
                    {/* PS ID gets its own column so the allocation can be read
                        down a single scannable line of codes. */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {row.problem_statement_code ? (
                        <span className="hv-mono border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                          {row.problem_statement_code}
                        </span>
                      ) : (
                        <span className="hv-mono text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="max-w-[280px] truncate px-4 py-3 text-xs text-muted-foreground">
                      {row.problem_statement_title ?? "—"}
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-3 text-xs text-muted-foreground">
                      {row.domain_name ?? "—"}
                    </td>
                    <td className="hv-mono px-4 py-3 text-[11px] whitespace-nowrap text-muted-foreground">
                      {row.selected_at ? formatStamp(row.selected_at) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Pill
                        label={row.allocation_status === "allocated" ? "LOCKED" : "PENDING"}
                        tone={row.allocation_status === "allocated" ? "primary" : "neutral"}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        {row.status !== "disqualified" && row.allocation_status !== "allocated" ? (
                          <button
                            type="button"
                            onClick={() => {
                              setAllotError(null);
                              setChosenPs(openPs[0]?.code ?? "");
                              setAllotting(row);
                            }}
                            className="hv-mono inline-flex items-center gap-1.5 border border-primary/60 px-2.5 py-1.5 text-[10px] font-bold tracking-widest text-primary uppercase transition-colors hover:bg-primary/10"
                          >
                            <ListPlus className="h-3 w-3" /> Allot
                          </button>
                        ) : null}
                        {row.status === "disqualified" ? (
                          <button
                            type="button"
                            disabled={changeStatus.isPending}
                            onClick={() =>
                              changeStatus.mutate({ teamCode: row.team_id, status: "eligible" })
                            }
                            className="hv-mono inline-flex items-center gap-1.5 border border-success/60 px-2.5 py-1.5 text-[10px] font-bold tracking-widest text-success uppercase transition-colors hover:bg-success/10 disabled:opacity-40"
                          >
                            <ShieldCheck className="h-3 w-3" /> Reinstate
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirming(row)}
                            className="hv-mono inline-flex items-center gap-1.5 border border-destructive/60 px-2.5 py-1.5 text-[10px] font-bold tracking-widest text-destructive uppercase transition-colors hover:bg-destructive/10"
                          >
                            <ShieldAlert className="h-3 w-3" /> Disqualify
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataPanel>

      {/* ------------------------------------------------------ allot PS */}
      {allotting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-4 backdrop-blur-sm">
          <div className="hv-panel w-full max-w-lg" role="dialog" aria-modal="true">
            <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <p className="hv-label">Allot problem statement</p>
                <h2 className="font-display mt-1.5 text-xl font-black tracking-tight uppercase">
                  {allotting.team_name}
                </h2>
                <p className="hv-mono mt-1.5 text-[11px] text-muted-foreground">
                  {allotting.team_id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAllotting(null)}
                aria-label="Close"
                className="shrink-0 p-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="px-5 py-4">
              {openPs.length === 0 ? (
                <p className="hv-mono border-l-2 border-warning bg-warning/10 px-3 py-2.5 text-[11px] text-warning">
                  Every problem statement is full. Raise a capacity on the Problem Statements page
                  first, then come back here.
                </p>
              ) : (
                <label className="block">
                  <span className="hv-label mb-2 block">
                    Problem statement ({openPs.length} with free slots)
                  </span>
                  <select
                    value={chosenPs}
                    onChange={(e) => {
                      setChosenPs(e.target.value);
                      setAllotError(null);
                    }}
                    className="w-full border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                  >
                    {openPs.map((p) => (
                      <option key={p.id} value={p.code}>
                        {p.code} — {p.title} ({p.remaining_slots} free)
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <p className="hv-mono mt-4 border-l-2 border-border-strong bg-surface-raised px-3 py-2.5 text-[10px] text-muted-foreground">
                This bypasses the closed-selection and 50-team limits, which apply to participants
                rather than organisers. The problem statement&apos;s own capacity is still enforced.
              </p>

              {allotError ? (
                <p className="hv-mono mt-3 border-l-2 border-destructive bg-destructive/10 px-3 py-2.5 text-[11px] text-destructive">
                  {allotError}
                </p>
              ) : null}
            </div>

            <footer className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <ActionButton variant="outline" onClick={() => setAllotting(null)}>
                Cancel
              </ActionButton>
              <ActionButton
                disabled={allot.isPending || openPs.length === 0 || !chosenPs}
                onClick={() => allot.mutate({ teamCode: allotting.team_id, psCode: chosenPs })}
              >
                {allot.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Allot problem statement
              </ActionButton>
            </footer>
          </div>
        </div>
      ) : null}

      {/* ---------------------------------------------- disqualify confirm */}
      {confirming ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-4 backdrop-blur-sm">
          <div className="hv-panel w-full max-w-md" role="dialog" aria-modal="true">
            <header className="border-b border-border px-5 py-4">
              <p className="hv-label text-destructive">Confirm</p>
              <h2 className="font-display mt-1.5 text-xl font-black tracking-tight uppercase">
                Disqualify {confirming.team_name}?
              </h2>
              <p className="hv-mono mt-1.5 text-[11px] text-muted-foreground">
                {confirming.team_id}
              </p>
            </header>
            <div className="px-5 py-4">
              {confirming.allocation_status === "allocated" ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    This team is holding{" "}
                    <span className="hv-mono text-foreground">
                      {confirming.problem_statement_code}
                    </span>
                    . Their allocation record is kept and the slot stays taken, so the problem
                    statement will not be handed to another team.
                  </p>
                  <p className="hv-mono mt-3 border-l-2 border-warning bg-warning/10 px-3 py-2.5 text-[11px] text-warning">
                    Nothing is deleted. You can reinstate this team at any time and they return to
                    their allocated problem statement.
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  This team has no allocation. Marking them disqualified excludes them from the
                  event; nothing is deleted and it can be undone.
                </p>
              )}
            </div>
            <footer className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <ActionButton variant="outline" onClick={() => setConfirming(null)}>
                Cancel
              </ActionButton>
              <ActionButton
                variant="danger"
                disabled={changeStatus.isPending}
                onClick={() =>
                  changeStatus.mutate({ teamCode: confirming.team_id, status: "disqualified" })
                }
              >
                {changeStatus.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Disqualify team
              </ActionButton>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
