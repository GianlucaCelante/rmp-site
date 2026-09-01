# rmp-site

Sito vetrina del gestionale per la ristorazione. Sito statico: HTML, CSS e JS puri, nessun build step.

## Struttura

```
index.html            redirect a sagre/ (finché non esiste una home)
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
  brand/              marchio cèlan: petali, lettere, logo, favicon (png)
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

## Google Analytics e banner cookie

Il tracciamento è gestito da `assets/js/consent.js`, incluso in fondo alla pagina:

```html
<script src="../assets/js/consent.js" data-ga-id="G-XXXXXXXXXX" data-policy-url="../privacy/#cookie"></script>
```

- `data-ga-id` è l'ID misurazione di GA4. Se è vuoto non parte niente: né banner né cookie.
- Lo script di Google viene scaricato solo dopo che l'utente ha premuto "Accetta" (Consent Mode con default `denied`); "Rifiuta" ha la stessa evidenza. La scelta vive in `localStorage` (`rmp-consent`) per 6 mesi.
- Il link "Preferenze cookie" nel footer (`data-consent-open`) riapre il banner.

Oggi lo include solo `sagre/`, con l'ID vuoto. La landing pizzerie e l'informativa cèlan **non** lo includono: il mockup ha tolto anche i font di Google per non passare l'IP dei visitatori a terzi, e l'informativa dichiara che il sito non usa cookie. Accendere le statistiche lì vuol dire prima riscrivere la sezione "Cookie" dell'informativa.

## Note

- Il form "Richiedi il preventivo" invia a `data-endpoint` del `<form id="quoteForm">` (l'URL del Worker in `worker/`). Finché l'attributo è vuoto l'invio è simulato.
- `privacy/index.html` contiene ancora i segnaposto tra parentesi quadre (data di pubblicazione, ragione sociale, indirizzo, P.IVA, hosting, fornitore email): vanno compilati prima di pubblicare.
- Il marchio del prodotto è **cèlan** (dominio www.celan.it, contatti celan.rmp@gmail.com). La landing sagre porta ancora il vecchio nome "Infornato" in `<title>`, nella nav e nel footer: va rifatta con il marchio nuovo.
