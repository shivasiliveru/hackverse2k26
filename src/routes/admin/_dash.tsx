import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Loader2, ShieldAlert } from "lucide-react";

import { AdminSidebar } from "@/components/hv/admin-chrome";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_QUERY_KEYS, adminWhoamiQuery } from "@/lib/admin.queries";
import { useLiveAllocations } from "@/lib/live";

/**
 * Pathless layout: everything under it is admin-only. /admin/login sits
 * outside it on purpose, otherwise the guard would bounce organisers away
 * from the very page they sign in on.
 */
export const Route = createFileRoute("/admin/_dash")({
  head: () => ({
    meta: [
      { title: "Control Center — HackVerse 2K26" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLayout,
});

function AdminGate({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-4">
      {children}
    </div>
  );
}

function AdminLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // The bearer token lives in localStorage, so the identity check can only
  // run in the browser — never in a route loader.
  const { data, isPending, isError } = useQuery(adminWhoamiQuery);

  const denied = isError || (data ? !data.isAdmin : false);

  useEffect(() => {
    if (isError) void navigate({ to: "/admin/login", replace: true });
  }, [isError, navigate]);

  // One subscription for the whole dashboard: every admin query key is
  // invalidated whenever the backend changes, which is what makes the
  // control center track the live event without a manual refresh.
  useLiveAllocations(ADMIN_QUERY_KEYS);

  async function onSignOut() {
    await supabase.auth.signOut();
    queryClient.clear();
    void navigate({ to: "/admin/login", replace: true });
  }

  if (isPending) {
    return (
      <AdminGate>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <p className="hv-mono text-[11px] tracking-widest text-muted-foreground uppercase">
          Verifying organiser access…
        </p>
      </AdminGate>
    );
  }

  if (denied) {
    return (
      <AdminGate>
        <ShieldAlert className="h-6 w-6 text-destructive" />
        <p className="font-display text-lg font-black tracking-tight uppercase">Access denied</p>
        <p className="max-w-sm text-center text-sm text-muted-foreground">
          {data?.email ?? "This account"} is signed in but has not been granted the organiser role.
        </p>
        <button
          type="button"
          onClick={onSignOut}
          className="hv-mono mt-2 border border-border-strong px-4 py-2.5 text-[11px] font-bold tracking-widest uppercase hover:bg-accent"
        >
          Sign out
        </button>
      </AdminGate>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      <AdminSidebar email={data?.email ?? null} onSignOut={onSignOut} />
      <main className="min-w-0 flex-1 lg:h-screen lg:overflow-y-auto">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
