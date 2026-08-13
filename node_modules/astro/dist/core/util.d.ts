import type { AstroSettings } from '../types/astro.js';
import type { AstroConfig } from '../types/public/config.js';
/** Check if a file is a markdown file based on its extension */
export declare function isMarkdownFile(fileId: string, option?: {
    suffix?: string;
}): boolean;
/** is a specifier an npm package? */
export declare function parseNpmName(spec: string): {
    scope?: string;
    name: string;
    subpath?: string;
} | undefined;
/**
 * Convert file URL to ID for environment.moduleGraph.idToModuleMap.get(:viteID)
 * Format:
 *   Linux/Mac:  /Users/astro/code/my-project/src/pages/index.astro
 *   Windows:    C:/Users/astro/code/my-project/src/pages/index.astro
 */
export declare function viteID(filePath: URL): string;
export declare const VALID_ID_PREFIX = "/@id/";
export declare function unwrapId(id: string): string;
export declare function wrapId(id: string): string;
export declare function resolvePages(config: AstroConfig): URL;
export declare function isPage(file: URL, settings: AstroSettings): boolean;
export declare function isEndpoint(file: URL, settings: AstroSettings): boolean;
export declare function resolveJsToTs(filePath: string): string;
/**
 * Resolve a path that doesn't name a file on disk (e.g. produced by an
 * extensionless import like `import { Counter } from './Counter'`) to the file
 * Vite would load, by probing Vite's default extension order and directory
 * `index` files. Returns the path unchanged when it already exists as a file
 * or when no candidate is found.
 */
export declare function resolveExtensionlessPath(filePath: string): string;
/**
 * Set a default NODE_ENV so Vite doesn't set an incorrect default when loading the Astro config
 */
export declare function ensureProcessNodeEnv(defaultNodeEnv: string): void;
