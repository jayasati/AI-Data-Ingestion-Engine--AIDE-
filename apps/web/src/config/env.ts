/**
 * Client-safe environment access. Only NEXT_PUBLIC_* variables are readable
 * here — Next.js inlines them at build time.
 */
export const env = {
  apiUrl: (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/+$/, ""),
} as const;
