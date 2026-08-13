// Generic so the inferred plugin type preserves each visitor's *actual* return
// type. That lets call sites of `markdownToHtml`/`mdxToJs` distinguish sync
// plugins from async ones in their conditional return type.
export function defineMdastPlugin(definition) {
    if (!definition.name) {
        throw new Error("Plugin definition must have a name");
    }
    return definition;
}
export function defineHastPlugin(definition) {
    if (!definition.name) {
        throw new Error("Plugin definition must have a name");
    }
    return definition;
}
