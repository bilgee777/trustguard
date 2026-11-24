import type { Confidence, Finding } from './types';

/**
 * Confidence describes how much evidence the engine had, not how dangerous the content is.
 * A long message with several independent signals pointing the same way is high
 * confidence. A ten-word message with no signals is low confidence even though it scores 0.
 */
export function assessConfidence(text: string, findings: Finding[], score: number): Confidence {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const categories = new Set(findings.map((f) => f.category)).size;
  const strongSignals = findings.filter((f) => f.weight >= 0.45).length;
  const reasons: string[] = [];
  let value = 55;

  if (words < 8) {
    value -= 25;
    reasons.push('Very short text gives the engine little to work with.');
  } else if (words >= 30) {
    value += 10;
    reasons.push('Enough text to evaluate wording and context.');
  }

  if (score >= 50) {
    const bonus = Math.min(categories * 8, 24);
    value += bonus;
    if (categories >= 2) reasons.push(`${categories} independent indicator types point the same way.`);
  }
  if (strongSignals > 0) {
    value += 10;
    reasons.push('At least one strong, specific indicator was found.');
  }
  if (score >= 25 && score < 50) {
    value -= 10;
    reasons.push('Mixed signals: some warning signs, but none decisive.');
  }
  if (score < 25 && findings.length === 0 && words >= 8) {
    reasons.push('No known scam patterns matched. New or tailored scams can still slip through.');
  }

  reasons.push('Rule-based analysis only. AI review is not connected in this version.');
  value = Math.round(Math.min(Math.max(value, 5), 85));
  return { level: value >= 70 ? 'high' : value >= 45 ? 'medium' : 'low', value, reasons };
}
