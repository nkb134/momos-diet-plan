# Contributing

## Recipe schema

Every recipe is `src/content/recipes/<slug>.md` with YAML frontmatter validated by Zod at build time (see `src/content/config.ts`). A malformed recipe fails the build rather than rendering broken.

| Field | Type | Notes |
|---|---|---|
| `title` | string | Display name |
| `slug` | string | `a-z0-9-`, must equal the file name |
| `diet` | `veg` \| `egg` \| `nonveg` | Drives the FSSAI mark and the veg-only toggle |
| `meals` | array of `breakfast` \| `lunch` \| `snack` \| `dinner` | Slots the recipe can fill |
| `cuisine` | string | Counts as Indian unless listed in `nonIndianCuisines` in the nutrition config |
| `region` | string | Optional, shown after cuisine |
| `image` | string | File name under `src/assets/recipes/`; placeholder card if missing |
| `imageCredit` | `{ name, url, license }` | Recorded for provenance; not rendered |
| `video` | `{ youtubeId, title, channel, isShort }` or `null` | Optional Short of a similar method |
| `prepMin`, `cookMin` | integer | Minutes |
| `serves` | integer | People the listed quantities feed on the recipe page. Veg 2, non-veg add-ons 1 |
| `macros` | object | **Generated** by `npm run compute-macros`. Per serving. Never hand-edit |
| `load` | `light` \| `moderate` \| `hearty` | Dinner must be `light` |
| `anchor` | ingredient key | The protein component the plan's `anchorGrams` overrides |
| `tags` | string array | Free-form, used by the library filter |
| `difficulty` | `easy` \| `medium` \| `hard` | |
| `equipment` | array | Only values on `equipmentAllowlist` in the nutrition config |
| `ingredients` | array of `{ item, key, qty, unit, household, note }` | `qty` is grams **per serving**; `key` must exist in `src/data/ingredients.yaml`; `household` is an Indian measure for the cooked quantity |
| `swaps` | array of `{ for, use, why }` | Regional or specialty items and lower-effort alternatives |
| `steps` | string array | Original prose, home kitchen, low oil |
| `notes` | string | Storage, tiffin, what to watch |

## Plan schema

`src/content/plan/week-NN.yaml`: `week`, `title`, and exactly seven `days`, each with `day`, `date` (ISO), `training` (`lift` \| `swim` \| `rest`) and four `meals`. Each meal has `veg` (required), `portion`, `anchorGrams`, and optional `nonVegAddOn`.

## Ingredient table

`src/data/ingredients.yaml`: per-100 g `kcal`, `protein_g`, `carb_g`, `fibre_g`, `fat_g`, plus `name`, `aisle`, `hint`, and `source` (IFCT 2017 or USDA FDC reference). Add a row before using a new key.

## Workflow

- Conventional commits (`feat:`, `fix:`, `style:`, `docs:`, `chore:`).
- `npm run validate` and `npm run check` must pass; CI runs both plus a link check on every pull request.
- Keep recipe methods original. Technique is shared knowledge; sentences are not.
