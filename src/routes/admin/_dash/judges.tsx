import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AlertTriangle, KeyRound, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

import {
  ActionButton,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  DataPanel,
  Pill,
  SearchField,
  Toolbar,
} from "@/components/hv/admin-chrome";
import { adminJudgesQuery } from "@/lib/admin.queries";
import { createJudge, resetJudgePassword, setJudgeStatus } from "@/lib/admin.functions";
import type { JudgeRow } from "@/lib/hackverse-types";
import { formatStamp } from "@/lib/live";

export const Route = createFileRoute("/admin/_dash/judges")({
  component: AdminJudges,
});

interface CreateForm {
  username: string;
  password: string;
  name: string;
  email: string;
  organization: string;
  phone: string;
}

const BLANK: CreateForm = {
  username: "",
  password: "",
  name: "",
  email: "",
  organization: "",
  phone: "",
};

function AdminJudges() {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery(adminJudgesQuery);
  const runCreate = useServerFn(createJudge);
  const runStatus = useServerFn(setJudgeStatus);
  const runReset = useServerFn(resetJudgePassword);

  const [search, setSearch] = useState("");
  const [form, setForm] = useState<CreateForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState<JudgeRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<JudgeRow | null>(null);

  const rows = useMemo(() => (data ?? []).filter((j) => j.status !== "deleted"), [data]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((j) =>
      `${j.name} ${j.username} ${j.organization ?? ""}`.toLowerCase().includes(term),
    );
  }, [rows, search]);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["admin-judges"] });
    await queryClient.invalidateQueries({ queryKey: ["admin-leaderboard"] });
  }

  const create = useMutation({
    mutationFn: (input: CreateForm) => runCreate({ data: input }),
    onSuccess: async (result) => {
      if (!result.ok) {
        setError(result.message ?? "Could not create the judge account.");
        return;
      }
      await refresh();
      toast.success("Judge account created successfully");
      setForm(null);
      setError(null);
    },
    onError: () => setError("Could not create the judge account. Please try again."),
  });

  const status = useMutation({
    mutationFn: (input: { id: string; status: "active" | "disabled" | "deleted" }) =>
      runStatus({ data: input }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.message ?? "Could not update this judge.");
        return;
      }
      await refresh();
      setConfirmDelete(null);
      toast.success("Judge updated");
    },
    onError: () => toast.error("Could not update this judge."),
  });

  const reset = useMutation({
    mutationFn: (input: { id: string; password: string }) => runReset({ data: input }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.message ?? "Could not reset the password.");
        return;
      }
      await refresh();
      setResetting(null);
      setNewPassword("");
      toast.success("Password reset");
    },
    onError: () => toast.error("Could not reset the password."),
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Judges"
        subtitle="Evaluation panel"
        right={
          <ActionButton
            onClick={() => {
              setError(null);
              setForm({ ...BLANK });
            }}
          >
            <Plus className="h-3.5 w-3.5" /> Add judge
          </ActionButton>
        }
      />

      <DataPanel title="Judge Accounts" hint={`${visible.length} of ${rows.length} shown`}>
        <Toolbar>
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Search judge name or username…"
          />
        </Toolbar>

        {isPending ? (
          <AdminLoading />
        ) : visible.length === 0 ? (
          <AdminEmpty>
            {rows.length === 0
              ? "No judge accounts have been created yet."
              : "No judges match this search."}
          </AdminEmpty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border">
                  {[
                    "Judge",
                    "Username",
                    "Status",
                    "Evaluations",
                    "Remaining",
                    "Avg",
                    "Last Activity",
                    "",
                  ].map((heading, index) => (
                    <th key={index} className="hv-label px-4 py-2.5 whitespace-nowrap">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((judge) => (
                  <tr
                    key={judge.id}
                    className="border-b border-border last:border-b-0 hover:bg-surface-raised"
                  >
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      <span className="font-semibold">{judge.name}</span>
                      {judge.organization ? (
                        <span className="ml-2 text-muted-foreground">{judge.organization}</span>
                      ) : null}
                    </td>
                    <td className="hv-mono px-4 py-3 text-xs font-bold whitespace-nowrap">
                      {judge.username}
                    </td>
                    <td className="px-4 py-3">
                      <Pill
                        label={judge.status === "active" ? "ACTIVE" : "DISABLED"}
                        tone={judge.status === "active" ? "success" : "neutral"}
                      />
                    </td>
                    <td className="hv-mono px-4 py-3 text-xs tabular-nums">{judge.evaluations}</td>
                    <td className="hv-mono px-4 py-3 text-xs tabular-nums text-muted-foreground">
                      {judge.remaining}
                    </td>
                    <td className="hv-mono px-4 py-3 text-xs tabular-nums">
                      {judge.average_score === null ? "—" : judge.average_score.toFixed(2)}
                    </td>
                    <td className="hv-mono px-4 py-3 text-[11px] whitespace-nowrap text-muted-foreground">
                      {judge.last_activity ? formatStamp(judge.last_activity) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            status.mutate({
                              id: judge.id,
                              status: judge.status === "active" ? "disabled" : "active",
                            })
                          }
                          disabled={status.isPending}
                          className="hv-mono border border-border-strong px-2.5 py-1.5 text-[10px] font-bold tracking-widest uppercase transition-colors hover:bg-accent disabled:opacity-40"
                        >
                          {judge.status === "active" ? "Disable" : "Enable"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setResetting(judge);
                            setNewPassword("");
                          }}
                          className="hv-mono border border-border-strong px-2.5 py-1.5 text-[10px] font-bold tracking-widest uppercase transition-colors hover:bg-accent"
                        >
                          Reset
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(judge)}
                          className="hv-mono border border-destructive/60 px-2.5 py-1.5 text-[10px] font-bold tracking-widest text-destructive uppercase transition-colors hover:bg-destructive/10"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataPanel>

      {/* ------------------------------------------------------- create */}
      {form ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm sm:p-8"
          onClick={() => setForm(null)}
        >
          <form
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              if (!create.isPending) create.mutate(form);
            }}
            className="hv-panel w-full max-w-lg"
            aria-label="Add judge"
          >
            <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <p className="hv-label">Create</p>
                <h2 className="font-display mt-1.5 text-xl font-black tracking-tight uppercase">
                  Add Judge
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setForm(null)}
                aria-label="Close"
                className="shrink-0 p-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
              <label className="block">
                <span className="hv-label mb-2 block">Judge username</span>
                <input
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })}
                  required
                  minLength={3}
                  maxLength={40}
                  pattern="[a-zA-Z0-9._\-]+"
                  placeholder="judge_01"
                  className="hv-mono w-full border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                />
              </label>
              <label className="block">
                <span className="hv-label mb-2 block">Password</span>
                <input
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  minLength={8}
                  maxLength={200}
                  placeholder="At least 8 characters"
                  className="w-full border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="hv-label mb-2 block">Judge name</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  minLength={2}
                  maxLength={120}
                  placeholder="Rahul Kumar"
                  className="w-full border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                />
              </label>
              <label className="block">
                <span className="hv-label mb-2 block">Email (optional)</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  maxLength={200}
                  className="w-full border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                />
              </label>
              <label className="block">
                <span className="hv-label mb-2 block">Organization (optional)</span>
                <input
                  value={form.organization}
                  onChange={(e) => setForm({ ...form, organization: e.target.value })}
                  maxLength={160}
                  className="w-full border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="hv-label mb-2 block">Phone (optional)</span>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  maxLength={40}
                  className="w-full border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                />
              </label>
            </div>

            <p className="hv-mono mx-5 mb-4 border-l-2 border-border-strong bg-surface-raised px-3 py-2.5 text-[10px] text-muted-foreground">
              The password is hashed by Supabase Auth and cannot be read back. Note it down before
              sharing it with the judge — you can reset it later, but not view it.
            </p>

            {error ? (
              <p className="hv-mono mx-5 mb-4 flex items-start gap-2 border-l-2 border-destructive bg-destructive/10 px-3 py-2.5 text-[11px] text-destructive">
                <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                {error}
              </p>
            ) : null}

            <footer className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <ActionButton type="button" variant="outline" onClick={() => setForm(null)}>
                Cancel
              </ActionButton>
              <ActionButton type="submit" disabled={create.isPending}>
                {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Create judge
              </ActionButton>
            </footer>
          </form>
        </div>
      ) : null}

      {/* -------------------------------------------------- reset password */}
      {resetting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-4 backdrop-blur-sm">
          <div className="hv-panel w-full max-w-md" role="dialog" aria-modal="true">
            <header className="border-b border-border px-5 py-4">
              <p className="hv-label">Reset password</p>
              <h2 className="font-display mt-1.5 text-xl font-black tracking-tight uppercase">
                {resetting.name}
              </h2>
            </header>
            <div className="px-5 py-4">
              <label className="block">
                <span className="hv-label mb-2 block">New password</span>
                <input
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                  maxLength={200}
                  placeholder="At least 8 characters"
                  className="w-full border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                />
              </label>
            </div>
            <footer className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <ActionButton variant="outline" onClick={() => setResetting(null)}>
                Cancel
              </ActionButton>
              <ActionButton
                disabled={newPassword.length < 8 || reset.isPending}
                onClick={() => reset.mutate({ id: resetting.id, password: newPassword })}
              >
                {reset.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <KeyRound className="h-3.5 w-3.5" />
                )}
                Reset password
              </ActionButton>
            </footer>
          </div>
        </div>
      ) : null}

      {/* --------------------------------------------------------- delete */}
      {confirmDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-4 backdrop-blur-sm">
          <div className="hv-panel w-full max-w-md" role="dialog" aria-modal="true">
            <header className="border-b border-border px-5 py-4">
              <p className="hv-label text-destructive">Confirm</p>
              <h2 className="font-display mt-1.5 text-xl font-black tracking-tight uppercase">
                Delete {confirmDelete.name}?
              </h2>
            </header>
            <div className="px-5 py-4">
              <p className="text-sm text-muted-foreground">
                This judge will no longer be able to sign in. Their{" "}
                <span className="text-foreground">{confirmDelete.evaluations} evaluation(s)</span>{" "}
                are kept and still count towards the leaderboard, so the audit trail stays intact.
              </p>
            </div>
            <footer className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <ActionButton variant="outline" onClick={() => setConfirmDelete(null)}>
                Cancel
              </ActionButton>
              <ActionButton
                variant="danger"
                disabled={status.isPending}
                onClick={() => status.mutate({ id: confirmDelete.id, status: "deleted" })}
              >
                {status.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Delete judge
              </ActionButton>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
