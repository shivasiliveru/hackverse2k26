import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, ClipboardCheck, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { judgeEmailFor } from "@/lib/judge.queries";

export const Route = createFileRoute("/judge/login")({
  head: () => ({
    meta: [
      { title: "Judge Evaluation Portal — HackVerse 2K26" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: JudgeLogin,
});

function JudgeLogin() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // Judges sign in with a username; it maps to the synthetic address their
      // auth account was created with. They never see or type an email.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: judgeEmailFor(username),
        password,
      });
      if (signInError) {
        setError(
          /invalid login/i.test(signInError.message)
            ? "Incorrect username or password."
            : signInError.message,
        );
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["judge-whoami"] });
      await navigate({ to: "/judge" });
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
            <p className="hv-label mt-1">Judge Evaluation Portal</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="hv-panel mt-6 p-6">
          <p className="hv-label flex items-center gap-2">
            <ClipboardCheck className="h-3.5 w-3.5" /> Judge access only
          </p>
          <h1 className="font-display mt-2 text-2xl font-black tracking-tighter uppercase">
            Judge Sign In
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Use the username and password provided by the organizers.
          </p>

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="hv-label mb-2 block">Username</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
                maxLength={40}
                placeholder="judge_01"
                className="hv-mono w-full border border-input bg-background px-3 py-3 text-sm outline-none focus:border-primary"
              />
            </label>
            <label className="block">
              <span className="hv-label mb-2 block">Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="current-password"
                maxLength={200}
                className="w-full border border-input bg-background px-3 py-3 text-sm outline-none focus:border-primary"
              />
            </label>
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
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {busy ? "Signing in…" : "Login"}
          </button>

          <p className="hv-mono mt-4 text-center text-[10px] tracking-wide text-muted-foreground">
            Evaluation activity is recorded in the organiser audit log.
          </p>
        </form>
      </div>
    </div>
  );
}
