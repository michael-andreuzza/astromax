/**
 * Build a lazy getter descriptor that caches the value on first access.
 */
export declare function lazyProp<T>(key: string, get: () => T): PropertyDescriptor;
/**
 * First access to any field in the group resolves all fields from one reader call.
 * Uses a shared resolve-once pattern: the first getter to fire reads all data,
 * defines own properties for every key, then each per-key getter returns its value.
 */
export declare function lazyGroup(node: object, keys: readonly string[], resolve: () => Record<string, unknown>): void;
