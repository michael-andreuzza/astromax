import type { LazyChildResolver } from "../lazy-child-resolver.js";
import type { MdastNode } from "../types.js";
import type { MdastReader } from "./mdast-reader.js";
type MdastResolver = LazyChildResolver<MdastReader, MdastNode>;
/**
 * Walk-path child stub: arena id + `type` eagerly, every other field a lazy
 * forward to the materialized node (first read snapshots the arena via
 * `materializeOne`, which enforces the handle epoch — the pass seal is checked
 * where the stubs are built). Spread/identity rules are enforced by `nid()`
 * (authoritative doc in hast-visitor.ts).
 */
export declare class MdastChildStub {
    _resolver: MdastResolver;
    _id: number;
    type: string;
    constructor(resolver: MdastResolver, id: number, nodeType: number);
}
export {};
