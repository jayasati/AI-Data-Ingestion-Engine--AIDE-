/**
 * Shape the Validation stage will produce once the trust engine (a later
 * volume) is implemented. Defined now so the Aggregation stage's input
 * contract is real, even though nothing populates this yet.
 */
export interface ValidatedRecord {
  readonly rowNumber: number;
  readonly isValid: boolean;
  readonly confidenceScore: number;
  readonly issues: readonly string[];
}

export interface ValidationResult {
  readonly records: readonly ValidatedRecord[];
}
