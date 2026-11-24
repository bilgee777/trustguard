import type { TextSpan } from './types';

/** Characters that render as nothing but break keyword filters. */
const INVISIBLE_CHARS = /[\u00AD\u200B-\u200F\u2060-\u2064\uFEFF]/gu;

export function findInvisibleChars(text: string): TextSpan[] {
  return [...text.matchAll(INVISIBLE_CHARS)].map((m) => ({ start: m.index, end: m.index + m[0].length }));
}

/**
 * Script detection by explicit code-point ranges rather than \p{Script=...}: the same
 * table is used by the C# engine (where Unicode script properties are unavailable),
 * so both engines classify every character identically.
 */
const SCRIPT_RANGES: [string, number, number][] = [
  ['Latin', 0x41, 0x5a],
  ['Latin', 0x61, 0x7a],
  ['Latin', 0xc0, 0x24f],
  ['Latin', 0x1e00, 0x1eff],
  ['Greek', 0x370, 0x3ff],
  ['Greek', 0x1f00, 0x1fff],
  ['Cyrillic', 0x400, 0x52f],
  ['Armenian', 0x530, 0x58f],
];

export function scriptOf(codePoint: number): string | null {
  for (const [name, from, to] of SCRIPT_RANGES) {
    if (codePoint >= from && codePoint <= to) return name;
  }
  return null;
}

export function scriptsIn(word: string): Set<string> {
  const scripts = new Set<string>();
  for (let i = 0; i < word.length; i++) {
    const script = scriptOf(word.charCodeAt(i));
    if (script) scripts.add(script);
  }
  return scripts;
}

export function isMixedScript(word: string): boolean {
  const scripts = scriptsIn(word);
  return scripts.size > 1 && scripts.has('Latin');
}

/** Words that mix Latin with look-alike scripts, e.g. "Pаypal" with a Cyrillic "а". */
export function findMixedScriptWords(text: string): TextSpan[] {
  return [...text.matchAll(/[\p{L}\p{M}]+/gu)]
    .filter((m) => isMixedScript(m[0]))
    .map((m) => ({ start: m.index, end: m.index + m[0].length }));
}

const HOMOGLYPHS: Record<string, string> = {
  а: 'a',
  е: 'e',
  о: 'o',
  р: 'p',
  с: 'c',
  у: 'y',
  х: 'x',
  і: 'i',
  ј: 'j',
  ѕ: 's',
  ԁ: 'd',
  һ: 'h',
  ӏ: 'l',
  ԛ: 'q',
  ԝ: 'w',
  ο: 'o',
  α: 'a',
  ν: 'v',
  ρ: 'p',
  τ: 't',
  ι: 'i',
  κ: 'k',
  ε: 'e',
  υ: 'u',
  ı: 'i',
  ɡ: 'g',
  ℓ: 'l',
};

const LEET: Record<string, string> = { '0': 'o', '1': 'l', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a' };

/**
 * Reduces a string to a comparable "skeleton": look-alike letters and digit substitutions
 * map to the Latin letter they imitate. Inspired by Unicode TS #39 confusable detection,
 * with a deliberately small table so results stay explainable.
 */
export function skeleton(value: string): string {
  let out = '';
  for (const char of value.toLowerCase().normalize('NFKC')) {
    out += HOMOGLYPHS[char] ?? LEET[char] ?? char;
  }
  return out.replace(/rn/g, 'm').replace(/vv/g, 'w');
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = prev[0] ?? 0;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = prev[j] ?? 0;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      prev[j] = Math.min(above + 1, (prev[j - 1] ?? 0) + 1, diagonal + cost);
      diagonal = above;
    }
  }
  return prev[b.length] ?? 0;
}
