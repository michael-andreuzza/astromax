import type { ConfigEnv, Plugin as VitePlugin } from 'vite';
import type { AstroSettings, RoutesList } from '../types/astro.js';
export declare const ASTRO_RENDERERS_MODULE_ID = "virtual:astro:renderers";
interface PluginOptions {
    settings: AstroSettings;
    routesList: RoutesList;
    command: ConfigEnv['command'];
}
export default function vitePluginRenderers(options: PluginOptions): VitePlugin;
export {};
