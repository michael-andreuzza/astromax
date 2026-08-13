import type { Root } from "mdast";
import type { MdastNode } from "../types.js";
import type { MdastReader } from "./mdast-reader.js";
export declare const LEAF_TYPES: ReadonlySet<number>;
/**
 * Materialize a single MDAST node from a binary buffer as a lazy JS object.
 */
export declare function materializeNode(reader: MdastReader, nodeId: number): MdastNode;
/** Materialize the full tree from root (nodeId=0). */
export declare function materializeMdastTree(reader: MdastReader): Root;
