import type { AnalysisResult, ContentType, RiskLevel, ConfidenceLevel } from '@/features/analysis/engine';

export type HistoryMode = 'off' | 'summary' | 'redacted_text';

export interface Settings {
  historyMode: HistoryMode;
  retentionDays: number;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  settings: Settings;
}

export interface AnalyzeResponse {
  result: AnalysisResult;
  saved: boolean;
  historyId: string | null;
}

export interface HistoryItem {
  id: string;
  createdAt: string;
  expiresAt: string;
  contentType: ContentType;
  score: number;
  level: RiskLevel;
  confidenceLevel: ConfidenceLevel;
  confidenceValue: number;
  categories: string[];
  findingTitles: string[];
  hasDetails: boolean;
}

export interface HistoryPage {
  items: HistoryItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface HistoryDetail {
  item: HistoryItem;
  redactedText: string | null;
  result: AnalysisResult | null;
}

export interface HistoryQuery {
  level: RiskLevel[];
  from: string;
  to: string;
  q: string;
  sort: 'newest' | 'oldest' | 'score';
  page: number;
}
