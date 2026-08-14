import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, X } from "lucide-react";

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
  psStatusTone,
} from "@/components/hv/admin-chrome";
import { adminAllocationsQuery } from "@/lib/admin.queries";
import { adminPsStatus } from "@/lib/hackverse-types";
import type { AdminAllocationRow } from "@/lib/hackverse-types";
import { downloadFile, formatStamp, toCsv } from "@/lib/live";

export const Route = createFileRoute("/admin/_dash/allocations")({
  component: AdminAllocations,
});

type Filter = "all" | "available" | "partial" | "full";

function AdminAllocations() {
  const { data, isPending } = useQuery(adminAllocationsQuery);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [domain, setDomain] = useState("all");
  const [detail, setDetail] = useState<AdminAllocationRow | null>(null);

  const rows = useMemo(() => data ?? [], [data]);

  const domainOptions = useMemo(() => {
    const names = [...new Set(rows.map((row) => row.domain_name))].sort();
    return [
      { value: "all", label: "All domains" },
      ...names.map((name) => ({ value: name, label: name })),
    ];
  }, [rows]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      available: rows.filter((row) => row.allocated_count === 0).length,
      partial: rows.filter((row) => row.allocated_count > 0 && row.allocated_count < row.capacity)
        .length,
      full: rows.filter((row) => row.allocated_count >= row.capacity).length,
    }),
    [rows],
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (domain !== "all" && row.domain_name !== domain) return false;
      if (filter === "available" && row.allocated_count !== 0) return false;
      if (filter === "partial" && !(row.allocated_count > 0 && row.allocated_count < row.capacity))
        return false;
      if (filter === "full" && row.allocated_count < row.capacity) return false;
      if (!term) return true;
      return (
        row.code.toLowerCase().includes(term) ||
        row.title.toLowerCase().includes(term) ||
        row.domain_name.toLowerCase().includes(term) ||
        row.teams.some((team) => `${team.team_id} ${team.team_name}`.toLowerCase().includes(term))
      );
    });
  }, [rows, search, filter, domain]);

  function exportReport() {
    const csv = toCsv(
      ["PS ID", "Problem Statement", "Domain", "Capacity", "Allocated", "Remaining", "Status"],
      rows.map((row) => [
        row.code,
        row.title,
        row.domain_name,
        row.capacity,
        row.allocated_count,
        row.remaining_slots,
        adminPsStatus(row.allocated_count, row.capacity),
      ]),
    );
    downloadFile("hackverse-problem-statement-report.csv", csv);
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Allocations"
        subtitle="Problem statement capacity"
        right={
          <ActionButton variant="outline" onClick={exportReport} disabled={rows.length === 0}>
            <Download className="h-3.5 w-3.5" /> Export report
          </ActionButton>
        }
      />

      <DataPanel
        title="Problem Statement Allocations"
        hint={`${visible.length} of ${rows.length} shown`}
      >
        <Toolbar>
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Search PS ID, title or team…"
          />
          <FilterTabs
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All", count: counts.all },
              { value: "available", label: "Available", count: counts.available },
              { value: "partial", label: "Partial", count: counts.partial },
              { value: "full", label: "Full", count: counts.full },
            ]}
          />
          <SelectField value={domain} onChange={setDomain} options={domainOptions} label="Domain" />
        </Toolbar>

        {isPending ? (
          <AdminLoading />
        ) : visible.length === 0 ? (
          <AdminEmpty>
            {rows.length === 0
              ? "No problem statements have been created yet."
              : "No problem statements match these filters."}
          </AdminEmpty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border">
                  {[
                    "PS ID",
                    "Problem Statement",
                    "Domain",
                    "Cap",
                    "Alloc",
                    "Rem",
                    "Status",
                    "Team 1",
                    "Team 2",
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
                    onClick={() => setDetail(row)}
                    className="cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-surface-raised"
                  >
                    <td className="hv-mono px-4 py-3 text-xs font-bold whitespace-nowrap">
                      {row.code}
                    </td>
                    <td className="max-w-[280px] truncate px-4 py-3 text-xs">{row.title}</td>
                    <td className="max-w-[180px] truncate px-4 py-3 text-xs text-muted-foreground">
                      {row.domain_name}
                    </td>
                    <td className="hv-mono px-4 py-3 text-xs tabular-nums">{row.capacity}</td>
                    <td className="hv-mono px-4 py-3 text-xs tabular-nums">
                      {row.allocated_count}
                    </td>
                    <td className="hv-mono px-4 py-3 text-xs tabular-nums">
                      {row.remaining_slots}
                    </td>
                    <td className="px-4 py-3">
                      <Pill
                        label={adminPsStatus(row.allocated_count, row.capacity)}
                        tone={psStatusTone(row.allocated_count, row.capacity)}
                      />
                    </td>
                    {[0, 1].map((index) => {
                      const team = row.teams[index];
                      return (
                        <td key={index} className="px-4 py-3 text-xs whitespace-nowrap">
                          {team ? (
                            <span>
                              {team.team_name}
                              <span className="hv-mono ml-1.5 text-[10px] text-muted-foreground">
                                {team.team_id}
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataPanel>

      {detail ? <AllocationDetail row={detail} onClose={() => setDetail(null)} /> : null}
    </div>
  );
}

/** §27 — full allocation detail for one problem statement, with exact timestamps. */
function AllocationDetail({ row, onClose }: { row: AdminAllocationRow; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm sm:p-8"
      onClick={onClose}
    >
      <div
        className="hv-panel w-full max-w-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${row.code} allocation detail`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <p className="hv-mono text-[11px] font-bold tracking-widest text-primary">{row.code}</p>
            <h2 className="font-display mt-1.5 text-xl font-black tracking-tight uppercase">
              {row.title}
            </h2>
            <p className="hv-mono mt-1.5 text-[11px] text-muted-foreground">{row.domain_name}</p>
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

        <div className="grid grid-cols-4 gap-px bg-border">
          {[
            { label: "Capacity", value: row.capacity },
            { label: "Allocated", value: row.allocated_count },
            { label: "Remaining", value: row.remaining_slots },
          ].map((item) => (
            <div key={item.label} className="bg-surface px-4 py-3">
              <p className="hv-label">{item.label}</p>
              <p className="font-display mt-1 text-xl font-extrabold tabular-nums">{item.value}</p>
            </div>
          ))}
          <div className="bg-surface px-4 py-3">
            <p className="hv-label">Status</p>
            <div className="mt-2">
              <Pill
                label={adminPsStatus(row.allocated_count, row.capacity)}
                tone={psStatusTone(row.allocated_count, row.capacity)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <p className="hv-label">Teams</p>
            {row.teams.length === 0 ? (
              <p className="hv-mono mt-2 text-xs text-muted-foreground">
                No teams have selected this problem statement yet.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-border border border-border">
                {row.teams.map((team) => (
                  <li
                    key={team.team_id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
                  >
                    <span className="text-xs font-semibold">
                      {team.team_name}
                      <span className="hv-mono ml-2 text-[10px] text-muted-foreground">
                        {team.team_id}
                      </span>
                    </span>
                    <span className="hv-mono text-[10px] text-muted-foreground">
                      {formatStamp(team.selected_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {row.description ? (
            <div>
              <p className="hv-label">Summary</p>
              <p className="mt-1.5 text-sm text-muted-foreground">{row.description}</p>
            </div>
          ) : null}

          {row.full_description ? (
            <div>
              <p className="hv-label">Full problem statement</p>
              <p className="mt-1.5 text-sm whitespace-pre-line text-muted-foreground">
                {row.full_description}
              </p>
            </div>
          ) : null}

          {row.requirements ? (
            <div>
              <p className="hv-label">Requirements</p>
              <p className="mt-1.5 text-sm whitespace-pre-line text-muted-foreground">
                {row.requirements}
              </p>
            </div>
          ) : null}

          {row.expected_solution ? (
            <div>
              <p className="hv-label">Expected solution direction</p>
              <p className="mt-1.5 text-sm whitespace-pre-line text-muted-foreground">
                {row.expected_solution}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
