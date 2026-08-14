/**
 * Replaces the seeded PS-01..PS-25 placeholders with the organiser's real
 * roster from problem-statements.json, and renames domains to match.
 *
 * Refuses to run if any allocation exists: swapping problem statements
 * mid-event would orphan teams that had already locked one.
 *
 *   node scripts/load-problem-statements.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const U = process.env.SUPABASE_URL;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!U || !K) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");

const here = dirname(fileURLToPath(import.meta.url));
const { domains } = JSON.parse(readFileSync(join(here, "problem-statements.json"), "utf8"));

const H = { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "application/json" };

async function rest(method, path, body, extra = {}) {
  const res = await fetch(`${U}/rest/v1/${path}`, {
    method,
    headers: { ...H, ...extra },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

/* ------------------------------------------------------------ safety */

const allocations = await rest("GET", "allocations?select=id");
if (allocations.length > 0) {
  console.error(`ABORT: ${allocations.length} allocation(s) exist. Replacing problem`);
  console.error("statements now would orphan teams that already locked one.");
  process.exit(1);
}

/* ----------------------------------------------------------- domains */

const live = await rest("GET", "domains?select=id,name,display_order&order=display_order");
if (live.length !== domains.length) {
  throw new Error(`expected ${domains.length} domains in the database, found ${live.length}`);
}

for (const d of domains) {
  const match = live.find((x) => x.display_order === d.display_order);
  if (!match) throw new Error(`no domain at display_order ${d.display_order}`);
  d.id = match.id;
  if (match.name !== d.name) {
    await rest("PATCH", `domains?id=eq.${match.id}`, { name: d.name }, { Prefer: "return=minimal" });
    console.log(`renamed domain ${d.display_order}: "${match.name}"\n                 -> "${d.name}"`);
  }
}

/* -------------------------------------------------- problem statements */

await rest("DELETE", "problem_statements?id=not.is.null", null, { Prefer: "return=minimal" });

const rows = domains.flatMap((d) =>
  d.problem_statements.map((ps) => ({
    problem_statement_id: ps.code,
    title: ps.title,
    domain_id: d.id,
    // Only IDs and titles were supplied. Descriptions are left blank rather
    // than invented — organisers can fill them in from /admin/problem-statements.
    description: "",
    full_description: "",
    requirements: "",
    expected_solution: d.expected_solution,
    capacity: 2,
    status: "active",
  })),
);

await rest("POST", "problem_statements", rows, { Prefer: "return=minimal" });
console.log(`\nloaded ${rows.length} problem statements across ${domains.length} domains`);

/* ------------------------------------------------------------ verify */

const check = await rest(
  "GET",
  "problem_statements?select=problem_statement_id,capacity,remaining_slots,domain_id&order=problem_statement_id",
);
const byDomain = new Map();
for (const r of check) byDomain.set(r.domain_id, (byDomain.get(r.domain_id) ?? 0) + 1);

console.log(`total: ${check.length}`);
for (const d of domains) {
  console.log(`  ${String(byDomain.get(d.id) ?? 0)} x ${d.code.padEnd(8)} ${d.name}`);
}
console.log(`open slots: ${check.reduce((s, r) => s + r.remaining_slots, 0)}`);
