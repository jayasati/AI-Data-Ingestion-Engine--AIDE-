/**
 * Shape the Semantic Extraction stage will produce once the AI core (a later
 * volume) is implemented: one candidate CRM field mapping per source record.
 * Defined now so the Validation stage's input contract is real, even though
 * nothing populates this yet.
 */
export interface ExtractedField {
  readonly sourceHeader: string;
  readonly targetField: string;
  readonly value: string | null;
  readonly confidence: number;
}

export interface ExtractedRecord {
  readonly rowNumber: number;
  readonly fields: readonly ExtractedField[];
}

export interface SemanticExtractionResult {
  readonly records: readonly ExtractedRecord[];
}
