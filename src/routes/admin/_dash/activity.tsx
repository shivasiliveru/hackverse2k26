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
  SearchField,
  Toolbar,
} from "@/components/hv/admin-chrome";
import { LiveDot } from "@/components/hv/chrome";
import { adminAuditQuery } from "@/lib/admin.queries";
import { auditTone, describeAuditEvent } from "@/lib/audit-format";
import { downloadFile, formatStamp, toCsv } from "@/lib/live";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/_dash/activity")({
  component: AdminActivity,
});

type Filter = "all" | "allocations" | "failures" | "admin";

const TONE_TEXT = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
  admin: "text-signal",
  neutral: "text-muted-foreground",
} as const;

const TONE_BAR = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  admin: "bg-signal",
  neutral: "bg-border-strong",
} as const;

function AdminActivity() {
  const { data, isPending } = useQuery(adminAuditQuery);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const rows = useMemo(() => data ?? [], [data]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      allocations: rows.filter((row) => row.event === "allocation_success").length,
      failures: rows.filter((row) => auditTone(row.event) === "danger").length,
      admin: rows.filter((row) => row.event.startsWith("admin_")).length,
    }),
    [rows],
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === "allocations" && row.event !== "allocation_success") return false;
      if (filter === "failures" && auditTone(row.event) !== "danger") return false;
      if (filter === "admin" && !row.event.startsWith("admin_")) return false;
      if (!term) return true;
      return `${row.event} ${row.team_ref ?? ""} ${row.problem_statement_ref ?? ""} ${row.actor ?? ""}`
        .toLowerCase()
        .includes(term);
    });
  }, [rows, search, filter]);

  function exportLog() {
    const csv = toCsv(
      ["Timestamp", "Event", "Team", "Problem Statement", "Actor", "Detail", "Metadata"],
      rows.map((row) => [
        row.created_at,
        row.event,
        row.team_ref ?? "",
        row.problem_statement_ref ?? "",
        row.actor ?? "",
        describeAuditEvent(row),
        JSON.stringify(row.metadata ?? {}),
      ]),
    );
    downloadFile("hackverse-audit-log.csv", csv);
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Activity Log"
        subtitle="Audit trail"
        right={
          <>
            <LiveDot />
            <ActionButton variant="outline" onClick={exportLog} disabled={rows.length === 0}>
              <Download className="h-3.5 w-3.5" /> Export log
            </ActionButton>
          </>
        }
      />

      <DataPanel
        title="Recorded Events"
        hint={`${visible.length} of ${rows.length} shown — most recent 300 events`}
      >
        <Toolbar>
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Search team, PS or actor…"
          />
          <FilterTabs
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All", count: counts.all },
              { value: "allocations", label: "Allocations", count: counts.allocations },
              { value: "failures", label: "Failures", count: counts.failures },
              { value: "admin", label: "Organiser", count: counts.admin },
            ]}
          />
        </Toolbar>

        {isPending ? (
          <AdminLoading />
        ) : visible.length === 0 ? (
          <AdminEmpty>
            {rows.length === 0 ? "No activity recorded yet." : "No events match these filters."}
          </AdminEmpty>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((entry) => {
              const tone = auditTone(entry.event);
              return (
                <li
                  key={entry.id}
                  className="relative flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 pl-6"
                >
                  <span className={cn("absolute top-0 left-0 h-full w-[3px]", TONE_BAR[tone])} />
                  <span className="hv-mono shrink-0 text-[11px] whitespace-nowrap text-muted-foreground tabular-nums">
                    {formatStamp(entry.created_at)}
                  </span>
                  <span className={cn("hv-mono text-xs", TONE_TEXT[tone])}>
                    {describeAuditEvent(entry)}
                  </span>
                  <span className="hv-mono ml-auto text-[10px] tracking-wide text-muted-foreground/70">
                    {entry.event}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </DataPanel>
    </div>
  );
}
