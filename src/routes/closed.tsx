import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";

import { Metric, ParticipantFooter, ParticipantHeader } from "@/components/hv/chrome";
import { publicStateQuery, useLiveAllocations } from "@/lib/live";

export const Route = createFileRoute("/closed")({
  head: () => ({
    meta: [
      { title: "Selection Closed — HackVerse 2K26" },
      { name: "description", content: "All available HackVerse 2K26 problem statement slots have been allocated." },
      { property: "og:title", content: "Selection Closed — HackVerse 2K26" },
      { property: "og:description", content: "All available problem statement slots have been allocated." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(publicStateQuery),
  component: ClosedPage,
});

function ClosedPage() {
  const { data } = useSuspenseQuery(publicStateQuery);
  useLiveAllocations([["public-state"]]);
  const { stats } = data;
  const notAllocated = Math.max(0, stats.total_registered_teams - stats.allocated_teams);

  return (
    <div className="flex min-h-screen flex-col">
      <ParticipantHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-16 sm:px-6">
        <div className="hv-panel p-8">
          <div className="flex items-center gap-3">
            <Lock className="h-5 w-5 text-destructive" />
            <p className="hv-label text-destructive">Selection closed</p>
          </div>
          <h1 className="font-display mt-4 text-4xl font-black tracking-tighter uppercase sm:text-5xl">
            Selection Closed
          </h1>
          <p className="mt-4 text-base text-muted-foreground">
            All {stats.max_allocated_teams} problem statement slots have been successfully allocated. No further
            selection is allowed.
          </p>

          <div className="mt-8 grid gap-px bg-border sm:grid-cols-3">
            <Metric label="Teams Registered" value={stats.total_registered_teams} />
            <Metric label="Teams Allocated" value={stats.allocated_teams} tone="primary" />
            <Metric label="Teams Not Allocated" value={notAllocated} tone="danger" />
          </div>

          <p className="hv-mono mt-8 text-[11px] text-muted-foreground">
            For queries, contact the HackVerse 2K26 organising desk at the venue.
          </p>
          <Link
            to="/"
            className="hv-mono mt-6 inline-flex border border-border-strong px-5 py-3 text-xs font-bold tracking-widest uppercase hover:bg-accent"
          >
            Back to home
          </Link>
        </div>
      </main>
      <ParticipantFooter />
    </div>
  );
}
