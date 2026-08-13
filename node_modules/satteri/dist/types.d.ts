import type { Position } from "unist";
import type { Literal as MdastLiteral, Nodes as MdastStdNodes, Parent as MdastParent, PhrasingContent } from "mdast";
import type { Literal as HastLiteral, Nodes as HastStdNodes } from "hast";
export type { Position, Point } from "unist";
export type { MdxJsxFlowElement, MdxJsxTextElement, MdxJsxAttribute as MdxJsxAttributeNode, MdxJsxExpressionAttribute as MdxJsxExpressionAttributeNode, MdxJsxAttributeValueExpression as MdxJsxAttributeValueExpressionNode, MdxFlowExpression, MdxTextExpression, MdxjsEsm, MdxJsxFlowElementHast, MdxJsxTextElementHast, MdxFlowExpressionHast, MdxTextExpressionHast, MdxjsEsmHast, } from "./mdx-types.js";
export type { ContainerDirective, LeafDirective, TextDirective, DirectiveAttributes, } from "./directive-types.js";
import type { MdxJsxAttribute, MdxJsxExpressionAttribute } from "./mdx-types.js";
export type MdxJsxAttributeUnion = MdxJsxAttribute | MdxJsxExpressionAttribute;
export interface Toml extends MdastLiteral {
    type: "toml";
}
export interface MathNode extends MdastLiteral {
    type: "math";
    meta?: string | null | undefined;
}
export interface InlineMath extends MdastLiteral {
    type: "inlineMath";
}
export interface Superscript extends MdastParent {
    type: "superscript";
    children: PhrasingContent[];
}
export interface Subscript extends MdastParent {
    type: "subscript";
    children: PhrasingContent[];
}
declare module "mdast" {
    interface FrontmatterContentMap {
        toml: Toml;
    }
    interface RootContentMap {
        toml: Toml;
        math: MathNode;
        inlineMath: InlineMath;
        superscript: Superscript;
        subscript: Subscript;
    }
    interface PhrasingContentMap {
        inlineMath: InlineMath;
        superscript: Superscript;
        subscript: Subscript;
    }
    interface BlockContentMap {
        math: MathNode;
    }
}
export interface HastRaw extends HastLiteral {
    type: "raw";
}
declare module "hast" {
    interface RootContentMap {
        raw: HastRaw;
    }
    interface ElementContentMap {
        raw: HastRaw;
    }
}
/**
 * Materialized mdast node, a standard `mdast.Nodes` discriminated union.
 * Narrow by `node.type` to access type-specific properties
 * (e.g. `depth` on `"heading"`, `url` on `"link"`).
 */
export type MdastNode = MdastStdNodes;
/**
 * Materialized hast node, a standard `hast.Nodes` discriminated union.
 * Narrow by `node.type` to access type-specific properties
 * (e.g. `tagName` on `"element"`, `value` on `"text"`).
 */
export type HastNode = HastStdNodes;
/**
 * Registry for typing well-known keys on the plugin data bag. Augment it to
 * give specific `ctx.data` / `result.data` keys a type:
 *
 * ```ts
 * declare module "satteri" {
 *   interface DataMap {
 *     toc: TocEntry[];
 *   }
 * }
 * ```
 */
export interface DataMap {
}
/**
 * The document-level plugin data bag (`ctx.data` and `result.data`): any
 * string key holding any value, plus the typed keys registered in {@link DataMap}.
 */
export type Data = Record<string, unknown> & Partial<DataMap>;
/**
 * The source format a plugin is running against, surfaced as `ctx.sourceFormat`:
 * `"markdown"` for a plain Markdown compile, `"mdx"` for an MDX one. Lets a
 * plugin shared between both pipelines branch on which it is handling.
 */
export type SourceFormat = "markdown" | "mdx";
export interface StringRefRaw {
    offset: number;
    len: number;
}
export interface MdastNodeRaw {
    id: number;
    type: number;
    typeName: string;
    parent: number;
    position: Position | undefined;
    childrenStart: number;
    childrenCount: number;
    dataOffset: number;
    dataLen: number;
}
export interface BufferHeader {
    nodeStructSize: number;
    nodeCount: number;
    nodesOffset: number;
    childrenCount: number;
    childrenOffset: number;
    typeDataLen: number;
    typeDataOffset: number;
    stringPoolLen: number;
    stringPoolOffset: number;
    /** Number of nodes that carry an extra JSON `data` blob. */
    nodeDataCount: number;
    /** Offset of the node-data section: `[id u32][len u32][bytes...]` repeated. */
    nodeDataOffset: number;
}
