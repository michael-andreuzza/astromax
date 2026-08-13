/**
 * Binary command buffer for efficient JS→Rust mutation serialization.
 *
 * Simple mutations (remove, setProperty) are encoded as compact binary commands.
 * Structural mutations (insert, replace, …) carry one of two payload kinds:
 * compiled op-streams (`PAYLOAD_OPSTREAM`, replayed straight into the arena —
 * see op-stream.ts) for declarative content, or raw markdown/HTML strings
 * (re-parsed by Rust) for the `{raw}`/`{rawHtml}` escape hatches.
 *
 * All multi-byte integers are little-endian to match native x86/ARM layout and
 * avoid byte-swapping on the Rust side.
 */
import { ByteWriter } from "./byte-writer.js";
import type { MdastNode } from "./types.js";
type ReturnClass = "no_change" | "raw_markdown" | "raw_html" | "structured_node";
export declare function classifyReturn(value: unknown): ReturnClass;
/** Structural commands that carry a subtree payload. Each has an `${op}Opstream`
 *  twin (declarative content) and a raw twin (`{raw}`/`{rawHtml}` escape hatch). */
export type StructuralOp = "replace" | "insertBefore" | "insertAfter" | "prependChild" | "appendChild" | "wrapNode";
export declare class CommandBuffer extends ByteWriter {
    constructor();
    removeNode(nodeId: number): void;
    /** Unified set-property for both MDAST and HAST nodes. */
    setProperty(nodeId: number, key: string, value: unknown): void;
    insertBefore(nodeId: number, newNode: MdastNode | {
        raw: string;
    } | {
        rawHtml: string;
    }): void;
    insertAfter(nodeId: number, newNode: MdastNode | {
        raw: string;
    } | {
        rawHtml: string;
    }): void;
    prependChild(nodeId: number, newNode: MdastNode | {
        raw: string;
    } | {
        rawHtml: string;
    }): void;
    appendChild(nodeId: number, newNode: MdastNode | {
        raw: string;
    } | {
        rawHtml: string;
    }): void;
    wrapNode(nodeId: number, parentNode: MdastNode | {
        raw: string;
    } | {
        rawHtml: string;
    }): void;
    replace(nodeId: number, newNode: MdastNode | {
        raw: string;
    } | {
        rawHtml: string;
    }): void;
    /** Header (cmd + nodeId + payloadType) followed by a length-prefixed string payload. */
    private writePayloadCommand;
    replaceOpstream(nodeId: number, ops: Uint8Array): void;
    /** Replace a node's child list (root-wrapped `ops`) while keeping the node. */
    setChildrenOpstream(nodeId: number, ops: Uint8Array): void;
    insertBeforeOpstream(nodeId: number, ops: Uint8Array): void;
    insertAfterOpstream(nodeId: number, ops: Uint8Array): void;
    prependChildOpstream(nodeId: number, ops: Uint8Array): void;
    appendChildOpstream(nodeId: number, ops: Uint8Array): void;
    wrapNodeOpstream(nodeId: number, ops: Uint8Array): void;
    private writeOpstreamCommand;
    /** Return a Uint8Array view of the written bytes (no copy). */
    getBuffer(): Uint8Array;
    /** Reset for reuse, releasing the old buffer (handed-out views stay intact). */
    reset(): void;
    /** Raw structural content (`{raw}`/`{rawHtml}` escape hatches). Declarative
     *  nodes go through the `*Opstream` methods, not here. */
    private writeStructuralCommand;
}
export {};
