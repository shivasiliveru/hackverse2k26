import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import { getPublicState } from "./participant.functions";

export const publicStateQuery = queryOptions({
  queryKey: ["public-state"],
  queryFn: () => getPublicState(),
  staleTime: 5_000,
});

/**
 * Realtime table sets, scoped per audience.
 *
 * Every subscribed row change is broadcast to every connected client, and each
 * one triggers a refetch — so the cost is (events x clients), not (events).
 * With ~300 participants online at open, subscribing them to a high-churn
 * table is the difference between thousands of queries and hundreds of
 * thousands.
 *
 * audit_log is the worst offender: it gains a row on every verification
 * attempt, including typos and failures, none of which change a slot count.
 * Participants therefore watch only the three tables that actually move the
 * numbers on their screen.
 */
export const LIVE_TABLES = {
  /** Slot counts and open/paused/closed status. Nothing else moves these. */
  participant: ["problem_statements", "allocations", "event_settings"],
  /** The dashboard reports on everything, so it watches everything. */
  admin: [
    "problem_statements",
    "allocations",
    "teams",
    "event_settings",
    "audit_log",
    "evaluations",
    "judges",
    "leaderboard_freeze",
  ],
  /** A judge's own progress plus the evaluation window. */
  judge: ["evaluations", "event_settings"],
  /** Public standings move only when a score lands or the board is frozen. */
  leaderboard: ["evaluations", "event_settings", "leaderboard_freeze"],
} as const;

/** Coalescing window: a burst of allocations becomes one refetch, not N. */
const INVALIDATE_DEBOUNCE_MS = 1_000;

/**
 * Subscribes once to the given tables and invalidates the given query keys
 * whenever the backend changes, coalescing bursts.
 */
export function useLiveAllocations(
  keys: readonly (readonly string[])[],
  tables: readonly string[] = LIVE_TABLES.participant,
) {
  const queryClient = useQueryClient();
  const signature = JSON.stringify(keys);
  const tableSignature = JSON.stringify(tables);

  useEffect(() => {
    const watched = JSON.parse(tableSignature) as string[];
    let timer: ReturnType<typeof setTimeout> | undefined;

    const invalidate = () => {
      if (timer) return; // a refetch is already scheduled for this burst
      timer = setTimeout(() => {
        timer = undefined;
        for (const key of JSON.parse(signature) as string[][]) {
          void queryClient.invalidateQueries({ queryKey: key });
        }
      }, INVALIDATE_DEBOUNCE_MS);
    };

    // Distinct channel per table set: two different subscriptions sharing one
    // channel name would collide when both are mounted.
    let channel = supabase.channel(`hv-live-${watched.join("-")}`);
    for (const table of watched) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, invalidate);
    }
    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [queryClient, signature, tableSignature]);
}

export function formatStamp(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatClock(value: string | null | undefined): string {
  if (!value) return "--:--:--";
  return new Date(value).toLocaleTimeString("en-GB", { hour12: false });
}

export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const escape = (cell: string | number | null) => {
    const text = cell === null || cell === undefined ? "" : String(cell);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.join(","), ...rows.map((row) => row.map(escape).join(","))].join("\n");
}

export function downloadFile(filename: string, contents: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
