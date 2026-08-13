import { REROUTABLE_STATUS_CODES } from "../constants.js";
function rewroteToEmptyErrorResponse(skipMiddleware, errorRouteData, renderedRouteData, response) {
  return skipMiddleware === false && renderedRouteData !== errorRouteData && response.body === null && REROUTABLE_STATUS_CODES.includes(response.status);
}
export {
  rewroteToEmptyErrorResponse
};
