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
assets/               risorse condivise tra le sezioni
  css/fonts.css       @font-face dei webfont auto-hostati
  fonts/              Anton 400 e Archivo 400-700 (woff2, licenza OFL)
  js/lenis.min.js     Lenis 1.3.17 (smooth scroll)
  favicon.svg         favicon sagre (accento ambra)
  favicon-pizzerie.svg  favicon pizzerie (accento rosso)
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

## Note

- Il form "Richiedi il preventivo scritto" non è ancora collegato a un endpoint: in `sagre/js/sagre.js` la submit simula l'invio riuscito (vedi il `TODO`).
- Il nome "Infornato" è provvisorio, in attesa del nome ufficiale. Compare in `<title>`, nel logo della nav e nella firma sotto il form.
