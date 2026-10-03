// A minimal synchronous event emitter. Listeners run in the order they were added.
export function createEmitter() {
  const map = new Map();
  return {
    on(type, fn) {
      if (!map.has(type)) map.set(type, []);
      map.get(type).push(fn);
      return () => { const l = map.get(type); l.splice(l.indexOf(fn) >>> 0, 1); };
    },
    emit(type, ...args) {
      for (const fn of map.get(type) || []) fn(...args);
    },
  };
}
