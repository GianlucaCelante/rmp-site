// Build del sito per il deploy: copia il sito in dist/, poi per ogni pagina
//  - unisce i fogli di stile in un solo css/bundle.css (url() riscritti) e lo minifica;
//  - minifica gli script locali (consent.js, home.js, ...).
// Poi genera dist/sitemap.xml e controlla le pagine indicizzabili: se manca qualcosa di
// essenziale (title, canonical, og:image, JSON-LD, endpoint del form) il build FALLISCE.
// I sorgenti restano leggibili e il sito funziona anche aperto cosi' com'e' (senza build).
import { cpSync, rmSync, readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, relative, resolve, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const SITE = 'https://celan.it';
const PAGES = ['index.html', 'sagre/index.html', 'pizzerie/index.html', 'privacy/index.html',
               'guide/index.html', 'guide/cassa-per-sagre/index.html', 'guide/coda-forno-asporto/index.html'];
const ESCLUDI = new Set(['.git', '.github', 'build', 'worker', 'dist', 'node_modules', 'README.md', '.gitignore', '.idea', '.vscode',
                         '.claude', '.playwright-mcp', 'uc.js']);

/* URL canonico atteso di una pagina: index.html -> /, sagre/index.html -> /sagre/ */
const urlAtteso = (page) => SITE + '/' + page.replace(/index\.html$/, '');
const errori = [];
const controlli = []; // { page, html } delle pagine gia' trasformate

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
for (const voce of readdirSync(ROOT)) {
  if (ESCLUDI.has(voce)) continue;
  cpSync(join(ROOT, voce), join(DIST, voce), { recursive: true });
}

const kb = (n) => (n / 1024).toFixed(1) + ' KiB';
let prima = 0, dopo = 0;

/* riscrive gli url() di un css perche' restino validi dal nuovo percorso */
function riscriviUrl(css, daDir, aDir) {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (m, q, u) => {
    if (/^(data:|https?:|\/\/|#|\/)/i.test(u)) return m;
    const [pathPart, ...rest] = u.split(/(?=[?#])/);
    const assoluto = resolve(daDir, pathPart);
    const nuovo = relative(aDir, assoluto).split('\\').join('/');
    return `url(${q}${nuovo}${rest.join('')}${q})`;
  });
}


/* Toglie dal css le regole che non possono avere effetto: quelle in cui ogni
   selettore cita una classe o un id che non compare ne' nell'html ne' nel js
   della pagina. Si guarda solo fuori da :not()/:is()/:where()/:has(), e se il js
   compone nomi di classe a pezzi ('is-' + x) si tengono tutte le classi con quel prefisso. */
function potaCss(css, corpus) {
  const token = new Set(corpus.match(/[A-Za-z_][\w-]*/g) || []);
  const prefissi = [...corpus.matchAll(/['"]([\w-]*[-_])['"]\s*\+/g)].map((m) => m[1]);
  const esiste = (t) => token.has(t) || prefissi.some((p) => t.startsWith(p));
  const root = postcss.parse(css);
  let tolte = 0;
  root.walkRules((rule) => {
    if (rule.parent && rule.parent.type === 'atrule' && /keyframes$/i.test(rule.parent.name)) return;
    let tuttiMorti = true;
    selectorParser((sels) => {
      sels.each((sel) => {
        let morto = false;
        sel.walk((nd) => {
          if (nd.type !== 'class' && nd.type !== 'id') return;
          for (let a = nd.parent; a; a = a.parent) if (a.type === 'pseudo') return;
          if (!esiste(nd.value)) morto = true;
        });
        if (!morto) tuttiMorti = false;
      });
    }).processSync(rule.selector);
    if (tuttiMorti && rule.selector.trim()) { rule.remove(); tolte++; }
  });
  root.walkAtRules((a) => { if (a.nodes && a.nodes.length === 0) a.remove(); });
  return { css: root.toString(), tolte };
}

const jsFatti = new Set();
function minJs(file) {
  if (jsFatti.has(file) || /\.min\.js$/.test(file)) return;
  jsFatti.add(file);
  const src = readFileSync(file, 'utf8');
  const out = transformSync(src, { loader: 'js', minify: true, legalComments: 'none' }).code;
  prima += Buffer.byteLength(src); dopo += Buffer.byteLength(out);
  writeFileSync(file, out);
}

for (const page of PAGES) {
  const htmlPath = join(DIST, page);
  const dir = dirname(htmlPath);
  let html = readFileSync(htmlPath, 'utf8');

  /* testo da cui si decide cosa e' morto: html + js sorgente della pagina */
  let corpus = readFileSync(join(ROOT, page), 'utf8');
  for (const m of corpus.matchAll(/<script src="([^"]+)"/g)) {
    const f = resolve(join(ROOT, dirname(page)), m[1]);
    if (existsSync(f)) corpus += '\n' + readFileSync(f, 'utf8');
  }

  /* --- CSS: tutti i <link rel="stylesheet"> locali, nell'ordine --- */
  const re = /<link rel="stylesheet" href="([^"]+)">\n?/g;
  const bundleDir = join(dir, 'css');
  const bundlePath = join(bundleDir, 'bundle.css');
  let css = '';
  let primo = true;
  html = html.replace(re, (m, href) => {
    if (/^(https?:)?\/\//.test(href)) return m;
    const f = resolve(dir, href);
    if (!existsSync(f)) throw new Error(`${page}: css mancante ${href}`);
    const txt = readFileSync(join(ROOT, relative(DIST, f)), 'utf8'); // sorgente originale
    css += riscriviUrl(txt, dirname(f), bundleDir) + '\n';
    prima += Buffer.byteLength(txt);
    if (primo) { primo = false; return '<link rel="stylesheet" href="css/bundle.css">\n'; }
    return '';
  });
  const potato = potaCss(css, corpus);
  const outCss = transformSync(potato.css, { loader: 'css', minify: true, legalComments: 'none' }).code;
  mkdirSync(bundleDir, { recursive: true });
  writeFileSync(bundlePath, outCss);
  dopo += Buffer.byteLength(outCss);

  /* --- JS locali --- */
  for (const m of html.matchAll(/<script src="([^"]+)"/g)) {
    if (/^(https?:)?\/\//.test(m[1])) continue;
    minJs(resolve(dir, m[1]));
  }
  writeFileSync(htmlPath, html);
  controlli.push({ page, html });
  console.log(`${page.padEnd(20)} css ${kb(Buffer.byteLength(outCss))} (${potato.tolte} regole tolte)`);
}

/* i css sorgente non servono piu' in dist (restano solo i bundle) */
for (const f of ['css/home.css', 'sagre/css/sagre.css', 'pizzerie/css/pizzerie.css', 'privacy/css/privacy.css',
                 'assets/css/common.css', 'assets/css/bottoni.css', 'assets/css/consent.css', 'assets/css/fonts.css',
                 'guide/css/guide.css']) {
  rmSync(join(DIST, f), { force: true });
}
console.log(`totale css+js: ${kb(prima)} -> ${kb(dopo)}`);

/* ------------------------------------------------------------------
   Controlli: ogni errore e' una riga chiara, poi il build esce con codice 1.
   ------------------------------------------------------------------ */
const meta = (html, re) => { const m = re.exec(html); return m ? m[1].trim() : ''; };
const indicizzabili = [];

for (const { page, html } of controlli) {
  const noindex = /<meta\s+name="robots"\s+content="[^"]*noindex/i.test(html);

  /* ogni form deve avere un endpoint https non vuoto (bug del 31/10: era stato svuotato sostituendo il markup) */
  for (const m of html.matchAll(/<form\b[^>]*>/g)) {
    const ep = /\sdata-endpoint="([^"]*)"/.exec(m[0]);
    if (!ep || !/^https:\/\/\S+$/.test(ep[1].trim())) {
      errori.push(`${page}: il <form> non ha un data-endpoint https:// valido (trovato: ${ep ? JSON.stringify(ep[1]) : 'attributo assente'}). Senza endpoint l'invio e' solo simulato.`);
    }
  }

  if (noindex) continue;
  indicizzabili.push(page);
  const atteso = urlAtteso(page);

  if (!meta(html, /<title>([^<]*)<\/title>/)) errori.push(`${page}: <title> mancante o vuoto`);
  if (!meta(html, /<meta\s+name="description"\s+content="([^"]*)"/)) errori.push(`${page}: meta description mancante o vuota`);
  const nH1 = (html.match(/<h1[\s>]/g) || []).length;
  if (nH1 !== 1) errori.push(`${page}: servono esattamente un <h1>, ce ne sono ${nH1}`);

  const canon = meta(html, /<link\s+rel="canonical"\s+href="([^"]*)"/);
  if (canon !== atteso) errori.push(`${page}: canonical ${JSON.stringify(canon)} diverso da quello atteso ${atteso}`);

  const og = meta(html, /<meta\s+property="og:image"\s+content="([^"]*)"/);
  if (!og) errori.push(`${page}: og:image mancante`);
  else if (!og.startsWith(SITE + '/')) errori.push(`${page}: og:image deve essere un URL assoluto su ${SITE}/ (trovato ${og})`);
  else if (!existsSync(join(DIST, og.slice(SITE.length + 1)))) errori.push(`${page}: il file di og:image non esiste in dist (${og})`);

  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(m[1]); } catch (e) { errori.push(`${page}: JSON-LD non valido (${e.message})`); }
  }
}

/* sitemap.xml: solo le pagine indicizzabili. lastmod = data dell'ultimo commit che ha toccato il
   sorgente html (mai la data del build); senza storia completa o senza commit si omette. */
let shallow = true;
try { shallow = execFileSync('git', ['rev-parse', '--is-shallow-repository'], { cwd: ROOT, encoding: 'utf8' }).trim() !== 'false'; } catch { /* niente git: niente lastmod */ }
function ultimaModifica(page) {
  if (shallow) return '';
  try { return execFileSync('git', ['log', '-1', '--format=%cs', '--', page], { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return ''; }
}
const righe = indicizzabili.map((p) => {
  const d = ultimaModifica(p);
  return `  <url>\n    <loc>${urlAtteso(p)}</loc>\n${d ? `    <lastmod>${d}</lastmod>\n` : ''}  </url>`;
});
writeFileSync(join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${righe.join('\n')}\n</urlset>\n`);
console.log(`sitemap.xml: ${indicizzabili.length} pagine${shallow ? ' (repo shallow: lastmod omesso)' : ''}`);

if (errori.length) {
  console.error(`\nBUILD FALLITO: ${errori.length} problema/i\n` + errori.map((e) => '  - ' + e).join('\n'));
  process.exit(1);
}
