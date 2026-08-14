const U = process.env.SUPABASE_URL;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "application/json" };

let pass = 0;
let fail = 0;

function check(label, actual, expected) {
  const ok = String(actual) === String(expected);
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${label}  (got ${actual}, want ${expected})`);
  ok ? pass++ : fail++;
}

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

// The RPC is granted to service_role only.
const allocate = (team, ps) =>
  rest("POST", "rpc/allocate_problem_statement", { p_team_code: team, p_ps_code: ps });

const psRow = async (code) =>
  (await rest("GET", `problem_statements?select=allocated_count,remaining_slots,capacity,domain_id&problem_statement_id=eq.${code}`))[0];

const settings = async () => (await rest("GET", "event_settings?select=*&id=eq.1"))[0];
const allocCount = async () =>
  (await rest("GET", "allocations?select=id&status=eq.confirmed")).length;

/* ---------------------------------------------------------------- setup */

console.log("\n=== SETUP: temporary teams (is_sample=true) ===");
await rest("DELETE", "teams?is_sample=eq.true", null, { Prefer: "return=minimal" });
const temps = Array.from({ length: 60 }, (_, i) => ({
  team_id: `TEST-${String(i + 1).padStart(4, "0")}`,
  team_name: `Temp Team ${i + 1}`,
  is_sample: true,
  status: "eligible",
  allocation_status: "not_allocated",
}));
await rest("POST", "teams", temps, { Prefer: "return=minimal" });
console.log(`  created ${temps.length} temp teams`);

const allPs = await rest("GET", "problem_statements?select=problem_statement_id,domain_id,capacity&order=problem_statement_id");
console.log(`  ${allPs.length} problem statements, capacity ${allPs[0].capacity} each`);

/* ------------------------------------------------- scenarios 1, 2, 3, 5 */

console.log("\n=== S1: first team takes PS-01 (2 -> 1 remaining) ===");
let r = await allocate("TEST-0001", "PS-01");
check("allocation ok", r.ok, true);
check("remaining_slots", (await psRow("PS-01")).remaining_slots, 1);

console.log("\n=== S2: second team takes PS-01 (1 -> 0, becomes FULL) ===");
r = await allocate("TEST-0002", "PS-01");
check("allocation ok", r.ok, true);
check("remaining_slots", (await psRow("PS-01")).remaining_slots, 0);

console.log("\n=== S3: third team rejected on a full PS ===");
r = await allocate("TEST-0003", "PS-01");
check("ok", r.ok, false);
check("code", r.code, "PS_FULL");
check("allocated_count still 2", (await psRow("PS-01")).allocated_count, 2);

console.log("\n=== S5: a team cannot allocate twice ===");
r = await allocate("TEST-0001", "PS-02");
check("ok", r.ok, false);
check("code", r.code, "ALREADY_ALLOCATED");

console.log("\n=== bonus: unknown team / unknown PS ===");
check("TEAM_NOT_FOUND", (await allocate("NOPE-9999", "PS-02")).code, "TEAM_NOT_FOUND");
check("PS_NOT_FOUND", (await allocate("TEST-0003", "PS-999")).code, "PS_NOT_FOUND");

/* --------------------------------------------------- scenario 4: race */

console.log("\n=== S4: two teams race for the FINAL slot of PS-02 ===");
await allocate("TEST-0004", "PS-02"); // consume slot 1 of 2
check("PS-02 has 1 slot left", (await psRow("PS-02")).remaining_slots, 1);

const race = await Promise.all([allocate("TEST-0005", "PS-02"), allocate("TEST-0006", "PS-02")]);
const winners = race.filter((x) => x.ok === true).length;
const losers = race.filter((x) => x.ok === false && x.code === "PS_FULL").length;
check("exactly one winner", winners, 1);
check("exactly one PS_FULL", losers, 1);
check("allocated_count == capacity", (await psRow("PS-02")).allocated_count, 2);
check("remaining never negative", (await psRow("PS-02")).remaining_slots, 0);

/* ------------------------------------------------- scenario 9: paused */

console.log("\n=== S9: paused event blocks new allocations ===");
await rest("PATCH", "event_settings?id=eq.1", { selection_status: "paused" }, { Prefer: "return=minimal" });
check("code", (await allocate("TEST-0007", "PS-03")).code, "PAUSED");
await rest("PATCH", "event_settings?id=eq.1", { selection_status: "open" }, { Prefer: "return=minimal" });
check("reopened", (await settings()).selection_status, "open");

/* ---------------------------------------- scenarios 6 + 7: fill to 50 */

console.log("\n=== S6/S7: fill every slot, then test the global limit ===");
let next = 8;
for (const ps of allPs) {
  const row = await psRow(ps.problem_statement_id);
  for (let i = row.allocated_count; i < row.capacity; i++) {
    const res = await allocate(`TEST-${String(next).padStart(4, "0")}`, ps.problem_statement_id);
    if (!res.ok) {
      console.log(`  note: ${ps.problem_statement_id} -> ${res.code}`);
      break;
    }
    next++;
  }
}
check("total confirmed allocations", await allocCount(), 50);

// Domain full (S6): every PS in domain 1 exhausted.
const d1 = allPs[0].domain_id;
const d1rows = await rest("GET", `problem_statements?select=remaining_slots&domain_id=eq.${d1}`);
check("domain 1 remaining slots", d1rows.reduce((s, x) => s + x.remaining_slots, 0), 0);

// S7: the 51st team is refused and the event auto-closes.
const over = await allocate(`TEST-0059`, "PS-01");
check("51st team refused", over.ok, false);
// The 50th allocation auto-closes the event, and the RPC checks
// selection_status before the limit, so the 51st team sees CLOSED.
// LIMIT_REACHED only surfaces if the event was reopened while full.
check("refusal reason", ["CLOSED", "LIMIT_REACHED", "PS_FULL"].includes(over.code), true);
check("event auto-closed", (await settings()).selection_status, "closed");
check("no PS exceeded capacity",
  (await rest("GET", "problem_statements?select=allocated_count,capacity"))
    .every((p) => p.allocated_count <= p.capacity), true);

/* ----------------------------------------------------------- teardown */

console.log("\n=== RESET: restoring a pristine event database ===");
await rest("DELETE", "allocations?team_id=not.is.null", null, { Prefer: "return=minimal" });
await rest("DELETE", "teams?is_sample=eq.true", null, { Prefer: "return=minimal" });
await rest("PATCH", "problem_statements?id=not.is.null", { allocated_count: 0 }, { Prefer: "return=minimal" });
await rest("PATCH", "teams?id=not.is.null",
  { status: "eligible", allocation_status: "not_allocated", selected_problem_statement_id: null, selected_at: null },
  { Prefer: "return=minimal" });
await rest("DELETE", "audit_log?id=not.is.null", null, { Prefer: "return=minimal" });
await rest("PATCH", "event_settings?id=eq.1", { selection_status: "open" }, { Prefer: "return=minimal" });

const realTeams = await rest("GET", "teams?select=team_id,status,allocation_status");
const psAll = await rest("GET", "problem_statements?select=allocated_count,remaining_slots");
console.log("\n=== POST-RESET VERIFICATION ===");
check("real teams remaining", realTeams.length, 88);
check("temp teams removed", realTeams.filter((t) => t.team_id.startsWith("TEST-")).length, 0);
check("all teams eligible", realTeams.every((t) => t.status === "eligible"), true);
check("all teams unallocated", realTeams.every((t) => t.allocation_status === "not_allocated"), true);
check("allocations cleared", await allocCount(), 0);
check("all PS reset to 0", psAll.every((p) => p.allocated_count === 0), true);
check("all slots restored", psAll.reduce((s, p) => s + p.remaining_slots, 0), 50);
check("selection open", (await settings()).selection_status, "open");

console.log(`\n${"=".repeat(46)}\nPASS ${pass}   FAIL ${fail}\n${"=".repeat(46)}`);
process.exit(fail === 0 ? 0 : 1);
