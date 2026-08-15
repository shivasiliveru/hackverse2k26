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
  FilterTabs,
  Pill,
  SearchField,
  Toolbar,
  teamStatusTone,
} from "@/components/hv/admin-chrome";
import { adminTeamsQuery } from "@/lib/admin.queries";
import { downloadFile, formatStamp, toCsv } from "@/lib/live";

export const Route = createFileRoute("/admin/_dash/teams")({
  component: AdminTeams,
});

type Filter = "all" | "allocated" | "not_allocated" | "eligible" | "disqualified";

function AdminTeams() {
  const { data, isPending } = useQuery(adminTeamsQuery);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

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

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Teams"
        subtitle="Registered teams"
        right={
          <ActionButton variant="outline" onClick={exportTeams} disabled={rows.length === 0}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </ActionButton>
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
