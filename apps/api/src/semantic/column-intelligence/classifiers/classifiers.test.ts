import { describe, expect, it } from "vitest";
import {
  companyClassifier,
  currencyClassifier,
  dateClassifier,
  emailClassifier,
  locationClassifier,
  nameClassifier,
  phoneClassifier,
  statusClassifier,
} from "@/semantic/column-intelligence/classifiers";

describe("classifiers", () => {
  it("emailClassifier matches email-shaped values", () => {
    const result = emailClassifier.classify(["a@x.com", "b@x.com", "not-an-email"]);
    expect(result.matchRatio).toBeCloseTo(2 / 3);
    expect(result.evidence).toContain("a@x.com");
  });

  it("phoneClassifier matches phone-shaped values", () => {
    const result = phoneClassifier.classify(["9876543210", "+91 98765 43210", "hello"]);
    expect(result.matchRatio).toBeCloseTo(2 / 3);
  });

  it("dateClassifier matches ISO and common date formats", () => {
    const result = dateClassifier.classify(["2026-05-12", "5/12/2026", "not a date"]);
    expect(result.matchRatio).toBeCloseTo(2 / 3);
  });

  it("currencyClassifier requires an explicit currency symbol or code", () => {
    expect(currencyClassifier.classify(["$1,200.50", "₹500"]).matchRatio).toBe(1);
    expect(currencyClassifier.classify(["1200.50", "500"]).matchRatio).toBe(0);
  });

  it("nameClassifier accepts plausible human names and rejects other shapes", () => {
    const result = nameClassifier.classify([
      "John Doe",
      "Priya Sharma",
      "john@example.com",
      "9876543210",
    ]);
    expect(result.matchRatio).toBeCloseTo(0.5);
  });

  it("nameClassifier rejects Title-Case phrases built from common non-name nouns", () => {
    const result = nameClassifier.classify([
      "Site Visit Request",
      "Brochure Download",
      "Callback Request",
      "John Doe",
    ]);
    expect(result.matchRatio).toBeCloseTo(0.25);
    expect(result.evidence).toEqual(["John Doe"]);
  });

  it("nameClassifier rejects a phrase if any single token is a non-name word", () => {
    expect(nameClassifier.classify(["Product Demo"]).matchRatio).toBe(0);
    expect(nameClassifier.classify(["Priya Sharma"]).matchRatio).toBe(1);
  });

  it("companyClassifier matches values carrying a recognizable suffix", () => {
    const result = companyClassifier.classify(["Acme Corp", "Ali Traders", "Google"]);
    expect(result.matchRatio).toBeCloseTo(2 / 3);
  });

  it("locationClassifier matches known countries, states, and cities", () => {
    const result = locationClassifier.classify([
      "Bengaluru",
      "Maharashtra",
      "India",
      "Nowhereville",
    ]);
    expect(result.matchRatio).toBeCloseTo(0.75);
  });

  it("statusClassifier matches known status keywords", () => {
    const result = statusClassifier.classify(["New", "Closed", "Won", "banana"]);
    expect(result.matchRatio).toBeCloseTo(0.75);
  });

  it("statusClassifier falls back to a weak low-cardinality signal without keywords", () => {
    const result = statusClassifier.classify([
      "Alpha",
      "Beta",
      "Alpha",
      "Alpha",
      "Alpha",
      "Beta",
      "Alpha",
      "Alpha",
    ]);
    expect(result.matchRatio).toBe(0.3);
  });

  it("statusClassifier scores 0 for high-cardinality, non-keyword text", () => {
    const result = statusClassifier.classify(["a", "b", "c", "d", "e", "f"]);
    expect(result.matchRatio).toBe(0);
  });

  it("every classifier returns matchRatio 0 and no evidence for an empty column", () => {
    expect(emailClassifier.classify([])).toEqual({ matchRatio: 0, evidence: [] });
  });
});
