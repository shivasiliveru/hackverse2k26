import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  Activity,
  LayoutDashboard,
  ListChecks,
  Layers,
  LogOut,
  Settings,
  SlidersHorizontal,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ nav */

export const ADMIN_NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/allocations", label: "Allocations", icon: ListChecks },
  { to: "/admin/teams", label: "Teams", icon: Users },
  { to: "/admin/problem-statements", label: "Problem Statements", icon: SlidersHorizontal },
  { to: "/admin/domains", label: "Domains", icon: Layers },
  { to: "/admin/activity", label: "Activity Log", icon: Activity },
  { to: "/admin/settings", label: "Settings", icon: Settings },
] as const;

export function AdminSidebar({
  email,
  onSignOut,
}: {
  email: string | null;
  onSignOut: () => void;
}) {
  return (
    <aside className="flex shrink-0 flex-col border-border bg-sidebar lg:h-screen lg:w-60 lg:border-r">
      <div className="flex items-center gap-3 border-b border-border px-4 py-4 lg:px-5">
        <img
          src="/hackverse-logo.png"
          alt=""
          width={54}
          height={36}
          className="h-9 w-auto shrink-0"
        />
        <span className="leading-none">
          <span className="font-display block text-sm font-extrabold tracking-tight">
            HACKVERSE 2K26
          </span>
          <span className="hv-label mt-1 block text-[10px]">Control Center</span>
        </span>
      </div>

      <nav className="flex gap-px overflow-x-auto p-2 lg:flex-1 lg:flex-col lg:overflow-visible lg:p-3">
        {ADMIN_NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.to === "/admin" }}
            activeProps={{ className: "bg-sidebar-accent text-foreground" }}
            inactiveProps={{
              className: "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
            }}
            className="hv-mono flex shrink-0 items-center gap-2.5 px-3 py-2.5 text-[11px] font-bold tracking-widest uppercase transition-colors"
          >
            <item.icon className="h-3.5 w-3.5 shrink-0" />
            <span className="whitespace-nowrap">{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="hidden border-t border-border px-3 py-3 lg:block">
        <p className="hv-mono truncate px-1 text-[10px] text-muted-foreground">{email ?? "—"}</p>
        <button
          type="button"
          onClick={onSignOut}
          className="hv-mono mt-2 flex w-full items-center gap-2 px-1 py-1.5 text-[10px] font-bold tracking-widest text-muted-foreground uppercase transition-colors hover:text-destructive"
        >
          <LogOut className="h-3 w-3" /> Sign out
        </button>
      </div>
    </aside>
  );
}

/* --------------------------------------------------------------- headings */

export function AdminPageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
      <div>
        <p className="hv-label">{subtitle ?? "HackVerse 2K26"}</p>
        <h1 className="font-display mt-2 text-2xl font-black tracking-tighter uppercase sm:text-3xl">
          {title}
        </h1>
      </div>
      {right ? <div className="flex flex-wrap items-center gap-2">{right}</div> : null}
    </div>
  );
}

export function DataPanel({
  title,
  hint,
  right,
  children,
  className,
}: {
  title: string;
  hint?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("hv-panel", className)}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="font-display text-sm font-extrabold tracking-tight uppercase">{title}</h2>
          {hint ? <p className="hv-mono mt-1 text-[10px] text-muted-foreground">{hint}</p> : null}
        </div>
        {right}
      </header>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ pills */

export type PillTone = "neutral" | "success" | "warning" | "danger" | "primary" | "signal";

export function Pill({ label, tone = "neutral" }: { label: string; tone?: PillTone }) {
  return (
    <span
      className={cn(
        "hv-mono inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] font-bold tracking-widest whitespace-nowrap uppercase",
        tone === "neutral" && "border-border-strong text-muted-foreground",
        tone === "success" && "border-success/50 bg-success/10 text-success",
        tone === "warning" && "border-warning/50 bg-warning/10 text-warning",
        tone === "danger" && "border-destructive/50 bg-destructive/10 text-destructive",
        tone === "primary" && "border-primary/50 bg-primary/10 text-primary",
        tone === "signal" && "border-signal/50 bg-signal/10 text-signal",
      )}
    >
      {label}
    </span>
  );
}

/** Admin status language, §46: AVAILABLE / PARTIALLY ALLOCATED / FULL. */
export function psStatusTone(allocated: number, capacity: number): PillTone {
  if (allocated >= capacity) return "danger";
  if (allocated > 0) return "warning";
  return "success";
}

export function teamStatusTone(status: string): PillTone {
  if (status === "allocated") return "primary";
  if (status === "disqualified") return "danger";
  if (status === "inactive") return "neutral";
  return "success";
}

export function selectionStatusTone(status: string): PillTone {
  if (status === "closed") return "danger";
  if (status === "paused") return "warning";
  return "success";
}

/* ---------------------------------------------------------------- toolbar */

export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
      {children}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="hv-mono min-w-0 flex-1 border border-input bg-background px-3 py-2 text-xs outline-none placeholder:text-muted-foreground/70 focus:border-primary sm:max-w-xs"
    />
  );
}

export function FilterTabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; count?: number }[];
}) {
  return (
    <div className="flex flex-wrap gap-px bg-border">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "hv-mono px-3 py-2 text-[10px] font-bold tracking-widest uppercase transition-colors",
            option.value === value
              ? "bg-primary text-primary-foreground"
              : "bg-surface text-muted-foreground hover:bg-surface-raised hover:text-foreground",
          )}
        >
          {option.label}
          {option.count === undefined ? null : (
            <span className={cn("ml-1.5", option.value !== value && "text-muted-foreground/70")}>
              {option.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function SelectField({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  label?: string;
}) {
  return (
    <label className="flex items-center gap-2">
      {label ? <span className="hv-label whitespace-nowrap">{label}</span> : null}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="hv-mono max-w-[220px] border border-input bg-background px-2.5 py-2 text-xs outline-none focus:border-primary"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ----------------------------------------------------------------- states */

export function AdminEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="hv-mono px-4 py-10 text-center text-xs tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

export function AdminLoading({ label = "Loading" }: { label?: string }) {
  return (
    <p className="hv-mono px-4 py-10 text-center text-xs tracking-widest text-muted-foreground uppercase">
      {label}…
    </p>
  );
}

export function ActionButton({
  children,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "outline" | "danger" }) {
  return (
    <button
      {...props}
      className={cn(
        "hv-mono inline-flex items-center justify-center gap-2 px-4 py-2.5 text-[11px] font-bold tracking-widest uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" && "bg-primary text-primary-foreground hover:bg-primary/90",
        variant === "outline" && "border border-border-strong hover:bg-accent",
        variant === "danger" &&
          "border border-destructive/60 bg-destructive/10 text-destructive hover:bg-destructive/20",
        props.className,
      )}
    >
      {children}
    </button>
  );
}
