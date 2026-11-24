import { BRANDS, isOfficialHost } from './brands';
import { assessConfidence } from './confidence';
import { buildHighlights } from './highlights';
import { buildRecommendations } from './recommendations';
import { TEXT_RULES } from './rules';
import { attributeScore, combineWeights, levelForScore } from './scoring';
import type {
  AnalysisInput,
  AnalysisResult,
  CategoryBreakdown,
  Finding,
  IndicatorCategory,
  TextSpan,
  UrlReport,
} from './types';
import { findInvisibleChars, findMixedScriptWords } from './unicode';
import { extractUrls, inspectUrl, type ExtractedUrl } from './url';

export const ENGINE_VERSION = '1.0.0';
export const MAX_INPUT_LENGTH = 10_000;
const MAX_URLS = 10;
const MAX_EVIDENCE = 3;
const MAX_WEIGHT = 0.9;

export interface AnalyzeOptions {
  source?: AnalysisResult['source'];
  demoScenarioId?: string | null;
  id?: string;
  now?: Date;
}

function collectEvidence(text: string, spans: TextSpan[]): string[] {
  const seen = new Map<string, string>();
  for (const span of spans) {
    const snippet = text.slice(span.start, span.end).trim();
    const key = snippet.toLowerCase();
    if (snippet && !seen.has(key)) seen.set(key, snippet);
    if (seen.size >= MAX_EVIDENCE) break;
  }
  return [...seen.values()];
}

function runTextRules({ text, contentType }: AnalysisInput): Finding[] {
  const findings: Finding[] = [];
  for (const rule of TEXT_RULES) {
    const spans = rule.patterns.flatMap((pattern) =>
      [...text.matchAll(pattern)].map((m) => ({ start: m.index, end: m.index + m[0].length })),
    );
    if (spans.length === 0) continue;
    findings.push({
      id: rule.id,
      ruleId: rule.id,
      category: rule.category,
      title: rule.title,
      explanation: rule.explanation,
      weight: Math.min(rule.weight * (rule.boost?.[contentType] ?? 1), MAX_WEIGHT),
      evidence: collectEvidence(text, spans),
      spans,
    });
  }
  return findings;
}

function runObfuscationChecks(text: string): Finding[] {
  const findings: Finding[] = [];
  const invisible = findInvisibleChars(text);
  if (invisible.length > 0) {
    findings.push({
      id: 'obfuscation.invisible',
      ruleId: 'obfuscation.invisible',
      category: 'obfuscation',
      title: 'Invisible characters inside the text',
      explanation: `The text contains ${invisible.length} invisible character${invisible.length === 1 ? '' : 's'}. They are inserted to break up words so spam filters miss them.`,
      weight: 0.3,
      evidence: [`${invisible.length} hidden character${invisible.length === 1 ? '' : 's'}`],
      spans: invisible,
    });
  }
  const mixed = findMixedScriptWords(text);
  if (mixed.length > 0) {
    findings.push({
      id: 'obfuscation.mixed_script',
      ruleId: 'obfuscation.mixed_script',
      category: 'obfuscation',
      title: 'Words built from look-alike letters',
      explanation:
        'Some words mix Latin letters with identical-looking Cyrillic or Greek ones. Real companies never do this. It is used to fake brand names and dodge filters.',
      weight: 0.4,
      evidence: collectEvidence(text, mixed),
      spans: mixed,
    });
  }
  return findings;
}

function locateUrls({ text, contentType }: AnalysisInput): ExtractedUrl[] {
  if (contentType === 'url') {
    const value = text.trim();
    const start = text.indexOf(value);
    return value ? [{ value, start, end: start + value.length }] : [];
  }
  return extractUrls(text).slice(0, MAX_URLS);
}

/** URL findings from several links are merged per rule, keeping the strongest weight. */
function mergeUrlFindings(located: ExtractedUrl[], reports: UrlReport[]): Finding[] {
  const merged = new Map<string, Finding>();
  reports.forEach((report, index) => {
    const span = located[index];
    for (const finding of report.findings) {
      const existing = merged.get(finding.ruleId);
      const spans = span ? [{ start: span.start, end: span.end }] : [];
      if (!existing) {
        merged.set(finding.ruleId, { ...finding, spans });
      } else {
        existing.spans.push(...spans);
        existing.evidence = [...new Set([...existing.evidence, ...finding.evidence])].slice(0, MAX_EVIDENCE);
        if (finding.weight > existing.weight) {
          existing.weight = finding.weight;
          existing.title = finding.title;
          existing.explanation = finding.explanation;
        }
      }
    }
  });
  return [...merged.values()];
}

function overlaps(span: TextSpan, others: TextSpan[]): boolean {
  return others.some((o) => span.start < o.end && o.start < span.end);
}

function detectImpersonation(text: string, located: ExtractedUrl[], reports: UrlReport[], findings: Finding[]): Finding | null {
  const asksForData = findings.some((f) => f.category === 'phishing' || f.category === 'personal_info' || f.category === 'advance_fee');
  for (const brand of BRANDS) {
    const pattern = new RegExp(`\\b(${brand.keywords.map((k) => k.replace(/\s+/g, '\\s+')).join('|')})\\b`, 'giu');
    const mentions = [...text.matchAll(pattern)]
      .map((m) => ({ start: m.index, end: m.index + m[0].length }))
      .filter((span) => !overlaps(span, located));
    if (mentions.length === 0) continue;

    const foreignHosts = reports
      .filter((r) => r.parts && (r.parts.scheme === 'http' || r.parts.scheme === 'https'))
      .map((r) => r.parts?.host ?? '')
      .filter((host) => !isOfficialHost(host, brand));
    if (foreignHosts.length === 0 && !asksForData) continue;

    const explanation =
      foreignHosts.length > 0
        ? `The message presents itself as ${brand.name}, but its link goes to ${foreignHosts[0] ?? ''}, which is not one of ${brand.name}'s official domains (${brand.domains.join(', ')}).`
        : `The message presents itself as ${brand.name} and asks for an action, payment or data. ${brand.name} will not ask for this by message. Check in the official app instead.`;
    return {
      id: 'impersonation.brand',
      ruleId: 'impersonation.brand',
      category: 'impersonation',
      title: `Claims to be ${brand.name}`,
      explanation,
      weight: foreignHosts.length > 0 ? 0.4 : 0.25,
      evidence: collectEvidence(text, mentions),
      spans: mentions,
    };
  }
  return null;
}

function detectCombinations(findings: Finding[], reports: UrlReport[]): Finding[] {
  const has = (category: IndicatorCategory) => findings.some((f) => f.category === category);
  const riskyLink = reports.some((r) => r.valid && r.officialBrand === null);
  const combos: Finding[] = [];
  const combo = (id: string, category: IndicatorCategory, title: string, explanation: string, weight: number) =>
    combos.push({ id, ruleId: id, category, title, explanation, weight, evidence: [], spans: [] });

  if (has('urgency') && riskyLink) {
    combo(
      'combo.pressure_link',
      'suspicious_link',
      'Pressure combined with a link',
      'Urgent or threatening wording next to a link is the core phishing recipe: it makes you click before you check where the link goes.',
      0.15,
    );
  }
  if (has('fake_job') && has('advance_fee')) {
    combo(
      'combo.job_fee',
      'advance_fee',
      'Job offer that asks you to pay',
      'Real employers pay you. They never charge for training, equipment, registration or a “starter kit”.',
      0.35,
    );
  }
  if (has('unrealistic_earnings') && findings.some((f) => f.ruleId === 'advance_fee.untraceable')) {
    combo(
      'combo.investment_fraud',
      'unrealistic_earnings',
      'Promised returns paid in untraceable money',
      'High or guaranteed returns combined with a request to send crypto, gift cards or wire transfers is the signature of investment fraud. Deposits are almost never recovered.',
      0.3,
    );
  }
  if (findings.some((f) => f.ruleId === 'phishing.credentials') && riskyLink) {
    combo(
      'combo.credential_link',
      'phishing',
      'Account request with an unofficial link',
      'The message asks you to act on your account and supplies a link that is not an official domain of a known brand.',
      0.2,
    );
  }
  return combos;
}

function createId(): string {
  return globalThis.crypto.randomUUID();
}

export function analyze(input: AnalysisInput, options: AnalyzeOptions = {}): AnalysisResult {
  const text = input.text.slice(0, MAX_INPUT_LENGTH);
  const normalizedInput = { ...input, text };

  const located = locateUrls(normalizedInput);
  const reports = located.map((u) => inspectUrl(u.value));

  const findings: Finding[] = [
    ...runTextRules(normalizedInput),
    ...runObfuscationChecks(text),
    ...mergeUrlFindings(located, reports),
  ];
  const impersonation = detectImpersonation(text, located, reports, findings);
  if (impersonation) findings.push(impersonation);
  findings.push(...detectCombinations(findings, reports));

  const score = combineWeights(findings.map((f) => f.weight));
  const level = levelForScore(score);
  const contributions = attributeScore(findings, score);
  const pointsById = new Map(contributions.map((c) => [c.findingId, c.points]));
  findings.sort((a, b) => (pointsById.get(b.id) ?? 0) - (pointsById.get(a.id) ?? 0) || b.weight - a.weight);

  const byCategory = new Map<IndicatorCategory, CategoryBreakdown>();
  for (const finding of findings) {
    const entry = byCategory.get(finding.category) ?? { category: finding.category, points: 0, findingIds: [] };
    entry.points += pointsById.get(finding.id) ?? 0;
    entry.findingIds.push(finding.id);
    byCategory.set(finding.category, entry);
  }

  return {
    id: options.id ?? createId(),
    createdAt: (options.now ?? new Date()).toISOString(),
    engineVersion: ENGINE_VERSION,
    source: options.source ?? 'user',
    demoScenarioId: options.demoScenarioId ?? null,
    contentType: input.contentType,
    text,
    score,
    level,
    confidence: assessConfidence(text, findings, score),
    findings,
    contributions: findings.map((f) => ({ findingId: f.id, points: pointsById.get(f.id) ?? 0 })),
    categories: [...byCategory.values()].sort((a, b) => b.points - a.points),
    highlights: buildHighlights(text, findings),
    recommendations: buildRecommendations(findings, level),
    urls: reports,
    aiSummary: null,
  };
}
