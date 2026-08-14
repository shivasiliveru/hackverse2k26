import type { AuditEntry } from "./hackverse-types";

export type AuditTone = "success" | "warning" | "danger" | "admin" | "neutral";

const TONES: Record<string, AuditTone> = {
  allocation_success: "success",
  ps_became_full: "warning",
  allocation_failed: "danger",
  allocation_error: "danger",
  team_verification_failed: "danger",
  team_verification_ineligible: "danger",
  team_verified: "neutral",
  team_verification_already_allocated: "warning",
  admin_register_rejected: "danger",
};

export function auditTone(event: string): AuditTone {
  if (event.startsWith("admin_")) return TONES[event] ?? "admin";
  return TONES[event] ?? "neutral";
}

/**
 * Turns an audit row into one line an organiser can scan during the event,
 * e.g. "Team Alpha 1 locked PS-07 (#12)".
 */
export function describeAuditEvent(entry: AuditEntry): string {
  const team = entry.team_ref ?? "Unknown team";
  const ps = entry.problem_statement_ref ?? "—";
  const actor = entry.actor ?? "organiser";
  const meta = entry.metadata ?? {};

  switch (entry.event) {
    case "allocation_success": {
      const number = meta["allocation_number"];
      return `${team} locked ${ps}${number === undefined || number === null ? "" : ` (#${number})`}`;
    }
    case "allocation_failed":
      return `${team} could not take ${ps} — ${String(meta["reason"] ?? "rejected")}`;
    case "allocation_error":
      return `${team} hit a server error on ${ps}`;
    case "ps_became_full":
      return `${ps} is now FULL`;
    case "team_verified":
      return `${team} verified`;
    case "team_verification_failed":
      return `Failed verification for ${team}`;
    case "team_verification_ineligible":
      return `${team} is not eligible`;
    case "team_verification_already_allocated":
      return `${team} returned after already selecting`;
    case "admin_registered":
      return `Organiser account created — ${actor}`;
    case "admin_register_rejected":
      return `Rejected organiser setup attempt — ${actor}`;
    case "admin_created_problem_statement":
      return `${actor} created ${ps}`;
    case "admin_edited_problem_statement":
      return `${actor} edited ${ps}`;
    case "admin_created_domain":
      return `${actor} created domain "${String(meta["name"] ?? "—")}"`;
    case "admin_edited_domain":
      return `${actor} edited domain "${String(meta["name"] ?? "—")}"`;
    case "admin_deleted_domain":
      return `${actor} deleted a domain`;
    case "admin_set_selection_open":
      return `${actor} opened selection`;
    case "admin_set_selection_paused":
      return `${actor} paused selection`;
    case "admin_set_selection_closed":
      return `${actor} closed selection`;
    case "admin_finalized_disqualifications":
      return `${actor} disqualified ${String(meta["count"] ?? 0)} unallocated teams`;
    default:
      return `${entry.event.replace(/_/g, " ")}${entry.team_ref ? ` — ${team}` : ""}`;
  }
}
