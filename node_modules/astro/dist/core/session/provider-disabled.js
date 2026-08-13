import { PipelineFeatures } from "../base-pipeline.js";
function provideSession(state) {
  state.pipeline.usedFeatures |= PipelineFeatures.sessions;
}
export {
  provideSession
};
