# Styles

The classes and CSS variables in `@gronare/stomme/styles.css` that a custom block builds with, each shown in the site's own theme.

The library's blocks are made from these, so a block that uses them takes the theme, the dark surface and the night colours the same way. A class not listed here belongs to one block and can change. [Add a custom block](../how-to/add-a-custom-block.md) shows where the markup goes.

## Section rhythm

`.section` is the box every block sits in: centred, at most 72rem wide, with the side gutter and the vertical rhythm every block shares. Add `.section--read` for a reading column of 53rem, and wrap the eyebrow, heading and intro in `.section-head` to keep them to a comfortable line length.

```html preview
<section class="section section--read" style="padding-block: 0">
  <div class="section-head">
    <span class="mono eyebrow">Care</span>
    <h2 class="display">Pruned at the right time</h2>
    <p class="intro">Most shrubs want cutting just after they flower.</p>
  </div>
</section>
```

The inline `padding-block: 0` only keeps this example short; a block leaves the padding to `.section`.

## Headings and text

| Class | Use it for |
|---|---|
| `.display` | a block's heading, in the display font and brand colour |
| `.display--hero` | with `.display`, the page's one large heading |
| `.intro` | the line under a heading, muted and a little larger |
| `.mono` | small uppercase labels in the code font |
| `.eyebrow` | with `.mono`, the label above a heading, with the theme's marker |
| `.prose` | rich text at a reading width, with brand-coloured links |

```html preview
<span class="mono eyebrow">Wren &amp; Sorrel</span>
<h1 class="display display--hero">Gardens that get better every year.</h1>
<p class="intro">We design, build and look after gardens for homes across the valley.</p>
<h2 class="display" style="margin-top: 2rem">Plant for the tenth summer</h2>
<div class="prose">
  <p>A new garden looks its thinnest on the day it is finished. Read <a href="#">how a project runs</a>.</p>
</div>
```

Words in `<em>` inside `.display` are underlined rather than set in italics, which is what `*asterisks*` in a heading field produce.

```html preview
<h2 class="display">Most gardens fail in the <em>first summer</em>.</h2>
```

## Buttons

`.btn` is the main action of a block, `.btn-outline` the second one beside it, and `.btn-ghost` a quiet text link. `.btn-row` lays out a row of them with even gaps and wraps on a narrow screen.

```html preview
<div class="btn-row" style="margin-top: 0">
  <a class="btn" href="#">Book a garden visit</a>
  <a class="btn btn-outline" href="#">See recent gardens</a>
  <a class="btn-ghost" href="tel:+441632960412">Call 01632 960 412 →</a>
</div>
```

On the `dark` and `gradient` surfaces the buttons turn light on their own.

```html preview
<div class="surface-dark" style="padding: 1.5rem; border-radius: 0.7rem">
  <div class="btn-row" style="margin-top: 0">
    <a class="btn" href="#">Book a garden visit</a>
    <a class="btn btn-outline" href="#">See recent gardens</a>
  </div>
</div>
```

## Cards and icons

`.card` is a bordered box on the paper colour, with rounded corners that clip a picture inside it; on an `<a>` the whole card is the link. `.ico-badge` is the tinted square that holds an icon.

```html preview
<a class="card" href="#" style="padding: 1.25rem; max-width: 20rem">
  <span class="ico-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19c0-8 6-13 14-13 0 8-5 14-13 14"/><path d="M5 19c2-4 5-7 9-9"/></svg></span>
  <h3 style="margin: 0.75rem 0 0.25rem">Care</h3>
  <p style="margin: 0; color: var(--color-muted)">Seasonal visits that keep the garden on course.</p>
</a>
```

## Surfaces

A block's `style.surface` puts its `.section` inside one of these wrappers. A custom block gets them for free through the renderer; use the classes yourself only for a band inside your own markup. On `.surface-dark` and `.surface-gradient` the colour variables are redefined, so text, lines and cards inside follow without extra rules.

| Class | Surface | Use it for |
|---|---|---|
| none | `standard` | most blocks, on the paper colour |
| `.surface-tint` | `tint` | a quiet change of background between two blocks |
| `.surface-panel` | `panel` | a rounded tinted panel inside the content width |
| `.band` | `band` | a full-width band in the surface colour |
| `.surface-dark` | `dark` | a dark band for a statement or a call to action |
| `.surface-gradient` | `gradient` | a dark gradient band |

```html preview
<div class="surface-tint" style="padding: 1rem 1.25rem"><span class="mono">surface-tint</span></div>
<div class="band" style="padding: 1rem 1.25rem"><span class="mono">band</span></div>
<div class="surface-panel" style="padding: 0.5rem 0"><div class="section" style="padding: 1rem 1.25rem"><span class="mono">surface-panel</span></div></div>
<div class="surface-dark" style="padding: 1rem 1.25rem"><span class="mono">surface-dark</span> <span>with its own ink</span></div>
<div class="surface-gradient" style="padding: 1rem 1.25rem"><span class="mono">surface-gradient</span> <span>with its own ink</span></div>
```

## Colours

The theme writes these variables on `<html>`, so a block that uses them follows the theme, `scheme: auto` and the dark surfaces. [Theme](content.md#theme) lists the field that sets each one.

```html preview
<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(7.5rem, 1fr)); gap: 0.75rem; font-size: 0.8rem">
  <div><div style="height: 3rem; border-radius: 0.5rem; border: 1px solid var(--color-line); background: var(--color-brand)"></div><code>--color-brand</code></div>
  <div><div style="height: 3rem; border-radius: 0.5rem; border: 1px solid var(--color-line); background: var(--color-brand-press)"></div><code>--color-brand-press</code></div>
  <div><div style="height: 3rem; border-radius: 0.5rem; border: 1px solid var(--color-line); background: var(--color-secondary)"></div><code>--color-secondary</code></div>
  <div><div style="height: 3rem; border-radius: 0.5rem; border: 1px solid var(--color-line); background: var(--color-highlight)"></div><code>--color-highlight</code></div>
  <div><div style="height: 3rem; border-radius: 0.5rem; border: 1px solid var(--color-line); background: var(--color-ink)"></div><code>--color-ink</code></div>
  <div><div style="height: 3rem; border-radius: 0.5rem; border: 1px solid var(--color-line); background: var(--color-muted)"></div><code>--color-muted</code></div>
  <div><div style="height: 3rem; border-radius: 0.5rem; border: 1px solid var(--color-line); background: var(--color-paper)"></div><code>--color-paper</code></div>
  <div><div style="height: 3rem; border-radius: 0.5rem; border: 1px solid var(--color-line); background: var(--color-surface)"></div><code>--color-surface</code></div>
  <div><div style="height: 3rem; border-radius: 0.5rem; border: 1px solid var(--color-ink); background: var(--color-line)"></div><code>--color-line</code></div>
  <div><div style="height: 3rem; border-radius: 0.5rem; border: 1px solid var(--color-line); background: var(--color-on-dark)"></div><code>--color-on-dark</code></div>
  <div><div style="height: 3rem; border-radius: 0.5rem; border: 1px solid var(--color-line); background: var(--color-dark)"></div><code>--color-dark</code></div>
  <div><div style="height: 3rem; border-radius: 0.5rem; border: 1px solid var(--color-line); background: var(--color-dark-ink)"></div><code>--color-dark-ink</code></div>
</div>
```

| Variable | Use it for |
|---|---|
| `--color-brand`, `--color-brand-press` | actions, rules and icons; the pressed shade for hover |
| `--color-secondary`, `--color-highlight` | a second accent, and a highlight for numbers and markers |
| `--color-ink`, `--color-muted` | text, and secondary text |
| `--color-paper`, `--color-surface`, `--color-line` | the page, a tinted area, and borders |
| `--color-on-dark` | text on a brand-coloured button or band |
| `--color-dark`, `--color-dark-ink`, `--color-dark-line` | the dark surface, its text and its lines |
| `--eyebrow-accent` | the eyebrow marker, set from the theme's `eyebrowColor` |

## Fonts

| Variable | Use it for |
|---|---|
| `--font-display` | headings; `.display` uses it |
| `--font-sans` | body text |
| `--font-mono` | code, labels and figures in `.mono` |

```html preview
<p style="font-family: var(--font-display); font-size: 1.6rem; font-weight: 800; margin: 0">Display: Gardens that get better</p>
<p style="font-family: var(--font-sans); margin: 0.5rem 0 0">Sans: We design, build and look after gardens for homes across the valley.</p>
<p style="font-family: var(--font-mono); margin: 0.5rem 0 0">Mono: pnpm stomme block new promo-banner</p>
```

## Safe areas

`--safe-t`, `--safe-r`, `--safe-b` and `--safe-l` hold the device's safe-area insets, zero on a screen without a notch. `.section` already pads with them; use them in a block that reaches the edge of the screen on its own, such as a fixed bar.
