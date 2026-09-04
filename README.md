# rmp-site

Sito vetrina del gestionale per la ristorazione. Sito statico: HTML, CSS e JS puri, nessun build step.

## Struttura

```
index.html            redirect a pizzerie/ (finché non esiste una home vera)
sagre/                landing "sagre e feste di paese" (marchio Infornato)
  index.html
  css/sagre.css       stile della landing
  js/sagre.js         motion layer, carosello tablet, form
  img/                screenshot demo (hero KDS, 6 slide cassa, totem)
pizzerie/             landing "pizzerie, ristoranti e locali" (marchio cèlan)
  index.html
  css/pizzerie.css
  js/pizzerie.js
  img/                fetta, pomodoro, palmare, 6 schermate del gestionale
privacy/              informativa privacy e cookie (linkata da checkbox e footer)
  index.html
  css/privacy.css
assets/               risorse condivise tra le sezioni
  brand/              marchio cèlan: petali, lettere, logo, favicon (png + svg)
  css/fonts.css       @font-face dei webfont auto-hostati
  css/consent.css     stile del banner cookie
  js/consent.js       banner cookie + Google Analytics 4 (caricato solo dopo il consenso)
  fonts/              Anton 400 e Archivo 400-700 (woff2, licenza OFL)
  js/lenis.min.js     Lenis 1.3.17 (smooth scroll)
  favicon.svg         favicon sagre (accento ambra)
worker/               Cloudflare Worker che inoltra il form con Brevo (vedi worker/README.md)
.github/workflows/
  deploy.yml          deploy su GitHub Pages
```

Ogni verticale è autonomo: una cartella con `index.html`, `css/`, `js/`, `img/`. Le due landing condividono la stessa impalcatura (nav, hero, tablet, formule, FAQ, form) ma con stile e testi propri, per questo CSS e JS sono per cartella e non condivisi; in `assets/` sta solo ciò che è davvero comune. Le prossime sezioni seguono lo stesso schema.

`pizzerie/` e `privacy/` sono la trascrizione dei mockup finali (`celan-master.html` e `privacy.html`): markup, CSS e JS sono quelli del mockup, cambiano solo i percorsi, perché font e immagini stanno in file veri invece che in base64 dentro la pagina. Chi li modifica tenga allineato il mockup, o il prossimo giro di design ripartirà da una versione vecchia.

## Sviluppo in locale

Basta aprire `pizzerie/index.html` nel browser. Meglio servirlo via HTTP, così font e immagini si caricano come in produzione:

- da IntelliJ: tasto destro su `pizzerie/index.html` → *Open In* → *Browser* (usa il server integrato dell'IDE);
- da terminale, con Node installato: `npx serve .` e poi <http://localhost:3000/pizzerie/>.

## Branch e deploy

- `master`: produzione. Ogni push avvia il workflow `deploy.yml` che pubblica il sito su GitHub Pages.
- `develop`: sviluppo. I branch di feature si staccano da `develop` e vi rientrano con pull request; `develop` viene poi unito in `master` per la pubblicazione.

Prima del primo deploy, nelle impostazioni del repository GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Statistiche e banner cookie

Le visite si contano con Google Analytics 4 (ID `G-4ZMKC3B4FJ`), acceso da `assets/js/consent.js`, incluso in fondo a sagre, pizzerie e privacy:

```html
<script src="../assets/js/consent.js" data-ga-id="G-4ZMKC3B4FJ" data-policy-url="../privacy/#cookie"></script>
```

- Lo script di Google si scarica **solo dopo** che qualcuno ha premuto "Accetta" (Consent Mode con i default a `denied`): prima non parte nessuna richiesta verso Google e nessun cookie viene creato.
- "Accetta" e "Rifiuta" hanno la stessa evidenza, come chiedono le linee guida del Garante; chiudere senza scegliere vale come rifiuto. La scelta sta in `localStorage` (`rmp-consent`) e dura 6 mesi.
- Il link "Preferenze cookie" nel footer (`data-consent-open`) riapre il banner.
- Svuotare `data-ga-id` spegne tutto: niente banner, niente cookie, niente Google.
- I webfont restano auto-hostati: anche col consenso, il sito non chiede i caratteri a Google.
- La sezione "Cookie" di `privacy/index.html` descrive questo comportamento: se cambia, va aggiornata.

## Note

- Il form "Richiedi il preventivo" invia al Worker in `worker/` (`data-endpoint` del `<form id="quoteForm">`), collegato dal 2/9/2026: avviso al titolare, conferma al richiedente, contatto nella lista Brevo "Preventivi sito". Svuotare l'attributo torna all'invio simulato, comodo per le anteprime.
- `privacy/index.html` è compilata: titolare, indirizzo, conservazione, fornitori. Nessun segnaposto aperto. La P.IVA non c'è perché il titolare non ne ha ancora una: quando arriva va aggiunta al punto 1.
- Le immagini del sito sono in **WebP**, scelto per quello che contengono: le schermate del gestionale in «quasi senza perdita» (misurato: nessun pixel si scosta più di 6 su 255), le foto scontornate con perdita a qualità 90, marchi e loghi senza perdita, che su una tinta piatta è anche più piccolo. Restano PNG solo la favicon, l'icona Apple e il logo delle email, dove il WebP non arriva. Chi aggiunge immagini segua lo stesso criterio.
- Il marchio del prodotto è **cèlan** (dominio www.celan.it, contatti celan.rmp@gmail.com). La landing sagre porta ancora il vecchio nome "Infornato" in `<title>`, nella nav e nel footer, e non è linkata da nessuna parte: va rifatta con il marchio nuovo.
