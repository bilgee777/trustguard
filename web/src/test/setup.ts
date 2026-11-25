import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { useAnalysisStore } from '@/features/analysis/store/analysisStore';
import { mockApi } from './mockApi';

// Every test starts with an API that answers 404 to everything, so nothing can reach the network by accident.
beforeEach(() => {
  mockApi();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  // Some suites run in the node environment, where there is no DOM.
  if (typeof document !== 'undefined') document.cookie = 'tg_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  useAnalysisStore.setState({ results: {} });
  useAnalysisStore.getState().resetDraft();
});

// jsdom does not implement the modal <dialog> API. This minimal stand-in lets component tests open and close it.
if (typeof HTMLDialogElement !== 'undefined' && typeof HTMLDialogElement.prototype.showModal !== 'function') {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}
