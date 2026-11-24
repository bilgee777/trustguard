import { create } from 'zustand';
import type { ContentType } from '../engine';
import type { AnalysisOutcome } from '../api/analysisService';

export interface AnalyzerDraft {
  contentType: ContentType;
  text: string;
  /** Set when the text came from a demo sample and has not been edited since. */
  sampleId: string | null;
}

interface AnalysisState {
  results: Record<string, AnalysisOutcome>;
  draft: AnalyzerDraft;
  addResult: (outcome: AnalysisOutcome) => void;
  setDraft: (draft: Partial<AnalyzerDraft>) => void;
  resetDraft: () => void;
}

const EMPTY_DRAFT: AnalyzerDraft = { contentType: 'sms', text: '', sampleId: null };
const MAX_RESULTS = 20;

/**
 * Deliberately not persisted: analysed messages can contain personal data, so results live in memory
 * only and disappear when the tab closes. Saving is an explicit, server-side, opt-in history feature.
 */
export const useAnalysisStore = create<AnalysisState>()((set) => ({
  results: {},
  draft: EMPTY_DRAFT,
  addResult: (outcome) => {
    set((state) => {
      const ids = Object.keys(state.results);
      const kept = ids.length >= MAX_RESULTS ? ids.slice(ids.length - MAX_RESULTS + 1) : ids;
      const results: Record<string, AnalysisOutcome> = {};
      for (const id of kept) {
        const existing = state.results[id];
        if (existing) results[id] = existing;
      }
      results[outcome.result.id] = outcome;
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
