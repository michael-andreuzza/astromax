import { renderEndpoint } from "../../runtime/server/endpoint.js";
import { renderPage } from "../../runtime/server/index.js";
import { ASTRO_ERROR_HEADER } from "../constants.js";
import {
  createCrossOriginForbiddenResponse,
  isForbiddenCrossOriginRequest
} from "../app/origin-check.js";
import { getCookiesFromResponse } from "../cookies/response.js";
const EMPTY_SLOTS = Object.freeze({});
class PagesHandler {
  #pipeline;
  constructor(pipeline) {
    this.#pipeline = pipeline;
  }
  async handle(state, ctx) {
    const pipeline = this.#pipeline;
    const { logger, streaming } = pipeline;
    state.resetResponseMetadata();
    let response;
    const componentInstance = await state.loadComponentInstance();
    switch (state.routeData.type) {
      case "endpoint": {
        response = await renderEndpoint(
          componentInstance,
          ctx,
          state.routeData.prerender,
          logger,
          state
        );
        break;
      }
      case "page": {
        const props = await state.getProps();
        const actionApiContext = state.getActionAPIContext();
        const result = await state.createResult(componentInstance, actionApiContext);
        try {
          response = await renderPage(
            result,
            componentInstance?.default,
            props,
            state.slots ?? EMPTY_SLOTS,
            streaming,
            state.routeData
          );
        } catch (e) {
          result.cancelled = true;
          throw e;
        }
        state.responseRouteType = "page";
        if (state.routeData.route === "/404" || state.routeData.route === "/500") {
          state.skipErrorReroute = true;
        }
        break;
      }
      case "redirect": {
        return new Response(null, { status: 404, headers: { [ASTRO_ERROR_HEADER]: "true" } });
      }
      case "fallback": {
        state.responseRouteType = "fallback";
        return new Response(null, { status: 500 });
      }
    }
    const responseCookies = getCookiesFromResponse(response);
    if (responseCookies) {
      state.cookies.merge(responseCookies);
    }
    state.response = response;
    return response;
  }
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
  async handleWithErrorFallback(app, state) {
    if (!state.routeData) {
      return new Response(null, { status: 404, headers: { [ASTRO_ERROR_HEADER]: "true" } });
    }
    const ctx = state.getAPIContext();
    if (this.#pipeline.manifest.checkOrigin && isForbiddenCrossOriginRequest(ctx.request, ctx.url, ctx.isPrerendered)) {
      return createCrossOriginForbiddenResponse(ctx.request);
    }
    try {
      return await this.handle(state, ctx);
    } catch (err) {
      app.logger.error(null, err.stack || err.message || String(err));
      return app.renderError(state.request, {
        ...state.renderOptions,
        status: 500,
        error: err,
        pathname: state.pathname
      });
    }
  }
}
export {
  PagesHandler
};
