import type { MdastPluginInput, HastPluginInput } from "./plugin.js";
import type { MdastNode, HastNode, Data } from "./types.js";
/** Configuration for static subtree collapsing during MDX compilation. */
export interface OptimizeStaticConfig {
    component: string;
    prop: string;
    wrapPropValue?: boolean;
    ignoreElements?: string[];
}
/** Granular smart-punctuation toggles. Omitted fields default to true. */
export interface SmartPunctuationOptions {
    /** Replace straight quotes with curly/smart quotes. Default: true. */
    quotes?: boolean;
    /** Replace `--`/`---` with en-dash/em-dash. Default: true. */
    dashes?: boolean;
    /** Replace `...` with ellipsis (`…`). Default: true. */
    ellipses?: boolean;
}
/**
 * Per-backref callback. Invoked once per anchor in the footnotes section
 * with 1-based `referenceNumber` and `rerunIndex` (1 on the first backref
 * to that definition, 2 on the second, and so on). Must return the final
 * string used as the backref content or `aria-label`.
 */
export type FootnoteBackrefCallback = (referenceNumber: number, rerunIndex: number) => string;
/**
 * i18n strings for the GFM footnotes section. Mirrors `footnoteLabel`,
 * `footnoteBackLabel`, and `footnoteBackContent` from remark-rehype.
 *
 * `backContent` and `backLabel` each accept either a template string with
 * the `{reference}` placeholder (substituted with `1` or `1-2` to match
 * remark-rehype's default suffix), or a callback receiving the raw
 * `(referenceNumber, rerunIndex)` pair.
 *
 * Passing this object enables footnotes. To turn them off, use
 * `gfm: { footnotes: false }`.
 */
export interface FootnoteOptions {
    /** `<h2>` label opening the footnotes section. Default: `"Footnotes"`. */
    label?: string;
    /**
     * Backref `<a>` content. Default: `"↩"`.
     *
     * Template form: the string is used as-is, and a `<sup>K</sup>` marker
     * is auto-appended on reruns (k > 1). Callback form: returns the full
     * content for each backref; no auto-sup is added.
     */
    backContent?: string | FootnoteBackrefCallback;
    /**
     * Backref `aria-label`. Default: `"Back to reference {reference}"`.
     *
     * Template form: `{reference}` becomes `n` for the first backref, `n-K`
     * for subsequent ones. Callback form: returns the `aria-label` string
     * for each backref.
     */
    backLabel?: string | FootnoteBackrefCallback;
}
/** Granular GFM toggles, nested under {@link Features.gfm}. */
export interface GfmOptions {
    /**
     * Enable GFM footnotes (`[^id]`). Default: true.
     *
     * Pass `false` to drop footnote parsing while keeping the rest of GFM;
     * pass an object to enable footnotes with custom i18n strings (see
     * {@link FootnoteOptions}).
     */
    footnotes?: boolean | FootnoteOptions;
}
/** Granular math toggles, nested under {@link Features.math}. */
export interface MathOptions {
    /**
     * Treat single-dollar runs (`$ ... $`) as inline math. Default: true.
     *
     * Set `false` to keep single `$` as literal text while still parsing
     * `$$ ... $$` display math. Mirrors `singleDollarTextMath` from
     * remark-math.
     */
    singleDollarTextMath?: boolean;
}
/** Parser feature toggles. All default to their documented value when omitted. */
export interface Features {
    /**
     * GFM: tables, footnotes, strikethrough, task lists. Default: true.
     *
     * Pass an options object for granular control:
     * ```ts
     * gfm: { footnotes: false }                   // skip footnotes only
     * gfm: { footnotes: { label: "Notes" } }      // localize footnotes
     * ```
     */
    gfm?: boolean | GfmOptions;
    /** Frontmatter: YAML (`--- ... ---`) and TOML (`+++ ... +++`). Default: true. */
    frontmatter?: boolean;
    /**
     * Math blocks and inline math. Default: false.
     *
     * Pass an options object for granular control:
     * ```ts
     * math: { singleDollarTextMath: false }       // $$..$$ only, $..$ literal
     * ```
     */
    math?: boolean | MathOptions;
    /** Heading attributes (`# text { #id .class }`). Default: false. */
    headingAttributes?: boolean;
    /** Colon-delimited container directive blocks (`:::`). Default: false. */
    directive?: boolean;
    /** Superscript (`^super^`). Default: false. */
    superscript?: boolean;
    /** Subscript (`~sub~`). Default: false. */
    subscript?: boolean;
    /** Obsidian-style wikilinks (`[[link]]`). Default: false. */
    wikilinks?: boolean;
    /**
     * Smart punctuation à la SmartyPants. Default: false.
     *
     * Pass `true` to enable all categories, or an options object for granular control:
     * ```ts
     * smartPunctuation: { dashes: false } // quotes + ellipses only
     * ```
     */
    smartPunctuation?: boolean | SmartPunctuationOptions;
}
export interface CompileOptions {
    mdastPlugins?: MdastPluginInput[];
    hastPlugins?: HastPluginInput[];
    features?: Features;
    /**
     * The document being processed, surfaced to plugins as `ctx.fileURL`. Must
     * be a `URL` (e.g. Astro's `fileURL`); convert a filesystem path with Node's
     * `pathToFileURL` before passing it.
     */
    fileURL?: URL;
    /**
     * Initial document-level data bag, seeding `ctx.data` before any plugin runs.
     * It is the same object plugins mutate and the caller reads back as
     * `result.data`, so values flow both into and out of a compile. Defaults to a
     * fresh empty object. Used by reference and mutated in place, so pass a
     * throwaway object per compile rather than a shared one.
     */
    data?: Data;
}
/**
 * MDX-only compile options.
 *
 * These are the fields specific to MDX compilation, separate from the shared
 * pipeline options in {@link CompileOptions}. Useful for wrappers (Vite/Rollup
 * plugins, framework integrations) that want to expose MDX-specific knobs
 * without re-exposing the shared pipeline fields.
 */
export interface MdxOnlyOptions {
    optimizeStatic?: OptimizeStaticConfig;
    /** Place to import automatic JSX runtimes from (e.g. "react", "preact"). Default: "react". */
    jsxImportSource?: string;
    /** Whether to keep JSX instead of compiling it to functions. Default: false. */
    jsx?: boolean;
    /** JSX runtime: "automatic" (default) or "classic". */
    jsxRuntime?: "automatic" | "classic";
    /** Enable development mode. Default: false. */
    development?: boolean;
    /** Place to import the component provider from. */
    providerImportSource?: string;
    /** Pragma for JSX in classic runtime (default: "React.createElement"). */
    pragma?: string;
    /** Pragma for JSX fragments in classic runtime (default: "React.Fragment"). */
    pragmaFrag?: string;
    /** Where to import the pragma from in classic runtime (default: "react"). */
    pragmaImportSource?: string;
    /**
     * Output format: "program" (default) or "function-body".
     *
     * - `"program"`: ES module with `import`/`export` statements.
     * - `"function-body"`: Function body that reads runtime from `arguments[0]`
     *   and returns `{ default: MDXContent, ...exports }`. Suitable for
     *   `new Function()` or `evaluate()`.
     */
    outputFormat?: "program" | "function-body";
    /**
     * Casing for HTML/SVG attribute names on plain (rehype-produced) elements.
     *
     * - `"react"` (default): `className`, `htmlFor`, `strokeLinecap`, `xmlLang`.
     * - `"html"`: `class`, `for`, `stroke-linecap`, `xml:lang`.
     *
     * Does not affect attributes on user-written MDX JSX; those are emitted as
     * the author wrote them.
     */
    elementAttributeNameCase?: "react" | "html";
    /**
     * Casing for keys in `style` objects parsed from `style="…"` strings on
     * plain (rehype-produced) elements.
     *
     * - `"dom"` (default): `{backgroundColor: …, WebkitLineClamp: …}`.
     * - `"css"`: `{"background-color": …, "-webkit-line-clamp": …}`.
     */
    stylePropertyNameCase?: "dom" | "css";
}
export interface MdxCompileOptions extends CompileOptions, MdxOnlyOptions {
}
/** Frontmatter block extracted from the parsed Markdown/MDX source. */
export interface Frontmatter {
    /** Delimiter syntax used for the block. */
    kind: "yaml" | "toml";
    /** Raw content between the delimiters (`---`/`+++` lines excluded). */
    value: string;
}
/** Result of {@link markdownToHtml}. */
export interface MarkdownToHtmlResult {
    /** Rendered HTML string. */
    html: string;
    /** Frontmatter block at the start of the document, or `null` if none. */
    frontmatter: Frontmatter | null;
    /** Document-level data bag shared with plugins via `ctx.data`; the seeded `data` option if provided, else a fresh `{}`. */
    data: Data;
}
/** Result of {@link mdxToJs}. */
export interface MdxToJsResult {
    /** Compiled JavaScript module source. */
    code: string;
    /** Frontmatter block at the start of the document, or `null` if none. */
    frontmatter: Frontmatter | null;
    /** Document-level data bag shared with plugins via `ctx.data`; the seeded `data` option if provided, else a fresh `{}`. */
    data: Data;
}
type AnyFn = (...args: any[]) => unknown;
type ReturnsPromise<F> = F extends AnyFn ? Extract<ReturnType<F>, Promise<unknown>> extends never ? false : true : false;
type FieldIsAsync<V> = V extends AnyFn ? ReturnsPromise<V> : V extends {
    visit: infer F;
} ? ReturnsPromise<F> : V extends ReadonlyArray<infer Item> ? Item extends {
    visit: infer F;
} ? ReturnsPromise<F> : false : false;
type AnyVisitorAsync<P> = {
    [K in keyof P]-?: FieldIsAsync<NonNullable<P[K]>>;
}[keyof P];
type IsPluginAsync<P> = true extends AnyVisitorAsync<P> ? true : false;
type ResolveInput<P> = P extends () => infer D ? D : P;
type AnyInputAsync<Ps> = Ps extends ReadonlyArray<infer P> ? true extends IsPluginAsync<ResolveInput<P>> ? true : false : false;
type OptionsAsync<O> = (O extends {
    mdastPlugins: infer Ps;
} ? AnyInputAsync<Ps> : false) extends true ? true : (O extends {
    hastPlugins: infer Ps;
} ? AnyInputAsync<Ps> : false) extends true ? true : false;
type ResultFor<O, R> = OptionsAsync<O> extends true ? Promise<R> : R;
export declare function markdownToHtml<O extends CompileOptions>(source: string, options?: O): ResultFor<O, MarkdownToHtmlResult>;
export declare function mdxToJs<O extends MdxCompileOptions>(source: string, options?: O): ResultFor<O, MdxToJsResult>;
export interface EvaluateOptions extends Omit<MdxCompileOptions, "jsx" | "outputFormat"> {
    Fragment: unknown;
    jsx: (type: unknown, props: unknown, key?: unknown) => unknown;
    jsxs: (type: unknown, props: unknown, key?: unknown) => unknown;
    jsxDEV?: (type: unknown, props: unknown, key: unknown, isStaticChildren: boolean, source: unknown, self: unknown) => unknown;
    useMDXComponents?: () => Record<string, unknown>;
}
/**
 * Compile and evaluate MDX in one step.
 *
 * Returns the module's exports, including `default` (the MDX component).
 * Returns a Promise when async plugins are used, otherwise returns synchronously.
 *
 * ```ts
 * import * as runtime from "react/jsx-runtime";
 * const { default: Content } = evaluate("# Hello", { ...runtime });
 * ```
 */
export declare function evaluate(source: string, options: EvaluateOptions): Record<string, unknown> | Promise<Record<string, unknown>>;
/** Parse Markdown source into a materialized mdast tree. */
export declare function markdownToMdast(source: string, options?: {
    features?: Features;
}): MdastNode;
/** Parse MDX source into a materialized mdast tree. */
export declare function mdxToMdast(source: string, options?: {
    features?: Features;
}): MdastNode;
/** Convert Markdown source to a materialized hast tree. */
export declare function markdownToHast(source: string, options?: {
    features?: Features;
}): HastNode;
/** Convert MDX source to a materialized hast tree. */
export declare function mdxToHast(source: string, options?: {
    features?: Features;
}): HastNode;
export {};
