// Global test setup (referenced from vitest.config.ts). Test-only — never
// imported by application code.
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// ── jsdom gaps (browser APIs the app relies on that jsdom 25 does not ship) ──
// Blob/File.text() — used by the RCSA CSV importers (`await file.text()`).
if (typeof Blob.prototype.text !== 'function') {
  Blob.prototype.text = function text(this: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}
// Object URLs — used by the CSV exporters to trigger a download.
if (typeof URL.createObjectURL !== 'function') URL.createObjectURL = () => 'blob:jsdom';
if (typeof URL.revokeObjectURL !== 'function') URL.revokeObjectURL = () => {};

// Every repository persists to localStorage; start each test from an empty
// store so seed data / prior writes never leak between tests.
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
