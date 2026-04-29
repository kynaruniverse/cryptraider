// ============================================================
// CRYPT RAIDER — Event Bus
// Lightweight pub/sub used across all systems
// ============================================================

export class EventBus {
  constructor() {
    this._listeners = new Map();
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
    if (idx !== -1) list.splice(idx, 1);
  }

  emit(event, data = {}) {
    // Optional: Log events in dev mode for easier debugging of physics/input
    if (window.DEBUG_MODE) {
      console.log(`[Event]: ${event}`, data);
    }

    const list = this._listeners.get(event);
    if (!list) return;

    // We use a spread to create a shallow copy so that if a listener 
    // unsubscribes during the loop, it doesn't break the iteration.
    [...list].forEach(fn => {
      try {
        fn(data);
      } catch (error) {
        console.error(`Error in listener for event "${event}":`, error);
      }
    });
  }


  clear() {
    this._listeners.clear();
  }
}
