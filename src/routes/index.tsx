import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, Lock, ShieldCheck } from "lucide-react";

import { LiveDot, Metric, ParticipantFooter, ParticipantHeader, SectionHeading } from "@/components/hv/chrome";
import { publicStateQuery, useLiveAllocations } from "@/lib/live";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HackVerse 2K26 — Problem Statement Selection" },
      {
        name: "description",
        content:
          "Choose your domain and secure your problem statement for HackVerse 2K26. 25 problem statements, 50 slots, first come first served.",
      },
      { property: "og:title", content: "HackVerse 2K26 — Problem Statement Selection" },
      {
        property: "og:description",
        content: "Live first-come-first-served problem statement allocation for HackVerse 2K26.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(publicStateQuery),
  component: Landing,
});

function Landing() {
  const { data } = useSuspenseQuery(publicStateQuery);
  useLiveAllocations([["public-state"]]);

  const { stats, domains } = data;
  const remaining = Math.max(0, stats.max_allocated_teams - stats.allocated_teams);
  const closed = stats.selection_status === "closed" || remaining === 0;
  const paused = stats.selection_status === "paused";
  const progress = stats.max_allocated_teams > 0 ? (stats.allocated_teams / stats.max_allocated_teams) * 100 : 0;

  return (
    <div className="flex min-h-screen flex-col">
      <ParticipantHeader right={<LiveDot />} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6">
        <section className="grid gap-10 border-b border-border py-12 lg:grid-cols-[1.35fr_1fr] lg:gap-14 lg:py-16">
          <div>
            <div className="hv-mono inline-flex items-center gap-2 border border-border px-2.5 py-1 text-[10px] font-bold tracking-widest uppercase">
              <span className="h-1.5 w-1.5 bg-primary" />
              TRR College of Technology
            </div>
            <h1 className="font-display mt-5 text-5xl leading-[0.92] font-black tracking-tighter uppercase sm:text-6xl lg:text-7xl">
              Hackverse
              <br />
              <span className="text-primary">2K26</span>
            </h1>
            <p className="font-display mt-5 text-xl font-bold tracking-tight uppercase sm:text-2xl">
              Problem Statement Selection
            </p>
            <p className="mt-3 max-w-xl text-base text-muted-foreground">
              Choose your domain. Secure your problem statement.{" "}
              <span className="text-foreground">First come, first served.</span>
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              {closed ? (
                <Link
                  to="/closed"
                  className="hv-mono inline-flex items-center gap-2 border border-destructive/60 bg-destructive/10 px-6 py-3.5 text-xs font-bold tracking-widest text-destructive uppercase"
                >
                  <Lock className="h-3.5 w-3.5" /> Selection Closed
                </Link>
              ) : (
                <Link
                  to="/select"
                  className="hv-mono group inline-flex items-center gap-2 bg-primary px-6 py-3.5 text-xs font-bold tracking-widest text-primary-foreground uppercase transition-transform hover:-translate-y-0.5"
                >
                  Start Selection
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </Link>
              )}
              <span className="hv-mono flex items-center gap-2 text-[11px] text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                One problem statement per team. Locked on confirmation.
              </span>
            </div>

            {paused ? (
              <p className="hv-mono mt-6 border-l-2 border-warning bg-warning/10 px-4 py-3 text-xs text-warning">
                Problem statement selection is temporarily paused by the organizers.
              </p>
            ) : null}
          </div>

          <div className="hv-panel self-start p-5">
            <div className="flex items-center justify-between">
              <p className="hv-label">Live allocation status</p>
              <LiveDot label="Realtime" />
            </div>
            <p className="font-display mt-4 text-4xl leading-none font-black tabular-nums">
              {stats.allocated_teams}
              <span className="text-muted-foreground"> / {stats.max_allocated_teams}</span>
            </p>
            <p className="hv-label mt-2">Teams Allocated</p>

            <div className="mt-4 h-2 w-full bg-muted">
              <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-px bg-border">
              {[
                ["Slots Remaining", remaining],
                ["Problem Statements", stats.total_problem_statements],
                ["Open PS Slots", stats.available_ps_slots],
                ["Registered Teams", stats.total_registered_teams],
              ].map(([label, value]) => (
                <div key={String(label)} className="bg-surface px-3 py-3">
                  <dt className="hv-label text-[10px]">{label}</dt>
                  <dd className="font-display mt-1 text-xl font-extrabold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="py-12">
          <SectionHeading eyebrow="Step 02 preview" title="Domains" />
          <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
            {domains.map((domain) => (
              <div key={domain.id} className="bg-surface p-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="hv-mono text-[11px] font-bold text-primary">
                    D-{String(domain.display_order).padStart(2, "0")}
                  </p>
                  {domain.is_full ? (
                    <span className="hv-mono border border-destructive/50 px-2 py-0.5 text-[10px] font-bold tracking-widest text-destructive">
                      DOMAIN FULL
                    </span>
                  ) : null}
                </div>
                <h3 className="font-display mt-3 text-base leading-tight font-bold">{domain.name}</h3>
                <p className="hv-mono mt-3 text-[11px] text-muted-foreground">
                  {domain.ps_count} Problem Statements · {domain.remaining_slots} Slots Remaining
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-px bg-border pb-14 sm:grid-cols-3">
          <Metric label="Capacity per problem statement" value="2 Teams" tone="primary" hint="Maximum, enforced by the server" />
          <Metric label="Allocation rule" value="FCFS" tone="signal" hint="First come, first served" />
          <Metric
            label="Unsuccessful teams"
            value={Math.max(0, stats.total_registered_teams - stats.max_allocated_teams)}
            tone="danger"
            hint="Teams that will not receive a slot"
          />
        </section>
      </main>

      <ParticipantFooter />
    </div>
  );
}
