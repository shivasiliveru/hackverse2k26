import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";

import {
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  DataPanel,
  Pill,
  selectionStatusTone,
} from "@/components/hv/admin-chrome";
import { LiveDot, Metric } from "@/components/hv/chrome";
import { adminAllocationsQuery, adminOverviewQuery } from "@/lib/admin.queries";
import { auditTone, describeAuditEvent } from "@/lib/audit-format";
import { formatClock } from "@/lib/live";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/_dash/")({
  component: AdminDashboard,
});

const TONE_TEXT = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
  admin: "text-signal",
  neutral: "text-muted-foreground",
} as const;

function AdminDashboard() {
  const overview = useQuery(adminOverviewQuery);
  const allocations = useQuery(adminAllocationsQuery);

  const data = overview.data;
  const rows = allocations.data ?? [];

  const progress =
    data && data.maxAllocatedTeams > 0 ? (data.allocated / data.maxAllocatedTeams) * 100 : 0;
  const full = rows.filter((row) => row.allocated_count >= row.capacity).length;
  const partial = rows.filter(
    (row) => row.allocated_count > 0 && row.allocated_count < row.capacity,
  ).length;
  const untouched = rows.filter((row) => row.allocated_count === 0).length;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Allocation Control Center"
        subtitle={data?.eventName ?? "HackVerse 2K26"}
        right={
          <>
            <LiveDot />
            {data ? (
              <Pill label={data.selectionStatus} tone={selectionStatusTone(data.selectionStatus)} />
            ) : null}
          </>
        }
      />

      {overview.isPending ? (
        <AdminLoading label="Loading live metrics" />
      ) : !data ? (
        <AdminEmpty>Live metrics are unavailable right now.</AdminEmpty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            <Metric label="Total Teams" value={data.totalTeams} hint="Registered" />
            <Metric
              label="Allocated"
              value={data.allocated}
              hint={`of ${data.maxAllocatedTeams} slots`}
              tone="primary"
            />
            <Metric
              label="Remaining Slots"
              value={data.remainingSlots}
              hint="Still open"
              tone="signal"
            />
            <Metric label="Problem Statements" value={data.problemStatements} hint="Active" />
            <Metric label="Domains" value={data.domains} hint="Configured" />
            <Metric
              label="Disqualified"
              value={data.disqualified}
              hint={`${data.eligible} eligible`}
              tone={data.disqualified > 0 ? "danger" : "default"}
            />
          </div>

          <DataPanel
            title="Live Allocation Overview"
            hint={`${data.allocated} / ${data.maxAllocatedTeams} teams allocated — ${data.remainingSlots} slots remaining`}
            right={
              <Link
                to="/admin/allocations"
                className="hv-mono inline-flex items-center gap-1 text-[10px] font-bold tracking-widest text-muted-foreground uppercase transition-colors hover:text-foreground"
              >
                Open allocations <ArrowUpRight className="h-3 w-3" />
              </Link>
            }
          >
            <div className="px-4 py-5">
              <div className="flex items-end justify-between gap-4">
                <p className="font-display text-3xl leading-none font-black tabular-nums">
                  {data.allocated}
                  <span className="text-muted-foreground"> / {data.maxAllocatedTeams}</span>
                </p>
                <p className="hv-mono text-[11px] text-muted-foreground">
                  {Math.round(progress)}% filled
                </p>
              </div>
              <div className="mt-3 h-2 w-full bg-surface-raised">
                <div
                  className="h-full bg-primary transition-[width] duration-500"
                  style={{ width: `${Math.min(100, progress)}%` }}
                />
              </div>

              <div className="mt-5 grid grid-cols-3 gap-px bg-border">
                {[
                  { label: "Full", value: full, tone: "text-destructive" },
                  { label: "Partially allocated", value: partial, tone: "text-warning" },
                  { label: "Untouched", value: untouched, tone: "text-success" },
                ].map((item) => (
                  <div key={item.label} className="bg-surface px-3 py-3">
                    <p
                      className={cn(
                        "font-display text-2xl leading-none font-extrabold tabular-nums",
                        item.tone,
                      )}
                    >
                      {item.value}
                    </p>
                    <p className="hv-label mt-1.5">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </DataPanel>

          <div className="grid gap-6 xl:grid-cols-2">
            <DataPanel
              title="Recent Activity"
              hint="Newest first — every allocation and organiser action"
              right={
                <Link
                  to="/admin/activity"
                  className="hv-mono inline-flex items-center gap-1 text-[10px] font-bold tracking-widest text-muted-foreground uppercase transition-colors hover:text-foreground"
                >
                  Full log <ArrowUpRight className="h-3 w-3" />
                </Link>
              }
            >
              {data.activity.length === 0 ? (
                <AdminEmpty>No activity recorded yet.</AdminEmpty>
              ) : (
                <ul className="max-h-[420px] divide-y divide-border overflow-y-auto">
                  {data.activity.map((entry) => (
                    <li key={entry.id} className="flex items-baseline gap-3 px-4 py-2.5">
                      <span className="hv-mono shrink-0 text-[11px] text-muted-foreground tabular-nums">
                        {formatClock(entry.created_at)}
                      </span>
                      <span
                        className={cn("hv-mono text-[11px]", TONE_TEXT[auditTone(entry.event)])}
                      >
                        {describeAuditEvent(entry)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </DataPanel>

            <DataPanel title="Problem Statement Capacity" hint="Slot usage per problem statement">
              {allocations.isPending ? (
                <AdminLoading />
              ) : rows.length === 0 ? (
                <AdminEmpty>No problem statements have been created yet.</AdminEmpty>
              ) : (
                <ul className="max-h-[420px] divide-y divide-border overflow-y-auto">
                  {rows.map((row) => (
                    <li key={row.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="hv-mono w-16 shrink-0 text-[11px] font-bold">
                        {row.code}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                        {row.title}
                      </span>
                      <span className="flex shrink-0 gap-px">
                        {Array.from({ length: row.capacity }, (_, index) => (
                          <span
                            key={index}
                            className={cn(
                              "h-3.5 w-3.5",
                              index < row.allocated_count ? "bg-primary" : "bg-surface-raised",
                            )}
                          />
                        ))}
                      </span>
                      <span className="hv-mono w-10 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                        {row.allocated_count}/{row.capacity}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </DataPanel>
          </div>
        </>
      )}
    </div>
  );
}
