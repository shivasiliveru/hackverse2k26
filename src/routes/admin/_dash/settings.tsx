import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Save, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import {
  ActionButton,
  AdminLoading,
  AdminPageHeader,
  DataPanel,
  Pill,
  selectionStatusTone,
} from "@/components/hv/admin-chrome";
import { EvaluationSettingsPanels } from "@/components/hv/evaluation-settings";
import { adminOverviewQuery } from "@/lib/admin.queries";
import { finalizeDisqualifications, updateEventSettings } from "@/lib/admin.functions";
import type { SelectionStatus } from "@/lib/hackverse-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/_dash/settings")({
  component: AdminSettings,
});

const STATUS_COPY: Record<SelectionStatus, string> = {
  open: "Participants can verify, browse and lock problem statements.",
  paused: "Participants can browse but cannot confirm a selection.",
  closed: "No further selection is allowed.",
};

function AdminSettings() {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery(adminOverviewQuery);
  const runUpdate = useServerFn(updateEventSettings);
  const runFinalize = useServerFn(finalizeDisqualifications);

  const [eventName, setEventName] = useState("");
  const [status, setStatus] = useState<SelectionStatus>("open");
  const [maxTeams, setMaxTeams] = useState(50);
  const [capacity, setCapacity] = useState(2);
  const [confirmText, setConfirmText] = useState("");
  const [showFinalize, setShowFinalize] = useState(false);

  // Seed the form once the live settings arrive, and re-seed whenever another
  // organiser changes them (realtime invalidates this query).
  useEffect(() => {
    if (!data) return;
    setEventName(data.eventName);
    setStatus(data.selectionStatus);
    setMaxTeams(data.maxAllocatedTeams);
    setCapacity(data.defaultCapacity);
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      runUpdate({
        data: {
          event_name: eventName,
          selection_status: status,
          max_allocated_teams: maxTeams,
          default_capacity: capacity,
        },
      }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.message ?? "Could not save settings.");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      toast.success("Event settings saved");
    },
    onError: () => toast.error("Could not save settings. Please try again."),
  });

  const finalize = useMutation({
    mutationFn: () => runFinalize({}),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-teams"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      setShowFinalize(false);
      setConfirmText("");
      toast.success(
        `${result.count} unallocated team${result.count === 1 ? "" : "s"} marked as disqualified`,
      );
    },
    onError: () => toast.error("Could not finalize disqualifications."),
  });

  if (isPending || !data) return <AdminLoading label="Loading event settings" />;

  const pendingDisqualification = data.eligible - data.allocated;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Settings"
        subtitle="Event configuration"
        right={
          <Pill label={data.selectionStatus} tone={selectionStatusTone(data.selectionStatus)} />
        }
      />

      <DataPanel title="Selection Status" hint="Takes effect immediately for every participant">
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
      </DataPanel>

      <DataPanel title="Event Configuration" hint="Capacity and limits are enforced by the backend">
        <div className="grid gap-4 px-4 py-4 sm:grid-cols-2">
          <label className="block">
            <span className="hv-label mb-2 block">Event name</span>
            <input
              value={eventName}
              onChange={(event) => setEventName(event.target.value)}
              minLength={2}
              maxLength={120}
              className="w-full border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </label>

          <label className="block">
            <span className="hv-label mb-2 block">Maximum allocated teams</span>
            <input
              type="number"
              value={maxTeams}
              onChange={(event) => setMaxTeams(Number(event.target.value))}
              min={0}
              max={10000}
              className="hv-mono w-full border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
            <span className="hv-mono mt-1.5 block text-[10px] text-muted-foreground">
              {data.allocated} already allocated
            </span>
          </label>

          <label className="block">
            <span className="hv-label mb-2 block">Default problem statement capacity</span>
            <input
              type="number"
              value={capacity}
              onChange={(event) => setCapacity(Number(event.target.value))}
              min={1}
              max={50}
              className="hv-mono w-full border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
            <span className="hv-mono mt-1.5 block text-[10px] text-muted-foreground">
              Applies to newly created problem statements
            </span>
          </label>
        </div>

        <footer className="flex justify-end border-t border-border px-4 py-3">
          <ActionButton onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save settings
          </ActionButton>
        </footer>
      </DataPanel>

      <EvaluationSettingsPanels />

      <DataPanel
        title="Finalize & Disqualify"
        hint="§29 — run this only after selection has officially closed"
      >
        <div className="px-4 py-4">
          <p className="text-sm text-muted-foreground">
            Marks every eligible team without an allocation as{" "}
            <span className="text-destructive">disqualified</span>. This is irreversible from the
            dashboard.
          </p>

          <div className="mt-4 grid grid-cols-3 gap-px bg-border">
            {[
              { label: "Registered", value: data.totalTeams },
              { label: "Allocated", value: data.allocated },
              { label: "Would be disqualified", value: Math.max(0, pendingDisqualification) },
            ].map((item) => (
              <div key={item.label} className="bg-surface px-3 py-3">
                <p className="font-display text-2xl leading-none font-extrabold tabular-nums">
                  {item.value}
                </p>
                <p className="hv-label mt-1.5">{item.label}</p>
              </div>
            ))}
          </div>

          {data.selectionStatus !== "closed" ? (
            <p className="hv-mono mt-4 flex items-start gap-2 border-l-2 border-warning bg-warning/10 px-3 py-2.5 text-[11px] text-warning">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              Selection is still {data.selectionStatus}. Close it before finalizing.
            </p>
          ) : null}

          <ActionButton
            variant="danger"
            className="mt-4"
            onClick={() => setShowFinalize(true)}
            disabled={pendingDisqualification <= 0}
          >
            <ShieldAlert className="h-3.5 w-3.5" /> Finalize & disqualify remaining teams
          </ActionButton>
        </div>
      </DataPanel>

      {showFinalize ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-4 backdrop-blur-sm">
          <div className="hv-panel w-full max-w-md" role="dialog" aria-modal="true">
            <header className="border-b border-border px-5 py-4">
              <p className="hv-label text-destructive">Irreversible action</p>
              <h2 className="font-display mt-1.5 text-xl font-black tracking-tight uppercase">
                Disqualify {Math.max(0, pendingDisqualification)} teams?
              </h2>
            </header>
            <div className="px-5 py-4">
              <p className="text-sm text-muted-foreground">
                Every eligible team without an allocation will be marked disqualified. Type{" "}
                <span className="hv-mono text-foreground">DISQUALIFY</span> to confirm.
              </p>
              <input
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value.toUpperCase())}
                placeholder="DISQUALIFY"
                className="hv-mono mt-3 w-full border border-input bg-background px-3 py-2.5 text-sm tracking-widest outline-none focus:border-destructive"
              />
            </div>
            <footer className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <ActionButton
                variant="outline"
                onClick={() => {
                  setShowFinalize(false);
                  setConfirmText("");
                }}
              >
                Cancel
              </ActionButton>
              <ActionButton
                variant="danger"
                disabled={confirmText !== "DISQUALIFY" || finalize.isPending}
                onClick={() => finalize.mutate()}
              >
                {finalize.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Confirm disqualification
              </ActionButton>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
