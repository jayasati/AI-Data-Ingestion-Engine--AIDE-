import { describe, expect, it } from "vitest";
import { decideApproval } from "@/trust/approval/approval-engine";

const CLEAN: Parameters<typeof decideApproval>[0] = {
  skipped: false,
  skipReason: null,
  hasSchemaErrors: false,
  hasBusinessRuleErrors: false,
  recordConfidence: 0.9,
  qualityScore: 90,
  repairCount: 0,
};

describe("decideApproval", () => {
  it("approves a clean, confident, high-quality record", () => {
    const decision = decideApproval(CLEAN);
    expect(decision.status).toBe("approved");
  });

  it("skips a skipped record regardless of everything else being clean", () => {
    const decision = decideApproval({ ...CLEAN, skipped: true, skipReason: "no contact info" });
    expect(decision.status).toBe("skipped");
    expect(decision.reason).toBe("no contact info");
  });

  it("rejects a record with a schema error, even at high confidence", () => {
    const decision = decideApproval({ ...CLEAN, hasSchemaErrors: true });
    expect(decision.status).toBe("rejected");
  });

  it("rejects a record with a business rule error, even at high confidence", () => {
    const decision = decideApproval({ ...CLEAN, hasBusinessRuleErrors: true });
    expect(decision.status).toBe("rejected");
  });

  it("rejects a record whose confidence falls below the needs-review floor", () => {
    const decision = decideApproval({ ...CLEAN, recordConfidence: 0.1 });
    expect(decision.status).toBe("rejected");
  });

  it("rejects a record whose quality score falls below the needs-review floor", () => {
    const decision = decideApproval({ ...CLEAN, qualityScore: 10 });
    expect(decision.status).toBe("rejected");
  });

  it("marks a record needs_review when it's in the middle band", () => {
    const decision = decideApproval({ ...CLEAN, recordConfidence: 0.5, qualityScore: 50 });
    expect(decision.status).toBe("needs_review");
  });

  it("marks a record needs_review when it exceeds the repair-count cap even if otherwise confident", () => {
    const decision = decideApproval({ ...CLEAN, repairCount: 10 });
    expect(decision.status).toBe("needs_review");
  });

  it("skip takes priority over a schema error", () => {
    const decision = decideApproval({ ...CLEAN, skipped: true, hasSchemaErrors: true });
    expect(decision.status).toBe("skipped");
  });
});
