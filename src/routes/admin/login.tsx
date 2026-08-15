import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AlertTriangle, KeyRound, Loader2, ShieldCheck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { PasswordField } from "@/components/hv/password-field";
import { registerAdminAccount } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: "Organiser Access — HackVerse 2K26" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLogin,
});

type Mode = "signin" | "setup";

function AdminLogin() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const runRegister = useServerFn(registerAdminAccount);

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enterDashboard() {
    await queryClient.invalidateQueries({ queryKey: ["admin-whoami"] });
    await navigate({ to: "/admin" });
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "setup") {
        const result = await runRegister({ data: { email, password, accessCode } });
        if (!result.ok) {
          setError(result.message ?? "Could not create the organiser account.");
          return;
        }
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(
          /invalid login/i.test(signInError.message)
            ? "Incorrect email or password."
            : signInError.message,
        );
        return;
      }
      await enterDashboard();
    } catch {
      setError("Sign in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3">
          <img
            src="/hackverse-logo.png"
            alt=""
            width={60}
            height={40}
            className="h-10 w-auto shrink-0"
          />
          <div className="leading-none">
            <p className="font-display text-sm font-extrabold tracking-tight">HACKVERSE 2K26</p>
            <p className="hv-label mt-1">Problem Statement Allocation Control Center</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="hv-panel mt-6 p-6">
          <p className="hv-label flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5" /> Organiser access
          </p>
          <h1 className="font-display mt-2 text-2xl font-black tracking-tighter uppercase">
            {mode === "signin" ? "Admin Sign In" : "First-Time Setup"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Restricted to HackVerse organisers. All actions are recorded in the audit log."
              : "Creates the first organiser account. Requires the organiser access code."}
          </p>

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="hv-label mb-2 block">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                maxLength={200}
                placeholder="organiser@trrcollege.edu"
                className="w-full border border-input bg-background px-3 py-3 text-sm outline-none focus:border-primary"
              />
            </label>
            <PasswordField
              label="Password"
              value={password}
              onChange={setPassword}
              required
              minLength={8}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
            {mode === "setup" ? (
              <label className="block">
                <span className="hv-label mb-2 block">Organiser access code</span>
                <input
                  value={accessCode}
                  onChange={(event) => setAccessCode(event.target.value)}
                  required
                  maxLength={120}
                  placeholder="Provided by the event owner"
                  className="hv-mono w-full border border-input bg-background px-3 py-3 text-sm tracking-widest outline-none focus:border-primary"
                />
              </label>
            ) : null}
          </div>

          {error ? (
            <p className="hv-mono mt-4 flex items-start gap-2 border-l-2 border-destructive bg-destructive/10 px-3 py-2.5 text-[11px] text-destructive">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="hv-mono mt-6 inline-flex w-full items-center justify-center gap-2 bg-primary px-6 py-3.5 text-xs font-bold tracking-widest text-primary-foreground uppercase disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <KeyRound className="h-3.5 w-3.5" />
            )}
            {busy
              ? mode === "signin"
                ? "Signing in…"
                : "Creating account…"
              : mode === "signin"
                ? "Sign in"
                : "Create organiser account"}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "setup" : "signin");
              setError(null);
            }}
            className="hv-mono mt-4 w-full text-center text-[10px] font-bold tracking-widest text-muted-foreground uppercase transition-colors hover:text-foreground"
          >
            {mode === "signin" ? "First-time setup" : "Back to sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
