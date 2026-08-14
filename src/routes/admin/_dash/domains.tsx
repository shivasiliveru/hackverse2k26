import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  ActionButton,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  DataPanel,
  Pill,
} from "@/components/hv/admin-chrome";
import { adminDomainsQuery } from "@/lib/admin.queries";
import { deleteDomainRecord, saveDomainRecord } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/_dash/domains")({
  component: AdminDomains,
});

interface DomainRow {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  ps_count: number;
}

interface FormState {
  id?: string;
  name: string;
  description: string;
  display_order: number;
  is_active: boolean;
}

function AdminDomains() {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery(adminDomainsQuery);
  const runSave = useServerFn(saveDomainRecord);
  const runDelete = useServerFn(deleteDomainRecord);

  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => data ?? [], [data]);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["admin-domains"] });
    await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
  }

  const save = useMutation({
    mutationFn: (input: FormState) => runSave({ data: input }),
    onSuccess: async (result) => {
      if (!result.ok) {
        setError(result.message ?? "Could not save this domain.");
        return;
      }
      await refresh();
      toast.success(form?.id ? "Domain updated" : "Domain created");
      setForm(null);
      setError(null);
    },
    onError: () => setError("Could not save this domain. Please try again."),
  });

  // Reorder and activate/deactivate write straight through — no modal, because
  // organisers do these mid-event and a dialog would slow them down.
  const quickSave = useMutation({
    mutationFn: (input: FormState) => runSave({ data: input }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.message ?? "Could not update this domain.");
        return;
      }
      await refresh();
    },
    onError: () => toast.error("Could not update this domain."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => runDelete({ data: { id } }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.message ?? "Could not delete this domain.");
        return;
      }
      await refresh();
      toast.success("Domain deleted");
    },
    onError: () => toast.error("Could not delete this domain."),
  });

  function move(index: number, direction: -1 | 1) {
    const current = rows[index];
    const swap = rows[index + direction];
    if (!current || !swap) return;
    quickSave.mutate({
      id: current.id,
      name: current.name,
      description: current.description ?? "",
      display_order: swap.display_order,
      is_active: current.is_active,
    });
    quickSave.mutate({
      id: swap.id,
      name: swap.name,
      description: swap.description ?? "",
      display_order: current.display_order,
      is_active: swap.is_active,
    });
  }

  function toggleActive(row: DomainRow) {
    quickSave.mutate({
      id: row.id,
      name: row.name,
      description: row.description ?? "",
      display_order: row.display_order,
      is_active: !row.is_active,
    });
  }

  function onDelete(row: DomainRow) {
    if (row.ps_count > 0) {
      toast.error("This domain contains problem statements and cannot be deleted.");
      return;
    }
    remove.mutate(row.id);
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form || save.isPending) return;
    setError(null);
    save.mutate(form);
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Domains"
        subtitle="Problem statement categories"
        right={
          <ActionButton
            onClick={() => {
              setError(null);
              setForm({
                name: "",
                description: "",
                display_order:
                  rows.length > 0 ? Math.max(...rows.map((row) => row.display_order)) + 1 : 1,
                is_active: true,
              });
            }}
          >
            <Plus className="h-3.5 w-3.5" /> New domain
          </ActionButton>
        }
      />

      <DataPanel title="Domain Register" hint="Order controls how domains appear to participants">
        {isPending ? (
          <AdminLoading />
        ) : rows.length === 0 ? (
          <AdminEmpty>No domains have been created yet.</AdminEmpty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border">
                  {["Order", "Domain", "Description", "Problem Statements", "Status", ""].map(
                    (heading, index) => (
                      <th key={index} className="hv-label px-4 py-2.5 whitespace-nowrap">
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={row.id}
                    className="border-b border-border last:border-b-0 hover:bg-surface-raised"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <span className="hv-mono w-5 text-xs tabular-nums text-muted-foreground">
                          {row.display_order}
                        </span>
                        <button
                          type="button"
                          onClick={() => move(index, -1)}
                          disabled={index === 0 || quickSave.isPending}
                          aria-label={`Move ${row.name} up`}
                          className="border border-border-strong p-1 transition-colors hover:bg-accent disabled:opacity-30"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => move(index, 1)}
                          disabled={index === rows.length - 1 || quickSave.isPending}
                          aria-label={`Move ${row.name} down`}
                          className="border border-border-strong p-1 transition-colors hover:bg-accent disabled:opacity-30"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold">{row.name}</td>
                    <td className="max-w-[280px] truncate px-4 py-3 text-xs text-muted-foreground">
                      {row.description || "—"}
                    </td>
                    <td className="hv-mono px-4 py-3 text-xs tabular-nums">{row.ps_count}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleActive(row)}
                        disabled={quickSave.isPending}
                      >
                        <Pill
                          label={row.is_active ? "ACTIVE" : "INACTIVE"}
                          tone={row.is_active ? "success" : "neutral"}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setError(null);
                            setForm({
                              id: row.id,
                              name: row.name,
                              description: row.description ?? "",
                              display_order: row.display_order,
                              is_active: row.is_active,
                            });
                          }}
                          className="hv-mono inline-flex items-center gap-1.5 border border-border-strong px-2.5 py-1.5 text-[10px] font-bold tracking-widest uppercase transition-colors hover:bg-accent"
                        >
                          <Pencil className="h-3 w-3" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(row)}
                          disabled={remove.isPending}
                          title={
                            row.ps_count > 0
                              ? "This domain contains problem statements and cannot be deleted."
                              : "Delete domain"
                          }
                          className="hv-mono inline-flex items-center gap-1.5 border border-destructive/60 px-2.5 py-1.5 text-[10px] font-bold tracking-widest text-destructive uppercase transition-colors hover:bg-destructive/10 disabled:opacity-40"
                        >
                          <Trash2 className="h-3 w-3" />
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

      {form ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm sm:p-8"
          onClick={() => setForm(null)}
        >
          <form
            onSubmit={onSubmit}
            onClick={(event) => event.stopPropagation()}
            className="hv-panel w-full max-w-lg"
            aria-label={form.id ? "Edit domain" : "Create domain"}
          >
            <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <p className="hv-label">{form.id ? "Edit" : "Create"}</p>
                <h2 className="font-display mt-1.5 text-xl font-black tracking-tight uppercase">
                  {form.id ? "Domain" : "New Domain"}
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

            <div className="space-y-4 px-5 py-4">
              <label className="block">
                <span className="hv-label mb-2 block">Name</span>
                <input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  required
                  minLength={2}
                  maxLength={160}
                  placeholder="AI, Data Science & Smart Automation"
                  className="w-full border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                />
              </label>

              <label className="block">
                <span className="hv-label mb-2 block">Description</span>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  rows={3}
                  maxLength={600}
                  className="w-full resize-y border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="hv-label mb-2 block">Display order</span>
                  <input
                    type="number"
                    value={form.display_order}
                    onChange={(event) =>
                      setForm({ ...form, display_order: Number(event.target.value) })
                    }
                    required
                    min={0}
                    max={999}
                    className="hv-mono w-full border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                  />
                </label>
                <label className="block">
                  <span className="hv-label mb-2 block">Status</span>
                  <select
                    value={form.is_active ? "active" : "inactive"}
                    onChange={(event) =>
                      setForm({ ...form, is_active: event.target.value === "active" })
                    }
                    className="w-full border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
              </div>
            </div>

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
              <ActionButton type="submit" disabled={save.isPending}>
                {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {form.id ? "Save changes" : "Create domain"}
              </ActionButton>
            </footer>
          </form>
        </div>
      ) : null}
    </div>
  );
}
