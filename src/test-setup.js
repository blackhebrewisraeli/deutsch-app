// Vitest setup.
//
// 1. jest-dom matchers (toBeInTheDocument, etc.) for component tests.
// 2. Auto-unmount React trees after each test (we run with globals:false, so
//    Testing Library's built-in cleanup won't auto-register — do it here).
// 3. A working in-memory localStorage / sessionStorage shim — Node 22+ ships an
//    experimental built-in localStorage that requires `--localstorage-file`;
//    without it the global becomes a broken empty object that can override
//    jsdom's. The shim also exposes `Storage` so tests can
//    `vi.spyOn(Storage.prototype, ...)` to simulate quota errors.

import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup, configure } from '@testing-library/react';
import { thawPersist } from './lib/storage';

// findBy*/waitFor give up after 1s by default, which is a coin flip on a loaded
// machine — a render that normally settles in 20ms can take seconds when the
// CPU is oversubscribed. This only extends how long we wait for something that
// is going to happen; assertions that never come true still fail, and the
// vitest testTimeout in vitest.config.js remains the outer bound.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  cleanup();
  thawPersist();
});

class StorageMock {
  constructor() {
    this._data = Object.create(null);
  }
  get length() {
    return Object.keys(this._data).length;
  }
  key(i) {
    return Object.keys(this._data)[i] ?? null;
  }
  getItem(k) {
    return Object.prototype.hasOwnProperty.call(this._data, k) ? this._data[k] : null;
  }
  setItem(k, v) {
    this._data[k] = String(v);
  }
  removeItem(k) {
    delete this._data[k];
  }
  clear() {
    this._data = Object.create(null);
  }
}

globalThis.Storage = StorageMock;
globalThis.localStorage = new StorageMock();
globalThis.sessionStorage = new StorageMock();
