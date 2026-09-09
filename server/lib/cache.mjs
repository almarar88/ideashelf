/**
 * Tiny in-memory TTL cache with single-flight de-duplication.
 *
 * Partner APIs meter every call and Wikimedia asks that clients cache, so two
 * users searching the same route within the TTL must cost one upstream call —
 * and ten simultaneous requests for the same key must cost one, not ten.
 */
export function createCache({ max = 500 } = {}) {
  const store = new Map();
  const inflight = new Map();

  const evictIfNeeded = () => {
    while (store.size > max) {
      // Map preserves insertion order, so the first key is the oldest.
      const oldest = store.keys().next().value;
      store.delete(oldest);
    }
  };

  return {
    /** Runs `fn` unless a fresh value is cached; concurrent callers share one run. */
    async wrap(key, ttlMs, fn) {
      const hit = store.get(key);
      if (hit && hit.expires > Date.now()) return hit.value;

      const pending = inflight.get(key);
      if (pending) return pending;

      const run = (async () => {
        try {
          const value = await fn();
          store.set(key, { value, expires: Date.now() + ttlMs });
          evictIfNeeded();
          return value;
        } finally {
          inflight.delete(key);
        }
      })();

      inflight.set(key, run);
      return run;
    },
    clear: () => store.clear(),
    get size() {
      return store.size;
    },
  };
}
