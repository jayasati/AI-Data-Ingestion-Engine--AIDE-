/**
 * Shannon entropy over a column's value distribution, normalized to 0-1 by
 * the maximum possible entropy for that many unique values
 * (`log2(uniqueCount)`). 0 means every value is identical (or there are no
 * values); 1 means every value is equally likely, i.e. maximally random —
 * useful for telling apart a low-cardinality field (status, lead owner) from
 * a high-cardinality one (email, name) independent of row count.
 */
export function normalizedShannonEntropy(values: readonly string[]): number {
  if (values.length === 0) {
    return 0;
  }

  const frequencies = new Map<string, number>();
  for (const value of values) {
    frequencies.set(value, (frequencies.get(value) ?? 0) + 1);
  }

  if (frequencies.size <= 1) {
    return 0;
  }

  let entropy = 0;
  for (const count of frequencies.values()) {
    const probability = count / values.length;
    entropy -= probability * Math.log2(probability);
  }

  const maxEntropy = Math.log2(frequencies.size);
  return maxEntropy > 0 ? entropy / maxEntropy : 0;
}
