import { attributeScore, combineWeights, levelForScore } from './scoring';
import type { Finding } from './types';

const finding = (id: string, weight: number): Finding => ({
  id,
  ruleId: id,
  category: 'urgency',
  title: id,
  explanation: '',
  weight,
  evidence: [],
  spans: [],
});

describe('scoring', () => {
  it('combines weights with noisy-OR', () => {
    expect(combineWeights([])).toBe(0);
    expect(combineWeights([0.5])).toBe(50);
    expect(combineWeights([0.5, 0.5])).toBe(75);
  });

  it('is monotonic and never exceeds 100', () => {
    const weights = [0.2, 0.3, 0.9, 0.9, 0.9, 0.9];
    let previous = 0;
    for (let i = 1; i <= weights.length; i++) {
      const score = combineWeights(weights.slice(0, i));
      expect(score).toBeGreaterThanOrEqual(previous);
      expect(score).toBeLessThanOrEqual(100);
      previous = score;
    }
  });

  it('maps scores to levels at documented thresholds', () => {
    expect([0, 24, 25, 49, 50, 74, 75, 100].map(levelForScore)).toEqual([
      'low',
      'low',
      'moderate',
      'moderate',
      'high',
      'high',
      'critical',
      'critical',
    ]);
  });

  it('attributes points that sum exactly to the score', () => {
    const findings = [finding('a', 0.3), finding('b', 0.22), finding('c', 0.08), finding('d', 0.55)];
    const score = combineWeights(findings.map((f) => f.weight));
    const points = attributeScore(findings, score);
    expect(points.reduce((sum, p) => sum + p.points, 0)).toBe(score);
    const byId = Object.fromEntries(points.map((p) => [p.findingId, p.points]));
    expect(byId['d']).toBeGreaterThan(byId['a'] ?? 0);
  });
});
