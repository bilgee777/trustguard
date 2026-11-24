/** Joins class names, skipping falsy values. Small enough not to need a dependency. */
export function cn(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}
