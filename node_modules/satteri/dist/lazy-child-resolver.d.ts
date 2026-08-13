import type { AnyHandle } from "./handles.js";
/** Record that `handle`'s arena was rebuilt. Resolvers created before the bump
 *  refuse to take a fresh snapshot afterwards (their ids are stale). */
export declare function markHandleMutated(handle: AnyHandle): void;
/**
 * Lazy node materializer for the walk paths: serializes the handle's arena
 * once, on the first stub materialization, then materializes nodes from that
 * snapshot. Subclasses supply reader construction and per-node materialization
 * so the hot path stays free of per-node closures.
 */
export declare abstract class LazyChildResolver<TReader, TNode> {
    #private;
    constructor(handle: AnyHandle);
    protected abstract createReader(wire: Uint8Array): TReader;
    protected abstract materializeNode(reader: TReader, nodeId: number): TNode;
    protected abstract readParentId(reader: TReader, nodeId: number): number;
    protected abstract readChildIds(reader: TReader, nodeId: number): number[];
    /**
     * Mark the visitor pass over. Child ids were captured at match time; once
     * the pass's mutations land the arena is rebuilt and ids renumbered, so a
     * later snapshot would map those stale ids onto the wrong nodes (or out of
     * range). Failing loudly here beats silently wrong children.
     */
    seal(): void;
    /** Guards the `.children` getters: a first read after the pass is refused
     *  outright, even when no mutation landed — match-time ids cannot be trusted
     *  once the plugin no longer controls the tree. */
    assertUnsealed(): void;
    /** Materialize one node for a child stub's first real-field read. */
    materializeOne(nodeId: number): TNode;
    /** Arena id of `nodeId`'s parent in the pass snapshot, or undefined at the root. */
    parentIdOf(nodeId: number): number | undefined;
    /** Index of `nodeId` within its parent's children in the pass snapshot,
     *  or undefined at the root. */
    indexInParent(nodeId: number): number | undefined;
}
