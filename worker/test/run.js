/* Test del Worker senza Cloudflare: Node 18+ ha Request/Response/fetch.
   Le chiamate a Brevo sono intercettate da un finto fetch. Esegui con
   `npm test` dentro worker/. */
import worker from '../src/index.js';
import assert from 'node:assert/strict';

const calls = [];
globalThis.fetch = async (url, init) => {
  calls.push({ url, body: JSON.parse(init.body), headers: init.headers });
  if (globalThis.__failBrevo) return new Response('boom', { status: 500 });
  return new Response('{}', { status: 201, headers: { 'content-type': 'application/json' } });
};

const env = {
  ALLOWED_ORIGINS: 'https://gianlucacelante.github.io',
  NOTIFY_TO: 'owner@example.com',
  SENDER_EMAIL: 'noreply@example.com',
  SENDER_NAME: 'Infornato',
  SITE_NAME: 'Infornato',
  SEND_CONFIRMATION: 'true',
  BREVO_LIST_ID: '7',
  BREVO_API_KEY: 'xkeysib-fake',
  DRY_RUN: 'false'
};
const ORIGIN = 'https://gianlucacelante.github.io';
function req(method, body, origin = ORIGIN, ip = '1.2.3.4') {
  const headers = { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip };
  if (origin) headers.Origin = origin;
  return new Request('https://form.example.workers.dev/', { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}
const lead = { nome: 'Mario', locale: 'Sagra del Pesce, Caorle', email: 'mario@example.it', esperienza: 'completa', verticale: 'sagre', pagina: 'https://x/sagre/' };
const leadPizza = {
  nome: 'Giulia', locale: 'Da Ottavio', citta: 'Nervesa della Battaglia',
  email: 'giulia@example.it', telefono: '0422 885 200', esperienza: 'completo',
  aggiunte: ['Ordini online', 'Fatture e documenti'],
  verticale: 'pizzerie', pagina: 'https://x/pizzerie/'
};
let n = 0;
async function t(name, fn) { await fn(); n++; console.log('ok -', name); }

await t('preflight CORS', async () => {
  const r = await worker.fetch(req('OPTIONS'), env);
  assert.equal(r.status, 204);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), ORIGIN);
});
await t('GET rifiutato', async () => {
  assert.equal((await worker.fetch(req('GET'), env)).status, 405);
});
await t('origine non autorizzata', async () => {
  const r = await worker.fetch(req('POST', lead, 'https://evil.example'), env);
  assert.equal(r.status, 403);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), null);
});
await t('JSON malformato', async () => {
  const r = await fetchRaw('{nope');
  assert.equal(r.status, 400);
});
await t('honeypot: finto successo, nessuna chiamata', async () => {
  calls.length = 0;
  const r = await worker.fetch(req('POST', { ...lead, website: 'http://spam' }), env);
  assert.equal(r.status, 200);
  assert.equal(calls.length, 0);
});
await t('validazione: email e formula', async () => {
  const r = await worker.fetch(req('POST', { ...lead, email: 'mario@', esperienza: 'boh' }), env);
  assert.equal(r.status, 400);
  assert.deepEqual((await r.json()).fields, ['email', 'esperienza']);
});
await t('DRY_RUN: ok senza Brevo', async () => {
  calls.length = 0;
  const r = await worker.fetch(req('POST', lead), { ...env, DRY_RUN: 'true' });
  const j = await r.json();
  assert.equal(r.status, 200);
  assert.equal(j.dryRun, true);
  assert.equal(calls.length, 0);
});
await t('invio completo: avviso + contatto + conferma', async () => {
  calls.length = 0;
  const r = await worker.fetch(req('POST', lead, ORIGIN, '9.9.9.9'), env);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).ok, true);
  const paths = calls.map((c) => c.url.replace('https://api.brevo.com/v3', '')).sort();
  assert.deepEqual(paths, ['/contacts', '/smtp/email', '/smtp/email']);
  const notify = calls.find((c) => c.body.to && c.body.to[0].email === 'owner@example.com');
  assert.equal(notify.body.replyTo.email, 'mario@example.it');
  assert.match(notify.body.subject, /\[Infornato\] Sagra del Pesce, Caorle - richiesta di preventivo/);
  assert.match(notify.body.htmlContent, /Festa M/);
  /* il marchio arriva dal sito, non incorporato: se sparisce l'immagine
     l'email deve restare leggibile, quindi c'e' anche l'alt */
  assert.match(notify.body.htmlContent, /https:\/\/celan\.it\/assets\/brand\/logo-celan-email\.png/);
  assert.match(notify.body.htmlContent, /alt="c&egrave;lan"/);
  const confirm = calls.find((c) => c.body.to && c.body.to[0].email === 'mario@example.it');
  assert.match(confirm.body.textContent, /due giorni lavorativi/);
  /* il mittente e' un noreply senza casella: le risposte devono tornare
     al primo indirizzo degli avvisi, non nel vuoto */
  assert.equal(confirm.body.replyTo.email, 'owner@example.com');
  const contact = calls.find((c) => c.url.endsWith('/contacts'));
  assert.deepEqual(contact.body.listIds, [7]);
  assert.equal(contact.body.attributes.FORMULA, 'Festa M');
  assert.equal(contact.headers['api-key'], 'xkeysib-fake');
});
await t('HTML nei campi viene neutralizzato', async () => {
  calls.length = 0;
  await worker.fetch(req('POST', { ...lead, nome: '<img src=x onerror=1>' }, ORIGIN, '8.8.8.8'), env);
  const notify = calls.find((c) => c.body.to && c.body.to[0].email === 'owner@example.com');
  /* il guscio ha una sua <img>, il logo: quello che non deve esistere e'
     un secondo tag nato dal campo compilato */
  const tagImg = notify.body.htmlContent.match(/<img[^>]*>/g) || [];
  assert.equal(tagImg.length, 1);
  assert.match(tagImg[0], /logo-celan-email.png/);
  assert.match(notify.body.htmlContent, /&lt;img src=x onerror=1&gt;/);
});
await t('avviso fallito -> 502', async () => {
  globalThis.__failBrevo = true;
  const r = await worker.fetch(req('POST', lead, ORIGIN, '7.7.7.7'), env);
  globalThis.__failBrevo = false;
  assert.equal(r.status, 502);
});
await t('pizzerie: citta e telefono obbligatori', async () => {
  const r = await worker.fetch(req('POST', { ...leadPizza, citta: '', telefono: '123' }, ORIGIN, '4.4.4.1'), env);
  assert.equal(r.status, 400);
  assert.deepEqual((await r.json()).fields, ['citta', 'telefono']);
});
await t('pizzerie: invio completo con aggiunte', async () => {
  calls.length = 0;
  const r = await worker.fetch(req('POST', leadPizza, ORIGIN, '4.4.4.2'), env);
  assert.equal(r.status, 200);
  const notify = calls.find((c) => c.body.to && c.body.to[0].email === 'owner@example.com');
  assert.match(notify.body.textContent, /Citt\u00e0: Nervesa della Battaglia/);
  assert.match(notify.body.textContent, /Telefono: 0422 885 200/);
  assert.match(notify.body.textContent, /Aggiunte: Ordini online, Fatture e documenti/);
  assert.match(notify.body.subject, /Da Ottavio, Nervesa della Battaglia - richiesta di preventivo/);
  const confirm = calls.find((c) => c.body.to && c.body.to[0].email === 'giulia@example.it');
  assert.match(confirm.body.textContent, /un giorno lavorativo/);
  assert.match(confirm.body.textContent, /Canone completo/);
  const contact = calls.find((c) => c.url.endsWith('/contacts'));
  assert.equal(contact.body.attributes.CITTA, 'Nervesa della Battaglia');
  assert.equal(contact.body.attributes.AGGIUNTE, 'Ordini online, Fatture e documenti');
});
await t('pizzerie: formula non scelta', async () => {
  calls.length = 0;
  const r = await worker.fetch(req('POST', { ...leadPizza, esperienza: '', aggiunte: [] }, ORIGIN, '4.4.4.3'), env);
  assert.equal(r.status, 200);
  const notify = calls.find((c) => c.body.to && c.body.to[0].email === 'owner@example.com');
  assert.match(notify.body.textContent, /Formula: Da definire insieme/);
  assert.doesNotMatch(notify.body.textContent, /Aggiunte:/);
  const confirm = calls.find((c) => c.body.to && c.body.to[0].email === 'giulia@example.it');
  /* senza scelta il riepilogo non inventa una formula */
  assert.doesNotMatch(confirm.body.textContent, /Formula:/);
});
await t('limite di frequenza per IP', async () => {
  let last;
  for (let i = 0; i < 6; i++) last = await worker.fetch(req('POST', lead, ORIGIN, '5.5.5.5'), { ...env, DRY_RUN: 'true' });
  assert.equal(last.status, 429);
});

async function fetchRaw(text) {
  return worker.fetch(new Request('https://form.example.workers.dev/', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'CF-Connecting-IP': '2.2.2.2' }, body: text }), env);
}
console.log(n + ' test passati');
