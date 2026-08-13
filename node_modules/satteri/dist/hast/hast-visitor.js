import { materializeHastNode } from "./hast-materializer.js";
import { HastReader, HAST_ELEMENT, HAST_TEXT, HAST_COMMENT, HAST_RAW, HAST_MDX_JSX_ELEMENT, HAST_MDX_JSX_TEXT_ELEMENT, HAST_MDX_FLOW_EXPRESSION, HAST_MDX_TEXT_EXPRESSION, HAST_MDX_ESM, } from "./hast-reader.js";
import { TYPE_NAMES, NAME_TO_TYPE, VISITOR_KEYS, HAST_OPSTREAM_TYPES, } from "./generated/node-types.js";
import { CommandBuffer } from "../command-buffer.js";
import { OpWriter, OF_VALUE, OF_TAGNAME, OF_NAME, OF_EXPLICIT, PROP_STRING, PROP_BOOL_TRUE, PROP_BOOL_FALSE, PROP_SPACE_SEP, PROP_INT, emitMdxAttr, } from "../op-stream.js";
import { restorePhantomSpaces } from "../phantom.js";
import { decodeMdxJsxAttr } from "../mdx-attr.js";
import { decodeElementProp } from "./element-props.js";
import { readPosition, rstr } from "../wire-read.js";
import { walkHandle, applyCommandsToHandle, textContentHandle, parseExpression as napiParseExpression, parseEsm as napiParseEsm, } from "#binding";
import { asArray, makeRequireNid, mergeAndReset, unencodableContentError, } from "../visitor-shared.js";
import { LazyChildResolver, markHandleMutated } from "../lazy-child-resolver.js";
import { HastChildStub } from "./child-stub.js";
/** Maps HastNode objects to their arena node IDs without Object.defineProperty overhead. */
const nodeIdMap = new WeakMap();
/** Attach `parseExpression()` to an MDX expression or ESM node. */
function attachParseExpression(node, parseFn) {
    Object.defineProperty(node, "parseExpression", {
        value() {
            const value = this.value;
            if (typeof value !== "string")
                return null;
            const json = parseFn(value);
            if (json == null)
                return null;
            return JSON.parse(json);
        },
        writable: false,
        enumerable: false,
        configurable: true,
    });
}
/**
 * Arena identity of a node, rejecting impostors — the one place the
 * spread/identity invariant is enforced. A spread copy of a matched node or
 * stub must read as NEW content: trusting a copied id would splice the
 * original in as a ref and drop the copy's edits. Walk elements carry their
 * id in a private field behind `instanceof` (spread copies fail the check);
 * other walk-built nodes are keyed in the WeakMap (invisible to spread);
 * `HastChildStub`s (enumerable `_id`, but that key is ignored on plain
 * objects) are recognized by `instanceof`. Plain objects are trusted only via
 * the WeakMap or a NON-enumerable `_nodeId` (the materializers' convention,
 * which spread cannot copy).
 */
function nid(node) {
    if (node instanceof WalkElement)
        return node._nid;
    if (node instanceof HastChildStub)
        return node._id;
    const id = nodeIdMap.get(node);
    if (id !== undefined)
        return id;
    const d = Object.getOwnPropertyDescriptor(node, "_nodeId");
    return d !== undefined && !d.enumerable ? d.value : undefined;
}
const requireNid = makeRequireNid(nid);
function hastReusedId(node) {
    if (node === null || typeof node !== "object")
        return undefined;
    const id = nid(node);
    return typeof id === "number" ? id : undefined;
}
// Reused across replacements in a pass — see the note on `mdastWriter`.
const hastWriter = new OpWriter();
/** Compile a set-children payload: a root-wrapped child list, the shape
 *  `Patch::SetChildren` splices in. Reused children become refs. */
function compileHastChildrenToOpstream(children) {
    if (!Array.isArray(children))
        return null;
    hastWriter.begin();
    try {
        hastWriter.open(NAME_TO_TYPE.root);
        for (const c of children) {
            if (!emitHastOp(hastWriter, c, false))
                return null;
        }
        hastWriter.close();
        return hastWriter.take();
    }
    finally {
        hastWriter.end();
    }
}
/** Encode `node` as the `op` structural command. HAST content is always a
 *  declarative node (no raw escape hatch), so it compiles to the op-stream or
 *  it's a hard error — the op-stream is the only structural encoding. The
 *  switch stays inline so the buffer calls are monomorphic (computed method
 *  names defeat inline caches on this warm path). */
function emitHastTree(buffer, op, id, node) {
    const ops = compileHastToOpstream(node);
    if (ops === null)
        throw unencodableContentError(node);
    switch (op) {
        case "replace":
            return buffer.replaceOpstream(id, ops);
        case "insertBefore":
            return buffer.insertBeforeOpstream(id, ops);
        case "insertAfter":
            return buffer.insertAfterOpstream(id, ops);
        case "prependChild":
            return buffer.prependChildOpstream(id, ops);
        case "appendChild":
            return buffer.appendChildOpstream(id, ops);
        case "wrapNode":
            return buffer.wrapNodeOpstream(id, ops);
    }
}
/**
 * Compile a declarative HAST replacement tree to the op-stream — the only
 * structural encoding. Reused nodes become `ref`s (transparent passthrough).
 * Returns null when the tree holds a type the replay can't reproduce
 * identically; the caller throws.
 */
function compileHastToOpstream(root) {
    hastWriter.begin();
    try {
        if (!emitHastOp(hastWriter, root, true))
            return null;
        return hastWriter.take();
    }
    finally {
        hastWriter.end();
    }
}
function emitHastOp(w, node, isRoot) {
    if (node === null || typeof node !== "object")
        return false;
    if (!isRoot) {
        const id = hastReusedId(node);
        if (id !== undefined) {
            w.ref(id);
            return true;
        }
    }
    const n = node;
    const type = HAST_OPSTREAM_TYPES[n.type];
    if (type === undefined)
        return false;
    w.open(type);
    if (type === HAST_ELEMENT) {
        w.str(OF_TAGNAME, typeof n.tagName === "string" ? n.tagName : "div");
        const props = n.properties;
        if (props !== null && typeof props === "object") {
            for (const key in props) {
                emitHastProp(w, key, props[key]);
            }
        }
    }
    else if (type === HAST_MDX_JSX_ELEMENT || type === HAST_MDX_JSX_TEXT_ELEMENT) {
        // Name falls back to tagName, matching `encode_hast_js_node_data`.
        const name = typeof n.name === "string" ? n.name : typeof n.tagName === "string" ? n.tagName : "";
        if (name !== "")
            w.str(OF_NAME, name);
        if (Array.isArray(n.attributes)) {
            for (const a of n.attributes)
                emitMdxAttr(w, a);
        }
        if (n.data?._mdxExplicitJsx === true) {
            w.bool(OF_EXPLICIT, true);
        }
    }
    else {
        w.str(OF_VALUE, typeof n.value === "string" ? n.value : "");
    }
    if (n.data != null)
        w.data(n.data);
    const children = n.children;
    if (Array.isArray(children)) {
        for (const c of children)
            if (!emitHastOp(w, c, false))
                return false;
    }
    w.close();
    return true;
}
/** Emit one element property, mirroring `encode_hast_js_node_data` exactly:
 *  bool/string/number/array → kind; null/object → skip. */
function emitHastProp(w, name, value) {
    if (value === true)
        w.prop(name, PROP_BOOL_TRUE, "");
    else if (value === false)
        w.prop(name, PROP_BOOL_FALSE, "");
    else if (typeof value === "string")
        w.prop(name, PROP_STRING, value);
    else if (typeof value === "number")
        w.prop(name, PROP_INT, String(value));
    else if (Array.isArray(value))
        w.prop(name, PROP_SPACE_SEP, value.filter((v) => typeof v === "string").join(" "));
}
class HastVisitorContextImpl {
    #commandBuffer = new CommandBuffer();
    #diagnostics = [];
    /** Track accumulated node state for multiple setProperty calls on the same node. */
    #pendingNodes = new Map();
    #handle;
    #getSource;
    #resolver;
    /** One canonical object per parent id, so visitors can dedupe by identity.
     *  Null until the first `parent()` call; most passes never make one. */
    #parentsById = null;
    fileURL;
    data;
    sourceFormat;
    constructor(handle, getSource, fileURL, resolver, data, sourceFormat) {
        this.#handle = handle;
        this.#getSource = getSource;
        this.fileURL = fileURL;
        this.#resolver = resolver;
        this.data = data;
        this.sourceFormat = sourceFormat;
    }
    get source() {
        const value = this.#getSource();
        Object.defineProperty(this, "source", { value, writable: false, enumerable: true });
        return value;
    }
    removeNode(node) {
        this.#commandBuffer.removeNode(requireNid(node, "removeNode"));
    }
    replaceNode(node, newNode) {
        const id = requireNid(node, "replaceNode");
        emitHastTree(this.#commandBuffer, "replace", id, newNode);
        // Track the replacement so a later mdxJsx setProperty can fold into it.
        this.#pendingNodes.set(id, newNode);
    }
    insertBefore(node, newNode) {
        const id = requireNid(node, "insertBefore");
        for (const n of asArray(newNode))
            emitHastTree(this.#commandBuffer, "insertBefore", id, n);
    }
    insertAfter(node, newNode) {
        const id = requireNid(node, "insertAfter");
        for (const n of asArray(newNode))
            emitHastTree(this.#commandBuffer, "insertAfter", id, n);
    }
    wrapNode(node, parentNode) {
        const id = requireNid(node, "wrapNode");
        emitHastTree(this.#commandBuffer, "wrapNode", id, parentNode);
    }
    prependChild(node, childNode) {
        const id = requireNid(node, "prependChild");
        for (const n of asArray(childNode))
            emitHastTree(this.#commandBuffer, "prependChild", id, n);
    }
    appendChild(node, childNode) {
        const id = requireNid(node, "appendChild");
        for (const n of asArray(childNode))
            emitHastTree(this.#commandBuffer, "appendChild", id, n);
    }
    insertChildAt(node, index, childNode) {
        const children = "children" in node ? node.children : [];
        if (index <= 0 || children.length === 0) {
            this.prependChild(node, childNode);
        }
        else if (index >= children.length) {
            this.appendChild(node, childNode);
        }
        else {
            this.insertBefore(children[index], childNode);
        }
    }
    removeChildAt(node, index) {
        const child = "children" in node ? node.children[index] : undefined;
        if (child)
            this.removeNode(child);
    }
    setProperty(node, key, value) {
        const id = requireNid(node, "setProperty");
        if (key === "children") {
            // children is structural: set-children keeps the node and swaps only its
            // child list (reused children keep their id).
            const ops = compileHastChildrenToOpstream(value);
            if (!ops)
                throw unencodableContentError(value);
            this.#commandBuffer.setChildrenOpstream(id, ops);
            return;
        }
        if (key === "data") {
            this.#commandBuffer.setProperty(id, key, value != null ? JSON.stringify(value) : null);
            return;
        }
        if (node.type === "element") {
            this.#commandBuffer.setProperty(id, key, value);
            return;
        }
        if (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") {
            // MDX JSX nodes carry `attributes`, not `properties`. If a replacement is
            // already queued for this node, fold the attribute into it so the change
            // survives the rebuild. This spreads the queued replacement object, not
            // the matched node, so it never forces the matched node's children to
            // materialize.
            const pending = this.#pendingNodes.get(id);
            if (pending !== undefined) {
                const updated = { ...pending };
                const attrs = [...(updated.attributes ?? [])];
                const idx = attrs.findIndex((a) => a.type === "mdxJsxAttribute" && a.name === key);
                if (idx !== -1)
                    attrs.splice(idx, 1);
                // Arrays space-join, matching the binary path's PROP_SPACE_SEP encoding
                // (hast convention for list-valued properties like className).
                const attrValue = value === true || value === null || value === undefined
                    ? null
                    : typeof value === "string"
                        ? value
                        : Array.isArray(value)
                            ? value.join(" ")
                            : String(value);
                attrs.push({ type: "mdxJsxAttribute", name: key, value: attrValue });
                updated.attributes = attrs;
                this.replaceNode(node, updated);
                return;
            }
            // Binary attribute upsert in the arena's type_data — no child
            // materialization. Rust maps the value-type to a boolean (true/null) or
            // literal (string/number/false) attribute, mirroring the fold path above.
            this.#commandBuffer.setProperty(id, key, value);
            return;
        }
        // Text-like nodes (text, comment, raw, expressions, esm): Rust handles
        // `value` directly on these types.
        this.#commandBuffer.setProperty(id, key, value);
    }
    textContent(node) {
        return textContentHandle(this.#handle, requireNid(node, "textContent"));
    }
    parent(node) {
        const parentId = this.#resolver.parentIdOf(requireNid(node, "parent"));
        if (parentId === undefined)
            return undefined;
        const byId = (this.#parentsById ??= new Map());
        let parent = byId.get(parentId);
        if (parent === undefined) {
            parent = this.#resolver.materializeOne(parentId);
            byId.set(parentId, parent);
        }
        return parent;
    }
    indexOf(node) {
        return this.#resolver.indexInParent(requireNid(node, "indexOf"));
    }
    report({ message, node, severity = "error", }) {
        this.#diagnostics.push({ message, nodeId: node ? nid(node) : undefined, severity });
    }
    getCommandBuffer() {
        return this.#commandBuffer;
    }
    getDiagnostics() {
        return this.#diagnostics;
    }
}
/** Node types that use filtered visitors (have tag/component names). */
const FILTERED_METHODS = new Set(["element", "mdxJsxFlowElement", "mdxJsxTextElement"]);
export function resolveSubscriptions(plugin) {
    const subs = [];
    for (const [methodName, nodeType] of Object.entries(METHOD_TO_TYPE)) {
        const value = plugin[methodName];
        if (value === undefined)
            continue;
        if (FILTERED_METHODS.has(methodName)) {
            const items = Array.isArray(value) ? value : [value];
            for (const fv of items) {
                subs.push({
                    nodeType,
                    tagFilter: fv.filter,
                    visitFn: fv.visit,
                });
            }
        }
        else {
            // Bare function, empty filter matches all nodes of this type
            subs.push({ nodeType, tagFilter: [], visitFn: value });
        }
    }
    return subs;
}
/** Visitor method name → node-type tag (method names are the subscribable AST names). */
const METHOD_TO_TYPE = Object.fromEntries([...VISITOR_KEYS].map((name) => [name, NAME_TO_TYPE[name]]));
function decodeProperties(view, buf, pos) {
    const propCount = view.getUint16(pos, true);
    pos += 2;
    const properties = {};
    for (let i = 0; i < propCount; i++) {
        const nameLen = view.getUint16(pos, true);
        pos += 2;
        const name = rstr(buf, pos, nameLen);
        pos += nameLen;
        const kind = buf[pos];
        pos += 1;
        const valLen = view.getUint16(pos, true);
        pos += 2;
        const valStr = rstr(buf, pos, valLen);
        pos += valLen;
        properties[name] = decodeElementProp(kind, valStr);
    }
    return properties;
}
/** Build the child-stub list for a matched node from the wire's `[child_ids]
 *  [child_types]` blocks — no arena snapshot. The seal check still applies:
 *  post-pass ids are stale, and a stub built from them could later splice the
 *  wrong node as a ref. */
function readChildStubs(view, buf, idsPos, typesPos, count, resolver) {
    resolver.assertUnsealed();
    const stubs = new Array(count);
    for (let i = 0; i < count; i++) {
        stubs[i] = new HastChildStub(resolver, view.getUint32(idsPos + i * 4, true), buf[typesPos + i]);
    }
    return stubs;
}
// Shared own-getter descriptors for WalkElement's lazy fields, populated in
// its static block so the getters can read the private wire fields.
let WALK_PROPS_DESC;
let WALK_CHILDREN_DESC;
/**
 * Walk-path element. Spread-correctness requires `properties`/`children` as
 * own enumerable keys (`{ ...node }` copies nothing else), but construction
 * runs per matched element, so everything stays off the expensive paths:
 * wire state in private fields (plain stores, invisible to spread — a WeakMap
 * entry per element caused major-GC ephemeron stalls at this volume), shared
 * getter functions instead of per-node closures, at most one define per lazy
 * field, and `instanceof` gating identity so copies read as new content.
 */
class WalkElement {
    type = "element";
    tagName;
    #nodeId;
    #view;
    #buf;
    #propsPos;
    #childIdsPos;
    #childTypesPos;
    #childCount;
    #resolver;
    constructor(tagName, nodeId, view, buf, propsPos, propCount, childIdsPos, childTypesPos, childCount, resolver) {
        this.tagName = tagName;
        this.#nodeId = nodeId;
        this.#view = view;
        this.#buf = buf;
        this.#propsPos = propsPos;
        this.#childIdsPos = childIdsPos;
        this.#childTypesPos = childTypesPos;
        this.#childCount = childCount;
        this.#resolver = resolver;
        if (propCount === 0) {
            this.properties = {};
        }
        else {
            Object.defineProperty(this, "properties", WALK_PROPS_DESC);
        }
        if (childCount === 0) {
            this.children = [];
        }
        else {
            Object.defineProperty(this, "children", WALK_CHILDREN_DESC);
        }
    }
    /** @internal */
    get _nid() {
        return this.#nodeId;
    }
    static {
        WALK_PROPS_DESC = {
            enumerable: true,
            configurable: true,
            get() {
                const val = decodeProperties(this.#view, this.#buf, this.#propsPos);
                Object.defineProperty(this, "properties", {
                    value: val,
                    writable: true,
                    enumerable: true,
                    configurable: true,
                });
                return val;
            },
        };
        WALK_CHILDREN_DESC = {
            enumerable: true,
            configurable: true,
            get() {
                const val = readChildStubs(this.#view, this.#buf, this.#childIdsPos, this.#childTypesPos, this.#childCount, this.#resolver);
                Object.defineProperty(this, "children", {
                    value: val,
                    writable: true,
                    enumerable: true,
                    configurable: true,
                });
                return val;
            },
        };
    }
}
/** Read the tail of a matched element node (tag + properties).
 *  Common prelude (data/position/children) is already consumed by `readMatchedNode`. */
function readElementFromBinary(view, buf, offset, nodeId, resolver, position, childIdsPos, childTypesPos, childCount, data) {
    let pos = offset;
    // Eager: tagName (almost always accessed by visitors)
    const tagLen = view.getUint16(pos, true);
    pos += 2;
    const tagName = rstr(buf, pos, tagLen);
    pos += tagLen;
    const propCount = view.getUint16(pos, true);
    const node = new WalkElement(tagName, nodeId, view, buf, pos, propCount, childIdsPos, childTypesPos, childCount, resolver);
    if (position !== undefined)
        node.position = position;
    if (data !== null)
        node.data = data;
    return node;
}
/** Value-carrying types read by `readTextFromBinary` (tag → AST name). */
const TEXT_NODE_TYPES = Object.fromEntries(["text", "comment", "raw", "mdxFlowExpression", "mdxTextExpression", "mdxjsEsm"].map((name) => [NAME_TO_TYPE[name], name]));
function readTextFromBinary(view, buf, offset, nodeId, nodeType, position, data) {
    const valLen = view.getUint32(offset, true);
    const rawValue = rstr(buf, offset + 4, valLen);
    // MDX flow/text expressions store phantom-space sentinels; restore them so
    // the value matches the reader path. ESM and plain text keep their value.
    const value = nodeType === HAST_MDX_FLOW_EXPRESSION || nodeType === HAST_MDX_TEXT_EXPRESSION
        ? restorePhantomSpaces(rawValue)
        : rawValue;
    const base = { type: TEXT_NODE_TYPES[nodeType], value };
    if (position !== undefined)
        base.position = position;
    if (data !== null)
        base.data = data;
    const node = base;
    nodeIdMap.set(node, nodeId);
    if (nodeType === HAST_MDX_FLOW_EXPRESSION || nodeType === HAST_MDX_TEXT_EXPRESSION) {
        attachParseExpression(node, napiParseExpression);
    }
    else if (nodeType === HAST_MDX_ESM) {
        attachParseExpression(node, napiParseEsm);
    }
    return node;
}
function readMdxJsxFromBinary(view, buf, offset, nodeId, nodeType, resolver, position, childIdsPos, childTypesPos, childCount, data) {
    let pos = offset;
    const nameLen = view.getUint16(pos, true);
    pos += 2;
    const name = nameLen > 0 ? rstr(buf, pos, nameLen) : null;
    pos += nameLen;
    // Attributes: [kind: u8][nameLen: u16][name][valLen: u32][val]
    const attrCount = view.getUint16(pos, true);
    pos += 2;
    const attributes = [];
    for (let i = 0; i < attrCount; i++) {
        const kind = buf[pos];
        pos += 1;
        const attrNameLen = view.getUint16(pos, true);
        pos += 2;
        const attrName = rstr(buf, pos, attrNameLen);
        pos += attrNameLen;
        const attrValLen = view.getUint32(pos, true);
        pos += 4;
        const attrVal = rstr(buf, pos, attrValLen);
        pos += attrValLen;
        attributes.push(decodeMdxJsxAttr(kind, attrName, attrVal));
    }
    const typeName = nodeType === HAST_MDX_JSX_ELEMENT ? "mdxJsxFlowElement" : "mdxJsxTextElement";
    const base = { type: typeName, name, attributes };
    if (position !== undefined)
        base.position = position;
    if (data !== null)
        base.data = data;
    nodeIdMap.set(base, nodeId);
    makeLazyChildren(base, view, buf, childIdsPos, childTypesPos, childCount, resolver);
    return base;
}
function readMatchedNode(view, buf, offset, nodeId, nodeType, resolver) {
    let pos = offset;
    // Shared prelude (matches serialize_hast_node_inline / serialize_mdast_node_inline):
    //   [data_len: u32][data_bytes][position: 24B][child_count: u32][child_ids: N×u32][child_types: N×u8]
    const dataLen = view.getUint32(pos, true);
    pos += 4;
    let data = null;
    if (dataLen > 0) {
        const jsonStr = rstr(buf, pos, dataLen);
        try {
            data = JSON.parse(jsonStr);
        }
        catch (err) {
            if (process.env.NODE_ENV !== "production") {
                console.warn(`readMatchedNode: malformed node_data for nodeId=${nodeId}`, err);
            }
        }
        pos += dataLen;
    }
    const position = readPosition(view, pos);
    pos += 24;
    const childCount = view.getUint32(pos, true);
    pos += 4;
    // Ids/types decode lazily with `.children` — most matched nodes never read them.
    const childIdsPos = pos;
    pos += childCount * 4;
    const childTypesPos = pos;
    pos += childCount;
    // Dispatch to type-specific tail (pos now sits at the type-specific section)
    if (nodeType === HAST_ELEMENT) {
        return readElementFromBinary(view, buf, pos, nodeId, resolver, position, childIdsPos, childTypesPos, childCount, data);
    }
    else if (nodeType === HAST_TEXT ||
        nodeType === HAST_COMMENT ||
        nodeType === HAST_RAW ||
        nodeType === HAST_MDX_FLOW_EXPRESSION ||
        nodeType === HAST_MDX_TEXT_EXPRESSION ||
        nodeType === HAST_MDX_ESM) {
        return readTextFromBinary(view, buf, pos, nodeId, nodeType, position, data);
    }
    else if (nodeType === HAST_MDX_JSX_ELEMENT || nodeType === HAST_MDX_JSX_TEXT_ELEMENT) {
        return readMdxJsxFromBinary(view, buf, pos, nodeId, nodeType, resolver, position, childIdsPos, childTypesPos, childCount, data);
    }
    // Fallback (e.g. doctype): minimal node carrying whatever prelude data we found
    const base = { type: TYPE_NAMES[nodeType] ?? `unknown(${nodeType})` };
    if (position !== undefined)
        base.position = position;
    if (data !== null)
        base.data = data;
    const node = base;
    nodeIdMap.set(node, nodeId);
    return node;
}
class HastLazyChildResolver extends LazyChildResolver {
    createReader(wire) {
        return new HastReader(wire);
    }
    materializeNode(reader, nodeId) {
        return materializeHastNode(reader, nodeId);
    }
    readParentId(reader, nodeId) {
        return reader.getParentId(nodeId);
    }
    readChildIds(reader, nodeId) {
        return reader.getChildIds(nodeId);
    }
}
/** Install `children` as an own enumerable getter (spread must carry it),
 *  self-replacing with the one stable stub array on first read. One closure
 *  and one define per node — installing the wire locals as hidden slots
 *  instead measurably regressed every matching pipeline. */
function makeLazyChildren(node, view, buf, childIdsPos, childTypesPos, childCount, resolver) {
    Object.defineProperty(node, "children", {
        get() {
            const val = readChildStubs(view, buf, childIdsPos, childTypesPos, childCount, resolver);
            Object.defineProperty(this, "children", {
                value: val,
                writable: true,
                enumerable: true,
                configurable: true,
            });
            return val;
        },
        enumerable: true,
        configurable: true,
    });
}
/** A result that is the same object as the input node is a no-op, so context
 *  mutations (e.g. setProperty) are not clobbered. */
function handleVisitResult(result, nodeId, returnBuffer, deferred, originalNode) {
    if (result == null)
        return deferred;
    if (result === originalNode)
        return deferred;
    if (result instanceof Promise) {
        const list = deferred ?? [];
        list.push({ nodeId, promise: result, originalNode });
        return list;
    }
    emitHastTree(returnBuffer, "replace", nodeId, result);
    return deferred;
}
/**
 * Dispatch matched nodes from a binary match buffer to visitor functions.
 * Returns null if all sync, or an array of deferred promises if any visitor was async.
 */
function dispatchMatches(matchBuf, subs, ctx, returnBuffer, resolver) {
    const matchView = new DataView(matchBuf.buffer, matchBuf.byteOffset, matchBuf.byteLength);
    const matchCount = matchView.getUint32(0, true);
    let deferred = null;
    for (let i = 0; i < matchCount; i++) {
        const indexBase = 4 + i * 10;
        const nodeId = matchView.getUint32(indexBase, true);
        const subIndex = matchBuf[indexBase + 4];
        const dataOffset = matchView.getUint32(indexBase + 6, true);
        const sub = subs[subIndex];
        const node = readMatchedNode(matchView, matchBuf, dataOffset, nodeId, sub.nodeType, resolver);
        const result = sub.visitFn(node, ctx);
        deferred = handleVisitResult(result, nodeId, returnBuffer, deferred, node);
    }
    return deferred;
}
/**
 * Walk a handle's arena in Rust, dispatch matched nodes to JS visitor functions,
 * and apply mutations back to the handle. No arena buffers cross NAPI.
 *
 * Returns the number of patches dropped because their target was removed or
 * replaced earlier in the same pass (the caller warns when non-zero), or a
 * Promise of that count if any visitor is async.
 */
export function visitHastHandle(handle, plugin, subs, source, fileURL, data = {}, sourceFormat = "markdown") {
    const getSource = typeof source === "function" ? source : () => source;
    const resolver = new HastLazyChildResolver(handle);
    const ctx = new HastVisitorContextImpl(handle, getSource, fileURL, resolver, data, sourceFormat);
    const returnBuffer = new CommandBuffer();
    const rustSubs = subs.map((s) => ({ nodeType: s.nodeType, tagFilter: s.tagFilter }));
    const deferred = dispatchMatches(walkHandle(handle, rustSubs), subs, ctx, returnBuffer, resolver);
    if (deferred) {
        return Promise.all(deferred.map((d) => d.promise.then((result) => ({ nodeId: d.nodeId, result, originalNode: d.originalNode })))).then((results) => {
            for (const { nodeId, result, originalNode } of results) {
                if (result != null && result !== originalNode) {
                    emitHastTree(returnBuffer, "replace", nodeId, result);
                }
            }
            // Mutations land next, renumbering the arena: snapshots taken after
            // this point would resolve match-time child ids against wrong nodes.
            resolver.seal();
            return applyMutations(handle, returnBuffer, ctx);
        });
    }
    resolver.seal();
    return applyMutations(handle, returnBuffer, ctx);
}
/** Returns the number of patches dropped as stranded (0 when none). */
function applyMutations(handle, returnBuffer, ctx) {
    const { merged, hasMutations } = mergeAndReset(returnBuffer, ctx);
    if (hasMutations) {
        markHandleMutated(handle);
        return applyCommandsToHandle(handle, merged);
    }
    return 0;
}
