import { defineConfig } from 'astro/config';

import tailwind from "@astrojs/tailwind";
import sitemap from "@astrojs/sitemap";
import mdx from "@astrojs/mdx"; // VS Code Theme is: Sequoiatheme.com

export default defineConfig({
  markdown: {
    drafts: true,
    shikiConfig: {
      theme: "css-variables"
    }
  },
  shikiConfig: {
    wrap: true,
    skipInline: false,
    drafts: true
  },
  site: 'https://lexingtonthemes.com',
  integrations: [tailwind(), sitemap(), mdx()]
});