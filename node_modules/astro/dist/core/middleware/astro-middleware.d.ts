import type { FetchState } from '../fetch/fetch-state.js';
import type { APIContext } from '../../types/public/context.js';
import type { BaseApp } from '../app/base.js';
import { type Pipeline } from '../base-pipeline.js';
/**
 * Callback invoked at the bottom of the middleware chain to dispatch the
 * request to the matched route (endpoint / redirect / page / fallback).
 *
 * Callers of `AstroMiddleware.handle` pass their owned `PagesHandler`'s
 * `handle` method (bound) so route dispatch logic stays out of the
 * middleware layer.
 */
export type RenderRouteCallback = (state: FetchState, ctx: APIContext) => Promise<Response>;
/**
 * Handles the execution of Astro's middleware chain (internal + user) for a
 * single render. Holds a reference to the `Pipeline` and composes the
 * internal and user middleware at render time.
 *
 * Reads per-request data (componentInstance, slots, props, API contexts)
 * off the supplied `FetchState`. The actual route dispatch (endpoint /
 * redirect / page / fallback) is supplied by the caller as
 * `renderRouteCallback` — typically bound to a `PagesHandler.handle`.
 */
export declare class AstroMiddleware {
    #private;
    constructor(pipeline: Pipeline);
    handle(state: FetchState, renderRouteCallback: RenderRouteCallback): Promise<Response>;
    /**
     * Like `handle`, but mirrors the app-level error handling that
     * `AstroHandler` provides on the standard path, the same way
     * `PagesHandler.handleWithErrorFallback` does for `pages()`. When no
     * route matched it returns a 404 marked with `X-Astro-Error` for the
     * app's post-check; when Astro's own middleware chain throws it logs the
     * error and renders the custom `500.astro`.
     *
     * Errors surfaced through `renderRouteCallback` (the host framework's
     * `next`, e.g. host middleware mounted below `middleware()`) are
     * re-thrown instead, so the host's own error handling still runs rather
     * than being swallowed into Astro's 500 page. A sentinel tells the two
     * apart.
     *
     * Used by the composable `astro/fetch` `middleware()` entry point, where
     * there is no surrounding `AstroHandler` to supply this fallback.
     */
    handleWithErrorFallback(app: BaseApp<Pipeline>, state: FetchState, renderRouteCallback: RenderRouteCallback): Promise<Response>;
}
