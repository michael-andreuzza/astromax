import { type HastNode } from "./hast-materializer.js";
import type { HastRaw, Data, SourceFormat } from "../types.js";
import type { Element, Text, Comment, Doctype, Parents as HastParents, Root as HastRoot } from "hast";
import type { Program } from "estree-jsx";
import type { MdxJsxFlowElementHast, MdxJsxTextElementHast } from "../mdx-types.js";
import type { MdxFlowExpressionHast, MdxTextExpressionHast } from "../mdx-types.js";
import type { MdxjsEsmHast } from "../mdx-types.js";
import type { HastHandle } from "../handles.js";
export type { HastHandle };
/** ESTree-compatible Program node returned by `parseExpression()`. */
export type EstreeProgram = Program;
export interface HastDiagnostic {
    message: string;
    nodeId?: number | undefined;
    severity: "error" | "warning" | "info";
}
export interface HastVisitorContext {
    readonly source: string;
    /**
     * The URL of the document being processed (the compile `fileURL` option),
     * or `undefined` when none was given. Use `fileURLToPath(ctx.fileURL)` for a
     * decoded filesystem path.
     */
    readonly fileURL: URL | undefined;
    /**
     * Document-level data bag, shared across every plugin in the compile and
     * across the mdast→hast phase boundary. Mutate keys directly
     * (`ctx.data.foo = x`); the bag itself isn't reassignable. Values are kept
     * on the JS side, so any value is allowed, including functions and class
     * instances. Returned to the caller as `result.data`.
     */
    readonly data: Data;
    /**
     * The source format this compile is processing: `"markdown"` for a plain
     * Markdown compile, `"mdx"` for an MDX one. Lets a plugin shared between both
     * pipelines branch on which it is handling.
     */
    readonly sourceFormat: SourceFormat;
    removeNode(node: Readonly<HastNode>): void;
    replaceNode(node: Readonly<HastNode>, newNode: HastContent): void;
    insertBefore(node: Readonly<HastNode>, newNode: HastContent | HastContent[]): void;
    insertAfter(node: Readonly<HastNode>, newNode: HastContent | HastContent[]): void;
    /**
     * Wrap `node` in `parentNode`, making it `parentNode`'s first child. Any
     * children `parentNode` declares are kept after it, so a `div` with an anchor
     * child wraps a heading as `div > [heading, anchor]`.
     */
    wrapNode(node: Readonly<HastNode>, parentNode: HastContent): void;
    prependChild(node: Readonly<HastNode>, childNode: HastContent | HastContent[]): void;
    appendChild(node: Readonly<HastNode>, childNode: HastContent | HastContent[]): void;
    /** Insert one node or an array at `index`; clamps (`0` or less prepends, past the end appends). */
    insertChildAt(node: Readonly<HastNode>, index: number, childNode: HastContent | HastContent[]): void;
    /** Remove the `index`-th child of `node`; a no-op when there is no such child. */
    removeChildAt(node: Readonly<HastNode>, index: number): void;
    setProperty(node: Readonly<HastNode>, key: string, value: unknown): void;
    /** Collect the concatenated text of all descendant text nodes (like DOM textContent). */
    textContent(node: Readonly<HastNode>): string;
    /**
     * The parent of a node, or `undefined` at the root. Within a pass the same
     * parent is always the same object, so visitors on sibling nodes can dedupe
     * by identity.
     */
    parent<N extends Exclude<HastNode, HastRoot>>(node: Readonly<N>): Readonly<HastParents>;
    parent(node: Readonly<HastNode>): Readonly<HastParents> | undefined;
    /**
     * Index of `node` within its parent's children, or `undefined` at the root.
     * Use this rather than `parent.children.indexOf(node)`, which won't find it.
     */
    indexOf(node: Readonly<HastNode>): number | undefined;
    report(opts: {
        message: string;
        node?: Readonly<HastNode>;
        severity?: "error" | "warning" | "info";
    }): void;
    getDiagnostics(): HastDiagnostic[];
}
/** New content for a HAST structural mutation. Unlike [`MdastContent`], HAST has
 *  a `raw` node type, so it needs no raw/rawHtml escape hatch. */
export type HastContent = HastNode;
/** A filtered visitor: Rust filters by tag/component name, only matched nodes cross the boundary. */
export interface HastFilteredVisitor<N extends HastNode = HastNode> {
    filter: string[];
    visit(node: Readonly<N>, ctx: HastVisitorContext): HastNode | void | Promise<HastNode | void>;
}
type HastVisitorFn<N extends HastNode = HastNode> = (node: Readonly<N>, ctx: HastVisitorContext) => HastNode | void | Promise<HastNode | void>;
export interface HastVisitorInstance {
    element?: HastFilteredVisitor<Element> | HastFilteredVisitor<Element>[];
    mdxJsxFlowElement?: HastFilteredVisitor<MdxJsxFlowElementHast> | HastFilteredVisitor<MdxJsxFlowElementHast>[];
    mdxJsxTextElement?: HastFilteredVisitor<MdxJsxTextElementHast> | HastFilteredVisitor<MdxJsxTextElementHast>[];
    text?: HastVisitorFn<Text>;
    comment?: HastVisitorFn<Comment>;
    raw?: HastVisitorFn<HastRaw>;
    doctype?: HastVisitorFn<Doctype>;
    mdxFlowExpression?: HastVisitorFn<MdxFlowExpressionHast & {
        parseExpression(): EstreeProgram | null;
    }>;
    mdxTextExpression?: HastVisitorFn<MdxTextExpressionHast & {
        parseExpression(): EstreeProgram | null;
    }>;
    mdxjsEsm?: HastVisitorFn<MdxjsEsmHast & {
        parseExpression(): EstreeProgram | null;
    }>;
}
interface ResolvedSubscription {
    nodeType: number;
    tagFilter: string[];
    visitFn: (node: HastNode, ctx: HastVisitorContext) => HastNode | void;
}
export declare function resolveSubscriptions(plugin: HastVisitorInstance): ResolvedSubscription[];
/**
 * Walk a handle's arena in Rust, dispatch matched nodes to JS visitor functions,
 * and apply mutations back to the handle. No arena buffers cross NAPI.
 *
 * Returns the number of patches dropped because their target was removed or
 * replaced earlier in the same pass (the caller warns when non-zero), or a
 * Promise of that count if any visitor is async.
 */
export declare function visitHastHandle(handle: HastHandle, plugin: HastVisitorInstance, subs: ResolvedSubscription[], source: string | (() => string), fileURL: URL | undefined, data?: Data, sourceFormat?: SourceFormat): number | Promise<number>;
