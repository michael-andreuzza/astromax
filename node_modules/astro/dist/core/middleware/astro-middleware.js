import { PipelineFeatures } from "../base-pipeline.js";
import { ASTRO_ERROR_HEADER } from "../constants.js";
import { attachCookiesToResponse } from "../cookies/index.js";
import { applyRewriteToState } from "../rewrites/handler.js";
import { callMiddleware } from "./callMiddleware.js";
import { sequence } from "./index.js";
class AstroMiddleware {
  #pipeline;
  constructor(pipeline) {
    this.#pipeline = pipeline;
  }
  async handle(state, renderRouteCallback) {
    state.pipeline.usedFeatures |= PipelineFeatures.middleware;
    const pipeline = this.#pipeline;
    await state.getProps();
    const apiContext = state.getAPIContext();
    state.counter++;
    if (state.counter === 4) {
      return new Response("Loop Detected", {
        // https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/508
        status: 508,
        statusText: "Astro detected a loop where you tried to call the rewriting logic more than four times."
      });
    }
    const next = async (ctx, payload) => {
      if (payload) {
        pipeline.logger.debug("router", "Called rewriting to:", payload);
        const result = await pipeline.tryRewrite(payload, state.request);
        applyRewriteToState(state, payload, result);
      }
      return renderRouteCallback(state, ctx);
    };
    let response;
    if (state.skipMiddleware) {
      response = await next(apiContext);
    } else {
      const pipelineMiddleware = await pipeline.getMiddleware();
      const composed = sequence(...pipeline.internalMiddleware, pipelineMiddleware);
      response = await callMiddleware(composed, apiContext, next);
    }
    response = this.#finalize(state, response);
    state.response = response;
    return response;
  }
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
  async handleWithErrorFallback(app, state, renderRouteCallback) {
    if (!state.routeData) {
      return new Response(null, { status: 404, headers: { [ASTRO_ERROR_HEADER]: "true" } });
    }
    let nextError;
    try {
      return await this.handle(state, async (s, ctx) => {
        try {
          return await renderRouteCallback(s, ctx);
        } catch (err) {
          nextError = err;
          throw err;
        }
      });
    } catch (err) {
      if (err === nextError) throw err;
      app.logger.error(null, err.stack || err.message || String(err));
      return app.renderError(state.request, {
        ...state.renderOptions,
        status: 500,
        error: err,
        pathname: state.pathname
      });
    }
  }
  #finalize(state, response) {
    attachCookiesToResponse(response, state.cookies);
    return response;
  }
}
export {
  AstroMiddleware
};
