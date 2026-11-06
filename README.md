# rmp-site

Sito vetrina del gestionale per la ristorazione. Sito statico: HTML, CSS e JS puri. I sorgenti si aprono e si modificano cosi' come sono (nessun build in locale); il deploy li passa da `build/` che minifica e unisce i CSS in `dist/`.

## Struttura

```
index.html            home: gestionale, siti, su misura, chi siamo
css/home.css          stile della home
js/home.js            reveal e nav della home
js/gestionale.js      i due PC della home alternano le schermate
img/                  foto dei PC del gestionale (pizzerie e sagre)
sagre/                landing "sagre e feste di paese" (marchio cèlan)
  index.html
  css/sagre.css       stile della landing
  js/sagre.js         motion layer, carosello tablet, form
  img/                6 slide cassa, totem, foto del PC
pizzerie/             landing "pizzerie, ristoranti e locali" (marchio cèlan)
  index.html
  css/pizzerie.css
  js/pizzerie.js
  img/                palmare, foto del PC, 8 schermate del gestionale
privacy/              informativa privacy e cookie (linkata da checkbox e footer)
  index.html
  css/privacy.css
guide/                guide di approfondimento, in layout di lettura (stesso schema di privacy/)
  index.html          elenco delle guide
  css/guide.css       stile condiviso da elenco e guide
  cassa-per-sagre/    una cartella per guida, con il suo index.html
  coda-forno-asporto/
  food-cost-pizzeria/
404.html              pagina "non trovata": GitHub Pages la serve per ogni percorso inesistente
robots.txt            consente tutto e indica la sitemap (la sitemap.xml la genera il build)
assets/               risorse condivise tra le sezioni
  brand/              marchio cèlan: petali, lettere, logo, favicon (png + svg), anteprime social og-*.png (1200x630)
  css/fonts.css       @font-face dei webfont auto-hostati
  css/common.css      nav, menu a pagina piena, footer (comuni a tutte le pagine)
  css/bottoni.css     bottoni coordinati
  css/consent.css     stile del banner cookie
  js/consent.js       banner cookie + Google Analytics 4 (caricato solo dopo il consenso)
  fonts/              Anton 400 e Archivo 400-700 (woff2, licenza OFL)
  js/lenis.min.js     Lenis 1.3.17 (smooth scroll)
  js/menu.js          menu a pagina piena su telefono
  js/pc.js            scala il PC all-in-one nel suo contenitore
build/                build per il deploy (esbuild): `cd build && npm ci && npm run build` produce `dist/`; lighthouserc.json e' la config di Lighthouse CI
worker/               Cloudflare Worker che inoltra il form con Brevo (vedi worker/README.md)
.github/workflows/
  deploy.yml          deploy su GitHub Pages
  lighthouse.yml      Lighthouse CI su dist/ (pull request e push su master), non blocca il deploy
  worker.yml          test e deploy del Worker su Cloudflare (solo se cambia worker/)
```

Ogni verticale è autonomo: una cartella con `index.html`, `css/`, `js/`, `img/`. La home segue lo stesso schema, solo che la sua cartella è la radice. Le due landing condividono la stessa impalcatura (nav, hero, tablet, formule, FAQ, form) ma con stile e testi propri, per questo CSS e JS sono per cartella e non condivisi; in `assets/` sta solo ciò che è davvero comune. Le prossime sezioni seguono lo stesso schema.

Il repository è l'unica fonte delle pagine: i mockup da cui sono nate non servono più e non vanno riallineati. Le modifiche si fanno direttamente qui.

## Controlli del build e SEO

Il build non si limita a minificare: se una pagina indicizzabile non è a posto **esce con codice 1** e dice cosa manca. Controlla che

- ci siano `<title>` e meta description, e un solo `<h1>`;
- il `link rel="canonical"` sia uguale all'URL atteso (`index.html` → `https://celan.it/`, `sagre/index.html` → `https://celan.it/sagre/`);
- `og:image` sia un URL assoluto e il file esista in `dist/`;
- ogni `<script type="application/ld+json">` si legga come JSON;
- ogni `<form>` abbia un `data-endpoint` che comincia per `https://` (in qualunque pagina, anche `privacy/`).

Le pagine con `noindex` (oggi `privacy/`) restano fuori da questi controlli e dalla sitemap, ma non dal controllo sui form. Le anteprime senza build restano possibili: i controlli girano solo nel build.

**Head SEO ed endpoint del form.** Sostituendo il markup di una pagina, l'head SEO (title, canonical, Open Graph, JSON-LD) e il `data-endpoint` del form non devono andare persi: il 31/10 l'endpoint era stato azzerato e l'invio era diventato simulato senza che nessuno se ne accorgesse. Il build ora fallisce se mancano.

La **sitemap** (`dist/sitemap.xml`) elenca le pagine indicizzabili. `lastmod` è la data dell'ultimo commit che ha toccato il sorgente html della pagina, non quella del build; per questo `deploy.yml` clona con `fetch-depth: 0`. In un clone shallow, o per un file senza commit, `lastmod` si omette.

**Lighthouse CI** (`lighthouse.yml`) gira su ogni pull request e su ogni push in master, sul `dist/` appena costruito: home, sagre, pizzerie e una guida, 3 run ciascuna. SEO sotto 0.9 è un errore, performance e accessibilità sono avvisi. Il report va su `temporary-public-storage` di Google; la config sta in `build/lighthouserc.json` perché nella radice verrebbe pubblicata.

### Aggiungere una guida

1. Crea `guide/<nome>/index.html` partendo da una guida esistente (stesso head, nav e footer, `consent.js`, nessun form). Percorsi relativi con `../../`.
2. Nell'head: `<title>` con `| cèlan`, description, `canonical` assoluto (`https://celan.it/guide/<nome>/`), Open Graph (`og:image` può essere `og-home.png`), JSON-LD `BreadcrumbList` (Home > Guide > titolo) e `Article` con data di pubblicazione e modifica.
3. Aggiungila all'elenco in `guide/index.html`.
4. Aggiungi `guide/<nome>/index.html` a `PAGES` in `build/build.mjs`: la sitemap e i controlli la prendono da lì.
5. Solo fatti che sono già nelle landing o che il titolare ha confermato: niente numeri, clienti o esperienza inventati.

## Sviluppo in locale

Basta aprire `index.html` nel browser. Meglio servirlo via HTTP, così font e immagini si caricano come in produzione:

- da IntelliJ: tasto destro su `pizzerie/index.html` → *Open In* → *Browser* (usa il server integrato dell'IDE);
- da terminale, con Node installato: `npx serve .` e poi <http://localhost:3000/>.

## Branch e deploy

- `master`: produzione. Ogni push avvia il workflow `deploy.yml` che pubblica il sito su GitHub Pages. Se il push tocca `worker/`, parte anche `worker.yml`, che pubblica il Worker del form (vedi `worker/README.md`).
- `develop`: sviluppo. I branch di feature si staccano da `develop` e vi rientrano con pull request; `develop` viene poi unito in `master` per la pubblicazione.

Prima del primo deploy, nelle impostazioni del repository GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Statistiche e banner cookie

Le visite si contano con Google Analytics 4 (ID `G-4ZMKC3B4FJ`), acceso da `assets/js/consent.js`, incluso in fondo a home, sagre, pizzerie e privacy:

```html
<script src="../assets/js/consent.js" data-ga-id="G-4ZMKC3B4FJ" data-policy-url="../privacy/#cookie"></script>
```

- Lo script di Google si scarica **solo dopo** che qualcuno ha premuto "Accetta" (Consent Mode con i default a `denied`): prima non parte nessuna richiesta verso Google e nessun cookie viene creato.
- "Accetta" e "Rifiuta" hanno la stessa evidenza, come chiedono le linee guida del Garante; chiudere senza scegliere vale come rifiuto. La scelta sta in `localStorage` (`rmp-consent`) e dura 6 mesi.
- Il link "Preferenze cookie" nel footer (`data-consent-open`) riapre il banner.
- Svuotare `data-ga-id` spegne tutto: niente banner, niente cookie, niente Google.
- I webfont restano auto-hostati: anche col consenso, il sito non chiede i caratteri a Google.
- La sezione "Cookie" di `privacy/index.html` descrive questo comportamento: se cambia, va aggiornata.
- Quando il form parte davvero (risposta positiva del Worker, non l'invio simulato) e c'è il consenso alle statistiche, `sagre.js` e `pizzerie.js` mandano a GA4 l'evento `generate_lead` con il solo parametro `verticale`: nessun dato personale. Senza consenso non parte nulla. La sezione "Statistiche di visita" della privacy dice che si conta anche l'invio.

## Note

- Il form "Richiedi il preventivo" invia al Worker in `worker/` (`data-endpoint` del `<form id="quoteForm">`), collegato dal 2/9/2026: avviso al titolare, conferma al richiedente, contatto nella lista Brevo "Preventivi sito". Svuotare l'attributo torna all'invio simulato, comodo per le anteprime.
- `privacy/index.html` è compilata: titolare, indirizzo, conservazione, fornitori. Nessun segnaposto aperto. I 12 mesi di conservazione dei contatti Brevo sono applicati dalla pulizia giornaliera del Worker (vedi `worker/README.md`): se cambiano, vanno cambiati insieme privacy e Worker. La P.IVA non c'è perché il titolare non ne ha ancora una: quando arriva va aggiunta al punto 1.
- Le immagini del sito sono in **WebP**, scelto per quello che contengono: le schermate del gestionale in «quasi senza perdita» (misurato: nessun pixel si scosta più di 6 su 255), le foto scontornate con perdita a qualità 90, marchi e loghi senza perdita, che su una tinta piatta è anche più piccolo. Restano PNG solo la favicon, l'icona Apple e il logo delle email, dove il WebP non arriva. Chi aggiunge immagini segua lo stesso criterio.
- Il marchio del prodotto è **cèlan** (dominio www.celan.it, contatti celan.rmp@gmail.com).
