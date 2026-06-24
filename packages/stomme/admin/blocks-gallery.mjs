// Render a standalone "block gallery" reference page from the catalog: every block the
// site can add, grouped, with a crude wireframe pictogram, a one-line "what it produces"
// and a filter box. stomme-gen writes the result to public/admin/blocks.html so an editor
// can keep it open beside /admin. Block labels + group names are translated via `t`;
// summaries stay in the catalog language (English) for now.

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Crude wireframe pictograms — inner markup per `shape`, drawn by the CSS below.
const SHAPES = {
  hero: '<i class="col"><i class="ln w70"></i><i class="ln w90"></i><i class="ln w40"></i></i><i class="box"></i>',
  band: '<i class="bar"></i><i class="ln w50 ctr"></i>',
  prose: '<i class="ln w90"></i><i class="ln w100"></i><i class="ln w80"></i><i class="ln w95"></i>',
  split: '<i class="col"><i class="ln w80"></i><i class="ln w90"></i><i class="ln w50"></i></i><i class="box"></i>',
  grid: '<i class="cell"></i><i class="cell"></i><i class="cell"></i><i class="cell"></i>',
  gallery: '<i class="img"></i><i class="img"></i><i class="img"></i>',
  steps: '<i class="row"><b class="num">1</b><i class="ln w70"></i></i><i class="row"><b class="num">2</b><i class="ln w55"></i></i>',
  checklist: '<i class="row"><b class="tick">✓</b><i class="ln w70"></i></i><i class="row"><b class="tick">✓</b><i class="ln w55"></i></i>',
  quote: '<b class="qm">&rdquo;</b><i class="ln w80"></i><i class="ln w55"></i>',
  panel: '<i class="dark"><b class="big">42</b><i class="ln w50 lt"></i></i>',
  chips: '<i class="pill"></i><i class="pill"></i><i class="pill"></i><i class="pill"></i>',
  list: '<i class="lrow"></i><i class="lrow"></i><i class="lrow"></i>',
  box: '<i class="cbox"><i class="ln w60 ctr"></i><i class="btn"></i></i>',
  stats: '<i class="stat"><b>12</b></i><i class="stat"><b>98%</b></i><i class="stat"><b>4.9</b></i>',
  auto: '<i class="dash">auto</i>',
};

export function renderGallery(blocks, { t = (s) => s, groupOrder = [], locale = 'en' } = {}) {
  const groups = new Map();
  for (const b of blocks) {
    const g = b.group || 'Other';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(b);
  }
  const ordered = [...groupOrder.filter((g) => groups.has(g)), ...[...groups.keys()].filter((g) => !groupOrder.includes(g))];

  const sections = ordered.map((g) => {
    const cards = groups.get(g).map((b) => {
      const coll = b.collection ? `<span class="coll" title="${esc(t('Reads from a collection'))}">▢ ${esc(t('Reads from a collection'))}</span>` : '';
      const summary = t(b.summary || '');
      return `<article class="card" data-t="${esc((t(b.label) + ' ' + b.label + ' ' + (b.summary || '') + ' ' + summary).toLowerCase())}">
        <div class="wf" data-shape="${esc(b.shape || 'prose')}">${SHAPES[b.shape] || SHAPES.prose}</div>
        <div class="meta"><h3>${esc(t(b.label))}</h3><p>${esc(summary)}</p>${coll}</div>
      </article>`;
    }).join('');
    return `<section class="grp"><h2>${esc(t(g))}<span class="n">${groups.get(g).length}</span></h2><div class="cards">${cards}</div></section>`;
  }).join('');

  return `<!doctype html>
<html lang="${esc(locale)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t('Block gallery'))}</title>
<style>
:root{--paper:#f4f2ec;--card:#fbfaf6;--ink:#1c1916;--muted:#756f66;--rule:#ddd8cd;--red:#a8331f;--line:#c9c3b6;
--mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;--serif:Georgia,"Times New Roman",serif}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--serif);line-height:1.5;-webkit-font-smoothing:antialiased}
.wrap{max-width:1000px;margin:0 auto;padding:clamp(20px,5vw,52px) clamp(16px,4vw,40px) 80px}
header{border-bottom:3px double var(--ink);padding-bottom:16px}
.kick{font-family:var(--mono);font-size:.7rem;letter-spacing:.2em;text-transform:uppercase;color:var(--red);font-weight:700;margin:0 0 6px}
h1{font-size:clamp(1.8rem,5vw,2.7rem);margin:0;letter-spacing:-.01em}
.lede{color:var(--muted);margin:12px 0 0;max-width:60ch}
.filter{display:flex;align-items:center;gap:8px;background:var(--card);border:1px solid var(--rule);border-radius:7px;padding:9px 13px;margin:22px 0 0;max-width:340px}
.filter input{border:0;background:transparent;font:inherit;font-family:var(--mono);font-size:.85rem;width:100%;outline:none;color:var(--ink)}
.filter span{font-family:var(--mono);font-size:.78rem;color:var(--muted)}
.grp{margin-top:38px}.grp.hide{display:none}
h2{font-family:var(--mono);font-size:.74rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--red);margin:0 0 14px;padding-bottom:8px;border-bottom:1px solid var(--rule)}
h2 .n{color:var(--muted);font-weight:400;margin-left:.5em}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px}
.card{display:flex;gap:13px;background:var(--card);border:1px solid var(--rule);border-radius:9px;padding:13px}
.card.hide{display:none}
.meta h3{margin:0 0 3px;font-size:1.02rem;line-height:1.2}
.meta p{margin:0;font-size:.82rem;color:var(--muted);line-height:1.4}
.coll{display:inline-block;margin-top:6px;font-family:var(--mono);font-size:.62rem;letter-spacing:.04em;color:var(--red)}
.nores{display:none;color:var(--muted);font-style:italic;padding:24px 0}.nores.show{display:block}
footer{margin-top:50px;padding-top:14px;border-top:1px solid var(--rule);font-family:var(--mono);font-size:.7rem;color:var(--muted)}
/* ── wireframe pictograms ── */
.wf{flex:0 0 auto;width:92px;height:62px;background:#fff;border:1px solid var(--line);border-radius:5px;padding:7px;display:flex;flex-wrap:wrap;gap:3px;align-content:flex-start;overflow:hidden}
.wf i,.wf b{display:block}
.wf .ln{height:5px;border-radius:2px;background:var(--line);width:100%}
.wf .w40{width:40%}.wf .w50{width:50%}.wf .w55{width:55%}.wf .w60{width:60%}.wf .w70{width:70%}.wf .w80{width:80%}.wf .w90{width:90%}.wf .w95{width:95%}.wf .w100{width:100%}
.wf .ctr{margin:0 auto}
.wf .col{flex:1;display:flex;flex-direction:column;gap:4px;min-width:0}
.wf .box{flex:0 0 30px;align-self:stretch;background:var(--line);border-radius:3px;opacity:.7}
.wf[data-shape=hero],.wf[data-shape=split]{flex-wrap:nowrap;gap:6px;align-content:stretch}
.wf .bar{width:100%;height:20px;background:var(--line);border-radius:3px}
.wf .cell{flex:0 0 calc(50% - 2px);height:22px;background:var(--line);border-radius:3px;opacity:.65}
.wf[data-shape=grid]{align-content:center}
.wf .img{flex:1;height:30px;background:var(--line);border-radius:3px;opacity:.6}
.wf[data-shape=gallery]{flex-wrap:nowrap;align-content:center;align-items:center}
.wf .row{display:flex;align-items:center;gap:5px;width:100%}
.wf .num{font:700 8px/1 var(--mono);color:#fff;background:var(--red);border-radius:50%;width:12px;height:12px;display:flex;align-items:center;justify-content:center;flex:0 0 12px}
.wf .tick{font:700 9px/1 var(--mono);color:var(--red);flex:0 0 12px;text-align:center}
.wf[data-shape=steps],.wf[data-shape=checklist]{flex-direction:column;justify-content:center;gap:7px}
.wf .qm{font:700 30px/0.7 var(--serif);color:var(--line)}
.wf[data-shape=quote]{flex-direction:column;justify-content:center}
.wf .dark{background:var(--ink);border-radius:4px;width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:4px}
.wf .big{font:700 17px/1 var(--mono);color:#fff}.wf .lt{background:#fff;opacity:.5}
.wf .pill{height:9px;width:26px;background:var(--line);border-radius:9px}
.wf[data-shape=chips]{align-content:center}
.wf .lrow{width:100%;height:10px;background:var(--line);border-radius:2px;opacity:.7}
.wf[data-shape=list]{flex-direction:column;justify-content:center;gap:6px}
.wf .cbox{border:1.5px solid var(--line);border-radius:4px;width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:6px}
.wf .btn{width:34px;height:9px;background:var(--red);border-radius:3px;opacity:.8}
.wf[data-shape=stats]{align-items:center;justify-content:space-around}
.wf .stat{flex:1;text-align:center}.wf .stat b{font:700 13px/1 var(--mono);color:var(--ink)}
.wf .dash{border:1.5px dashed var(--line);border-radius:4px;width:100%;height:100%;display:flex;align-items:center;justify-content:center;font:600 9px/1 var(--mono);color:var(--muted);letter-spacing:.1em;text-transform:uppercase}
@media(max-width:480px){.card{flex-direction:column}.wf{width:100%}}
</style>
</head>
<body>
<div class="wrap">
<header>
<p class="kick">${esc(t('Block gallery'))}</p>
<h1>${esc(t('Sections you can add'))}</h1>
<p class="lede">${esc(t('What each section produces. Keep this open beside /admin while you build a page.'))}</p>
<label class="filter"><span>filter</span><input id="q" type="text" placeholder="${esc(t('Filter sections…'))}" autocomplete="off" aria-label="Filter"></label>
</header>
<div id="list">${sections}</div>
<p class="nores" id="nores">${esc(t('No matches.'))}</p>
<footer>@gronare/stomme · generated by stomme-gen from the block catalog</footer>
</div>
<script>
const q=document.getElementById('q'),nores=document.getElementById('nores'),list=document.getElementById('list');
q.addEventListener('input',()=>{const t=q.value.trim().toLowerCase();let shown=0;
for(const sec of list.children){let vis=0;
for(const c of sec.querySelectorAll('.card')){const m=!t||c.dataset.t.includes(t);c.classList.toggle('hide',!m);if(m){vis++;shown++}}
sec.classList.toggle('hide',vis===0)}
nores.classList.toggle('show',shown===0)});
</script>
</body>
</html>`;
}
