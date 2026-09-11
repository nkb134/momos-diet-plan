// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// GitHub Pages project site: https://nkb134.github.io/momos-diet-plan/
// `base` is applied to every internal link and asset. Always build hrefs
// with `import.meta.env.BASE_URL` (or the Astro `base` helpers), never a
// hardcoded leading slash.
export default defineConfig({
  site: 'https://nkb134.github.io',
  base: '/momos-diet-plan',
  trailingSlash: 'always',
  vite: {
    plugins: [tailwindcss()],
  },
});
