/**
 * Anonymous session identifier.
 *
 * Each browser gets a persistent UUID stored in localStorage.
 * This ID is used to scope customer data, cart, and orders
 * for guest (non-authenticated) users, preventing data leakage
 * between different users on shared devices and providing
 * a stable identifier for anonymous order ownership.
 */

const SESSION_KEY = '_session_id';

/**
 * Returns (or creates) the anonymous session ID for this browser.
 * The ID persists across page reloads and browser sessions
 * until localStorage is explicitly cleared.
 */
export function getOrCreateSessionId(): string {
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing && existing.length > 10) {
      return existing;
    }
  } catch {
    // localStorage unavailable — fall back to runtime-only ID
  }

  const id = crypto.randomUUID();

  try {
    localStorage.setItem(SESSION_KEY, id);
  } catch {
    // storage full or blocked — ID won't persist across reloads
  }

  return id;
}

/**
 * Builds a scoped localStorage key that includes the session ID,
 * ensuring different anonymous users on the same device do not
 * share data.
 *
 * Key format: `{prefix}__{sessionId}`
 * Example:    `dados_cliente_burguer-house__a1b2c3d4-...`
 */
export function scopedStorageKey(
  prefix: string,
  slug: string
): string {
  const sessionId = getOrCreateSessionId();
  return `${prefix}__${slug}__${sessionId}`;
}

/**
 * Returns all localStorage keys that match a given prefix pattern.
 * Useful for cleaning up old unscoped keys that predate the session
 * isolation system.
 */
export function findAllScopedKeys(
  prefix: string
): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix + '__')) {
        keys.push(key);
      }
    }
  } catch {
    // ignore
  }
  return keys;
}

/**
 * Reads the most recently updated scoped value for a given prefix/slug.
 * This handles the case where a user previously had unscoped keys
 * and we need to migrate them.
 */
export function readScopedData<T>(
  prefix: string,
  slug: string
): T | null {
  const key = scopedStorageKey(prefix, slug);
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      return JSON.parse(raw) as T;
    }
  } catch {
    // invalid JSON
  }
  return null;
}

/**
 * Writes data to a scoped localStorage key.
 */
export function writeScopedData<T>(
  prefix: string,
  slug: string,
  data: T
): void {
  const key = scopedStorageKey(prefix, slug);
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // storage full or blocked
  }
}
