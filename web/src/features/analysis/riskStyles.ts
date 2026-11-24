import type { RiskLevel } from './engine';

export const RISK_TONE: Record<RiskLevel, { text: string; soft: string; bar: string; ring: string }> = {
  low: { text: 'text-low', soft: 'bg-low-soft', bar: 'bg-low', ring: 'ring-low/40' },
  moderate: { text: 'text-moderate', soft: 'bg-moderate-soft', bar: 'bg-moderate', ring: 'ring-moderate/40' },
  high: { text: 'text-high', soft: 'bg-high-soft', bar: 'bg-high', ring: 'ring-high/40' },
  critical: { text: 'text-critical', soft: 'bg-critical-soft', bar: 'bg-critical', ring: 'ring-critical/40' },
};

/** Highlight strength follows signal weight, so the eye goes to the strongest evidence first. */
export function strengthOf(weight: number): RiskLevel {
  if (weight >= 0.4) return 'critical';
  if (weight >= 0.25) return 'high';
  return 'moderate';
}
