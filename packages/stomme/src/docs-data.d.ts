export interface DocsLink { url: string; titleHtml: string }
export interface DocsNavItem { path: string | null; url: string; title: string; titleHtml: string; descriptionHtml: string }
export interface DocsNavGroup { label: string | null; labelHtml: string; items: DocsNavItem[] }
export interface DocsNavSection { name: string; nameHtml: string; groups: DocsNavGroup[] }
export interface DocsHeading { id: string; html: string; text: string }
export interface DocsPage {
  path: string;
  slug: string;
  url: string;
  param: string | undefined;
  title: string;
  titleHtml: string;
  lede: string;
  ledeHtml: string;
  html: string;
  headings: DocsHeading[];
  section: string | null;
  edit: string;
  prev: DocsLink | null;
  next: DocsLink | null;
}
export interface DocsVersion {
  key: string;
  ref: string;
  label: string;
  kind: 'release' | 'unreleased' | 'local';
  base: string;
  param: string | undefined;
  home: { url: string; title: string; titleHtml: string; lede: string; ledeHtml: string; edit: string };
  nav: DocsNavSection[];
  pages: DocsPage[];
  search: { t: string; u: string; s: string; x: string }[];
}
export interface DocsData { route: string; repo: string; path: string; versions: DocsVersion[] }
