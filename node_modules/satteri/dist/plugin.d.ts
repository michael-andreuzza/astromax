import type { MdastPluginInstance } from "./mdast/mdast-visitor.js";
import type { HastVisitorInstance } from "./hast/hast-visitor.js";
export type MdastPluginDefinition = MdastPluginInstance & {
    name: string;
};
export type HastPluginDefinition = HastVisitorInstance & {
    name: string;
};
/**
 * Entry accepted by `mdastPlugins`: a definition reused across documents,
 * or a factory called once per compile so closures reset per document.
 */
export type MdastPluginInput = MdastPluginDefinition | (() => MdastPluginDefinition);
/**
 * Entry accepted by `hastPlugins`: a definition reused across documents,
 * or a factory called once per compile so closures reset per document.
 */
export type HastPluginInput = HastPluginDefinition | (() => HastPluginDefinition);
export declare function defineMdastPlugin<P extends MdastPluginDefinition>(definition: P): P;
export declare function defineHastPlugin<P extends HastPluginDefinition>(definition: P): P;
