export type SelectionStatus = "open" | "paused" | "closed";

export interface PublicStats {
  allocated_teams: number;
  max_allocated_teams: number;
  selection_status: SelectionStatus;
  total_problem_statements: number;
  available_ps_slots: number;
  total_registered_teams: number;
}

export interface PublicDomain {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
  ps_count: number;
  remaining_slots: number;
  is_full: boolean;
}

export interface PublicProblemStatement {
  id: string;
  code: string;
  title: string;
  description: string;
  full_description: string;
  requirements: string;
  expected_solution: string;
  domain_id: string;
  capacity: number;
  allocated_count: number;
  remaining_slots: number;
}

export interface PublicState {
  stats: PublicStats;
  domains: PublicDomain[];
  problemStatements: PublicProblemStatement[];
}

export type VerifyResult =
  | { status: "ok"; team: { team_id: string; team_name: string; leader_name: string | null } }
  | { status: "not_found" }
  | { status: "ineligible" }
  | {
      status: "already_allocated";
      team: { team_id: string; team_name: string };
      allocation: {
        problem_statement_id: string;
        title: string;
        domain: string;
        allocation_number: number;
        selected_at: string;
      };
    };

export interface AllocationReceipt {
  allocation_number: number;
  team_name: string;
  team_id: string;
  problem_statement_id: string;
  title: string;
  domain: string;
  selected_at: string;
}

export type AllocateResult =
  | { ok: true; receipt: AllocationReceipt }
  | { ok: false; code: string; message: string };

export const ALLOCATION_ERROR_MESSAGES: Record<string, string> = {
  PAUSED: "Problem statement selection is temporarily paused by the organizers.",
  CLOSED: "Selection is closed. All available slots have been allocated.",
  LIMIT_REACHED: "ALL AVAILABLE SLOTS HAVE BEEN ALLOCATED.",
  TEAM_NOT_FOUND: "Invalid Team ID. Please check your registration details.",
  TEAM_INELIGIBLE: "This team is not eligible for problem statement selection.",
  ALREADY_ALLOCATED: "This team has already completed selection.",
  PS_NOT_FOUND: "That problem statement is no longer available.",
  PS_INACTIVE: "That problem statement is no longer active.",
  PS_FULL: "This problem statement was just taken by another team. Please select another problem statement.",
  RATE_LIMITED: "Too many attempts. Please wait a moment and try again.",
  UNKNOWN: "Something went wrong. Please try again.",
};

export interface AdminTeamRow {
  id: string;
  team_id: string;
  team_name: string;
  leader_name: string | null;
  status: string;
  allocation_status: string;
  selected_at: string | null;
  problem_statement_code: string | null;
  problem_statement_title: string | null;
  domain_name: string | null;
}

export interface AdminAllocationRow {
  id: string;
  code: string;
  title: string;
  domain_name: string;
  domain_id: string;
  capacity: number;
  allocated_count: number;
  remaining_slots: number;
  status: string;
  description: string;
  full_description: string;
  requirements: string;
  expected_solution: string;
  teams: { team_id: string; team_name: string; selected_at: string }[];
}

export interface AuditEntry {
  id: string;
  event: string;
  team_ref: string | null;
  problem_statement_ref: string | null;
  actor: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AdminOverview {
  totalTeams: number;
  allocated: number;
  remainingSlots: number;
  maxAllocatedTeams: number;
  problemStatements: number;
  domains: number;
  disqualified: number;
  eligible: number;
  selectionStatus: SelectionStatus;
  eventName: string;
  defaultCapacity: number;
  activity: AuditEntry[];
}

export function psStatusLabel(remaining: number): string {
  if (remaining <= 0) return "FULL";
  if (remaining === 1) return "1 SLOT LEFT";
  return `${remaining} SLOTS`;
}

export function adminPsStatus(allocated: number, capacity: number): string {
  if (allocated >= capacity) return "FULL";
  if (allocated > 0) return "PARTIALLY ALLOCATED";
  return "AVAILABLE";
}
