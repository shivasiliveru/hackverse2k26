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
 * Subscribes once to the tables that drive live slot availability and
 * invalidates the given query keys whenever the backend changes.
 */
export function useLiveAllocations(keys: string[][]) {
  const queryClient = useQueryClient();
  const signature = JSON.stringify(keys);

  useEffect(() => {
    const invalidate = () => {
      for (const key of JSON.parse(signature) as string[][]) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    };

    const channel = supabase
      .channel("hv-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "problem_statements" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "allocations" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_settings" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "audit_log" }, invalidate)
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, signature]);
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
