import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";

import {
  ActionButton,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  DataPanel,
  Pill,
  SearchField,
  SelectField,
  Toolbar,
  psStatusTone,
} from "@/components/hv/admin-chrome";
import { adminAllocationsQuery, adminDomainsQuery, adminOverviewQuery } from "@/lib/admin.queries";
import { saveProblemStatement } from "@/lib/admin.functions";
import { adminPsStatus } from "@/lib/hackverse-types";
import type { AdminAllocationRow } from "@/lib/hackverse-types";

export const Route = createFileRoute("/admin/_dash/problem-statements")({
  component: AdminProblemStatements,
});

interface FormState {
  id?: string;
  code: string;
  title: string;
  description: string;
  full_description: string;
  requirements: string;
  expected_solution: string;
  domain_id: string;
  capacity: number;
  status: "active" | "inactive";
}

function blankForm(domainId: string, capacity: number): FormState {
  return {
    code: "",
    title: "",
    description: "",
    full_description: "",
    requirements: "",
    expected_solution: "",
    domain_id: domainId,
    capacity,
    status: "active",
  };
}

function AdminProblemStatements() {
  const queryClient = useQueryClient();
  const list = useQuery(adminAllocationsQuery);
  const domains = useQuery(adminDomainsQuery);
  const overview = useQuery(adminOverviewQuery);
  const runSave = useServerFn(saveProblemStatement);

  const [search, setSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState("all");
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => list.data ?? [], [list.data]);
  const domainList = useMemo(() => domains.data ?? [], [domains.data]);
  const defaultCapacity = overview.data?.defaultCapacity ?? 2;

  // Guard §25: an edit must never take capacity below what is already allocated.
  const editingRow = form?.id ? rows.find((row) => row.id === form.id) : undefined;
  const capacityFloor = editingRow?.allocated_count ?? 0;

  const save = useMutation({
    mutationFn: (input: FormState) => runSave({ data: input }),
    onSuccess: async (result) => {
      if (!result.ok) {
        setError(result.message ?? "Could not save this problem statement.");
        return;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-allocations"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
      ]);
      toast.success(form?.id ? "Problem statement updated" : "Problem statement created");
      setForm(null);
      setError(null);
    },
    onError: () => setError("Could not save this problem statement. Please try again."),
  });

  const domainOptions = useMemo(
    () => [
      { value: "all", label: "All domains" },
      ...domainList.map((domain) => ({ value: domain.id, label: domain.name })),
    ],
    [domainList],
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (domainFilter !== "all" && row.domain_id !== domainFilter) return false;
      if (!term) return true;
      return `${row.code} ${row.title} ${row.domain_name}`.toLowerCase().includes(term);
    });
  }, [rows, search, domainFilter]);

  function openCreate() {
    if (domainList.length === 0) {
      toast.error("Create a domain before adding problem statements.");
      return;
    }
    setError(null);
    setForm(blankForm(domainList[0]!.id, defaultCapacity));
  }

  function openEdit(row: AdminAllocationRow) {
    setError(null);
    setForm({
      id: row.id,
      code: row.code,
      title: row.title,
      description: row.description,
      full_description: row.full_description,
      requirements: row.requirements,
      expected_solution: row.expected_solution,
      domain_id: row.domain_id,
      capacity: row.capacity,
      status: row.status === "inactive" ? "inactive" : "active",
    });
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form || save.isPending) return;
    if (form.capacity < capacityFloor) {
      setError("Capacity cannot be lower than the number of existing allocations.");
      return;
    }
    setError(null);
    save.mutate(form);
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Problem Statements"
        subtitle="Catalogue"
        right={
          <ActionButton onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" /> New problem statement
          </ActionButton>
        }
      />

      <DataPanel title="All Problem Statements" hint={`${visible.length} of ${rows.length} shown`}>
        <Toolbar>
          <SearchField value={search} onChange={setSearch} placeholder="Search PS ID or title…" />
          <SelectField
            value={domainFilter}
            onChange={setDomainFilter}
            options={domainOptions}
            label="Domain"
          />
        </Toolbar>

        {list.isPending ? (
          <AdminLoading />
        ) : visible.length === 0 ? (
          <AdminEmpty>
            {rows.length === 0
              ? "No problem statements have been created yet."
              : "No problem statements match these filters."}
          </AdminEmpty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border">
                  {["PS ID", "Title", "Domain", "Cap", "Alloc", "Slots", "Active", ""].map(
                    (heading, index) => (
                      <th key={index} className="hv-label px-4 py-2.5 whitespace-nowrap">
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border last:border-b-0 hover:bg-surface-raised"
                  >
                    <td className="hv-mono px-4 py-3 text-xs font-bold whitespace-nowrap">
                      {row.code}
                    </td>
                    <td className="max-w-[300px] truncate px-4 py-3 text-xs">{row.title}</td>
                    <td className="max-w-[180px] truncate px-4 py-3 text-xs text-muted-foreground">
                      {row.domain_name}
                    </td>
                    <td className="hv-mono px-4 py-3 text-xs tabular-nums">{row.capacity}</td>
                    <td className="hv-mono px-4 py-3 text-xs tabular-nums">
                      {row.allocated_count}
                    </td>
                    <td className="px-4 py-3">
                      <Pill
                        label={adminPsStatus(row.allocated_count, row.capacity)}
                        tone={psStatusTone(row.allocated_count, row.capacity)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Pill
                        label={row.status === "active" ? "ACTIVE" : "INACTIVE"}
                        tone={row.status === "active" ? "success" : "neutral"}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        className="hv-mono inline-flex items-center gap-1.5 border border-border-strong px-2.5 py-1.5 text-[10px] font-bold tracking-widest uppercase transition-colors hover:bg-accent"
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
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
            className="hv-panel w-full max-w-2xl"
            aria-label={form.id ? "Edit problem statement" : "Create problem statement"}
          >
            <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <p className="hv-label">{form.id ? "Edit" : "Create"}</p>
                <h2 className="font-display mt-1.5 text-xl font-black tracking-tight uppercase">
                  {form.id ? form.code : "New Problem Statement"}
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
              <Field label="Problem Statement ID">
                <input
                  value={form.code}
                  onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
                  required
                  maxLength={20}
                  pattern="[A-Za-z0-9\-]+"
                  placeholder="PS-26"
                  className="hv-mono w-full border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                />
              </Field>

              <Field label="Domain">
                <select
                  value={form.domain_id}
                  onChange={(event) => setForm({ ...form, domain_id: event.target.value })}
                  required
                  className="w-full border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                >
                  {domainList.map((domain) => (
                    <option key={domain.id} value={domain.id}>
                      {domain.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Title" className="sm:col-span-2">
                <input
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  required
                  minLength={3}
                  maxLength={200}
                  placeholder="AI-Based Crop Disease Detection"
                  className="w-full border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                />
              </Field>

              <Field label="Short description" className="sm:col-span-2">
                <textarea
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  rows={2}
                  maxLength={600}
                  placeholder="Shown on the selection card."
                  className="w-full resize-y border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                />
              </Field>

              <Field label="Full problem statement" className="sm:col-span-2">
                <textarea
                  value={form.full_description}
                  onChange={(event) => setForm({ ...form, full_description: event.target.value })}
                  rows={4}
                  maxLength={6000}
                  className="w-full resize-y border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                />
              </Field>

              <Field label="Requirements">
                <textarea
                  value={form.requirements}
                  onChange={(event) => setForm({ ...form, requirements: event.target.value })}
                  rows={3}
                  maxLength={4000}
                  className="w-full resize-y border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                />
              </Field>

              <Field label="Expected solution direction">
                <textarea
                  value={form.expected_solution}
                  onChange={(event) => setForm({ ...form, expected_solution: event.target.value })}
                  rows={3}
                  maxLength={4000}
                  className="w-full resize-y border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                />
              </Field>

              <Field label={`Capacity${capacityFloor > 0 ? ` (min ${capacityFloor})` : ""}`}>
                <input
                  type="number"
                  value={form.capacity}
                  onChange={(event) => setForm({ ...form, capacity: Number(event.target.value) })}
                  required
                  min={capacityFloor}
                  max={50}
                  className="hv-mono w-full border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                />
              </Field>

              <Field label="Status">
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm({ ...form, status: event.target.value as "active" | "inactive" })
                  }
                  className="w-full border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </Field>
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
                {form.id ? "Save changes" : "Create problem statement"}
              </ActionButton>
            </footer>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="hv-label mb-2 block">{label}</span>
      {children}
    </label>
  );
}
