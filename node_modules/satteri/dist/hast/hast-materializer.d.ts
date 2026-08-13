import { HastReader } from "./hast-reader.js";
import type { Root } from "hast";
import type { HastNode } from "../types.js";
export type { HastNode };
/**
 * Materialize a single HAST node from a binary buffer as a lazy JS object.
 */
export declare function materializeHastNode(reader: HastReader, nodeId: number): HastNode;
/**
 * Materialize the full HAST tree from root (nodeId=0).
 */
export declare function materializeHastTree(reader: HastReader): Root;
