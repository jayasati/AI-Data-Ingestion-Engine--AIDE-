export function isBlankRecord(record: readonly string[]): boolean {
  return record.every((cell) => cell.trim() === "");
}

/**
 * A single malformed row must never fail the whole import. Short rows are
 * padded with empty cells; long rows are truncated. Both are counted by the
 * caller so the discrepancy is visible in stage metadata, not silently lost.
 */
export function reconcileRowLength(
  cells: readonly string[],
  headerCount: number,
): readonly string[] {
  if (cells.length === headerCount) {
    return cells;
  }
  if (cells.length < headerCount) {
    return [...cells, ...(Array(headerCount - cells.length).fill("") as string[])];
  }
  return cells.slice(0, headerCount);
}
