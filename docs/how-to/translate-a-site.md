# Translate a site

Serve pages in more than one language, each under its own prefix, with hreflang links and a language switcher.

1. List the languages in `src/site.config.ts`, the default first.

   ```ts
   export const site: SiteConfig = {
     locale: 'en-US',
     locales: ['en', 'sv'],
   };
   ```

2. Run `pnpm cms:gen`. The CMS editors for the home page, pages, navigation, FAQ and footer get a version per language.
3. Translate a page as a sibling file with the language before `.md`, and give it its own address with `url` if you want one.

   ```yaml
   # src/content/pages/about.sv.md
   title: Om oss
   url: om-oss
   published: true
   seo: { title: Om oss, description: Vilka vi är. }
   blocks:
     - type: pageHeader
       heading: Om oss
   ```

4. Build. The page answers at `/sv/om-oss/` with `<html lang="sv">`, and `/about/` carries `hreflang` links to both, plus `x-default`.

The default language has no prefix. Every page also answers under each other prefix: an untranslated one renders in the default language there, and its links lead on to the pages that do exist in that language. Fewer than two `locales` turns the whole layer off, with no prefixed routes, no hreflang and no switcher.

| Key | What it sets |
|---|---|
| `locale` | the site's language and region (BCP 47). It formats dates and numbers and picks the built-in interface text: English, Swedish and Norwegian (`no`, `nb`, `nn`) ship, any other language falls back to English |
| `locales` | the content languages, default first |
| `localeTags` | the `lang` and hreflang tag per language, when it should differ from the code in `locales`, for example `{ sv: 'sv-SE' }` |
| `strings` | your own wording for the interface text, written in the default language. On every other language the site's `strings` are dropped and that language's built-in text is used, so the default language is the only one they reword |
| `cmsLocale` | the language of the CMS's field labels: `en` or `sv`. Nothing on the public site |

The switcher in the header shows a globe or flags, set by `languageSwitcher` in the site settings.
