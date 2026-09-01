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
  brand/              marchio cèlan: petali, lettere, logo, favicon (png)
  css/fonts.css       @font-face dei webfont auto-hostati
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

## Niente statistiche, niente cookie

Il sito non usa cookie, né strumenti di statistica o di tracciamento, e nemmeno i font di Google: i webfont sono in `assets/fonts/`, così la visita non manda l'indirizzo IP a server terzi. È quello che dichiara `privacy/index.html`, ed è il motivo per cui non c'è un banner da accettare.

Se un giorno servono le statistiche: il banner con Google Consent Mode e GA4 c'era, è stato tolto il 1/9/2026 e si recupera dalla storia di git (`git show <commit>^:assets/js/consent.js`). Va rimessa anche la sezione "Cookie" dell'informativa, che oggi dichiara il contrario.

## Note

- Il form "Richiedi il preventivo" invia a `data-endpoint` del `<form id="quoteForm">` (l'URL del Worker in `worker/`). Finché l'attributo è vuoto l'invio è simulato.
- `privacy/index.html` è compilata: titolare, indirizzo, conservazione, fornitori. Nessun segnaposto aperto. La P.IVA non c'è perché il titolare non ne ha ancora una: quando arriva va aggiunta al punto 1.
- Il marchio del prodotto è **cèlan** (dominio www.celan.it, contatti celan.rmp@gmail.com). La landing sagre porta ancora il vecchio nome "Infornato" in `<title>`, nella nav e nel footer, e non è linkata da nessuna parte: va rifatta con il marchio nuovo.
