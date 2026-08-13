import { visitHastHandle, resolveSubscriptions } from "./hast/hast-visitor.js";
import { visitMdastHandle, resolveMdastSubscriptions, } from "./mdast/mdast-visitor.js";
import { createHastHandle, createMdxHastHandle, renderHandle, compileHandle, dropHandle, createMdastHandle, createMdxMdastHandle, applyCommandsToMdastHandle, convertMdastToHastHandle, getHandleSource, getMdastFrontmatter, serializeHandle, } from "#binding";
import { MdastReader } from "./mdast/mdast-reader.js";
import { materializeMdastTree } from "./mdast/mdast-materializer.js";
import { markHandleMutated } from "./lazy-child-resolver.js";
import { HastReader } from "./hast/hast-reader.js";
import { materializeHastTree } from "./hast/hast-materializer.js";
/**
 * Split the user-facing `Features` (with nested unions) into the flat napi
 * `JsFeatures` shape plus the conversion-side `JsConvertOptions` carrying
 * the footnote i18n strings. The public API only exposes `features`; the
 * footnote strings are routed to napi internally.
 */
function featuresToNative(features) {
    if (!features)
        return { features: undefined, convertOptions: undefined };
    const result = {};
    let convertOptions;
    if (features.gfm !== undefined) {
        if (typeof features.gfm === "object") {
            const g = features.gfm;
            const gfmOpts = {};
            if (g.footnotes !== undefined) {
                if (typeof g.footnotes === "object") {
                    gfmOpts.footnotes = true;
                    convertOptions = convertOptions ?? {};
                    if (g.footnotes.label !== undefined)
                        convertOptions.footnoteLabel = g.footnotes.label;
                    if (g.footnotes.backContent !== undefined)
                        convertOptions.footnoteBackContent = g.footnotes.backContent;
                    if (g.footnotes.backLabel !== undefined)
                        convertOptions.footnoteBackLabel = g.footnotes.backLabel;
                }
                else {
                    gfmOpts.footnotes = g.footnotes;
                }
            }
            result.gfmOptions = gfmOpts;
        }
        else {
            result.gfm = features.gfm;
        }
    }
    if (features.frontmatter !== undefined)
        result.frontmatter = features.frontmatter;
    if (features.math !== undefined) {
        if (typeof features.math === "object") {
            const mathOpts = {};
            if (features.math.singleDollarTextMath !== undefined)
                mathOpts.singleDollarTextMath = features.math.singleDollarTextMath;
            result.mathOptions = mathOpts;
        }
        else {
            result.math = features.math;
        }
    }
    if (features.headingAttributes !== undefined)
        result.headingAttributes = features.headingAttributes;
    if (features.directive !== undefined)
        result.directive = features.directive;
    if (features.superscript !== undefined)
        result.superscript = features.superscript;
    if (features.subscript !== undefined)
        result.subscript = features.subscript;
    if (features.wikilinks !== undefined)
        result.wikilinks = features.wikilinks;
    if (features.smartPunctuation !== undefined) {
        if (typeof features.smartPunctuation === "object") {
            result.smartPunctuationOptions = features.smartPunctuation;
        }
        else {
            result.smartPunctuation = features.smartPunctuation;
        }
    }
    return { features: result, convertOptions };
}
/** Free a handle's arena. A plugin's visitor can hand child stubs to user code;
 *  pass `invalidateStubs` so the epoch bump makes any stub retained past this
 *  point hit the designed retention error instead of snapshotting the freed arena. */
function releaseHandle(handle, invalidateStubs) {
    if (invalidateStubs)
        markHandleMutated(handle);
    dropHandle(handle);
}
function warnDroppedTransforms(plugin, dropped, kind) {
    const name = plugin.name ?? "<anonymous>";
    const noun = dropped === 1 ? "transform" : "transforms";
    console.warn(`satteri: plugin "${name}" queued ${dropped} ${kind} ${noun} on node(s) that were removed or ` +
        `replaced earlier in the same pass; ${dropped === 1 ? "it was" : "they were"} dropped.`);
}
function runMdastPluginsOnHandle(handle, plugins, fileURL, data, sourceFormat) {
    // Each plugin runs once over the tree. A transform that passes a child
    // through (returning it inside the replacement) keeps that child's identity,
    // so a patch the same pass queued on it still applies — nesting composes in
    // one pass. A plugin's own freshly-built nodes are not re-walked; transform
    // them up front, or hand off to a later plugin that sees the materialized tree.
    const runPlugin = (plugin) => {
        const subs = resolveMdastSubscriptions(plugin);
        const result = visitMdastHandle(handle, plugin, subs, () => getHandleSource(handle), fileURL, data, sourceFormat);
        const apply = (r) => {
            if (!r.hasMutations)
                return;
            markHandleMutated(handle);
            const dropped = applyCommandsToMdastHandle(handle, r.commandBuffer);
            if (dropped)
                warnDroppedTransforms(plugin, dropped, "mdast");
        };
        return result instanceof Promise ? result.then(apply) : apply(result);
    };
    let i = 0;
    const runNext = () => {
        while (i < plugins.length) {
            const raw = plugins[i++];
            const plugin = typeof raw === "function" ? raw() : raw;
            const r = runPlugin(plugin);
            if (r instanceof Promise)
                return r.then(runNext);
        }
        return { handle };
    };
    return runNext();
}
function runHastPluginsOnHandle(handle, plugins, source, fileURL, data, sourceFormat) {
    if (plugins.length === 0)
        return;
    let i = 0;
    const runNext = () => {
        while (i < plugins.length) {
            const raw = plugins[i];
            i++;
            const plugin = typeof raw === "function" ? raw() : raw;
            const subs = resolveSubscriptions(plugin);
            const result = visitHastHandle(handle, plugin, subs, source, fileURL, data, sourceFormat);
            const warnIfDropped = (dropped) => {
                if (dropped)
                    warnDroppedTransforms(plugin, dropped, "hast");
            };
            if (result instanceof Promise) {
                return result.then((dropped) => {
                    warnIfDropped(dropped);
                    return runNext();
                });
            }
            warnIfDropped(result);
        }
    };
    return runNext();
}
// Public API
function mdxOptionsToNative(opts) {
    const hasAny = opts.optimizeStatic ||
        opts.jsxImportSource !== undefined ||
        opts.jsx !== undefined ||
        opts.jsxRuntime !== undefined ||
        opts.development !== undefined ||
        opts.providerImportSource !== undefined ||
        opts.pragma !== undefined ||
        opts.pragmaFrag !== undefined ||
        opts.pragmaImportSource !== undefined ||
        opts.outputFormat !== undefined ||
        opts.elementAttributeNameCase !== undefined ||
        opts.stylePropertyNameCase !== undefined;
    if (!hasAny)
        return undefined;
    const result = {};
    if (opts.optimizeStatic)
        result.optimizeStatic = opts.optimizeStatic;
    if (opts.jsxImportSource !== undefined)
        result.jsxImportSource = opts.jsxImportSource;
    if (opts.jsx !== undefined)
        result.jsx = opts.jsx;
    if (opts.jsxRuntime !== undefined)
        result.jsxRuntime = opts.jsxRuntime;
    if (opts.development !== undefined)
        result.development = opts.development;
    if (opts.providerImportSource !== undefined)
        result.providerImportSource = opts.providerImportSource;
    if (opts.pragma !== undefined)
        result.pragma = opts.pragma;
    if (opts.pragmaFrag !== undefined)
        result.pragmaFrag = opts.pragmaFrag;
    if (opts.pragmaImportSource !== undefined)
        result.pragmaImportSource = opts.pragmaImportSource;
    if (opts.outputFormat !== undefined)
        result.outputFormat = opts.outputFormat;
    if (opts.elementAttributeNameCase !== undefined)
        result.elementAttributeNameCase = opts.elementAttributeNameCase;
    if (opts.stylePropertyNameCase !== undefined)
        result.stylePropertyNameCase = opts.stylePropertyNameCase;
    return result;
}
export function markdownToHtml(source, options = {}) {
    const { mdastPlugins = [], hastPlugins = [], features, fileURL, data = {} } = options;
    const hastMayHaveStubs = hastPlugins.length > 0;
    const { features: nativeFeatures, convertOptions: nativeConvertOptions } = featuresToNative(features);
    const result = createHastHandleFromMdast(source, mdastPlugins, false, fileURL, nativeFeatures, nativeConvertOptions, data);
    const renderAndDrop = (h, frontmatter) => {
        try {
            const html = renderHandle(h);
            return { html, frontmatter, data };
        }
        finally {
            releaseHandle(h, hastMayHaveStubs);
        }
    };
    const runHastThenRender = (r) => {
        let hastResult;
        try {
            hastResult = runHastPluginsOnHandle(r.hastHandle, hastPlugins, source, fileURL, data, "markdown");
        }
        catch (err) {
            releaseHandle(r.hastHandle, hastMayHaveStubs);
            throw err;
        }
        if (hastResult instanceof Promise) {
            return hastResult.then(() => renderAndDrop(r.hastHandle, r.frontmatter), (err) => {
                releaseHandle(r.hastHandle, hastMayHaveStubs);
                throw err;
            });
        }
        return renderAndDrop(r.hastHandle, r.frontmatter);
    };
    if (result instanceof Promise)
        return result.then(runHastThenRender);
    return runHastThenRender(result);
}
export function mdxToJs(source, options = {}) {
    const { mdastPlugins = [], hastPlugins = [], features, fileURL, data = {}, ...mdxFields } = options;
    const hastMayHaveStubs = hastPlugins.length > 0;
    const mdxOptions = mdxOptionsToNative(mdxFields);
    const { features: nativeFeatures, convertOptions: nativeConvertOptions } = featuresToNative(features);
    const result = createHastHandleFromMdast(source, mdastPlugins, true, fileURL, nativeFeatures, nativeConvertOptions, data);
    const compileAndDrop = (h, frontmatter) => {
        try {
            const code = compileHandle(h, mdxOptions);
            return { code, frontmatter, data };
        }
        finally {
            releaseHandle(h, hastMayHaveStubs);
        }
    };
    const runHastThenCompile = (r) => {
        let hastResult;
        try {
            hastResult = runHastPluginsOnHandle(r.hastHandle, hastPlugins, source, fileURL, data, "mdx");
        }
        catch (err) {
            releaseHandle(r.hastHandle, hastMayHaveStubs);
            throw err;
        }
        if (hastResult instanceof Promise) {
            return hastResult.then(() => compileAndDrop(r.hastHandle, r.frontmatter), (err) => {
                releaseHandle(r.hastHandle, hastMayHaveStubs);
                throw err;
            });
        }
        return compileAndDrop(r.hastHandle, r.frontmatter);
    };
    if (result instanceof Promise)
        return result.then(runHastThenCompile);
    return runHastThenCompile(result);
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
export function evaluate(source, options) {
    const { Fragment, jsx, jsxs, jsxDEV, useMDXComponents, ...compileOpts } = options;
    const runtime = { Fragment, jsx, jsxs, jsxDEV, useMDXComponents };
    const result = mdxToJs(source, { ...compileOpts, outputFormat: "function-body" });
    if (result instanceof Promise) {
        return result.then((resolved) => new Function(resolved.code)(runtime));
    }
    return new Function(result.code)(runtime);
}
function readFrontmatter(handle) {
    const raw = getMdastFrontmatter(handle);
    return raw ? { kind: raw.kind === "toml" ? "toml" : "yaml", value: raw.value } : null;
}
/** Parse, run mdast plugins, capture frontmatter, then convert to HAST.
 *  Frontmatter is read from the post-plugin MDAST so visitor mutations to
 *  the yaml/toml node are reflected in the returned value. */
function createHastHandleFromMdast(source, mdastPlugins, mdx, fileURL, 
// eslint-disable-next-line @typescript-eslint/no-explicit-any
nativeFeatures, 
// eslint-disable-next-line @typescript-eslint/no-explicit-any
nativeConvertOptions, data) {
    const mdastHandle = mdx
        ? createMdxMdastHandle(source, nativeFeatures)
        : createMdastHandle(source, nativeFeatures);
    const sourceFormat = mdx ? "mdx" : "markdown";
    const mdastMayHaveStubs = mdastPlugins.length > 0;
    // finally{release} is intentional: convertMdastToHastHandle empties the arena
    // on success, but if any step here throws the handle would otherwise leak.
    const finalize = (r) => {
        try {
            const frontmatter = readFrontmatter(r.handle);
            // convert empties the mdast arena, so invalidate any stub held past this point.
            if (mdastMayHaveStubs)
                markHandleMutated(r.handle);
            const hastHandle = convertMdastToHastHandle(r.handle, nativeConvertOptions);
            return { hastHandle, frontmatter };
        }
        finally {
            releaseHandle(r.handle, mdastMayHaveStubs);
        }
    };
    try {
        if (mdastPlugins.length === 0) {
            return finalize({ handle: mdastHandle });
        }
        const mdastResult = runMdastPluginsOnHandle(mdastHandle, mdastPlugins, fileURL, data, sourceFormat);
        if (mdastResult instanceof Promise) {
            return mdastResult.then(finalize, (err) => {
                releaseHandle(mdastHandle, mdastMayHaveStubs);
                throw err;
            });
        }
        return finalize(mdastResult);
    }
    catch (err) {
        releaseHandle(mdastHandle, mdastMayHaveStubs);
        throw err;
    }
}
// Step-by-step API: individual pipeline stages with materialized trees
/** Parse Markdown source into a materialized mdast tree. */
export function markdownToMdast(source, options = {}) {
    const handle = createMdastHandle(source, featuresToNative(options.features).features);
    try {
        return materializeMdastTree(new MdastReader(serializeHandle(handle)));
    }
    finally {
        releaseHandle(handle, true);
    }
}
/** Parse MDX source into a materialized mdast tree. */
export function mdxToMdast(source, options = {}) {
    const handle = createMdxMdastHandle(source, featuresToNative(options.features).features);
    try {
        return materializeMdastTree(new MdastReader(serializeHandle(handle)));
    }
    finally {
        releaseHandle(handle, true);
    }
}
/** Convert Markdown source to a materialized hast tree. */
export function markdownToHast(source, options = {}) {
    const { features: nativeFeatures, convertOptions } = featuresToNative(options.features);
    const handle = createHastHandle(source, nativeFeatures, convertOptions);
    try {
        return materializeHastTree(new HastReader(serializeHandle(handle)));
    }
    finally {
        releaseHandle(handle, true);
    }
}
/** Convert MDX source to a materialized hast tree. */
export function mdxToHast(source, options = {}) {
    const { features: nativeFeatures, convertOptions } = featuresToNative(options.features);
    const handle = createMdxHastHandle(source, nativeFeatures, convertOptions);
    try {
        return materializeHastTree(new HastReader(serializeHandle(handle)));
    }
    finally {
        releaseHandle(handle, true);
    }
}
