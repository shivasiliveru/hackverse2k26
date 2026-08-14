import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Printer } from "lucide-react";

import { ParticipantFooter, ParticipantHeader } from "@/components/hv/chrome";
import { formatStamp } from "@/lib/live";
import type { AllocationReceipt } from "@/lib/hackverse-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/success")({
  head: () => ({
    meta: [
      { title: "Problem Statement Locked — HackVerse 2K26" },
      { name: "description", content: "Your HackVerse 2K26 problem statement has been confirmed and locked." },
      { property: "og:title", content: "Problem Statement Locked — HackVerse 2K26" },
      { property: "og:description", content: "Your HackVerse 2K26 problem statement allocation receipt." },
    ],
  }),
  component: SuccessPage,
});

function SuccessPage() {
  const [receipt, setReceipt] = useState<AllocationReceipt | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("hv-receipt");
    if (raw) {
      try {
        setReceipt(JSON.parse(raw) as AllocationReceipt);
      } catch {
        setReceipt(null);
      }
    }
    setReady(true);
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <ParticipantHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        {!ready ? null : receipt ? (
          <div className="hv-panel p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-success" />
              <p className="hv-label text-success">Allocation confirmed</p>
            </div>
            <h1 className="font-display mt-4 text-3xl font-black tracking-tighter uppercase sm:text-4xl">
              Problem Statement Locked
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Your problem statement has been successfully allocated to your team. Save this receipt for reference.
            </p>

            <dl className="mt-8 divide-y divide-border border border-border">
              <Row label="Team" value={receipt.team_name} />
              <Row label="Team ID" value={receipt.team_id} mono />
              <Row label="Domain" value={receipt.domain} />
              <Row label="Problem Statement ID" value={receipt.problem_statement_id} mono />
              <Row label="Title" value={receipt.title} />
              <Row label="Confirmed On" value={formatStamp(receipt.selected_at)} mono />
              <Row label="Allocation Reference" value={receipt.allocation_id} mono />
            </dl>

            <p className="hv-mono mt-6 text-[11px] text-muted-foreground">
              This allocation is final and cannot be changed. Report to the HackVerse 2K26 desk with this reference.
            </p>

            <div className="mt-8 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => window.print()}
                className="hv-mono inline-flex items-center justify-center gap-2 bg-primary px-5 py-3.5 text-xs font-bold tracking-widest text-primary-foreground uppercase"
              >
                <Printer className="h-3.5 w-3.5" /> Print receipt
              </button>
              <Link
                to="/"
                className="hv-mono inline-flex items-center justify-center border border-border-strong px-5 py-3.5 text-xs font-bold tracking-widest uppercase hover:bg-accent"
              >
                Back to home
              </Link>
            </div>
          </div>
        ) : (
          <div className="hv-panel p-8 text-center">
            <h1 className="font-display text-2xl font-extrabold tracking-tight uppercase">No receipt found</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              This receipt is only available right after confirming a selection. Verify your team again to view your
              existing allocation.
            </p>
            <Link
              to="/select"
              className="hv-mono mt-6 inline-flex border border-border-strong px-5 py-3 text-xs font-bold tracking-widest uppercase hover:bg-accent"
            >
              Go to selection
            </Link>
          </div>
        )}
      </main>
      <ParticipantFooter />
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <dt className="hv-label">{label}</dt>
      <dd className={cn("text-sm font-semibold", mono && "hv-mono text-xs break-all")}>{value}</dd>
    </div>
  );
}
