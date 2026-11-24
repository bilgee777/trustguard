/**
 * Minimal RFC 3492 Punycode decoder. Browsers expose hostnames in their ASCII "xn--" form,
 * so we decode them to reveal what a user would actually see in the address bar.
 */
const BASE = 36;
const T_MIN = 1;
const T_MAX = 26;
const SKEW = 38;
const DAMP = 700;
const INITIAL_BIAS = 72;
const INITIAL_N = 128;
const MAX_INT = 0x7fffffff;

function adapt(delta: number, numPoints: number, firstTime: boolean): number {
  let d = firstTime ? Math.floor(delta / DAMP) : delta >> 1;
  d += Math.floor(d / numPoints);
  let k = 0;
  while (d > ((BASE - T_MIN) * T_MAX) >> 1) {
    d = Math.floor(d / (BASE - T_MIN));
    k += BASE;
  }
  return Math.floor(k + ((BASE - T_MIN + 1) * d) / (d + SKEW));
}

function digitOf(codePoint: number): number {
  if (codePoint >= 48 && codePoint < 58) return codePoint - 22;
  if (codePoint >= 65 && codePoint < 91) return codePoint - 65;
  if (codePoint >= 97 && codePoint < 123) return codePoint - 97;
  return BASE;
}

export function decodePunycodeLabel(input: string): string | null {
  const output: number[] = [];
  let i = 0;
  let n = INITIAL_N;
  let bias = INITIAL_BIAS;
  const basicEnd = Math.max(input.lastIndexOf('-'), 0);

  for (let j = 0; j < basicEnd; j++) {
    const code = input.charCodeAt(j);
    if (code >= 0x80) return null;
    output.push(code);
  }

  for (let index = basicEnd > 0 ? basicEnd + 1 : 0; index < input.length;) {
    const oldI = i;
    let w = 1;
    for (let k = BASE; ; k += BASE) {
      if (index >= input.length) return null;
      const digit = digitOf(input.charCodeAt(index++));
      if (digit >= BASE || digit > Math.floor((MAX_INT - i) / w)) return null;
      i += digit * w;
      const t = k <= bias ? T_MIN : k >= bias + T_MAX ? T_MAX : k - bias;
      if (digit < t) break;
      if (w > Math.floor(MAX_INT / (BASE - t))) return null;
      w *= BASE - t;
    }
    const length = output.length + 1;
    bias = adapt(i - oldI, length, oldI === 0);
    if (Math.floor(i / length) > MAX_INT - n) return null;
    n += Math.floor(i / length);
    i %= length;
    output.splice(i++, 0, n);
  }
  // String.fromCodePoint throws a RangeError above U+10FFFF, and lone surrogates cannot be encoded
  // as UTF-8/JSON, so neither can be a decoded label.
  if (output.some((cp) => cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff))) return null;
  return String.fromCodePoint(...output);
}

export function hostToUnicode(host: string): string {
  return host
    .split('.')
    .map((label) => (label.toLowerCase().startsWith('xn--') ? (decodePunycodeLabel(label.slice(4)) ?? label) : label))
    .join('.');
}
