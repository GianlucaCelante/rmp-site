# Worker del form preventivo

Cloudflare Worker che riceve il modulo "Richiedi il preventivo" delle landing e lo inoltra con Brevo: avviso al Titolare, conferma al richiedente, contatto salvato in Brevo. La chiave API di Brevo resta qui, nei secret del Worker: nel sito non c'è.

## Prerequisiti

- Account Cloudflare (piano gratuito: 100.000 richieste/giorno).
- Account Brevo con un **mittente verificato** (Impostazioni → Mittenti e IP). Finché non c'è il dominio del prodotto va bene un indirizzo singolo; con il dominio, aggiungere i record SPF/DKIM/DMARC che Brevo indica.
- Chiave API Brevo (Impostazioni → Chiavi API → Genera).
- In Brevo, creare gli attributi contatto usati dal Worker (Contatti → Impostazioni → Attributi): `NOME`, `LOCALE`, `CITTA`, `TELEFONO`, `FORMULA`, `AGGIUNTE`, `VERTICALE`, `ORIGINE` (tutti testo). Facoltativo: una lista "Preventivi sito" e annotarne l'ID.
- Node 18+ (per `npx wrangler` e per i test).

## Test senza Cloudflare

```
cd worker
npm test
```

Simula le chiamate a Brevo e verifica CORS, honeypot, validazione, contenuto delle email, limite di frequenza.

## Configurazione

1. Compilare `[vars]` in `wrangler.toml`: `NOTIFY_TO` (chi riceve gli avvisi), `SENDER_EMAIL` (mittente verificato in Brevo), `ALLOWED_ORIGINS` (origini del sito, separate da virgola), `BREVO_LIST_ID` se si usa una lista.
2. Accesso a Cloudflare e secret:

```
cd worker
npx wrangler login
npx wrangler secret put BREVO_API_KEY
```

3. Deploy:

```
npx wrangler deploy
```

Il Worker gira sull'account Cloudflare di `celan.rmp@gmail.com` e risponde su `https://form.celan.it` (`routes` in `wrangler.toml`). La lista e il mittente stanno sul Brevo dello stesso titolare.

Dopo il primo deploy non serve piu' farlo a mano: ogni push su `master` che tocca `worker/` avvia `.github/workflows/worker.yml`, che fa girare i test e, se passano, pubblica il Worker. Si puo' lanciare anche a mano dal tab Actions ("Deploy del Worker su Cloudflare" → Run workflow). Il workflow entra in Cloudflare con un token nei secret del repository:

- in Cloudflare: My Profile → API Tokens → Create Token → modello **Edit Cloudflare Workers**, account e zone del sito;
- in GitHub: Settings → Secrets and variables → Actions → New repository secret, nome `CLOUDFLARE_API_TOKEN` (oppure `gh secret set CLOUDFLARE_API_TOKEN`).

L'account (`account_id`) sta in `wrangler.toml`. La chiave Brevo resta nei secret del Worker: il deploy non la tocca.

4. Nel sito, mettere quell'URL nell'attributo `data-endpoint` del `<form id="quoteForm">` di `sagre/index.html` e `pizzerie/index.html`. Con `data-endpoint` vuoto l'invio è simulato (utile per anteprime).

## Prova locale

```
cd worker
npm run dev
```

Avvia il Worker su `http://localhost:8787` in `DRY_RUN` (valida, risponde ok, non chiama Brevo) e senza restrizione di origine. Mettere `http://localhost:8787` in `data-endpoint` per provare il form dal sito servito in locale.

## Protezione dallo spam

- Campo honeypot `website` nel form: se un bot lo compila, il Worker risponde ok senza fare nulla.
- Limite di 5 invii per IP ogni 10 minuti, per isolate (best-effort). Per una protezione affidabile aggiungere nel pannello Cloudflare una regola **Rate limiting** sul Worker, e in caso di abusi il widget **Turnstile** (captcha invisibile, gratuito).

## Cancellazione automatica dei contatti (12 mesi)

L'informativa promette che i contatti della lista Brevo "Preventivi sito" (`BREVO_LIST_ID`) spariscono 12 mesi dopo l'ultima richiesta. Lo fa l'handler `scheduled` (`src/retention.js`), lanciato dal cron di `wrangler.toml` ogni giorno alle 03:00 UTC.

Come funziona:

1. Legge la lista a pagine da 500 (`GET /contacts/lists/{id}/contacts`, ordine di creazione) e solo dopo agisce, cosi' la paginazione non slitta quando si cancella.
2. Scaduto = `modifiedAt` anteriore a 12 mesi di calendario (il contatto viene aggiornato a ogni nuova richiesta).
3. Scaduto e solo in questa lista: `DELETE /contacts/{email}`. Scaduto e anche in altre liste: lo toglie solo da questa (`POST /contacts/lists/{id}/contacts/remove`, a gruppi di 50) e non lo cancella.
4. Contatto senza `modifiedAt` leggibile (o senza `listIds`): non lo tocca, lo conta come saltato.
5. Massimo 40 sottorichieste a esecuzione (il piano gratuito Cloudflare ne ammette 50); cio' che avanza va al giro dopo.
6. Nei log solo conteggi (letti, scaduti, cancellati, tolti dalla lista, saltati, errori, rimandati): mai email. Un errore su un contatto non ferma gli altri; a fine giro, se ci sono errori, l'esecuzione fallisce e si vede nei log di Cloudflare.
7. Senza `BREVO_LIST_ID` o `BREVO_API_KEY` esce senza fare nulla. Con `RETENTION_DRY_RUN = "true"` conta soltanto.

**Regola per i clienti.** Chi diventa cliente va tolto dalla lista "Preventivi sito" oppure messo anche in un'altra lista prima della scadenza: altrimenti, passati 12 mesi dall'ultima richiesta, viene cancellato (o, se e' in un'altra lista, tolto da questa).

**Email in Gmail.** Le email di avviso nella casella `celan.rmp@gmail.com` non passano da questo meccanismo. Le toglie `gmail/pulizia-preventivi.gs`, un Google Apps Script gia' installato su quell'account. Se l'avviso va anche a un'altra casella, va installato anche li':

1. Con l'account della casella apri <https://script.google.com> → **Nuovo progetto**, incolla il file e salva.
2. Scegli `pulisciPreventivi` e premi **Esegui**: Google chiede di autorizzare l'accesso a Gmail. Lo script parte in prova (`PROVA = true`) e nel log elenca cosa sposterebbe, senza toccare nulla.
3. Se l'elenco e' giusto metti `PROVA = false`, salva, scegli `installa` e premi **Esegui**: da allora gira ogni notte.

Sposta nel cestino le conversazioni il cui ultimo messaggio ha piu' di 11 mesi: Gmail svuota il cestino dopo 30 giorni, quindi si resta dentro i 12 mesi. Chi diventa cliente: etichetta `cliente` sulla conversazione, e lo script la salta.

Prova locale (senza `BREVO_API_KEY` esce senza chiamare Brevo; con la chiave usare `--var RETENTION_DRY_RUN:true`, che legge la lista ma non scrive):

```
cd worker
npx wrangler dev --test-scheduled
curl "http://localhost:8787/__scheduled?cron=0+3+*+*+*"
```

## Privacy

Brevo (Sendinblue SAS, Parigi) e Cloudflare (Cloudflare Inc., USA) vanno citati nell'informativa in `privacy/index.html` come responsabili del trattamento.
