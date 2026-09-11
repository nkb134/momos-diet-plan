import type { ImageMetadata } from 'astro';

/** All recipe photos under src/assets/recipes, keyed by file name. */
const files = import.meta.glob<{ default: ImageMetadata }>('../assets/recipes/*.{jpg,jpeg,png,webp,avif}', { eager: true });

const byName = new Map<string, ImageMetadata>();
for (const [path, mod] of Object.entries(files)) {
  byName.set(path.split('/').pop()!, mod.default);
}

/** Resolve a recipe's `image` frontmatter value to optimisable metadata, or null. */
export function recipeImage(image: string | undefined): ImageMetadata | null {
  if (!image) return null;
  return byName.get(image.split('/').pop()!) ?? null;
}
