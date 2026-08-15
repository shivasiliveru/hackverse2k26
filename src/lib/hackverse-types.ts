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
  { ok: true; receipt: AllocationReceipt } | { ok: false; code: string; message: string };

export const ALLOCATION_ERROR_MESSAGES: Record<string, string> = {
  PAUSED: "Problem statement selection is temporarily paused by the organizers.",
  CLOSED: "Selection is closed. All available slots have been allocated.",
  LIMIT_REACHED: "ALL AVAILABLE SLOTS HAVE BEEN ALLOCATED.",
  TEAM_NOT_FOUND: "Invalid Team ID. Please check your registration details.",
  TEAM_INELIGIBLE: "This team is not eligible for problem statement selection.",
  ALREADY_ALLOCATED: "This team has already completed selection.",
  PS_NOT_FOUND: "That problem statement is no longer available.",
  PS_INACTIVE: "That problem statement is no longer active.",
  PS_FULL:
    "This problem statement was just taken by another team. Please select another problem statement.",
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
  metadata: Record<string, string | number | boolean | null>;
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

/* ------------------------------------------------------------- judging */

export type EvaluationStatus = "open" | "paused" | "closed";
export type RankingMethod = "total" | "average";
export type JudgeStatus = "active" | "disabled" | "deleted";

export const SCORE_MAX = 10;

/** The official marking scheme. Maxima are mirrored by CHECK constraints. */
export const SCORE_CRITERIA = [
  { key: "problem", label: "Problem Understanding & Relevance", max: 2 },
  { key: "innovation", label: "Innovation & Creativity", max: 3 },
  { key: "technical", label: "Technical Implementation & Prototype", max: 3 },
  { key: "presentation", label: "Presentation & Feasibility", max: 2 },
] as const;

export type CriterionKey = (typeof SCORE_CRITERIA)[number]["key"];

export type CriterionScores = Record<CriterionKey, number>;

export const BLANK_CRITERIA: CriterionScores = {
  problem: 0,
  innovation: 0,
  technical: 0,
  presentation: 0,
};

export function criteriaTotal(scores: CriterionScores): number {
  return Number(SCORE_CRITERIA.reduce((sum, c) => sum + (scores[c.key] ?? 0), 0).toFixed(1));
}

export interface EvaluationSettings {
  evaluation_status: EvaluationStatus;
  score_increment: number;
  allow_score_editing: boolean;
  evaluation_start: string | null;
  evaluation_end: string | null;
  leaderboard_public: boolean;
  leaderboard_frozen: boolean;
  leaderboard_frozen_at: string | null;
  ranking_method: RankingMethod;
  judges_see_others: boolean;
  max_judges: number | null;
}

export interface JudgeRow {
  id: string;
  username: string;
  name: string;
  email: string | null;
  organization: string | null;
  phone: string | null;
  status: JudgeStatus;
  created_at: string;
  evaluations: number;
  remaining: number;
  average_score: number | null;
  min_score: number | null;
  max_score: number | null;
  last_activity: string | null;
}

/** One row of the judge's own team list — never carries other judges' scores. */
export interface JudgeTeamRow {
  team_uuid: string;
  team_code: string;
  team_name: string;
  ps_code: string | null;
  ps_title: string | null;
  domain_name: string | null;
  my_score: number | null;
  my_criteria: CriterionScores | null;
  evaluated: boolean;
  submitted_at: string | null;
}

export interface JudgeWhoami {
  id: string;
  username: string;
  name: string;
  status: JudgeStatus;
  isJudge: boolean;
}

export interface LeaderboardRow {
  rank: number;
  team_uuid: string;
  team_code: string;
  team_name: string;
  ps_code: string | null;
  ps_title: string | null;
  domain_name: string | null;
  total_score: number;
  average_score: number;
  judge_count: number;
  last_evaluated_at: string | null;
  tie_broken: boolean;
}

export interface EvaluationLogRow {
  id: string;
  judge_id: string;
  judge_name: string;
  judge_username: string;
  team_code: string;
  team_name: string;
  ps_code: string | null;
  score: number;
  criteria: CriterionScores;
  submitted_at: string;
  updated_at: string;
}

export interface LeaderboardStats {
  teams: number;
  judges: number;
  evaluations: number;
  averageScore: number;
  highestTotal: number;
}

export const EVALUATION_ERROR_MESSAGES: Record<string, string> = {
  JUDGE_NOT_FOUND: "This judge account could not be found.",
  JUDGE_INACTIVE: "This judge account has been disabled by the organizers.",
  EVAL_PAUSED: "Evaluation is temporarily paused by the organizers.",
  EVAL_CLOSED: "Evaluation is closed. No further scores can be submitted.",
  EVAL_NOT_STARTED: "The evaluation window has not opened yet.",
  EVAL_ENDED: "The evaluation deadline has passed.",
  TEAM_NOT_FOUND: "That team could not be found.",
  TEAM_NOT_ELIGIBLE: "That team is not eligible for evaluation.",
  SCORE_REQUIRED: "Please choose a score before submitting.",
  SCORE_OUT_OF_RANGE: `Score must be between 0 and ${SCORE_MAX}.`,
  SCORE_BAD_INCREMENT: "That score does not match the allowed increment.",
  ALREADY_EVALUATED: "You have already evaluated this team.",
  UNKNOWN: "Something went wrong. Please try again.",
};

export function scoreOptions(increment: number, max: number = SCORE_MAX): number[] {
  const steps = Math.round(max / increment);
  return Array.from({ length: steps + 1 }, (_, i) => Number((i * increment).toFixed(1)));
}

export function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
