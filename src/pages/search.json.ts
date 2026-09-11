import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

/** Static search index for the recipe library, generated at build. */
export const GET: APIRoute = async () => {
  const recipes = await getCollection('recipes');
  const index = recipes.map((r) => ({
    slug: r.data.slug, title: r.data.title, diet: r.data.diet, meals: r.data.meals, cuisine: r.data.cuisine,
    time: r.data.prepMin + r.data.cookMin, load: r.data.load, tags: r.data.tags,
    ingredients: r.data.ingredients.map((i) => i.item), macros: r.data.macros,
  }));
  return new Response(JSON.stringify(index), { headers: { 'Content-Type': 'application/json' } });
};
