// @vitest-environment node
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import casesFile from '@shared/engine/parity-cases.json';
import { DEMO_SCENARIOS } from '@/features/demo/scenarios';
import { analyze } from './analyze';
import type { AnalysisResult, ContentType } from './types';

/**
 * Golden-file parity contract between the TypeScript and C# engines.
 * `npm run golden` regenerates shared/engine/parity-expected.json from this engine;
 * both test suites then assert their output matches it exactly.
 */
const EXPECTED_PATH = fileURLToPath(new URL('../../../../../shared/engine/parity-expected.json', import.meta.url));

interface ParityCase {
  id: string;
  contentType: ContentType;
  text: string;
}

export function project(result: AnalysisResult) {
  const points = new Map(result.contributions.map((c) => [c.findingId, c.points]));
  return {
    score: result.score,
    level: result.level,
    confidence: { level: result.confidence.level, value: result.confidence.value, reasons: result.confidence.reasons },
    findings: result.findings.map((f) => ({
      ruleId: f.ruleId,
      category: f.category,
      title: f.title,
      explanation: f.explanation,
      weight: Math.round(f.weight * 1e6) / 1e6,
      points: points.get(f.id) ?? 0,
      evidence: f.evidence,
      spans: f.spans.map((s) => [s.start, s.end]),
    })),
    urls: result.urls.map((u) => ({
      input: u.input,
      defanged: u.defanged,
      valid: u.valid,
      score: u.score,
      level: u.level,
      officialBrand: u.officialBrand,
      parts: u.parts,
      checks: u.checks.map((c) => ({ id: c.id, status: c.status, detail: c.detail })),
    })),
    recommendations: result.recommendations.map((r) => ({ id: r.id, priority: r.priority })),
    categories: result.categories.map((c) => ({ category: c.category, points: c.points, findingIds: c.findingIds })),
    highlights: result.highlights.map((h) => ({ start: h.start, end: h.end, findingIds: h.findingIds })),
  };
}

const cases: ParityCase[] = [
  ...DEMO_SCENARIOS.map((s) => ({ id: `demo-${s.id}`, contentType: s.contentType, text: s.text })),
  ...(casesFile.cases as ParityCase[]),
];

const actual = Object.fromEntries(
  cases.map((c) => [c.id, project(analyze({ contentType: c.contentType, text: c.text }))]),
);

describe('engine parity contract', () => {
  if (process.env['UPDATE_GOLDEN'] === '1') {
    it('regenerates the golden file', () => {
      const allCases = cases.map((c) => ({ ...c, expected: actual[c.id] }));
      writeFileSync(EXPECTED_PATH, `${JSON.stringify({ engineVersion: '1.0.0', cases: allCases }, null, 2)}\n`);
    });
    return;
  }

  const golden = JSON.parse(readFileSync(EXPECTED_PATH, 'utf8')) as { cases: { id: string; expected: unknown }[] };

  it('covers every case', () => {
    expect(golden.cases.map((c) => c.id)).toEqual(cases.map((c) => c.id));
  });

  it.each(golden.cases.map((c) => [c.id, c.expected] as const))('%s matches the golden output', (id, expected) => {
    expect(actual[id]).toEqual(expected);
  });
});
