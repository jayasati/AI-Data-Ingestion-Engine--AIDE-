/** Minimal class-name joiner; avoids a runtime dependency for the common case. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
