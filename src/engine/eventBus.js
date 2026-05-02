// ============================================================
// CRYPT RAIDER — Event Bus
// Lightweight pub/sub used across all systems
// ============================================================

export class EventBus {
  /**
   * @param {boolean} [debug=false] - Enable event tracing without a window global.
   */
  constructor(debug = false) {
    this._listeners = new Map();
    this._debug = debug;
  }

  on(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, []);
    this._listeners.get(event).push(fn);
    return () => this.off(event, fn); // returns unsubscribe fn
  }

  once(event, fn) {
    const wrapper = (data) => {
      fn(data);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }


  off(event, fn) {
    const list = this._listeners.get(event);
    if (!list) return;
    const idx = list.indexOf(fn);
    // Tombstone: set to null instead of splicing — keeps array indices stable.
    if (idx !== -1) list[idx] = null;
  }

  emit(event, data = {}) {
    if (this._debug) {
      console.log(`[Event]: ${event}`, data);
    }

    const list = this._listeners.get(event);
    if (!list) return;

    let hasNulls = false;
    for (let i = 0, len = list.length; i < len; i++) {
      const fn = list[i];
      if (!fn) { hasNulls = true; continue; }
      try { fn(data); } catch (err) {
        console.error(`Error in listener for "${event}":`, err);
      }
    }
    // Lazy compaction: only allocate when tombstones accumulate.
    if (hasNulls) {
      const compacted = list.filter(Boolean);
      if (compacted.length === 0) this._listeners.delete(event);
      else this._listeners.set(event, compacted);
    }
  }


  clear() {
    this._listeners.clear();
  }
}
