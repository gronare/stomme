export const TARGETS = ['netlify', 'static', 'cloudflare', 'vercel', 'node'];

const HELP = {
  main: `stomme <command> [options]

Commands:
  new <directory> [--blank | --demo]   create a site: blank, or the Wren & Sorrel demo
  dev                                  run the site and its CMS on localhost
  build [--target <target>]            regenerate the CMS, then build the site
  cms                                  regenerate the CMS config and the block gallery
  block new <name>                     add a block component under src/blocks
  lint [content | styles | comments]   check content against the block catalog (default)

Run stomme help <command> for its options.`,
  new: `stomme new <directory> [--blank | --demo]

Creates a site in <directory>. --blank starts with a home and a contact page, --demo
with the Wren & Sorrel demo; without either it asks, or makes the blank site when
there is no terminal.`,
  dev: `stomme dev [options]

Runs the site's scripts/dev.mjs when it has one, which regenerates the CMS and
starts Astro. Without it, runs stomme cms and astro dev. Options go to Astro.`,
  build: `stomme build [--target <target>] [options]

Regenerates the CMS, then runs astro build. --target sets STOMME_TARGET, one of
${TARGETS.join(', ')}. Without it the site's own default applies, netlify
in a new site. Other options go to Astro.`,
  cms: `stomme cms

Writes public/admin/config.yml, the CMS preview script and stylesheet and the block
gallery from the site's block catalog. Run it after changing src/blocks/schema.ts.`,
  block: `stomme block new <name>

Writes src/blocks/<Name>.astro with a heading prop. The name may be PascalCase or
kebab-case: promo-banner becomes PromoBanner, type promoBanner.`,
  lint: `stomme lint [content | styles | comments] [options]

  content    every block in src/content against the site's catalog (default);
             --json prints the report as JSON, --strict exits 1 on any finding
  styles     the engine's stylesheet against its baseline of colors outside :root
  comments   one-line English comments in the files under a directory (default .)`,
};

const LINTS = { content: 'lint-content.mjs', styles: 'lint-styles.mjs', comments: 'lint-comments.mjs' };

const engine = (script, args = [], env = {}) => ({ engine: script, args, env });
const help = (topic = 'main') => ({ kind: 'help', text: HELP[topic] ?? HELP.main });
const fail = (message, topic = 'main') => ({ kind: 'error', text: `${message}\n\n${HELP[topic]}` });
const run = (...steps) => ({ kind: 'run', steps });

function splitTarget(args) {
  const rest = [];
  let target;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--target' || a === '-t') target = args[++i] ?? '';
    else if (a.startsWith('--target=')) target = a.slice('--target='.length);
    else rest.push(a);
  }
  return { target, rest };
}

export function plan(argv, { hasDevScript = false, version = '' } = {}) {
  const args = argv[0] === '--' ? argv.slice(1) : argv;
  const [cmd, ...rest] = args;
  const asksHelp = rest.includes('--help') || rest.includes('-h');

  if (!cmd || cmd === '--help' || cmd === '-h') return help();
  if (cmd === 'help') return help(rest[0]);
  if (cmd === '--version' || cmd === '-v') return { kind: 'help', text: version };
  if (asksHelp && HELP[cmd]) return help(cmd);

  switch (cmd) {
    case 'new':
      return run({ scaffold: true, args: rest });
    case 'dev':
      return hasDevScript ? run({ node: 'scripts/dev.mjs', args: rest }) : run(engine('gen-admin-blocks.mjs'), { astro: ['dev', ...rest] });
    case 'build': {
      const { target, rest: astroArgs } = splitTarget(rest);
      if (target !== undefined && !TARGETS.includes(target)) return fail(`Unknown target "${target}". Use one of: ${TARGETS.join(', ')}.`, 'build');
      const env = target ? { STOMME_TARGET: target } : {};
      return run({ ...engine('gen-admin-blocks.mjs'), env }, { astro: ['build', ...astroArgs], env });
    }
    case 'cms':
      return run(engine('gen-admin-blocks.mjs', rest));
    case 'block': {
      const [sub, ...names] = rest;
      if (sub !== 'new') return fail(sub ? `Unknown block command "${sub}".` : 'Missing block command.', 'block');
      if (!names.filter((n) => n !== '--').length) return fail('Missing block name.', 'block');
      return run(engine('new-block.mjs', names));
    }
    case 'lint': {
      const [which, ...opts] = rest[0] && !rest[0].startsWith('-') ? rest : ['content', ...rest];
      if (!LINTS[which]) return fail(`Unknown lint "${which}".`, 'lint');
      return run(engine(LINTS[which], opts));
    }
    default:
      return fail(`Unknown command "${cmd}".`);
  }
}
