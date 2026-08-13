/**
 * Build a lazy getter descriptor that caches the value on first access.
 */
export function lazyProp(key, get) {
    return {
        get() {
            const value = get();
            Object.defineProperty(this, key, {
                value,
                writable: true,
                configurable: true,
                enumerable: true,
            });
            return value;
        },
        configurable: true,
        enumerable: true,
    };
}
/**
 * First access to any field in the group resolves all fields from one reader call.
 * Uses a shared resolve-once pattern: the first getter to fire reads all data,
 * defines own properties for every key, then each per-key getter returns its value.
 */
export function lazyGroup(node, keys, resolve) {
    let cached;
    const ensureResolved = () => {
        if (cached)
            return cached;
        cached = resolve();
        for (const k of keys) {
            Object.defineProperty(node, k, {
                value: cached[k],
                writable: true,
                configurable: true,
                enumerable: true,
            });
        }
        return cached;
    };
    for (const key of keys) {
        Object.defineProperty(node, key, {
            get() {
                return ensureResolved()[key];
            },
            configurable: true,
            enumerable: true,
        });
    }
}
