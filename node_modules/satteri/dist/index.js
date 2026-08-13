// Public API: compile functions
export { markdownToHtml, mdxToJs, evaluate, markdownToMdast, mdxToMdast, markdownToHast, mdxToHast, } from "./compile.js";
// Plugin definitions
export { defineMdastPlugin, defineHastPlugin } from "./plugin.js";
// Visitor pipeline (for manual plugin execution)
export { visitMdastHandle, resolveMdastSubscriptions } from "./mdast/mdast-visitor.js";
export { visitHastHandle, resolveSubscriptions as resolveHastSubscriptions, } from "./hast/hast-visitor.js";
// Step-by-step API: readers, materializers, and handle functions
export { MdastReader } from "./mdast/mdast-reader.js";
export { materializeMdastTree } from "./mdast/mdast-materializer.js";
export { HastReader } from "./hast/hast-reader.js";
export { materializeHastTree } from "./hast/hast-materializer.js";
export { createMdastHandle, createMdxMdastHandle, createHastHandle, createMdxHastHandle, serializeHandle, renderHandle, compileHandle, getHandleSource, } from "#binding";
import { applyCommandsToMdastHandle as napiApplyCommandsToMdastHandle, applyCommandsAndConvertToHastHandle as napiApplyCommandsAndConvertToHastHandle, convertMdastToHastHandle as napiConvertMdastToHastHandle, dropHandle as napiDropHandle, } from "#binding";
import { markHandleMutated } from "./lazy-child-resolver.js";
// The raw NAPI mutators renumber or empty the arena; without the epoch bump a
// child stub retained past a manual-pipeline pass would silently snapshot the
// changed arena (or die with an opaque RangeError) instead of hitting the
// retention error.
export function applyCommandsToMdastHandle(handle, commandBuf) {
    markHandleMutated(handle);
    return napiApplyCommandsToMdastHandle(handle, commandBuf);
}
export function convertMdastToHastHandle(handle, convertOptions) {
    markHandleMutated(handle);
    return napiConvertMdastToHastHandle(handle, convertOptions);
}
export function dropHandle(handle) {
    markHandleMutated(handle);
    napiDropHandle(handle);
}
export function applyCommandsAndConvertToHastHandle(handle, commandBuf, convertOptions) {
    markHandleMutated(handle);
    return napiApplyCommandsAndConvertToHastHandle(handle, commandBuf, convertOptions);
}
