import { createSatteriMarkdownProcessor } from "./satteri-processor.js";
function satteri(opts = {}) {
  const processor = {
    name: "satteri",
    options: {
      mdastPlugins: [...opts.mdastPlugins ?? []],
      hastPlugins: [...opts.hastPlugins ?? []],
      // Default to `{}` so integrations can write `options.features.gfm = false`
      // without an `??=` check.
      features: { ...opts.features }
    },
    createRenderer(shared) {
      return createSatteriMarkdownProcessor({
        ...shared,
        mdastPlugins: processor.options.mdastPlugins,
        hastPlugins: processor.options.hastPlugins,
        features: processor.options.features
      });
    }
  };
  return processor;
}
function isSatteriProcessor(p) {
  return p.name === "satteri";
}
export {
  isSatteriProcessor,
  satteri
};
