import { collapseDuplicateSlashes } from "@astrojs/internal-helpers/path";
import { validateAndDecodePathname } from "./pathname.js";
function createNormalizedUrl(requestUrl) {
  return normalizeUrl(new URL(requestUrl));
}
function normalizeUrl(url) {
  try {
    url.pathname = validateAndDecodePathname(url.pathname);
  } catch {
    try {
      url.pathname = decodeURI(url.pathname);
    } catch {
    }
  }
  url.pathname = collapseDuplicateSlashes(url.pathname);
  return url;
}
export {
  createNormalizedUrl,
  normalizeUrl
};
