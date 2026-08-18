// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@tailwindcss/vite';
import { remarkBaseLinks } from './src/plugins/remark-base-links.mjs';
import { validateLessonsIntegration } from './src/integrations/validate-lessons.ts';
import rehypeShiki from './src/plugins/rehype-shiki.ts';

const base = '/weapon/';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  base,
  markdown: {
    remarkPlugins: [[remarkBaseLinks, { base }]],
    rehypePlugins: [rehypeShiki],
  },
  vite: {
    plugins: [tailwind()],
  },
  integrations: [validateLessonsIntegration()],
});
