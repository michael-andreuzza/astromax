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
import { PROP_STRING, PROP_BOOL_TRUE, PROP_BOOL_FALSE, PROP_SPACE_SEP, PROP_INT, PROP_NULL, } from "./op-stream.js";
import { CMD_REMOVE, CMD_INSERT_BEFORE, CMD_INSERT_AFTER, CMD_PREPEND_CHILD, CMD_APPEND_CHILD, CMD_WRAP, CMD_REPLACE, CMD_SET_PROPERTY, CMD_SET_CHILDREN, PAYLOAD_RAW_MARKDOWN, PAYLOAD_RAW_HTML, PAYLOAD_OPSTREAM, } from "./generated/wire-constants.js";
export function classifyReturn(value) {
    if (value === undefined || value === null)
        return "no_change";
    const v = value;
    if (typeof v.raw === "string")
        return "raw_markdown";
    if (typeof v.rawHtml === "string")
        return "raw_html";
    if (typeof v.type === "string")
        return "structured_node";
    throw new Error("Invalid return value from visitor: must have raw, rawHtml, or type");
}
const INITIAL_SIZE = 4096;
export class CommandBuffer extends ByteWriter {
    constructor() {
        super(INITIAL_SIZE);
    }
    removeNode(nodeId) {
        this.ensure(5);
        this.buf[this.n++] = CMD_REMOVE;
        this.writeU32(nodeId);
    }
    /** Unified set-property for both MDAST and HAST nodes. */
    setProperty(nodeId, key, value) {
        let valueType;
        let str;
        if (value === null || value === undefined) {
            valueType = PROP_NULL;
            str = "";
        }
        else if (value === true) {
            valueType = PROP_BOOL_TRUE;
            str = "";
        }
        else if (value === false) {
            valueType = PROP_BOOL_FALSE;
            str = "";
        }
        else if (typeof value === "number") {
            valueType = PROP_INT;
            str = String(value);
        }
        else if (Array.isArray(value)) {
            valueType = PROP_SPACE_SEP;
            str = value.join(" ");
        }
        else {
            valueType = PROP_STRING;
            str = String(value);
        }
        // 1(cmd) + 4(nodeId) + 1(valueType); name and value are length-prefixed strings
        this.ensure(6);
        this.buf[this.n++] = CMD_SET_PROPERTY;
        this.writeU32(nodeId);
        this.buf[this.n++] = valueType;
        this.utf8WithU32Len(key);
        this.utf8WithU32Len(str);
    }
    insertBefore(nodeId, newNode) {
        this.writeStructuralCommand(CMD_INSERT_BEFORE, nodeId, newNode);
    }
    insertAfter(nodeId, newNode) {
        this.writeStructuralCommand(CMD_INSERT_AFTER, nodeId, newNode);
    }
    prependChild(nodeId, newNode) {
        this.writeStructuralCommand(CMD_PREPEND_CHILD, nodeId, newNode);
    }
    appendChild(nodeId, newNode) {
        this.writeStructuralCommand(CMD_APPEND_CHILD, nodeId, newNode);
    }
    wrapNode(nodeId, parentNode) {
        this.writeStructuralCommand(CMD_WRAP, nodeId, parentNode);
    }
    replace(nodeId, newNode) {
        this.writeStructuralCommand(CMD_REPLACE, nodeId, newNode);
    }
    /** Header (cmd + nodeId + payloadType) followed by a length-prefixed string payload. */
    writePayloadCommand(cmd, nodeId, payloadType, s) {
        this.ensure(6);
        this.buf[this.n++] = cmd;
        this.writeU32(nodeId);
        this.buf[this.n++] = payloadType;
        this.utf8WithU32Len(s);
    }
    replaceOpstream(nodeId, ops) {
        this.writeOpstreamCommand(CMD_REPLACE, nodeId, ops);
    }
    /** Replace a node's child list (root-wrapped `ops`) while keeping the node. */
    setChildrenOpstream(nodeId, ops) {
        this.writeOpstreamCommand(CMD_SET_CHILDREN, nodeId, ops);
    }
    insertBeforeOpstream(nodeId, ops) {
        this.writeOpstreamCommand(CMD_INSERT_BEFORE, nodeId, ops);
    }
    insertAfterOpstream(nodeId, ops) {
        this.writeOpstreamCommand(CMD_INSERT_AFTER, nodeId, ops);
    }
    prependChildOpstream(nodeId, ops) {
        this.writeOpstreamCommand(CMD_PREPEND_CHILD, nodeId, ops);
    }
    appendChildOpstream(nodeId, ops) {
        this.writeOpstreamCommand(CMD_APPEND_CHILD, nodeId, ops);
    }
    wrapNodeOpstream(nodeId, ops) {
        this.writeOpstreamCommand(CMD_WRAP, nodeId, ops);
    }
    writeOpstreamCommand(cmd, nodeId, ops) {
        this.ensure(10 + ops.length);
        this.buf[this.n++] = cmd;
        this.writeU32(nodeId);
        this.buf[this.n++] = PAYLOAD_OPSTREAM;
        this.writeU32(ops.length);
        this.buf.set(ops, this.n);
        this.n += ops.length;
    }
    /** Return a Uint8Array view of the written bytes (no copy). */
    getBuffer() {
        return this.take();
    }
    /** Reset for reuse, releasing the old buffer (handed-out views stay intact). */
    reset() {
        if (this.n === 0)
            return;
        this.release();
    }
    /** Raw structural content (`{raw}`/`{rawHtml}` escape hatches). Declarative
     *  nodes go through the `*Opstream` methods, not here. */
    writeStructuralCommand(cmd, nodeId, node) {
        const v = node;
        if (typeof v.raw === "string") {
            this.writePayloadCommand(cmd, nodeId, PAYLOAD_RAW_MARKDOWN, v.raw);
        }
        else if (typeof v.rawHtml === "string") {
            this.writePayloadCommand(cmd, nodeId, PAYLOAD_RAW_HTML, v.rawHtml);
        }
        else {
            throw new Error("CommandBuffer: structural content must be {raw} or {rawHtml}");
        }
    }
}
