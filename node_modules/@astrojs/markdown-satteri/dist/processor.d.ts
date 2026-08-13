import type { MarkdownProcessor } from '@astrojs/internal-helpers/markdown';
import type { Features, HastPluginDefinition, MdastPluginDefinition } from 'satteri';
export interface SatteriProcessorOptions {
    mdastPlugins?: MdastPluginDefinition[];
    hastPlugins?: HastPluginDefinition[];
    features?: Features;
}
/**
 * Resolved options on the processor returned by `satteri()`. Always populated
 * (the factory normalises absent inputs into defaults).
 */
export interface SatteriResolvedOptions {
    mdastPlugins: MdastPluginDefinition[];
    hastPlugins: HastPluginDefinition[];
    features: Features;
}
/**
 * Use the Sätteri Markdown processor for `markdown.processor`. Extend the pipeline
 * with mdast or hast plugins, or toggle Markdown features.
 *
 * ```js
 * import { satteri } from '@astrojs/markdown-satteri';
 *
 * export default defineConfig({
 *   markdown: {
 *     processor: satteri({ features: { directive: true } }),
 *   },
 * });
 * ```
 */
export declare function satteri(opts?: SatteriProcessorOptions): MarkdownProcessor<SatteriResolvedOptions>;
export declare function isSatteriProcessor(p: {
    name: string;
}): p is MarkdownProcessor<SatteriResolvedOptions>;
