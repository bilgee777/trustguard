import type { HistoryItem, HistoryPage, Settings, User } from '@/lib/api/types';

export const USER: User = {
  id: 'user-1',
  email: 'ayse@example.com',
  displayName: 'Ayse Demir',
  settings: { historyMode: 'off', retentionDays: 30 },
};

export function userWith(settings: Partial<Settings>): User {
  return { ...USER, settings: { ...USER.settings, ...settings } };
}

export function historyItem(overrides: Partial<HistoryItem> = {}): HistoryItem {
  return {
    id: 'item-1',
    createdAt: '2026-11-24T10:00:00Z',
    expiresAt: '2026-12-24T10:00:00Z',
    contentType: 'sms',
    score: 88,
    level: 'critical',
    confidenceLevel: 'high',
    confidenceValue: 85,
    categories: ['phishing', 'urgency'],
    findingTitles: ['Asks you to sign in or verify your account', 'Artificial deadline'],
    hasDetails: false,
    ...overrides,
  };
}

export function historyPage(items: HistoryItem[], total = items.length, page = 1): HistoryPage {
  return { items, total, page, pageSize: 10 };
}
