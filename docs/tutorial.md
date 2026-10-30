# Your first site

Scaffold a site, add a page in the CMS while the preview shows it, and build it to static files.

You need Node.js 22.19 or later, pnpm 11, git, and Chrome or Edge for the CMS. The CMS works on your files directly through the browser's folder access, which those two browsers support.

## Create the site

1. Scaffold a site from the Wren & Sorrel demo, a finished site for a fictional garden studio, so the CMS has real pages and photos to show. Leave out `--demo` and the scaffolder asks, with a blank site as the default.

   ```bash
   pnpm create stomme my-site --demo
   ```

2. Install the site. The scaffolder made it its own git repository, and it installs the engine from the npm registry.

   ```bash
   cd my-site && pnpm install
   ```

## Connect the CMS

3. Name the site's GitHub repository in `src/site.config.ts`. The repository does not have to exist yet: locally, the CMS reads and writes the folder on disk.

   ```ts
   export const site: SiteConfig = {
     cms: { backend: 'github', repo: 'your-name/my-site' },
     routes: {
       // …
   ```

4. Start the dev server. It regenerates the CMS config from the block catalog, then serves the site.

   ```bash
   pnpm dev
   ```

   Open `http://localhost:4321` and you see the demo's home page.

## Add a page in the CMS

5. Open `http://localhost:4321/admin/` in Chrome or Edge. Choose **Work with Local Repository** and pick the `my-site` folder when the browser asks.

6. Open **Pages** and create a new page. Fill in:

   - **Published**: on. The switch is the first field of the form, and a new page starts with it off.
   - **Title**: `Pricing`
   - **SEO** › **SEO title**: `Pricing`, and **SEO description**: `What it costs.`

7. Under **Sections**, add a **Page header** with the heading `Pricing`. The preview beside the form renders it with the real component as you type.

8. Add a **Pricing / plans** section with two plans, `Basic` at `$10` and `Pro` at `$25`, and turn on **Highlight this plan** for Pro. Drag the sections to change their order, and watch the preview follow.

9. Save. The CMS writes `src/content/pages/pricing.md`, and the dev server shows the page at `http://localhost:4321/pricing/`.

   ```bash
   cat src/content/pages/pricing.md
   ```

   The file holds the title, the SEO fields, `published: true` and your two sections as a list of blocks.

## Build it

10. Build the site as plain static files.

    ```bash
    pnpm stomme build --target static
    ```

    The build writes `dist/`, with your page at `dist/pricing/index.html`.

11. Serve the build and open `http://localhost:4321/pricing/`. `pnpm preview` builds the static site again and serves it.

    ```bash
    pnpm preview
    ```

    ![The Wren & Sorrel demo in the browser](assets/hero.webp)

You have a site, a page you made in the CMS, and a static build of both. Next:

- [Deploy a site](how-to/deploy.md) to Netlify, Cloudflare, Vercel, a Node server or any static host.
- [Theme a site](how-to/theme-a-site.md) with your own colours and fonts.
- [Blocks](reference/blocks.md) lists every block and its fields.
