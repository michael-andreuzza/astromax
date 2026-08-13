/**
 * Cold/shape-stable helpers shared by the mdast and hast visitors. The
 * per-node hot decoders stay duplicated in each visitor on purpose: sharing
 * them would feed differently-shaped arguments through one call site and turn
 * it polymorphic.
 */
import type { CommandBuffer } from "./command-buffer.js";
export declare function asArray<T>(value: T | T[]): T[];
/** Thrown when declarative replacement content can't be compiled to the
 *  structural op-stream — an unsupported node type (e.g. a bare `root`/`doctype`
 *  handed in as content) or an out-of-range numeric field. The op-stream is the
 *  only structural encoding, so this is a hard error rather than a fallback. */
export declare function unencodableContentError(content: unknown): Error;
/**
 * Arena id for a node passed to a context method, via a per-kind `nid` lookup
 * (closure keeps each kind's call site monomorphic). Plugin-built nodes have
 * no id; without this check the id would coerce to 0 in the command buffer
 * and the mutation would silently target the document root.
 */
export declare function makeRequireNid<TNode>(nid: (node: TNode) => number | undefined): (node: TNode, method: string) => number;
/** Concatenate the return-value and context command buffers for one pass,
 *  resetting both for reuse. */
export declare function mergeAndReset(returnBuffer: CommandBuffer, ctx: {
    getCommandBuffer(): CommandBuffer;
}): {
    merged: Uint8Array;
    hasMutations: boolean;
};
