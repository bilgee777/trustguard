export const CONTENT_TYPES = ['sms', 'email', 'whatsapp', 'job_offer', 'url'] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const INDICATOR_CATEGORIES = [
  'phishing',
  'suspicious_link',
  'suspicious_domain',
  'impersonation',
  'personal_info',
  'advance_fee',
  'fake_job',
  'unrealistic_earnings',
  'urgency',
  'obfuscation',
] as const;
export type IndicatorCategory = (typeof INDICATOR_CATEGORIES)[number];

export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';

export interface TextSpan {
  start: number;
  end: number;
}

/** One detected risk indicator. A rule produces at most one finding per analysis. */
export interface Finding {
  id: string;
  ruleId: string;
  category: IndicatorCategory;
  title: string;
  explanation: string;
  /** Probability-like strength in (0, 1). Combined with other findings via noisy-OR. */
  weight: number;
  evidence: string[];
  spans: TextSpan[];
}

export interface ScoreContribution {
  findingId: string;
  points: number;
}

export interface CategoryBreakdown {
  category: IndicatorCategory;
  points: number;
  findingIds: string[];
}

export type ConfidenceLevel = 'low' | 'medium' | 'high';

export interface Confidence {
  level: ConfidenceLevel;
  value: number;
  reasons: string[];
}

export interface HighlightSegment {
  start: number;
  end: number;
  text: string;
  findingIds: string[];
}

export interface Recommendation {
  id: string;
  text: string;
  priority: 'primary' | 'secondary';
}

export type UrlCheckStatus = 'pass' | 'info' | 'warn' | 'fail';

export interface UrlCheck {
  id: string;
  label: string;
  status: UrlCheckStatus;
  detail: string;
}

export interface UrlParts {
  scheme: string | null;
  username: string | null;
  host: string;
  unicodeHost: string;
  registrableDomain: string;
  subdomain: string;
  port: string | null;
  path: string;
  query: string;
}

export interface UrlReport {
  input: string;
  defanged: string;
  valid: boolean;
  parts: UrlParts | null;
  checks: UrlCheck[];
  findings: Finding[];
  score: number;
  level: RiskLevel;
  officialBrand: string | null;
}

export interface AnalysisInput {
  contentType: ContentType;
  text: string;
}

export interface AnalysisResult {
  id: string;
  createdAt: string;
  engineVersion: string;
  source: 'user' | 'demo';
  demoScenarioId: string | null;
  contentType: ContentType;
  text: string;
  score: number;
  level: RiskLevel;
  confidence: Confidence;
  findings: Finding[];
  contributions: ScoreContribution[];
  categories: CategoryBreakdown[];
  highlights: HighlightSegment[];
  recommendations: Recommendation[];
  urls: UrlReport[];
  /** Null until the AI service is connected. Never filled with simulated output. */
  aiSummary: string | null;
}
