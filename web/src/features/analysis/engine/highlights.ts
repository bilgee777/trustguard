import type { Finding, HighlightSegment } from './types';

/**
 * Turns overlapping finding spans into a flat, gap-free list of segments covering the
 * whole text. Each segment lists every finding that covers it, so the UI can render
 * plain text with <mark> elements and no HTML injection risk.
 */
export function buildHighlights(text: string, findings: Finding[]): HighlightSegment[] {
  const spans = findings.flatMap((f) => f.spans.filter((s) => s.end > s.start).map((s) => ({ ...s, findingId: f.id })));
  const boundaries = [...new Set([0, text.length, ...spans.flatMap((s) => [s.start, s.end])])]
    .filter((b) => b >= 0 && b <= text.length)
    .sort((a, b) => a - b);

  const segments: HighlightSegment[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i] ?? 0;
    const end = boundaries[i + 1] ?? 0;
    const findingIds = [...new Set(spans.filter((s) => s.start <= start && s.end >= end).map((s) => s.findingId))];
    const previous = segments.at(-1);
    if (previous && sameIds(previous.findingIds, findingIds)) {
      previous.end = end;
      previous.text = text.slice(previous.start, end);
    } else {
      segments.push({ start, end, text: text.slice(start, end), findingIds });
    }
  }
  return segments;
}

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}
