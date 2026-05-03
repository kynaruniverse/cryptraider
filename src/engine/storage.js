// ============================================================
// CRYPT RAIDER — Storage Abstraction
// Swap this file's implementation for Capacitor Preferences
// in native builds without touching any consumer.
// ============================================================

export const Storage = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v !== null ? v : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, String(value));
    } catch { /* quota / private mode — silent */ }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch { /* silent */ }
  },
};