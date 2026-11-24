import rulesData from '@shared/engine/rules.json';
import { CONTENT_TYPES, INDICATOR_CATEGORIES, type ContentType, type IndicatorCategory } from './types';

export interface TextRule {
  id: string;
  category: IndicatorCategory;
  title: string;
  explanation: string;
  weight: number;
  patterns: RegExp[];
  /** Multiplies the weight when the content type makes the pattern more telling. */
  boost: Partial<Record<ContentType, number>>;
}

function isCategory(value: string): value is IndicatorCategory {
  return (INDICATOR_CATEGORIES as readonly string[]).includes(value);
}

function isContentType(value: string): value is ContentType {
  return (CONTENT_TYPES as readonly string[]).includes(value);
}

/**
 * Rules live in shared/engine/rules.json so the TypeScript and C# engines read the same
 * data. JSON carries no types, so the data is validated here and a bad file fails fast
 * at startup instead of silently mis-scoring messages.
 */
export function loadRules(data: typeof rulesData): TextRule[] {
  const ids = new Set<string>();
  return data.rules.map((raw) => {
    if (ids.has(raw.id)) throw new Error(`Duplicate rule id "${raw.id}"`);
    ids.add(raw.id);
    if (!isCategory(raw.category)) throw new Error(`Rule "${raw.id}" has unknown category "${raw.category}"`);
    if (!(raw.weight > 0 && raw.weight < 1)) throw new Error(`Rule "${raw.id}" weight must be between 0 and 1`);
    if (raw.patterns.length === 0) throw new Error(`Rule "${raw.id}" has no patterns`);
    const boost: Partial<Record<ContentType, number>> = {};
    for (const [type, factor] of Object.entries(raw.boost as Record<string, number>)) {
      if (!isContentType(type)) throw new Error(`Rule "${raw.id}" boosts unknown content type "${type}"`);
      boost[type] = factor;
    }
    return {
      id: raw.id,
      category: raw.category,
      title: raw.title,
      explanation: raw.explanation,
      weight: raw.weight,
      boost,
      patterns: raw.patterns.map((source) => new RegExp(source, 'giu')),
    };
  });
}

export const TEXT_RULES: TextRule[] = loadRules(rulesData);
