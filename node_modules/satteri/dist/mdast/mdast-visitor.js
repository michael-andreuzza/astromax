import { materializeNode } from "./mdast-materializer.js";
import { MdastReader } from "./mdast-reader.js";
import { CommandBuffer, classifyReturn } from "../command-buffer.js";
import { ru32, rstr, readPosition } from "../wire-read.js";
import { decodeMdastTypeData } from "./generated/layout.js";
import { TYPE_NAMES, NAME_TO_TYPE, VISITOR_KEYS, MDAST_OPSTREAM_TYPES, } from "./generated/node-types.js";
import { OpWriter, OF_VALUE, OF_URL, OF_TITLE, OF_ALT, OF_LANG, OF_META, OF_IDENTIFIER, OF_LABEL, OF_NAME, OF_REFERENCE_TYPE, OF_DEPTH, OF_CHECKED, OF_START, OF_ORDERED, OF_SPREAD, OF_EXPLICIT, PROP_STRING, emitMdxAttr, } from "../op-stream.js";
import { walkMdastHandle, mdastTextContentHandle } from "#binding";
import { asArray, makeRequireNid, mergeAndReset, unencodableContentError, } from "../visitor-shared.js";
import { LazyChildResolver } from "../lazy-child-resolver.js";
import { MdastChildStub } from "./child-stub.js";
/** Maps MdastNode objects to their arena node IDs without Object.defineProperty overhead. */
const mdastNodeIdMap = new WeakMap();
function nid(node) {
    // Genuine stubs carry their id as a plain field; a spread copy is not
    // `instanceof` and has no `_nodeId`, so it correctly reads as new content.
    if (node instanceof MdastChildStub)
        return node._id;
    const id = mdastNodeIdMap.get(node);
    if (id !== undefined)
        return id;
    // Plain objects are trusted only via the WeakMap or a NON-enumerable
    // `_nodeId` (the materializer's convention, which spread cannot copy) — an
    // enumerable one rode in on a copy and must read as new content.
    const d = Object.getOwnPropertyDescriptor(node, "_nodeId");
    return d !== undefined && !d.enumerable ? d.value : undefined;
}
const requireNid = makeRequireNid(nid);
export class MdastVisitorContext {
    #commandBuffer = new CommandBuffer();
    #diagnostics = [];
    #handle;
    #getSource;
    #resolver;
    /** One canonical object per parent id, so visitors can dedupe by identity.
     *  Null until the first `parent()` call; most passes never make one. */
    #parentsById = null;
    /**
     * The URL of the document being processed (the compile `fileURL` option),
     * or `undefined` when none was given. Use `fileURLToPath(ctx.fileURL)` for a
     * decoded filesystem path.
     */
    fileURL;
    /**
     * Document-level data bag, shared across every plugin in the compile and
     * across the mdast→hast phase boundary. Mutate keys directly
     * (`ctx.data.foo = x`); the bag itself isn't reassignable. Values are kept
     * on the JS side, so any value is allowed, including functions and class
     * instances. Returned to the caller as `result.data`.
     */
    data;
    /**
     * The source format this compile is processing: `"markdown"` for a plain
     * Markdown compile, `"mdx"` for an MDX one. Lets a plugin shared between both
     * pipelines branch on which it is handling.
     */
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
    insertBefore(node, newNode) {
        const id = requireNid(node, "insertBefore");
        for (const n of asArray(newNode))
            emitMdastTree(this.#commandBuffer, "insertBefore", id, n);
    }
    insertAfter(node, newNode) {
        const id = requireNid(node, "insertAfter");
        for (const n of asArray(newNode))
            emitMdastTree(this.#commandBuffer, "insertAfter", id, n);
    }
    /**
     * Wrap `node` in `parentNode`, making it `parentNode`'s first child. Any
     * children `parentNode` declares are kept after it.
     */
    wrapNode(node, parentNode) {
        const id = requireNid(node, "wrapNode");
        emitMdastTree(this.#commandBuffer, "wrapNode", id, parentNode);
    }
    prependChild(node, childNode) {
        const id = requireNid(node, "prependChild");
        for (const n of asArray(childNode))
            emitMdastTree(this.#commandBuffer, "prependChild", id, n);
    }
    appendChild(node, childNode) {
        const id = requireNid(node, "appendChild");
        for (const n of asArray(childNode))
            emitMdastTree(this.#commandBuffer, "appendChild", id, n);
    }
    /** Insert one node or an array at `index`; clamps (`0` or less prepends, past the end appends). */
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
    /** Remove the `index`-th child of `node`; a no-op when there is no such child. */
    removeChildAt(node, index) {
        const child = "children" in node ? node.children[index] : undefined;
        if (child)
            this.removeNode(child);
    }
    replaceNode(node, newNode) {
        const id = requireNid(node, "replaceNode");
        emitMdastTree(this.#commandBuffer, "replace", id, newNode, true);
    }
    setProperty(node, key, value) {
        if (key === "children") {
            // children is structural: set-children keeps the node and swaps only its
            // child list (reused children keep their id).
            const id = requireNid(node, "setProperty");
            const ops = compileMdastChildrenToOpstream(value);
            if (!ops)
                throw unencodableContentError(value);
            this.#commandBuffer.setChildrenOpstream(id, ops);
            return;
        }
        if (key === "data") {
            // data is stored as JSON in the arena, serialize it for the command buffer
            this.#commandBuffer.setProperty(requireNid(node, "setProperty"), key, value != null ? JSON.stringify(value) : null);
            return;
        }
        this.#commandBuffer.setProperty(requireNid(node, "setProperty"), key, value);
    }
    /** Collect the concatenated text of all descendant text nodes (like mdast-util-to-string). */
    textContent(node, options) {
        return mdastTextContentHandle(this.#handle, requireNid(node, "textContent"), options);
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
    /**
     * Index of `node` within its parent's children, or `undefined` at the root.
     * Use this rather than `parent.children.indexOf(node)`, which won't find it.
     */
    indexOf(node) {
        return this.#resolver.indexInParent(requireNid(node, "indexOf"));
    }
    report({ message, node, severity = "error", }) {
        this.#diagnostics.push({
            message,
            nodeId: node ? nid(node) : undefined,
            position: node?.position,
            severity,
        });
    }
    /** Get the binary command buffer for all mutations recorded via context methods. */
    getCommandBuffer() {
        return this.#commandBuffer;
    }
    getDiagnostics() {
        return this.#diagnostics;
    }
}
export function resolveMdastSubscriptions(plugin) {
    const subs = [];
    for (const [name, fn] of Object.entries(plugin)) {
        if (VISITOR_KEYS.has(name) && typeof fn === "function") {
            const nodeType = NAME_TO_TYPE[name];
            if (nodeType !== undefined) {
                subs.push({
                    nodeType,
                    visitFn: fn,
                });
            }
        }
    }
    return subs;
}
class MdastLazyChildResolver extends LazyChildResolver {
    createReader(wire) {
        return new MdastReader(wire);
    }
    materializeNode(reader, nodeId) {
        return materializeNode(reader, nodeId);
    }
    readParentId(reader, nodeId) {
        return reader.getParentId(nodeId);
    }
    readChildIds(reader, nodeId) {
        return reader.getChildIds(nodeId);
    }
}
/** Build the child-stub list for a matched node from the wire's `[child_ids]
 *  [child_types]` blocks — no arena snapshot. The seal check still applies:
 *  post-pass ids are stale, and a stub built from them could later splice the
 *  wrong node as a ref. */
function readMdastChildStubs(view, buf, idsPos, typesPos, count, resolver) {
    resolver.assertUnsealed();
    const stubs = new Array(count);
    for (let i = 0; i < count; i++) {
        stubs[i] = new MdastChildStub(resolver, ru32(view, idsPos + i * 4), buf[typesPos + i]);
    }
    return stubs;
}
/** Install `children` as an own enumerable getter (spread must carry it),
 *  self-replacing with the one stable stub array on first read. One closure
 *  and one define per node — installing the wire locals as hidden slots
 *  instead measurably regressed every matching pipeline. */
function makeLazyChildren(node, view, buf, childIdsPos, childTypesPos, childCount, resolver) {
    Object.defineProperty(node, "children", {
        get() {
            const val = readMdastChildStubs(view, buf, childIdsPos, childTypesPos, childCount, resolver);
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
/**
 * Read an MDAST node from the inline data in a match buffer entry.
 *
 * Inline format (from Rust serialize_mdast_node_inline):
 *   [node_data: u32+bytes][position: 6×u32 = 24B][child_count: u32][child_ids: N×u32]
 *   [child_types: N×u8][type-specific data]
 */
function readMdastMatchedNode(view, buf, dataOffset, nodeId, nodeType, resolver) {
    let pos = dataOffset;
    const dataJsonLen = ru32(view, pos);
    pos += 4;
    let initialData = null;
    if (dataJsonLen > 0) {
        const jsonStr = rstr(buf, pos, dataJsonLen);
        try {
            initialData = JSON.parse(jsonStr);
        }
        catch (err) {
            if (process.env.NODE_ENV !== "production") {
                console.warn(`readMdastMatchedNode: malformed node_data for nodeId=${nodeId}`, err);
            }
        }
        pos += dataJsonLen;
    }
    const position = readPosition(view, pos);
    pos += 24;
    const childCount = ru32(view, pos);
    pos += 4;
    // Ids/types decode lazily with `.children` — most matched nodes never read them.
    const childIdsPos = pos;
    pos += childCount * 4;
    const childTypesPos = pos;
    pos += childCount;
    const typeName = TYPE_NAMES[nodeType] ?? `unknown(${nodeType})`;
    const node = { type: typeName };
    if (position !== undefined)
        node.position = position;
    if (childCount > 0) {
        makeLazyChildren(node, view, buf, childIdsPos, childTypesPos, childCount, resolver);
    }
    // Fixed-field types decode from the generated layout table; the rest
    // (variable-length / cross-field) stay in the hand-written switch.
    if (!decodeMdastTypeData(view, buf, pos, nodeType, node)) {
        switch (nodeType) {
            case 5: {
                // list
                node.start = ru32(view, pos);
                node.ordered = buf[pos + 4] !== 0;
                node.spread = buf[pos + 5] !== 0;
                if (!node.ordered)
                    node.start = null;
                break;
            }
            case 6: {
                // listItem
                const checked = buf[pos];
                node.checked = checked === 2 ? null : checked === 1;
                node.spread = buf[pos + 1] !== 0;
                break;
            }
            // table (21), directives (30/31/32) and mdxJsx elements (100/101) are
            // decoded by the generated `decodeMdastTypeData` from their tails.
            // root(0), paragraph(1), thematicBreak(3), blockquote(4), emphasis(11),
            // strong(12), break(14), tableRow(22), tableCell(23), delete(24): no extra data
        }
    }
    mdastNodeIdMap.set(node, nodeId);
    if (initialData) {
        node.data = initialData;
    }
    return node;
}
/** The arena id of a node if it is an existing (materialized) node, else
 *  undefined for a freshly-built one. */
function reusedId(node) {
    if (node === null || typeof node !== "object")
        return undefined;
    const id = nid(node);
    return typeof id === "number" ? id : undefined;
}
// Reused across every replacement in a pass: compile is synchronous and its
// result is copied into the command buffer before the next call, so a single
// writer is safe and avoids a 512-byte allocation per built node.
const mdastWriter = new OpWriter();
/**
 * Compile a declarative MDAST replacement tree to the op-stream — the only
 * structural encoding. Reused nodes (those still carrying an arena id) become
 * `ref`s so the rebuild splices the original back in place. Returns null when
 * the replay can't reproduce the tree identically (unsupported node type or
 * out-of-range numeric field); the caller turns that into a hard error.
 */
function compileMdastToOpstream(root, forReplace = false) {
    mdastWriter.begin();
    try {
        if (!emitMdastOp(mdastWriter, root, true, forReplace))
            return null;
        return mdastWriter.take();
    }
    finally {
        mdastWriter.end();
    }
}
/** Compile a set-children payload: a root-wrapped child list, the shape
 *  `Patch::SetChildren` splices in. Reused children become refs. */
function compileMdastChildrenToOpstream(children) {
    if (!Array.isArray(children))
        return null;
    mdastWriter.begin();
    try {
        mdastWriter.open(NAME_TO_TYPE.root);
        for (const c of children) {
            if (!emitMdastOp(mdastWriter, c, false, false))
                return null;
        }
        mdastWriter.close();
        return mdastWriter.take();
    }
    finally {
        mdastWriter.end();
    }
}
function emitMdastOp(w, node, isRoot, forReplace) {
    if (node === null || typeof node !== "object")
        return false;
    if (!isRoot) {
        const id = reusedId(node);
        if (id !== undefined) {
            w.ref(id);
            return true;
        }
    }
    const n = node;
    const type = MDAST_OPSTREAM_TYPES[n.type];
    if (type === undefined)
        return false;
    w.open(type);
    if (typeof n.value === "string")
        w.str(OF_VALUE, n.value);
    if (typeof n.url === "string")
        w.str(OF_URL, n.url);
    if (typeof n.title === "string")
        w.str(OF_TITLE, n.title);
    if (typeof n.alt === "string")
        w.str(OF_ALT, n.alt);
    if (typeof n.lang === "string")
        w.str(OF_LANG, n.lang);
    if (typeof n.meta === "string")
        w.str(OF_META, n.meta);
    if (typeof n.identifier === "string")
        w.str(OF_IDENTIFIER, n.identifier);
    if (typeof n.label === "string")
        w.str(OF_LABEL, n.label);
    if (typeof n.referenceType === "string")
        w.str(OF_REFERENCE_TYPE, n.referenceType);
    // Out-of-range numbers compile to null and the caller throws — a visible
    // error instead of silently masking the bits.
    if (typeof n.depth === "number") {
        if (!Number.isInteger(n.depth) || n.depth < 0 || n.depth > 255)
            return false;
        w.u8(OF_DEPTH, n.depth);
    }
    if (typeof n.checked === "boolean")
        w.u8(OF_CHECKED, n.checked ? 1 : 0);
    if (typeof n.start === "number") {
        if (!Number.isInteger(n.start) || n.start < 0 || n.start > 4294967295)
            return false;
        w.u32(OF_START, n.start);
    }
    if (typeof n.ordered === "boolean")
        w.bool(OF_ORDERED, n.ordered);
    if (typeof n.spread === "boolean")
        w.bool(OF_SPREAD, n.spread);
    if (typeof n.name === "string")
        w.str(OF_NAME, n.name);
    const attrs = n.attributes;
    if (Array.isArray(attrs)) {
        for (const a of attrs)
            emitMdxAttr(w, a);
    }
    else if (attrs !== null && typeof attrs === "object") {
        // Directive attributes: a string→string map; non-string values are
        // dropped, since the stored form holds only strings.
        for (const key in attrs) {
            const v = attrs[key];
            if (typeof v === "string")
                w.prop(key, PROP_STRING, v);
        }
    }
    if (Array.isArray(n.align))
        w.align(n.align.map(alignCode));
    if (n.data?._mdxExplicitJsx === true) {
        w.bool(OF_EXPLICIT, true);
    }
    if (n.data != null)
        w.data(n.data);
    if (isRoot && forReplace && n._keepChildren === true) {
        // Replace splices the target's original children, discarding any the
        // replacement declares.
        w.keepChildren();
    }
    else {
        // `_keepChildren` only applies to replace; other ops ignore the marker
        // and emit the declared children.
        const children = n.children;
        if (Array.isArray(children)) {
            for (const c of children)
                if (!emitMdastOp(w, c, false, forReplace))
                    return false;
        }
    }
    w.close();
    return true;
}
/** Map a table `align` entry to its arena code (none=0). */
function alignCode(a) {
    return a === "left" ? 1 : a === "right" ? 2 : a === "center" ? 3 : 0;
}
/** True for the `{raw}` / `{rawHtml}` escape hatches — re-parsed by Rust rather
 *  than compiled to an op-stream, so they ride the RAW_MARKDOWN / RAW_HTML
 *  payloads instead of the declarative encoder. */
function isRawMdastContent(content) {
    const c = content;
    return typeof c.raw === "string" || typeof c.rawHtml === "string";
}
/** Encode `content` as the `op` structural command. Declarative nodes compile
 *  to the op-stream; the `{raw}`/`{rawHtml}` escape hatches ride the raw
 *  re-parse payloads. Anything that compiles to neither is a hard error — the
 *  op-stream is the only declarative encoding. The switches stay inline so the
 *  buffer calls are monomorphic (computed method names defeat inline caches on
 *  this warm path). */
function emitMdastTree(buffer, op, id, content, forReplace = false) {
    if (isRawMdastContent(content)) {
        switch (op) {
            case "replace":
                return buffer.replace(id, content);
            case "insertBefore":
                return buffer.insertBefore(id, content);
            case "insertAfter":
                return buffer.insertAfter(id, content);
            case "prependChild":
                return buffer.prependChild(id, content);
            case "appendChild":
                return buffer.appendChild(id, content);
            case "wrapNode":
                return buffer.wrapNode(id, content);
        }
    }
    const ops = compileMdastToOpstream(content, forReplace);
    if (ops === null)
        throw unencodableContentError(content);
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
/** A result that is the same object as the input node is a no-op, so context
 *  mutations (e.g. setProperty) are not clobbered. */
function applyMdastVisitResult(result, nodeId, returnBuffer, originalNode) {
    if (result === undefined || result === null)
        return;
    if (result === originalNode)
        return;
    const cls = classifyReturn(result);
    switch (cls) {
        case "raw_markdown":
            returnBuffer.replace(nodeId, result);
            break;
        case "raw_html":
            returnBuffer.replace(nodeId, result);
            break;
        case "structured_node":
            emitMdastTree(returnBuffer, "replace", nodeId, result, true);
            break;
    }
}
/**
 * Walk an MDAST handle in Rust, dispatch matched nodes to JS visitor functions,
 * and apply mutations back to the handle. No arena buffers cross NAPI.
 *
 * Returns MdastVisitResult synchronously if all visitors are sync,
 * or Promise<MdastVisitResult> if any visitor is async.
 */
export function visitMdastHandle(handle, plugin, subs, source, fileURL, data = {}, sourceFormat = "markdown") {
    const getSource = typeof source === "function" ? source : () => source;
    const resolver = new MdastLazyChildResolver(handle);
    const context = new MdastVisitorContext(handle, getSource, fileURL, resolver, data, sourceFormat);
    const returnBuffer = new CommandBuffer();
    const rustSubs = subs.map((s) => ({ nodeType: s.nodeType, tagFilter: [] }));
    const matchBuf = walkMdastHandle(handle, rustSubs);
    const matchView = new DataView(matchBuf.buffer, matchBuf.byteOffset, matchBuf.byteLength);
    const matchCount = ru32(matchView, 0);
    let deferred = null;
    for (let i = 0; i < matchCount; i++) {
        const indexBase = 4 + i * 10;
        const nodeId = ru32(matchView, indexBase);
        const subIndex = matchBuf[indexBase + 4];
        const dataOffset = ru32(matchView, indexBase + 6);
        const sub = subs[subIndex];
        const node = readMdastMatchedNode(matchView, matchBuf, dataOffset, nodeId, sub.nodeType, resolver);
        const result = sub.visitFn.call(plugin, node, context);
        if (result instanceof Promise) {
            deferred ??= [];
            deferred.push({ nodeId, promise: result, originalNode: node });
        }
        else {
            applyMdastVisitResult(result, nodeId, returnBuffer, node);
        }
    }
    if (deferred) {
        return Promise.all(deferred.map((d) => d.promise.then((r) => ({ nodeId: d.nodeId, result: r, originalNode: d.originalNode })))).then((results) => {
            for (const { nodeId, result, originalNode } of results) {
                applyMdastVisitResult(result, nodeId, returnBuffer, originalNode);
            }
            // End of the pass — the caller applies the returned command buffer next,
            // renumbering the arena, so later snapshots would resolve match-time
            // child ids against wrong nodes. This is the last point we control.
            resolver.seal();
            return finalizeMdastVisit(handle, context, returnBuffer);
        });
    }
    resolver.seal();
    return finalizeMdastVisit(handle, context, returnBuffer);
}
function finalizeMdastVisit(handle, context, returnBuffer) {
    const { merged, hasMutations } = mergeAndReset(returnBuffer, context);
    return { commandBuffer: merged, diagnostics: context.getDiagnostics(), hasMutations };
}
