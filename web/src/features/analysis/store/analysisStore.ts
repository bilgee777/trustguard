import { create } from 'zustand';
import type { AnalysisResult, ContentType } from '../engine';

export interface AnalyzerDraft {
  contentType: ContentType;
  text: string;
  /** Set when the text came from a demo sample and has not been edited since. */
  sampleId: string | null;
}

interface AnalysisState {
  results: Record<string, AnalysisResult>;
  draft: AnalyzerDraft;
  addResult: (result: AnalysisResult) => void;
  setDraft: (draft: Partial<AnalyzerDraft>) => void;
  resetDraft: () => void;
}

const EMPTY_DRAFT: AnalyzerDraft = { contentType: 'sms', text: '', sampleId: null };
const MAX_RESULTS = 20;

/**
 * Deliberately not persisted: analysed messages can contain personal data, so in this
 * version they live in memory only and disappear when the tab closes. Opt-in history
 * arrives with accounts and server-side storage.
 */
export const useAnalysisStore = create<AnalysisState>()((set) => ({
  results: {},
  draft: EMPTY_DRAFT,
  addResult: (result) => {
    set((state) => {
      const ids = Object.keys(state.results);
      const kept = ids.length >= MAX_RESULTS ? ids.slice(ids.length - MAX_RESULTS + 1) : ids;
      const results: Record<string, AnalysisResult> = {};
      for (const id of kept) {
        const existing = state.results[id];
        if (existing) results[id] = existing;
      }
      results[result.id] = result;
      return { results };
    });
  },
  setDraft: (draft) => {
    set((state) => ({ draft: { ...state.draft, ...draft } }));
  },
  resetDraft: () => {
    set({ draft: EMPTY_DRAFT });
  },
}));
