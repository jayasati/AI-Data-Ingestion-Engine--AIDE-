export function buildMissionSection(): string {
  return [
    "# Mission",
    "Extract only what exists in the data. Never fabricate a value. If a field cannot",
    "be determined with reasonable confidence from the row, its value is null — do not guess.",
  ].join("\n");
}
