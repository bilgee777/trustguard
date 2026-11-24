import type { Finding, RiskLevel, ScoreContribution } from './types';

/**
 * Noisy-OR combination: each finding is treated as an independent chance that the content
 * is malicious. risk = 1 - Π(1 - wᵢ). Properties we rely on:
 *  - adding a finding never lowers the score (monotonic),
 *  - the score saturates below 100 instead of overflowing like a plain sum,
 *  - one strong signal outweighs many weak ones, which matches analyst intuition.
 */
export function combineWeights(weights: number[]): number {
  const safe = weights.map((w) => Math.min(Math.max(w, 0), 0.99));
  const probability = 1 - safe.reduce((acc, w) => acc * (1 - w), 1);
  return Math.round(probability * 100);
}

export function levelForScore(score: number): RiskLevel {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'moderate';
  return 'low';
}

/**
 * Splits the final score into per-finding points that add up exactly to the score.
 * In log space noisy-OR is additive: -ln(1 - risk) = Σ -ln(1 - wᵢ), so each finding's
 * share of the total log-odds is its fair share of the points. Largest-remainder
 * rounding keeps the integers summing to the displayed score.
 */
export function attributeScore(findings: Finding[], score: number): ScoreContribution[] {
  const logs = findings.map((f) => -Math.log(1 - Math.min(f.weight, 0.99)));
  const total = logs.reduce((a, b) => a + b, 0);
  if (total === 0 || score === 0) return findings.map((f) => ({ findingId: f.id, points: 0 }));

  const raw = logs.map((l) => (l / total) * score);
  const floored = raw.map(Math.floor);
  let remainder = score - floored.reduce((a, b) => a + b, 0);
  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);
  for (const { index } of order) {
    if (remainder <= 0) break;
    floored[index] = (floored[index] ?? 0) + 1;
    remainder--;
  }
  return findings.map((f, i) => ({ findingId: f.id, points: floored[i] ?? 0 }));
}
