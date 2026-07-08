import { describe, expect, it } from "vitest";
import type { EmailFieldDetails } from "@/pipeline/domain/normalization";
import { EmailRule } from "@/pipeline/stages/normalization/rules/email-rule";

describe("EmailRule", () => {
  const rule = new EmailRule();

  it("canApply is true for a value that looks like an email", () => {
    expect(rule.canApply("JOHN@EXAMPLE.COM")).toBe(true);
  });

  it("canApply is false for a value with no @ sign", () => {
    expect(rule.canApply("not-an-email")).toBe(false);
  });

  it("canApply is true if any comma/semicolon-separated part looks like an email", () => {
    expect(rule.canApply("garbage;jane@example.com")).toBe(true);
  });

  it("lowercases and trims a single valid email", () => {
    const result = rule.apply(" JOHN@EXAMPLE.COM ");
    expect(result.value).toBe("john@example.com");
    expect(result.confidence).toBe(1);
    expect(result.warnings).toBeUndefined();
    const details = result.details as EmailFieldDetails;
    expect(details.kind).toBe("email");
    expect(details.primary).toBe("john@example.com");
    expect(details.additional).toEqual([]);
    expect(details.isValid).toBe(true);
  });

  it("splits multiple emails on comma, keeping the first as primary and the rest as additional", () => {
    const result = rule.apply("jane@example.com,backup@example.com,third@example.com");
    const details = result.details as EmailFieldDetails;
    expect(details.primary).toBe("jane@example.com");
    expect(details.additional).toEqual(["backup@example.com", "third@example.com"]);
  });

  it("splits multiple emails on semicolon", () => {
    const result = rule.apply("jane@example.com;backup@example.com");
    const details = result.details as EmailFieldDetails;
    expect(details.primary).toBe("jane@example.com");
    expect(details.additional).toEqual(["backup@example.com"]);
  });

  it("splits multiple emails on ' and '", () => {
    const result = rule.apply("jane@example.com and backup@example.com");
    const details = result.details as EmailFieldDetails;
    expect(details.primary).toBe("jane@example.com");
    expect(details.additional).toEqual(["backup@example.com"]);
  });

  it("flags an invalid email with a low confidence and a warning", () => {
    const result = rule.apply("john@@broken");
    const details = result.details as EmailFieldDetails;
    expect(details.isValid).toBe(false);
    expect(result.confidence).toBe(0.4);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings?.[0].code).toBe("INVALID_EMAIL_SYNTAX");
  });
});
