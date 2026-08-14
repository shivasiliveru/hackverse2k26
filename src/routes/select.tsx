import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

import { EmptyState, LiveDot, ParticipantFooter, ParticipantHeader, SlotBadge, StepIndicator } from "@/components/hv/chrome";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { publicStateQuery, formatStamp, useLiveAllocations } from "@/lib/live";
import { confirmAllocation, verifyTeam } from "@/lib/participant.functions";
import type { PublicDomain, PublicProblemStatement } from "@/lib/hackverse-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/select")({
  head: () => ({
    meta: [
      { title: "Select Your Problem Statement — HackVerse 2K26" },
      {
        name: "description",
        content: "Verify your team, choose a domain and lock your HackVerse 2K26 problem statement.",
      },
      { property: "og:title", content: "Select Your Problem Statement — HackVerse 2K26" },
      { property: "og:description", content: "Verify your team and lock a problem statement. First come, first served." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(publicStateQuery),
  component: SelectFlow,
});

interface VerifiedTeam {
  team_id: string;
  team_name: string;
  leader_name: string | null;
}

function SelectFlow() {
  const { data } = useSuspenseQuery(publicStateQuery);
  useLiveAllocations([["public-state"]]);
  const navigate = useNavigate();

  const runVerify = useServerFn(verifyTeam);
  const runConfirm = useServerFn(confirmAllocation);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [teamName, setTeamName] = useState("");
  const [teamId, setTeamId] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [team, setTeam] = useState<VerifiedTeam | null>(null);
  const [existing, setExisting] = useState<{
    team_name: string;
    team_id: string;
    problem_statement_id: string;
    title: string;
    domain: string;
    selected_at: string;
  } | null>(null);
  const [domain, setDomain] = useState<PublicDomain | null>(null);
  const [detail, setDetail] = useState<PublicProblemStatement | null>(null);
  const [chosen, setChosen] = useState<PublicProblemStatement | null>(null);
  const [locking, setLocking] = useState(false);

  const { stats, domains, problemStatements } = data;
  const closed = stats.selection_status === "closed" || stats.allocated_teams >= stats.max_allocated_teams;
  const paused = stats.selection_status === "paused";

  const liveChosen = useMemo(
    () => (chosen ? problemStatements.find((p) => p.id === chosen.id) ?? chosen : null),
    [chosen, problemStatements],
  );
  const domainItems = useMemo(
    () => (domain ? problemStatements.filter((p) => p.domain_id === domain.id) : []),
    [domain, problemStatements],
  );

  async function onVerify(event: React.FormEvent) {
    event.preventDefault();
    if (verifying) return;
    setVerifyError(null);
    setVerifying(true);
    try {
      const result = await runVerify({ data: { teamName, teamId } });
      if (result.status === "not_found") {
        setVerifyError("Invalid Team ID. Please check your registration details.");
      } else if (result.status === "ineligible") {
        setVerifyError("This team is not eligible for problem statement selection.");
      } else if (result.status === "already_allocated") {
        setExisting({
          team_name: result.team.team_name,
          team_id: result.team.team_id,
          ...result.allocation,
        });
      } else {
        setTeam(result.team);
        setStep(2);
      }
    } catch {
      setVerifyError("We could not verify your team right now. Please try again.");
    } finally {
      setVerifying(false);
    }
  }

  async function onLock() {
    if (!team || !liveChosen || locking) return;
    setLocking(true);
    try {
      const result = await runConfirm({
        data: { teamId: team.team_id, problemStatementId: liveChosen.code },
      });
      if (result.ok) {
        sessionStorage.setItem("hv-receipt", JSON.stringify(result.receipt));
        await navigate({ to: "/success" });
        return;
      }
      toast.error(result.message);
      if (result.code === "LIMIT_REACHED" || result.code === "CLOSED") {
        await navigate({ to: "/closed" });
        return;
      }
      if (result.code === "ALREADY_ALLOCATED") {
        setStep(1);
        setTeam(null);
      } else if (result.code === "PS_FULL" || result.code === "PS_INACTIVE" || result.code === "PS_NOT_FOUND") {
        setChosen(null);
        setStep(3);
      }
    } catch {
      toast.error("Allocation failed. Please try again.");
    } finally {
      setLocking(false);
    }
  }

  if (closed) {
    return (
      <Shell>
        <div className="hv-panel p-8 text-center">
          <Lock className="mx-auto h-6 w-6 text-destructive" />
          <h1 className="font-display mt-4 text-3xl font-black tracking-tighter uppercase">Selection Closed</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            ALL AVAILABLE SLOTS HAVE BEEN ALLOCATED.
          </p>
          <Link
            to="/closed"
            className="hv-mono mt-6 inline-flex border border-border-strong px-5 py-3 text-xs font-bold tracking-widest uppercase hover:bg-accent"
          >
            View final status
          </Link>
        </div>
      </Shell>
    );
  }

  if (existing) {
    return (
      <Shell>
        <div className="hv-panel p-8">
          <p className="hv-label text-warning">Already selected</p>
          <h1 className="font-display mt-3 text-2xl font-extrabold tracking-tight uppercase">
            This team has already selected a problem statement.
          </h1>
          <dl className="mt-6 divide-y divide-border border border-border">
            <Row label="Team" value={existing.team_name} />
            <Row label="Team ID" value={existing.team_id} mono />
            <Row label="Domain" value={existing.domain} />
            <Row label="Problem Statement" value={`${existing.problem_statement_id} — ${existing.title}`} />
            <Row label="Selected On" value={formatStamp(existing.selected_at)} mono />
          </dl>
          <p className="hv-mono mt-5 text-[11px] text-muted-foreground">
            Problem statement allocations cannot be changed after confirmation.
          </p>
          <Link
            to="/"
            className="hv-mono mt-6 inline-flex border border-border-strong px-5 py-3 text-xs font-bold tracking-widest uppercase hover:bg-accent"
          >
            Back to home
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <StepIndicator current={step} />

      {paused ? (
        <p className="hv-mono mt-4 border-l-2 border-warning bg-warning/10 px-4 py-3 text-xs text-warning">
          Problem statement selection is temporarily paused by the organizers.
        </p>
      ) : null}

      {/* ---------------------------------------------------------- step 1 */}
      {step === 1 ? (
        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <form onSubmit={onVerify} className="hv-panel p-6">
            <p className="hv-label">Step 01</p>
            <h1 className="font-display mt-2 text-2xl font-extrabold tracking-tight uppercase">Team Verification</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter your registered team details exactly as submitted during registration.
            </p>

            <div className="mt-6 space-y-4">
              <Field label="Team Name">
                <input
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  required
                  maxLength={120}
                  placeholder="Your registered team name"
                  className="w-full border border-input bg-background px-3 py-3 text-sm outline-none focus:border-primary"
                />
              </Field>
              <Field label="Team ID">
                <input
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value.toUpperCase())}
                  required
                  maxLength={40}
                  placeholder="HV2026-0001"
                  className="hv-mono w-full border border-input bg-background px-3 py-3 text-sm tracking-widest outline-none focus:border-primary"
                />
              </Field>
            </div>

            {verifyError ? (
              <p className="hv-mono mt-4 flex items-start gap-2 border-l-2 border-destructive bg-destructive/10 px-3 py-2.5 text-[11px] text-destructive">
                <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                {verifyError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={verifying}
              className="hv-mono mt-6 inline-flex w-full items-center justify-center gap-2 bg-primary px-6 py-3.5 text-xs font-bold tracking-widest text-primary-foreground uppercase disabled:opacity-60 sm:w-auto"
            >
              {verifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {verifying ? "Verifying team..." : "Continue"}
            </button>
          </form>

          <aside className="hv-panel h-fit p-5">
            <div className="flex items-center justify-between">
              <p className="hv-label">Live</p>
              <LiveDot />
            </div>
            <p className="font-display mt-3 text-3xl font-black tabular-nums">
              {stats.allocated_teams}
              <span className="text-muted-foreground"> / {stats.max_allocated_teams}</span>
            </p>
            <p className="hv-label mt-1">Teams allocated</p>
            <p className="hv-mono mt-4 text-[11px] text-muted-foreground">
              {stats.available_ps_slots} problem statement slots still open across {stats.total_problem_statements}{" "}
              statements.
            </p>
          </aside>
        </section>
      ) : null}

      {/* ---------------------------------------------------------- step 2 */}
      {step === 2 && team ? (
        <section className="mt-6">
          <TeamStrip team={team} />
          <div className="mt-6 flex items-end justify-between">
            <div>
              <p className="hv-label">Step 02</p>
              <h1 className="font-display mt-1.5 text-2xl font-extrabold tracking-tight uppercase">Select a Domain</h1>
            </div>
          </div>

          <div className="mt-4 grid gap-px bg-border md:grid-cols-2">
            {domains.map((d) => (
              <button
                key={d.id}
                type="button"
                disabled={d.is_full}
                onClick={() => {
                  setDomain(d);
                  setStep(3);
                }}
                className={cn(
                  "group bg-surface p-5 text-left transition-colors",
                  d.is_full ? "cursor-not-allowed opacity-70" : "hover:bg-surface-raised",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="hv-mono text-[11px] font-bold text-primary">
                    D-{String(d.display_order).padStart(2, "0")}
                  </span>
                  {d.is_full ? (
                    <span className="hv-mono border border-destructive/50 bg-destructive/10 px-2 py-0.5 text-[10px] font-bold tracking-widest text-destructive">
                      DOMAIN FULL
                    </span>
                  ) : (
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                  )}
                </div>
                <h2 className="font-display mt-3 text-lg leading-tight font-bold">{d.name}</h2>
                <p className="hv-mono mt-3 text-[11px] text-muted-foreground">
                  {d.ps_count} Problem Statements · {d.remaining_slots} Slots Remaining
                </p>
                {d.is_full ? (
                  <p className="hv-mono mt-2 text-[11px] text-destructive">
                    All problem statements in this domain have already been selected.
                  </p>
                ) : null}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {/* ---------------------------------------------------------- step 3 */}
      {step === 3 && team && domain ? (
        <section className="mt-6">
          <TeamStrip team={team} />
          <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="hv-label">Step 03 · {domain.name}</p>
              <h1 className="font-display mt-1.5 text-2xl font-extrabold tracking-tight uppercase">
                Problem Statements
              </h1>
            </div>
            <button
              type="button"
              onClick={() => {
                setDomain(null);
                setStep(2);
              }}
              className="hv-mono inline-flex items-center gap-2 border border-border-strong px-4 py-2.5 text-[11px] font-bold tracking-widest uppercase hover:bg-accent"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Domains
            </button>
          </div>

          {domainItems.length === 0 ? (
            <div className="mt-4">
              <EmptyState>No active problem statements are currently available in this domain.</EmptyState>
            </div>
          ) : (
            <div className="mt-4 grid gap-px bg-border md:grid-cols-2">
              {domainItems.map((ps) => {
                const full = ps.remaining_slots <= 0;
                return (
                  <div key={ps.id} className="flex flex-col bg-surface p-5">
                    <div className="flex items-start justify-between gap-3">
                      <span className="hv-mono text-sm font-bold text-primary">{ps.code}</span>
                      <SlotBadge remaining={ps.remaining_slots} capacity={ps.capacity} />
                    </div>
                    <h3 className="font-display mt-3 text-base leading-tight font-bold">{ps.title}</h3>
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{ps.description}</p>
                    {ps.remaining_slots === 1 ? (
                      <p className="hv-mono mt-3 text-[10px] font-bold tracking-wide text-warning">
                        1 SLOT REMAINING — FIRST COME, FIRST SERVED
                      </p>
                    ) : null}
                    <div className="mt-4 flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setDetail(ps)}
                        className="hv-mono border border-border-strong px-4 py-2.5 text-[11px] font-bold tracking-widest uppercase hover:bg-accent"
                      >
                        View details
                      </button>
                      <button
                        type="button"
                        disabled={full}
                        onClick={() => {
                          setChosen(ps);
                          setStep(4);
                        }}
                        className="hv-mono flex-1 bg-primary px-4 py-2.5 text-[11px] font-bold tracking-widest text-primary-foreground uppercase disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                      >
                        {full ? "Full" : "Select"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {/* ---------------------------------------------------------- step 4 */}
      {step === 4 && team && liveChosen ? (
        <section className="mt-6">
          <div className="hv-panel p-6 sm:p-8">
            <p className="hv-label">Step 04</p>
            <h1 className="font-display mt-2 text-2xl font-extrabold tracking-tight uppercase">
              Confirm Your Selection
            </h1>

            <dl className="mt-6 divide-y divide-border border border-border">
              <Row label="Team" value={team.team_name} />
              <Row label="Team ID" value={team.team_id} mono />
              <Row label="Domain" value={domain?.name ?? "—"} />
              <Row label="Problem Statement" value={`${liveChosen.code} — ${liveChosen.title}`} />
              <Row
                label="Available Slots"
                value={liveChosen.remaining_slots <= 0 ? "FULL" : `${liveChosen.remaining_slots} remaining`}
                mono
              />
            </dl>

            <p className="hv-mono mt-5 flex items-start gap-2 border-l-2 border-warning bg-warning/10 px-3 py-3 text-[11px] text-warning">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              Once confirmed, your problem statement cannot be changed.
            </p>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={locking}
                onClick={() => {
                  setChosen(null);
                  setStep(3);
                }}
                className="hv-mono inline-flex items-center justify-center gap-2 border border-border-strong px-5 py-3.5 text-xs font-bold tracking-widest uppercase hover:bg-accent disabled:opacity-50"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Go back
              </button>
              <button
                type="button"
                disabled={locking || paused || liveChosen.remaining_slots <= 0}
                onClick={onLock}
                className="hv-mono inline-flex flex-1 items-center justify-center gap-2 bg-primary px-6 py-3.5 text-xs font-bold tracking-widest text-primary-foreground uppercase disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
              >
                {locking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                {locking ? "Locking problem statement..." : "Confirm & lock problem statement"}
              </button>
            </div>
            {liveChosen.remaining_slots <= 0 ? (
              <p className="hv-mono mt-3 text-[11px] text-destructive">
                This problem statement was just taken by another team. Go back and select another one.
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border-border bg-surface sm:max-w-2xl">
          {detail ? (
            <>
              <DialogHeader>
                <p className="hv-mono text-xs font-bold text-primary">
                  {detail.code} · {domain?.name}
                </p>
                <DialogTitle className="font-display text-xl font-extrabold tracking-tight">
                  {detail.title}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <SlotBadge remaining={detail.remaining_slots} capacity={detail.capacity} />
                  <span className="hv-mono text-[11px] text-muted-foreground">
                    {detail.allocated_count} of {detail.capacity} teams allocated
                  </span>
                </div>
                <Block title="Problem statement">{detail.full_description || detail.description}</Block>
                {detail.requirements ? <Block title="Requirements">{detail.requirements}</Block> : null}
                {detail.expected_solution ? (
                  <Block title="Expected solution direction">{detail.expected_solution}</Block>
                ) : null}
                <button
                  type="button"
                  disabled={detail.remaining_slots <= 0}
                  onClick={() => {
                    setChosen(detail);
                    setDetail(null);
                    setStep(4);
                  }}
                  className="hv-mono w-full bg-primary px-6 py-3.5 text-xs font-bold tracking-widest text-primary-foreground uppercase disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                >
                  {detail.remaining_slots <= 0 ? "Full" : "Select this problem statement"}
                </button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <ParticipantHeader right={<LiveDot />} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <ParticipantFooter />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="hv-label mb-2 block">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <dt className="hv-label">{label}</dt>
      <dd className={cn("text-sm font-semibold", mono && "hv-mono text-xs")}>{value}</dd>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="hv-label">{title}</p>
      <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{children}</p>
    </div>
  );
}

function TeamStrip({ team }: { team: VerifiedTeam }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border border-border bg-surface px-4 py-3">
      <span className="hv-mono flex items-center gap-2 text-[11px] font-bold text-success">
        <Check className="h-3.5 w-3.5" /> TEAM VERIFIED
      </span>
      <span className="text-sm font-semibold">{team.team_name}</span>
      <span className="hv-mono text-[11px] text-muted-foreground">{team.team_id}</span>
      {team.leader_name ? (
        <span className="hv-mono text-[11px] text-muted-foreground">Leader: {team.leader_name}</span>
      ) : null}
    </div>
  );
}
