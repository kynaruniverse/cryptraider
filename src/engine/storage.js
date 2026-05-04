// ============================================================
// CRYPT RAIDER — Storage Adapter (Platform Abstraction Layer)
// ============================================================

export class StorageAdapter {
  constructor(driver = window.localStorage) {
    this.driver = driver;
  }

  get(key, fallback = null) {
    try {
      const v = this.driver.getItem(key);
      return v !== null ? v : fallback;
    } catch {
      return fallback;
    }
  }

  set(key, value) {
    try {
      this.driver.setItem(key, String(value));
    } catch {
      // silent fail (quota / private mode / platform restriction)
    }
  }

  remove(key) {
    try {
      this.driver.removeItem(key);
    } catch {
      // silent
    }
  }
}