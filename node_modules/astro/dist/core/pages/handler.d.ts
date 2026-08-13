import type { APIContext } from '../../types/public/context.js';
import type { BaseApp } from '../app/base.js';
import type { FetchState } from '../fetch/fetch-state.js';
import type { Pipeline } from '../base-pipeline.js';
/**
 * Handles dispatch of a matched route (endpoint / redirect / page / fallback)
 * at the bottom of the middleware chain. This is a pure dispatch layer — it
 * renders whatever route the `FetchState` currently points to without any
 * rewrite logic. Rewrites are handled upstream: `Rewrites.execute()` for
 * `Astro.rewrite()` and `AstroMiddleware` for `next(payload)`.
 *
 * `PagesHandler` is the `next` callback that `AstroMiddleware` invokes at
 * the end of the middleware chain. `AstroHandler` owns a single instance
 * and passes its `handle` method as the callback. Error handlers and the
 * container also use `PagesHandler` directly for the same dispatch behavior.
 */
export declare class PagesHandler {
    #private;
    constructor(pipeline: Pipeline);
    handle(state: FetchState, ctx: APIContext): Promise<Response>;
    /**
     * Like `handle`, but mirrors the app-level error handling that
     * `AstroHandler` provides on the standard path: unmatched routes
     * return a 404 marked with `X-Astro-Error` for the app's post-check
     * to render the 404 error page, and render-time errors are logged
     * and render the 500 error page instead of propagating to the host
     * framework.
     *
     * Used by the composable `astro/fetch` `pages()` entry point, where
     * there is no surrounding `AstroHandler` to supply this fallback.
     */
    handleWithErrorFallback(app: BaseApp<Pipeline>, state: FetchState): Promise<Response>;
}
