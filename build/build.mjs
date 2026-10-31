// Build del sito per il deploy: copia il sito in dist/, poi per ogni pagina
//  - unisce i fogli di stile in un solo css/bundle.css (url() riscritti) e lo minifica;
//  - minifica gli script locali (consent.js, home.js, ...).
// I sorgenti restano leggibili e il sito funziona anche aperto cosi' com'e' (senza build).
import { cpSync, rmSync, readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const PAGES = ['index.html', 'sagre/index.html', 'pizzerie/index.html', 'privacy/index.html'];
const ESCLUDI = new Set(['.git', '.github', 'build', 'worker', 'dist', 'node_modules', 'README.md', '.gitignore', '.idea', '.vscode']);

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
  console.log(`${page.padEnd(20)} css ${kb(Buffer.byteLength(outCss))} (${potato.tolte} regole tolte)`);
}

/* i css sorgente non servono piu' in dist (restano solo i bundle) */
for (const f of ['css/home.css', 'sagre/css/sagre.css', 'pizzerie/css/pizzerie.css', 'privacy/css/privacy.css',
                 'assets/css/common.css', 'assets/css/bottoni.css', 'assets/css/consent.css', 'assets/css/fonts.css']) {
  rmSync(join(DIST, f), { force: true });
}
console.log(`totale css+js: ${kb(prima)} -> ${kb(dopo)}`);
