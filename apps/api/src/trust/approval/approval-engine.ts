import type { ApprovalStatus } from "@/pipeline/domain/validation";
import { DEFAULT_TRUST_CONFIG, type TrustConfig } from "@/trust/config/trust-config";

export interface ApprovalInput {
  readonly skipped: boolean;
  readonly skipReason: string | null;
  readonly hasSchemaErrors: boolean;
  readonly hasBusinessRuleErrors: boolean;
  readonly recordConfidence: number;
  readonly qualityScore: number;
  readonly repairCount: number;
}

export interface ApprovalDecision {
  readonly status: ApprovalStatus;
  readonly reason: string;
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * The final gate: skipped beats everything (nothing left to approve), a
 * hard structural/business error always rejects (no confidence score can
 * outweigh an invalid enum or a broken schema), and otherwise the decision
 * comes down to whether confidence, quality, and repair count all clear
 * the "approved" bar, both fall below the "needs_review" floor (rejected),
 * or land in between (needs_review — the deliberately non-automated middle
 * ground; no human-review *workflow* exists yet, this is only the label).
 */
export function decideApproval(
  input: ApprovalInput,
  config: TrustConfig = DEFAULT_TRUST_CONFIG,
): ApprovalDecision {
  if (input.skipped) {
    return { status: "skipped", reason: input.skipReason ?? "Record was skipped." };
  }

  if (input.hasSchemaErrors) {
    return { status: "rejected", reason: "Record failed schema validation." };
  }

  if (input.hasBusinessRuleErrors) {
    return {
      status: "rejected",
      reason:
        "Record violates one or more business rules (invalid enum value or unparseable date).",
    };
  }

  const meetsApprovalBar =
    input.recordConfidence >= config.approvedConfidenceThreshold &&
    input.qualityScore >= config.approvedQualityThreshold &&
    input.repairCount <= config.maxRepairsBeforeReview;

  if (meetsApprovalBar) {
    return {
      status: "approved",
      reason: `Confidence ${percent(input.recordConfidence)} and quality score ${input.qualityScore} both meet the approval threshold.`,
    };
  }

  const belowRejectionFloor =
    input.recordConfidence < config.needsReviewConfidenceThreshold ||
    input.qualityScore < config.needsReviewQualityThreshold;

  if (belowRejectionFloor) {
    return {
      status: "rejected",
      reason: `Confidence ${percent(input.recordConfidence)} or quality score ${input.qualityScore} fell below the minimum acceptable threshold.`,
    };
  }

  if (input.repairCount > config.maxRepairsBeforeReview) {
    return {
      status: "needs_review",
      reason: `Record required ${input.repairCount} repairs, exceeding the ${config.maxRepairsBeforeReview}-repair auto-approval limit.`,
    };
  }

  return {
    status: "needs_review",
    reason: `Confidence ${percent(input.recordConfidence)} and quality score ${input.qualityScore} are in the acceptable-but-uncertain range.`,
  };
}
