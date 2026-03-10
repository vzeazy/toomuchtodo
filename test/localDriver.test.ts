import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalOnlyDriver } from '../src/store/storage/localDriver';
import { APP_SCHEMA_VERSION } from '../src/store/storage/migrations';

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length() {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key) ?? null : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

test('getSyncMeta upgrades persisted local schema version to the current app schema', () => {
  const originalLocalStorage = globalThis.localStorage;
  const storage = new MemoryStorage();
  const driver = new LocalOnlyDriver();

  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  });

  try {
    storage.setItem('too_much_to_do_sync_meta_v1', JSON.stringify({
      mode: 'account',
      cloudLinked: true,
      deviceId: 'device-old',
      syncCursor: '123:op-1',
      lastSyncAt: 123,
      pendingOps: [],
      localSchemaVersion: 2,
      schemaBlocked: true,
      settingsVersion: null,
      lastConflicts: [],
      lastSyncDiagnostics: null,
    }));

    const meta = driver.getSyncMeta();

    assert.equal(meta.localSchemaVersion, APP_SCHEMA_VERSION);

    const persisted = JSON.parse(storage.getItem('too_much_to_do_sync_meta_v1') || '{}') as { localSchemaVersion?: number };
    assert.equal(persisted.localSchemaVersion, APP_SCHEMA_VERSION);
  } finally {
    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLocalStorage,
      configurable: true,
      writable: true,
    });
  }
});
