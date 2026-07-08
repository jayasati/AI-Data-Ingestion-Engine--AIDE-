export interface BusinessRuleProfile {
  readonly id: string;
  readonly allowedCrmStatusValues: readonly string[];
  readonly allowedDataSourceValues: readonly string[];
  readonly multipleEmailsRule: string;
  readonly multiplePhonesRule: string;
  readonly dateRule: string;
  readonly skipRule: string;
  readonly crmNoteRule: string;
  readonly nullHandlingRule: string;
}

export interface BusinessRule {
  readonly id: string;
  readonly text: string;
}
