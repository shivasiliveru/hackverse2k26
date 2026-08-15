import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";

import { HackverseMark, LiveDot } from "@/components/hv/chrome";
import { formatScore } from "@/lib/hackverse-types";
import { getPublicLeaderboard } from "@/lib/participant.functions";
import { useLiveAllocations } from "@/lib/live";
import { cn } from "@/lib/utils";

const publicLeaderboardQuery = queryOptions({
  queryKey: ["public-leaderboard"],
  queryFn: () => getPublicLeaderboard(),
  staleTime: 5_000,
});

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — HackVerse 2K26" },
      {
        name: "description",
        content: "Live standings for HackVerse 2K26 at TRR College of Technology.",
      },
    ],
  }),
  component: PublicLeaderboard,
});

function PublicLeaderboard() {
  const { data, isPending } = useQuery(publicLeaderboardQuery);
  useLiveAllocations([["public-leaderboard"]]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-surface/80">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <HackverseMark />
          {data?.enabled && !data.frozen ? <LiveDot /> : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        {isPending ? (
          <p className="hv-mono py-16 text-center text-xs tracking-widest text-muted-foreground uppercase">
            Loading…
          </p>
        ) : !data?.enabled ? (
          // §35: when disabled this route must not leak the ranking at all.
          <div className="hv-panel px-6 py-16 text-center">
            <p className="hv-label">Not available</p>
            <h1 className="font-display mt-3 text-2xl font-black tracking-tighter uppercase">
              Leaderboard is not public
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              The organizers have not published the standings yet. Please check back later.
            </p>
            <Link
              to="/"
              className="hv-mono mt-6 inline-flex items-center justify-center border border-border-strong px-5 py-2.5 text-[11px] font-bold tracking-widest uppercase transition-colors hover:bg-accent"
            >
              Return home
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
              <div>
                <p className="hv-label">{data.frozen ? "Final results" : "Live standings"}</p>
                <h1 className="font-display mt-2 text-2xl font-black tracking-tighter uppercase sm:text-3xl">
                  {data.frozen ? "HackVerse 2K26 — Final Results" : "Leaderboard"}
                </h1>
              </div>
            </div>

            {data.rows.length === 0 ? (
              <p className="hv-mono py-16 text-center text-xs tracking-wide text-muted-foreground">
                No scores have been published yet.
              </p>
            ) : (
              <ol className="mt-6 space-y-2">
                {data.rows.map((row) => (
                  <li
                    key={row.team_code}
                    className={cn(
                      "hv-panel flex items-center gap-4 px-4 py-3.5",
                      row.rank === 1 && "border-primary/60 bg-primary/5",
                    )}
                  >
                    <span
                      className={cn(
                        "font-display w-12 shrink-0 text-xl leading-none font-black tabular-nums",
                        row.rank === 1 ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      #{row.rank}
                    </span>
                    {row.rank === 1 ? <Trophy className="h-4 w-4 shrink-0 text-primary" /> : null}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{row.team_name}</span>
                      <span className="hv-mono mt-0.5 block text-[10px] text-muted-foreground">
                        {row.team_code}
                      </span>
                    </span>
                    <span className="font-display shrink-0 text-xl leading-none font-black tabular-nums">
                      {formatScore(row.total_score)}
                    </span>
                  </li>
                ))}
              </ol>
            )}

            <p className="hv-mono mt-6 text-center text-[10px] tracking-wide text-muted-foreground">
              {data.frozen
                ? "These results are final."
                : "Standings update live as evaluations are submitted."}
            </p>
          </>
        )}
      </main>

      <footer className="border-t border-border px-4 py-5 sm:px-6">
        <p className="hv-mono mx-auto max-w-3xl text-center text-[10px] tracking-wide text-muted-foreground">
          HACKVERSE 2K26 · TRR COLLEGE OF TECHNOLOGY
        </p>
      </footer>
    </div>
  );
}
