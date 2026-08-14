import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function HackverseMark({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn("group flex items-center gap-3", className)}>
      <span className="flex h-8 w-8 items-center justify-center bg-primary text-primary-foreground">
        <span className="font-display text-base leading-none font-black">H</span>
      </span>
      <span className="leading-none">
        <span className="font-display block text-sm font-extrabold tracking-tight">HACKVERSE 2K26</span>
        <span className="hv-label mt-1 block text-[10px]">Problem Statement Selection</span>
      </span>
    </Link>
  );
}

export function ParticipantHeader({ right }: { right?: ReactNode }) {
  return (
    <header className="border-b border-border bg-surface/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <HackverseMark />
        <div className="flex items-center gap-3">{right}</div>
      </div>
    </header>
  );
}

export function ParticipantFooter() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="font-display text-xs font-bold tracking-wide">HACKVERSE 2K26</p>
        <p className="hv-label">TRR College of Technology</p>
      </div>
    </footer>
  );
}

export function LiveDot({ label = "LIVE" }: { label?: string }) {
  return (
    <span className="hv-mono inline-flex items-center gap-2 border border-border px-2 py-1 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
      <span className="hv-live-dot h-1.5 w-1.5 bg-success" />
      {label}
    </span>
  );
}

export function Metric({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "primary" | "danger" | "signal";
}) {
  return (
    <div className="hv-panel relative px-4 py-4">
      <span
        className={cn(
          "absolute top-0 left-0 h-full w-[3px]",
          tone === "primary" && "bg-primary",
          tone === "danger" && "bg-destructive",
          tone === "signal" && "bg-signal",
          tone === "default" && "bg-border-strong",
        )}
      />
      <p className="hv-label">{label}</p>
      <p
        className={cn(
          "font-display mt-2 text-3xl leading-none font-extrabold tabular-nums",
          tone === "primary" && "text-primary",
          tone === "danger" && "text-destructive",
          tone === "signal" && "text-signal",
        )}
      >
        {value}
      </p>
      {hint ? <p className="hv-mono mt-1.5 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function SlotBadge({ remaining, capacity }: { remaining: number; capacity: number }) {
  const full = remaining <= 0;
  const last = remaining === 1;
  return (
    <span
      key={remaining}
      className={cn(
        "hv-slot-enter hv-mono inline-flex items-center gap-1.5 border px-2 py-1 text-[10px] font-bold tracking-widest uppercase",
        full && "border-destructive/50 bg-destructive/10 text-destructive",
        last && "border-warning/50 bg-warning/10 text-warning",
        !full && !last && "border-success/50 bg-success/10 text-success",
      )}
    >
      {full ? "FULL" : last ? "1 SLOT LEFT" : `${remaining} SLOTS`}
      {!full ? <span className="text-muted-foreground">/ {capacity}</span> : null}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow ? <p className="hv-label">{eyebrow}</p> : null}
        <h2 className="font-display mt-1.5 text-xl font-extrabold tracking-tight uppercase">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function StepIndicator({ current }: { current: 1 | 2 | 3 | 4 }) {
  const steps = [
    { n: 1, label: "VERIFY" },
    { n: 2, label: "DOMAIN" },
    { n: 3, label: "SELECT" },
    { n: 4, label: "CONFIRM" },
  ];
  return (
    <ol className="grid grid-cols-4 border border-border">
      {steps.map((step) => {
        const active = step.n === current;
        const done = step.n < current;
        return (
          <li
            key={step.n}
            className={cn(
              "flex items-center gap-2 border-r border-border px-2 py-2.5 last:border-r-0 sm:px-4",
              active && "bg-primary text-primary-foreground",
              done && "bg-surface-raised",
            )}
          >
            <span className={cn("hv-mono text-[11px] font-bold", !active && !done && "text-muted-foreground")}>
              0{step.n}
            </span>
            <span
              className={cn(
                "hv-mono truncate text-[10px] font-bold tracking-widest",
                !active && !done && "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="hv-hatch border border-dashed border-border px-6 py-10 text-center">
      <p className="hv-mono text-xs tracking-wide text-muted-foreground">{children}</p>
    </div>
  );
}
