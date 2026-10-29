# Theme a site

Set a site's colours, dark mode and fonts, and restyle a component with your own CSS.

## Set the colours

1. Open **Theme colours** in the CMS, or edit `src/content/theme/theme.md`.

   ```yaml
   brand: "#533563"
   ink: "#2e2e34"
   surface: "#c3a7c8"
   paper: "#ffffff"
   line: "#dbdbdb"
   highlight: "#ec880f"
   ```

2. Save. `Base.astro` writes the colours onto `<html>` as CSS variables with `themeStyle()` from `@gronare/stomme/theme`, and every block follows.

[Theme](../reference/content.md#theme) lists every key and the variable it sets. Because the theme's values sit on `<html>`, they win over a `:root` rule in your stylesheet, so set colours in `theme.md`.

## Follow the visitor's dark mode

1. Set `scheme: auto` and the night colours you want.

   ```yaml
   scheme: auto
   nightBrand: "#f0a070"
   nightInk: "#ecebe5"
   nightPaper: "#141417"
   nightSurface: "#1d1d22"
   nightLine: "#3a3a44"
   ```

2. Build and switch your system to dark mode. The night colours take over, and any night colour left empty keeps its day value.

`Base.astro` writes them with `nightStyle()` from `@gronare/stomme/theme`.

## Let the visitor choose light or dark

A theme with `scheme: auto` also puts a light/dark switch at the end of the header, after the last link; on a phone it sits beside the menu button. A theme without `scheme: auto` has no night colours and gets no switch.

- Until the visitor clicks it, the page follows their system.
- A click switches to the other mode and remembers it in the browser, so the next page opens in that mode without a flash of the other one.
- The button shows a moon in light mode and a sun in dark mode, and turns between them unless the visitor has asked their system for reduced motion.

The button's label names what it does: `controls.darkMode` ("Switch to dark mode") and `controls.lightMode` ("Switch to light mode") in [`strings`](../reference/site-config.md#strings). The choice is the `data-theme` attribute on `<html>`, `light` or `dark`, so your own CSS can target it.

## Pick the fonts

1. Set `fontDisplay` for headings, `fontBody` for body text and `fontMono` for commands and labels. The choices are `system`, `serif`, `grotesk`, `geometric`, `rounded`, `slab`, `condensed`, `humanist`, `script`, `mono`, `inter`, `inter-tight`, `jost` and `custom`.

   ```yaml
   fontDisplay: serif
   fontBody: system
   ```

2. For `inter`, `inter-tight` or `jost`, upload the font to `/media/fonts/<name>.woff2`, for example `/media/fonts/inter.woff2`. Without the file they fall back to the system font.
3. For `custom`, upload a font file and set `fontCustomFile` (headings), `fontCustomBodyFile` (body) or `fontCustomMonoFile` (code) to its `/media/fonts/` path.
4. Build. The page preloads the fonts it uses and serves them from your own site.

## Restyle a component

Write the rule in `src/styles/global.css` after the engine's import. The library's classes are plain, with no `!important` and no scoped styles, so a later rule wins.

```css
@import "@gronare/stomme/styles.css";

.hero-img { --hero-ratio: 1600 / 520; }
.btn { border-radius: 0; }
```

To give a boxed image another shape, set the box's ratio variable, as above, rather than `aspect-ratio`. `aspect-ratio: auto` drops the image's `width` and `height` with the class's ratio, and the box measures 0 high until the file arrives.

## Use a theme directory

A theme directory holds a `theme.css` (the component layer) and, optionally, `tokens.css` (fonts and shape variables) and `theme-seed.md` (starting colours). The build splices it into `global.css` right after the engine import, so the order is engine, tokens, theme, then your own rules.

1. Point `STOMME_THEMES_DIR` at the folder that holds your theme directories, and name the theme in `site.style` (or `STOMME_STYLE`).

   ```ts
   export const site: SiteConfig = { style: 'my-theme' };
   ```

2. Build with the variable set.

   ```bash
   STOMME_THEMES_DIR=../themes pnpm build
   ```

3. Read the build log: `style "my-theme" verified in emitted CSS` confirms the theme reached the output.

A named theme with no `STOMME_THEMES_DIR`, or no `theme.css`, stops the build, so a site never ships unstyled. When `theme.md` does not exist yet, `pnpm cms:gen` copies `theme-seed.md` into its place.
