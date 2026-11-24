import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { HistoryQuery } from '@/lib/api/types';
import { deleteAllHistory, deleteHistoryItem, getHistoryItem, listHistory } from './historyApi';

export function useHistoryList(query: HistoryQuery) {
  return useQuery({
    queryKey: ['history', 'list', query],
    queryFn: ({ signal }) => listHistory(query, signal),
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useHistoryItem(id: string) {
  return useQuery({ queryKey: ['history', 'item', id], queryFn: () => getHistoryItem(id), retry: false });
}

export function useDeleteHistoryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteHistoryItem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['history'] }),
  });
}

export function useDeleteAllHistory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAllHistory,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['history'] }),
  });
}
