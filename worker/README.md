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

Wrangler stampa l'URL del Worker, tipo `https://rmp-site-form.<account>.workers.dev`.

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

## Privacy

Brevo (Sendinblue SAS, Parigi) e Cloudflare (Cloudflare Inc., USA) vanno citati nell'informativa in `privacy/index.html` come responsabili del trattamento.
