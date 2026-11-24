import { del, get } from '@/lib/api/client';
import type { HistoryDetail, HistoryPage, HistoryQuery } from '@/lib/api/types';

export const PAGE_SIZE = 10;

export function listHistory(query: HistoryQuery, signal?: AbortSignal): Promise<HistoryPage> {
  const params = new URLSearchParams();
  for (const level of query.level) params.append('level', level);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  if (query.q.trim()) params.set('q', query.q.trim());
  params.set('sort', query.sort);
  params.set('page', String(query.page));
  params.set('pageSize', String(PAGE_SIZE));
  return get<HistoryPage>(`/api/history?${params.toString()}`, signal ? { signal } : undefined);
}

export const getHistoryItem = (id: string) => get<HistoryDetail>(`/api/history/${encodeURIComponent(id)}`);
export const deleteHistoryItem = (id: string) => del(`/api/history/${encodeURIComponent(id)}`);
export const deleteAllHistory = () => del<{ deleted: number }>('/api/history');
