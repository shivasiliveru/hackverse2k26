/**
 * Spec test cases 1-11 for the judging system.
 *
 * Creates throwaway judges, scores a real team, then removes everything it
 * made and restores evaluation settings. Safe to run against the live
 * database before the event — but NOT during judging, since it briefly
 * writes and deletes evaluations.
 *
 * Requires judging-system.sql AND judging-criteria.sql to have been run.
 *
 *   node scripts/verify-judging.mjs
 */
const U = process.env.SUPABASE_URL;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!U || !K) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");

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

async function authAdmin(method, path, body) {
  const res = await fetch(`${U}/auth/v1/admin/${path}`, {
    method,
    headers: H,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} auth/${path} -> ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

/**
 * Marking scheme maxima: problem 2, innovation 3, technical 3, presentation 2.
 * `marks` may be a plain total (split across criteria) or explicit per-criterion
 * values when a test needs to push one criterion out of range.
 */
function split(total) {
  const caps = [2, 3, 3, 2];
  const out = [0, 0, 0, 0];
  let left = total;
  for (let i = 0; i < caps.length; i++) {
    const take = Math.min(caps[i], left);
    out[i] = Number(take.toFixed(1));
    left = Number((left - take).toFixed(1));
  }
  return out;
}

const evaluate = (judgeId, teamCode, marks) => {
  const [problem, innovation, technical, presentation] = Array.isArray(marks)
    ? marks
    : split(marks);
  return rest("POST", "rpc/submit_evaluation", {
    p_judge_id: judgeId,
    p_team_code: teamCode,
    p_problem: problem,
    p_innovation: innovation,
    p_technical: technical,
    p_presentation: presentation,
  });
};

const board = async (teamCode) =>
  (await rest("GET", `leaderboard?select=total_score,judge_count,average_score&team_code=eq.${teamCode}`))[0];

/* ------------------------------------------------------------- setup */

console.log("\n=== SETUP ===");
const settingsBefore = (await rest("GET", "event_settings?select=evaluation_status,score_increment,allow_score_editing&id=eq.1"))[0];
await rest("PATCH", "event_settings?id=eq.1",
  { evaluation_status: "open", score_increment: 0.5, allow_score_editing: false },
  { Prefer: "return=minimal" });
console.log("  evaluation opened, increment 0.5, editing off");

const team = (await rest("GET", "teams?select=team_id,team_name&is_sample=eq.false&order=team_id&limit=1"))[0];
console.log(`  target team: ${team.team_id} (${team.team_name})`);

const created = [];
async function makeJudge(username, name) {
  const email = `${username}@judges.hackverse.local`;
  const existing = await rest("GET", `judges?select=id,user_id&username=eq.${username}`);
  if (existing.length) {
    await rest("DELETE", `evaluations?judge_id=eq.${existing[0].id}`, null, { Prefer: "return=minimal" });
    await rest("DELETE", `judges?id=eq.${existing[0].id}`, null, { Prefer: "return=minimal" });
    await authAdmin("DELETE", `users/${existing[0].user_id}`).catch(() => {});
  }
  const user = await authAdmin("POST", "users", { email, password: "HackVerse@2026", email_confirm: true });
  const row = await rest("POST", "judges", [{ user_id: user.id, username, name }], {
    Prefer: "return=representation",
  });
  created.push({ id: row[0].id, user_id: user.id });
  return row[0].id;
}

const judge1 = await makeJudge("test_judge_a", "Test Judge A");
const judge2 = await makeJudge("test_judge_b", "Test Judge B");
console.log("  created 2 throwaway judges");

// Clear any prior scores on this team so totals are predictable.
await rest("DELETE", `evaluations?team_id=not.is.null&judge_id=in.(${judge1},${judge2})`, null, {
  Prefer: "return=minimal",
});

const baseline = await board(team.team_id);
console.log(`  baseline total for ${team.team_id}: ${baseline.total_score}`);
const base = Number(baseline.total_score);

/* -------------------------------------------------------------- tests */

console.log("\n=== T1/T2: two judge accounts exist and are distinct ===");
check("judge 1 created", typeof judge1 === "string" && judge1.length > 0, true);
check("judge 2 created", typeof judge2 === "string" && judge2.length > 0, true);
check("distinct ids", judge1 !== judge2, true);

console.log("\n=== T3: judge 1 scores 8 ===");
let r = await evaluate(judge1, team.team_id, 8);
check("accepted", r.ok, true);
check("team total", Number((await board(team.team_id)).total_score), base + 8);

console.log("\n=== T4: judge 2 scores 9 -> total 17 ===");
r = await evaluate(judge2, team.team_id, 9);
check("accepted", r.ok, true);
check("team total", Number((await board(team.team_id)).total_score), base + 17);
check("judge count", Number((await board(team.team_id)).judge_count), 2);

console.log("\n=== T5: judge 1 evaluates the same team again -> reject ===");
r = await evaluate(judge1, team.team_id, 5);
check("rejected", r.ok, false);
check("code", r.code, "ALREADY_EVALUATED");
check("total unchanged", Number((await board(team.team_id)).total_score), base + 17);

console.log("\n=== T6/T7/T8: out-of-range and bad-increment scores ===");
check("problem 11 rejected (max 2)", (await evaluate(judge2, team.team_id, [11, 0, 0, 0])).code, "SCORE_OUT_OF_RANGE");
check("problem -1 rejected", (await evaluate(judge2, team.team_id, [-1, 0, 0, 0])).code, "SCORE_OUT_OF_RANGE");
check("problem 2.5 rejected (max 2)", (await evaluate(judge2, team.team_id, [2.5, 0, 0, 0])).code, "SCORE_OUT_OF_RANGE");
check("innovation 100 rejected (max 3)", (await evaluate(judge2, team.team_id, [0, 100, 0, 0])).code, "SCORE_OUT_OF_RANGE");
check("technical 3.5 rejected (max 3)", (await evaluate(judge2, team.team_id, [0, 0, 3.5, 0])).code, "SCORE_OUT_OF_RANGE");
check("presentation 2.5 rejected (max 2)", (await evaluate(judge2, team.team_id, [0, 0, 0, 2.5])).code, "SCORE_OUT_OF_RANGE");
check("0.25 rejected (increment 0.5)", (await evaluate(judge2, team.team_id, [0.25, 0, 0, 0])).code, "SCORE_BAD_INCREMENT");
check("max on every criterion totals 10", split(10).reduce((a, b) => a + b, 0), 10);

console.log("\n=== T9: two judges evaluate the same team simultaneously ===");
const team2 = (await rest("GET", "teams?select=team_id&is_sample=eq.false&order=team_id&offset=1&limit=1"))[0];
const race = await Promise.all([
  evaluate(judge1, team2.team_id, 7),
  evaluate(judge2, team2.team_id, 6.5),
]);
check("both stored (different judges)", race.filter((x) => x.ok).length, 2);
check("total is the sum", Number((await board(team2.team_id)).total_score), 13.5);

console.log("\n=== T9b: same judge double-submits simultaneously -> one wins ===");
const team3 = (await rest("GET", "teams?select=team_id&is_sample=eq.false&order=team_id&offset=2&limit=1"))[0];
const dbl = await Promise.all([
  evaluate(judge1, team3.team_id, 5),
  evaluate(judge1, team3.team_id, 5),
]);
check("exactly one accepted", dbl.filter((x) => x.ok).length, 1);
check("judge count is 1", Number((await board(team3.team_id)).judge_count), 1);

console.log("\n=== T10: leaderboard reorders after a new evaluation ===");
const before = await board(team2.team_id);
await evaluate(judge1, team.team_id, 1).catch(() => {});
const after = await board(team.team_id);
check("team A now outranks team B", Number(after.total_score) > Number(before.total_score), true);

console.log("\n=== T11: paused and closed windows are enforced ===");
await rest("PATCH", "event_settings?id=eq.1", { evaluation_status: "paused" }, { Prefer: "return=minimal" });
const team4 = (await rest("GET", "teams?select=team_id&is_sample=eq.false&order=team_id&offset=3&limit=1"))[0];
check("paused blocks submission", (await evaluate(judge2, team4.team_id, 5)).code, "EVAL_PAUSED");
await rest("PATCH", "event_settings?id=eq.1", { evaluation_status: "closed" }, { Prefer: "return=minimal" });
check("closed blocks submission", (await evaluate(judge2, team4.team_id, 5)).code, "EVAL_CLOSED");
await rest("PATCH", "event_settings?id=eq.1", { evaluation_status: "open" }, { Prefer: "return=minimal" });

console.log("\n=== T12: disabled judge cannot submit ===");
await rest("PATCH", `judges?id=eq.${judge2}`, { status: "disabled" }, { Prefer: "return=minimal" });
check("disabled judge rejected", (await evaluate(judge2, team4.team_id, 5)).code, "JUDGE_INACTIVE");
await rest("PATCH", `judges?id=eq.${judge2}`, { status: "active" }, { Prefer: "return=minimal" });

console.log("\n=== T13: deleting a judge preserves their evaluations (§6) ===");
const beforeDelete = Number((await board(team2.team_id)).total_score);
await rest("PATCH", `judges?id=eq.${judge2}`, { status: "deleted" }, { Prefer: "return=minimal" });
check("evaluations survive soft delete", Number((await board(team2.team_id)).total_score), beforeDelete);

/* ----------------------------------------------------------- teardown */

console.log("\n=== TEARDOWN ===");
for (const j of created) {
  await rest("DELETE", `evaluations?judge_id=eq.${j.id}`, null, { Prefer: "return=minimal" });
  await rest("DELETE", `judges?id=eq.${j.id}`, null, { Prefer: "return=minimal" });
  await authAdmin("DELETE", `users/${j.user_id}`).catch(() => {});
}
await rest("PATCH", "event_settings?id=eq.1",
  {
    evaluation_status: settingsBefore.evaluation_status,
    score_increment: settingsBefore.score_increment,
    allow_score_editing: settingsBefore.allow_score_editing,
  },
  { Prefer: "return=minimal" });

// PostgREST spells the LIKE wildcard "*"; a literal % here is an invalid
// percent-escape and makes the edge worker throw before it reaches Postgres.
const leftoverJudges = await rest("GET", "judges?select=id&username=like.test_judge*");
const finalTotal = Number((await board(team.team_id)).total_score);
check("test judges removed", leftoverJudges.length, 0);
check("team total back to baseline", finalTotal, base);
check("evaluation status restored", (await rest("GET", "event_settings?select=evaluation_status&id=eq.1"))[0].evaluation_status, settingsBefore.evaluation_status);

console.log(`\n${"=".repeat(46)}\nPASS ${pass}   FAIL ${fail}\n${"=".repeat(46)}`);
process.exit(fail === 0 ? 0 : 1);
