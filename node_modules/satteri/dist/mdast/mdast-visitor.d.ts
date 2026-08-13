import { MdastReader } from "./mdast-reader.js";
import { CommandBuffer } from "../command-buffer.js";
import type { MdastNode, Toml, MathNode, InlineMath, Superscript, Subscript, Data, SourceFormat } from "../types.js";
import { LazyChildResolver } from "../lazy-child-resolver.js";
import type { MdastHandle } from "../handles.js";
import type { Blockquote, Break, Code, Definition, Delete, Emphasis, FootnoteDefinition, FootnoteReference, Heading, Html, Image, ImageReference, InlineCode, Link, LinkReference, List, ListItem, Paragraph, Strong, Table, TableRow, TableCell, Text, ThematicBreak, Yaml, Parents as MdastParents, Root as MdastRoot } from "mdast";
import type { MdxJsxFlowElement, MdxJsxTextElement } from "../mdx-types.js";
import type { MdxFlowExpression, MdxTextExpression } from "../mdx-types.js";
import type { MdxjsEsm } from "../mdx-types.js";
import type { ContainerDirective, LeafDirective, TextDirective } from "../directive-types.js";
/** New content for a structural mutation: a declarative node, or a raw markdown
 *  / HTML escape hatch. Declarative nodes compile to the op-stream; a type the
 *  op-stream can't encode is a hard error. */
export type MdastContent = MdastNode | {
    raw: string;
} | {
    rawHtml: string;
};
export interface MdastDiagnostic {
    message: string;
    nodeId?: number | undefined;
    position?: MdastNode["position"] | undefined;
    severity: "error" | "warning" | "info";
}
export declare class MdastVisitorContext {
    #private;
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
    constructor(handle: MdastHandle, getSource: () => string, fileURL: URL | undefined, resolver: LazyChildResolver<MdastReader, MdastNode>, data: Data, sourceFormat: SourceFormat);
    get source(): string;
    removeNode(node: Readonly<MdastNode>): void;
    insertBefore(node: Readonly<MdastNode>, newNode: MdastContent | MdastContent[]): void;
    insertAfter(node: Readonly<MdastNode>, newNode: MdastContent | MdastContent[]): void;
    /**
     * Wrap `node` in `parentNode`, making it `parentNode`'s first child. Any
     * children `parentNode` declares are kept after it.
     */
    wrapNode(node: Readonly<MdastNode>, parentNode: MdastContent): void;
    prependChild(node: Readonly<MdastNode>, childNode: MdastContent | MdastContent[]): void;
    appendChild(node: Readonly<MdastNode>, childNode: MdastContent | MdastContent[]): void;
    /** Insert one node or an array at `index`; clamps (`0` or less prepends, past the end appends). */
    insertChildAt(node: Readonly<MdastNode>, index: number, childNode: MdastContent | MdastContent[]): void;
    /** Remove the `index`-th child of `node`; a no-op when there is no such child. */
    removeChildAt(node: Readonly<MdastNode>, index: number): void;
    replaceNode(node: Readonly<MdastNode>, newNode: MdastContent): void;
    setProperty<N extends MdastNode, K extends keyof N & string>(node: Readonly<N>, key: K, value: N[K]): void;
    /** `children` is structural and every parent accepts it, so the key also
     *  works on node-type unions (e.g. a node returned by `parent()`). */
    setProperty(node: Readonly<MdastNode>, key: "children", value: readonly MdastNode[]): void;
    /** `data` is an open per-node bag serialized to JSON on the wire, so it
     *  accepts any record (hName/hProperties/custom fields), not just the node's
     *  declared `data` shape. `null` clears it. */
    setProperty(node: Readonly<MdastNode>, key: "data", value: Record<string, unknown> | null): void;
    /** Collect the concatenated text of all descendant text nodes (like mdast-util-to-string). */
    textContent(node: Readonly<MdastNode>, options?: {
        includeImageAlt?: boolean;
        includeHtml?: boolean;
    }): string;
    /**
     * The parent of a node, or `undefined` at the root. Within a pass the same
     * parent is always the same object, so visitors on sibling nodes can dedupe
     * by identity.
     */
    parent<N extends Exclude<MdastNode, MdastRoot>>(node: Readonly<N>): Readonly<MdastParents>;
    parent(node: Readonly<MdastNode>): Readonly<MdastParents> | undefined;
    /**
     * Index of `node` within its parent's children, or `undefined` at the root.
     * Use this rather than `parent.children.indexOf(node)`, which won't find it.
     */
    indexOf(node: Readonly<MdastNode>): number | undefined;
    report({ message, node, severity, }: {
        message: string;
        node?: Readonly<MdastNode>;
        severity?: "error" | "warning" | "info";
    }): void;
    /** Get the binary command buffer for all mutations recorded via context methods. */
    getCommandBuffer(): CommandBuffer;
    getDiagnostics(): MdastDiagnostic[];
}
type MdastVisitorResult = MdastNode | {
    raw: string;
} | {
    rawHtml: string;
} | undefined | null | void;
type MdastVisitorFn<N extends MdastNode = MdastNode> = (node: Readonly<N>, context: MdastVisitorContext) => MdastVisitorResult | Promise<MdastVisitorResult>;
export interface MdastPluginInstance {
    paragraph?: MdastVisitorFn<Paragraph>;
    heading?: MdastVisitorFn<Heading>;
    thematicBreak?: MdastVisitorFn<ThematicBreak>;
    blockquote?: MdastVisitorFn<Blockquote>;
    list?: MdastVisitorFn<List>;
    listItem?: MdastVisitorFn<ListItem>;
    html?: MdastVisitorFn<Html>;
    code?: MdastVisitorFn<Code>;
    definition?: MdastVisitorFn<Definition>;
    text?: MdastVisitorFn<Text>;
    emphasis?: MdastVisitorFn<Emphasis>;
    strong?: MdastVisitorFn<Strong>;
    inlineCode?: MdastVisitorFn<InlineCode>;
    break?: MdastVisitorFn<Break>;
    link?: MdastVisitorFn<Link>;
    image?: MdastVisitorFn<Image>;
    linkReference?: MdastVisitorFn<LinkReference>;
    imageReference?: MdastVisitorFn<ImageReference>;
    footnoteDefinition?: MdastVisitorFn<FootnoteDefinition>;
    footnoteReference?: MdastVisitorFn<FootnoteReference>;
    table?: MdastVisitorFn<Table>;
    tableRow?: MdastVisitorFn<TableRow>;
    tableCell?: MdastVisitorFn<TableCell>;
    delete?: MdastVisitorFn<Delete>;
    yaml?: MdastVisitorFn<Yaml>;
    toml?: MdastVisitorFn<Toml>;
    math?: MdastVisitorFn<MathNode>;
    inlineMath?: MdastVisitorFn<InlineMath>;
    containerDirective?: MdastVisitorFn<ContainerDirective>;
    leafDirective?: MdastVisitorFn<LeafDirective>;
    textDirective?: MdastVisitorFn<TextDirective>;
    superscript?: MdastVisitorFn<Superscript>;
    subscript?: MdastVisitorFn<Subscript>;
    mdxJsxFlowElement?: MdastVisitorFn<MdxJsxFlowElement>;
    mdxJsxTextElement?: MdastVisitorFn<MdxJsxTextElement>;
    mdxFlowExpression?: MdastVisitorFn<MdxFlowExpression>;
    mdxTextExpression?: MdastVisitorFn<MdxTextExpression>;
    mdxjsEsm?: MdastVisitorFn<MdxjsEsm>;
}
interface MdastVisitResult {
    /** Binary command buffer containing all mutations. */
    commandBuffer: Uint8Array;
    diagnostics: MdastDiagnostic[];
    hasMutations: boolean;
}
export type { MdastHandle };
interface MdastSubscription {
    nodeType: number;
    visitFn: (node: MdastNode, context: MdastVisitorContext) => unknown;
}
export declare function resolveMdastSubscriptions(plugin: MdastPluginInstance): MdastSubscription[];
/**
 * Walk an MDAST handle in Rust, dispatch matched nodes to JS visitor functions,
 * and apply mutations back to the handle. No arena buffers cross NAPI.
 *
 * Returns MdastVisitResult synchronously if all visitors are sync,
 * or Promise<MdastVisitResult> if any visitor is async.
 */
export declare function visitMdastHandle(handle: MdastHandle, plugin: MdastPluginInstance, subs: MdastSubscription[], source: string | (() => string), fileURL: URL | undefined, data?: Data, sourceFormat?: SourceFormat): MdastVisitResult | Promise<MdastVisitResult>;
