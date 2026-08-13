import { BaseApp } from "../app/entrypoints/index.js";
import { BuildPipeline } from "./pipeline.js";
import { BuildErrorHandler } from "../errors/build-handler.js";
class BuildApp extends BaseApp {
  createPipeline(_streaming, manifest, ..._args) {
    return BuildPipeline.create({
      manifest
    });
  }
  isDev() {
    return true;
  }
  setInternals(internals) {
    this.pipeline.setInternals(internals);
  }
  setOptions(options) {
    this.pipeline.setOptions(options);
    this.logger.setDestination(options.logger.options.destination);
    this.resetAdapterLogger();
  }
  getOptions() {
    return this.pipeline.getOptions();
  }
  getSettings() {
    return this.pipeline.getSettings();
  }
  createErrorHandler() {
    return new BuildErrorHandler(this);
  }
  logRequest(_options) {
  }
}
export {
  BuildApp
};
