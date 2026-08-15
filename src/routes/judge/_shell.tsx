import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { ClipboardList, LayoutDashboard, Loader2, LogOut, ShieldAlert } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { JUDGE_QUERY_KEYS, judgeWhoamiQuery } from "@/lib/judge.queries";
import { useLiveAllocations } from "@/lib/live";
import { cn } from "@/lib/utils";

/**
 * Pathless layout so /judge/login stays outside the guard. Judges hold no
 * admin role, so the admin shell rejects them independently of this.
 */
export const Route = createFileRoute("/judge/_shell")({
  head: () => ({
    meta: [
      { title: "Judge Evaluation — HackVerse 2K26" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: JudgeLayout,
});

const NAV = [
  { to: "/judge", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/judge/teams", label: "Teams", icon: ClipboardList, exact: false },
] as const;

function Gate({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-4">
      {children}
    </div>
  );
}

function JudgeLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isPending, isError } = useQuery(judgeWhoamiQuery);

  useEffect(() => {
    if (isError) void navigate({ to: "/judge/login", replace: true });
  }, [isError, navigate]);

  useLiveAllocations(JUDGE_QUERY_KEYS);

  async function onSignOut() {
    await supabase.auth.signOut();
    queryClient.clear();
    void navigate({ to: "/judge/login", replace: true });
  }

  if (isPending) {
    return (
      <Gate>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <p className="hv-mono text-[11px] tracking-widest text-muted-foreground uppercase">
          Verifying judge access…
        </p>
      </Gate>
    );
  }

  if (isError || !data?.isJudge) {
    return (
      <Gate>
        <ShieldAlert className="h-6 w-6 text-destructive" />
        <p className="font-display text-lg font-black tracking-tight uppercase">Access denied</p>
        <p className="max-w-sm text-center text-sm text-muted-foreground">
          {data?.status === "disabled"
            ? "This judge account has been disabled by the organizers."
            : "This account is not registered as a judge for HackVerse 2K26."}
        </p>
        <button
          type="button"
          onClick={onSignOut}
          className="hv-mono mt-2 border border-border-strong px-4 py-2.5 text-[11px] font-bold tracking-widest uppercase hover:bg-accent"
        >
          Sign out
        </button>
      </Gate>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <img
            src="/hackverse-logo.png"
            alt=""
            width={54}
            height={36}
            className="h-8 w-auto shrink-0"
          />
          <div className="min-w-0 flex-1 leading-none">
            <p className="font-display truncate text-sm font-extrabold tracking-tight">
              HACKVERSE 2K26
            </p>
            <p className="hv-label mt-1">Judge Evaluation Portal</p>
          </div>
          <div className="hidden text-right leading-none sm:block">
            <p className="text-xs font-semibold">{data.name}</p>
            <p className="hv-mono mt-1 text-[10px] text-muted-foreground">{data.username}</p>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            aria-label="Sign out"
            className="hv-mono flex shrink-0 items-center gap-1.5 border border-border-strong px-3 py-2 text-[10px] font-bold tracking-widest uppercase transition-colors hover:text-destructive"
          >
            <LogOut className="h-3 w-3" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>

        <nav className="mx-auto flex max-w-5xl gap-px px-4 sm:px-6">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.exact }}
              activeProps={{ className: "border-primary text-foreground" }}
              inactiveProps={{
                className: "border-transparent text-muted-foreground hover:text-foreground",
              }}
              className={cn(
                "hv-mono flex items-center gap-2 border-b-2 px-3 py-2.5 text-[11px] font-bold tracking-widest uppercase transition-colors",
              )}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
