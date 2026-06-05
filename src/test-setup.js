// Vitest setup — provides a working in-memory localStorage / sessionStorage.
//
// Why: Node 22+ ships an experimental built-in localStorage that requires
// `--localstorage-file=<path>` to function. Without the path, the global
// `localStorage` becomes a broken empty object (no getItem/setItem/removeItem).
// That object can override jsdom's localStorage in mixed environments.
//
// This shim guarantees a real Storage-like API and exposes `Storage` so tests
// can use `vi.spyOn(Storage.prototype, '...')` to simulate quota errors.

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
