/**
 * Bigram Sorensen-Dice coefficient: a cheap, dependency-free general string
 * similarity that works uniformly on single-word and multi-word normalized
 * headers alike (no tokenization edge cases to get wrong). Used only for
 * fuzzy alias matching — exact alias lookups never go through this.
 */
export function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigrams = (value: string): Map<string, number> => {
    const counts = new Map<string, number>();
    for (let i = 0; i < value.length - 1; i += 1) {
      const bigram = value.slice(i, i + 2);
      counts.set(bigram, (counts.get(bigram) ?? 0) + 1);
    }
    return counts;
  };

  const bigramsA = bigrams(a);
  const bigramsB = bigrams(b);

  let intersection = 0;
  for (const [bigram, countA] of bigramsA) {
    const countB = bigramsB.get(bigram);
    if (countB) {
      intersection += Math.min(countA, countB);
    }
  }

  const totalBigrams = a.length - 1 + (b.length - 1);
  return totalBigrams > 0 ? (2 * intersection) / totalBigrams : 0;
}
