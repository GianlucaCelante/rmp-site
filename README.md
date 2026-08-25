# rmp-site

Sito vetrina del gestionale per la ristorazione. Sito statico: HTML, CSS e JS puri, nessun build step.

## Struttura

```
index.html            redirect a sagre/ (finché non esiste una home)
sagre/                landing "sagre e feste di paese"
  index.html
  css/sagre.css       stile della landing
  js/sagre.js         motion layer, carosello tablet, form
  img/                screenshot demo (hero KDS, 6 slide cassa, totem)
pizzerie/             landing "pizzerie e ristoranti"
  index.html
  css/pizzerie.css
  js/pizzerie.js
  img/                screenshot gestionale, palmare, fetta e pomodoro 3D
privacy/              informativa privacy e cookie (linkata da checkbox e footer)
  index.html
  css/privacy.css
assets/               risorse condivise tra le sezioni
  css/fonts.css       @font-face dei webfont auto-hostati
  css/consent.css     stile del banner cookie
  js/consent.js       banner cookie + Google Analytics 4 (caricato solo dopo il consenso)
  fonts/              Anton 400 e Archivo 400-700 (woff2, licenza OFL)
  js/lenis.min.js     Lenis 1.3.17 (smooth scroll)
  favicon.svg         favicon sagre (accento ambra)
  favicon-pizzerie.svg  favicon pizzerie (accento rosso)
worker/               Cloudflare Worker che inoltra il form con Brevo (vedi worker/README.md)
.github/workflows/
  deploy.yml          deploy su GitHub Pages
```

Ogni verticale è autonomo: una cartella con `index.html`, `css/`, `js/`, `img/`. Le due landing condividono la stessa impalcatura (nav, hero, tablet, formule, FAQ, form) ma con stile e testi propri, per questo CSS e JS sono per cartella e non condivisi; in `assets/` sta solo ciò che è davvero comune. Le prossime sezioni seguono lo stesso schema.

## Sviluppo in locale

Basta aprire `sagre/index.html` nel browser. Meglio servirlo via HTTP, così font e immagini si caricano come in produzione:

- da IntelliJ: tasto destro su `sagre/index.html` → *Open In* → *Browser* (usa il server integrato dell'IDE);
- da terminale, con Node installato: `npx serve .` e poi <http://localhost:3000/sagre/>.

## Branch e deploy

- `master`: produzione. Ogni push avvia il workflow `deploy.yml` che pubblica il sito su GitHub Pages.
- `develop`: sviluppo. I branch di feature si staccano da `develop` e vi rientrano con pull request; `develop` viene poi unito in `master` per la pubblicazione.

Prima del primo deploy, nelle impostazioni del repository GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Google Analytics e banner cookie

Il tracciamento è gestito da `assets/js/consent.js`, incluso in fondo a ogni pagina:

```html
<script src="../assets/js/consent.js" data-ga-id="G-XXXXXXXXXX" data-policy-url="../privacy/#cookie"></script>
```

- `data-ga-id` è l'ID misurazione di GA4. Se è vuoto non parte niente: né banner né cookie.
- Lo script di Google viene scaricato solo dopo che l'utente ha premuto "Accetta" (Consent Mode con default `denied`); "Rifiuta" ha la stessa evidenza. La scelta vive in `localStorage` (`rmp-consent`) per 6 mesi.
- Il link "Preferenze cookie" nel footer (`data-consent-open`) riapre il banner.
- L'informativa in `privacy/index.html` va aggiornata se cambiano i servizi usati (form, analytics, video incorporati).

## Note

- Il form "Richiedi il preventivo scritto" invia a `data-endpoint` del `<form id="quoteForm">` (l'URL del Worker in `worker/`). Finché l'attributo è vuoto l'invio è simulato.
- `privacy/index.html` contiene ancora i segnaposto tra parentesi quadre (titolare, indirizzo, P.IVA, email, servizio di inoltro del modulo): vanno compilati prima di pubblicare.
- Il nome "Infornato" è provvisorio, in attesa del nome ufficiale. Compare in `<title>`, nel logo della nav e nella firma sotto il form.
