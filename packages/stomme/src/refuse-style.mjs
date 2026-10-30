// A site's whole design lives in its own global.css; a leftover style would otherwise build without the look it expects.
export function refuseStyle(style, tool = 'stomme') {
  if (!style) return;
  throw new Error(
    `${tool}: \`style: "${style}"\` is set, but the engine no longer loads themes. ` +
    `Move the theme's tokens.css and theme.css into src/styles/global.css, right after the @gronare/stomme/styles.css import, ` +
    `then remove \`style\` from the site config and STOMME_STYLE from the environment.`,
  );
}
