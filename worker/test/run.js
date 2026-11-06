/* Test del Worker senza Cloudflare: Node 18+ ha Request/Response/fetch.
   Le chiamate a Brevo sono intercettate da un finto fetch. Esegui con
   `npm test` dentro worker/. */
import worker from '../src/index.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

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
  assert.match(notify.body.htmlContent, /alt="cèlan"/);
  const confirm = calls.find((c) => c.body.to && c.body.to[0].email === 'mario@example.it');
  assert.match(confirm.body.textContent, /prima possibile/);
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
  assert.match(confirm.body.textContent, /prima possibile/);
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
await t('sagre: form senza formula, con serate e casse', async () => {
  calls.length = 0;
  const leadSagra = {
    nome: 'Luca', locale: 'Festa del Radicchio', citta: 'Arcade', email: 'luca@example.it',
    serate: '4', casse: '3', verticale: 'sagre', pagina: 'https://x/sagre/'
  };
  const r = await worker.fetch(req('POST', leadSagra, ORIGIN, '4.4.4.4'), env);
  assert.equal(r.status, 200);
  const notify = calls.find((c) => c.body.to && c.body.to[0].email === 'owner@example.com');
  assert.match(notify.body.textContent, /Serate: 4/);
  assert.match(notify.body.textContent, /Casse: 3/);
  const confirm = calls.find((c) => c.body.to && c.body.to[0].email === 'luca@example.it');
  assert.match(confirm.body.textContent, /Serate: 4/);
  assert.doesNotMatch(confirm.body.textContent, /Formula:/);
});
await t('limite di frequenza per IP', async () => {
  let last;
  for (let i = 0; i < 6; i++) last = await worker.fetch(req('POST', lead, ORIGIN, '5.5.5.5'), { ...env, DRY_RUN: 'true' });
  assert.equal(last.status, 429);
});

/* ---------------- Cancellazione automatica (scheduled) ---------------- */
import { classify, cutoffDate, runRetention } from '../src/retention.js';

const NOW = new Date('2026-11-06T03:00:00.000Z');
const mk = (email, modifiedAt, listIds = [7]) => ({ email, modifiedAt, listIds });
const VECCHIO = '2025-10-01T10:00:00.000Z';
const FRESCO = '2026-09-01T10:00:00.000Z';
const originalFetch = globalThis.fetch;
/* finto Brevo: elenco contatti paginato + registro delle scritture */
function fakeBrevo(contacts, { failDelete = [], failList = false } = {}) {
  const log = [];
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method || 'GET';
    const path = url.replace('https://api.brevo.com/v3', '');
    log.push({ method, path, body: init.body ? JSON.parse(init.body) : undefined });
    if (method === 'GET') {
      if (failList) return new Response('x', { status: 500 });
      const u = new URL(url);
      const off = Number(u.searchParams.get('offset')), lim = Number(u.searchParams.get('limit'));
      return new Response(JSON.stringify({ count: contacts.length, contacts: contacts.slice(off, off + lim) }), { status: 200 });
    }
    if (method === 'DELETE') {
      const email = decodeURIComponent(path.replace('/contacts/', ''));
      return failDelete.includes(email) ? new Response('no', { status: 500 }) : new Response(null, { status: 204 });
    }
    return new Response('{"success":{}}', { status: 201 });
  };
  return log;
}
const writes = (log) => log.filter((c) => c.method !== 'GET');
const renv = { ...env, RETENTION_DRY_RUN: 'false' };
async function conLog(fn) {
  const righe = [];
  const o = { log: console.log, error: console.error };
  console.log = console.error = (...a) => righe.push(a.join(' '));
  try { return { r: await fn(), righe }; }
  catch (e) { return { err: e, righe }; }
  finally { console.log = o.log; console.error = o.error; }
}

await t('retention: soglia a 12 mesi di calendario', async () => {
  assert.equal(cutoffDate(NOW).toISOString(), '2025-11-06T03:00:00.000Z');
  assert.equal(cutoffDate(new Date('2028-02-29T00:00:00Z')).toISOString(), '2027-02-28T00:00:00.000Z');
  const p = classify([
    mk('a@x.it', '2025-11-07T03:00:00.000Z'),   /* 11 mesi e 29 giorni */
    mk('b@x.it', '2025-11-05T03:00:00.000Z')    /* 12 mesi e 1 giorno */
  ], NOW, 7);
  assert.deepEqual(p.delete, ['b@x.it']);
  assert.equal(p.expired, 1);
});
await t('retention: scaduto solo in lista -> DELETE', async () => {
  const log = fakeBrevo([mk('vecchio@x.it', VECCHIO)]);
  const { r } = await conLog(() => runRetention(renv, NOW));
  assert.deepEqual(writes(log).map((c) => c.method + ' ' + c.path), ['DELETE /contacts/vecchio%40x.it']);
  assert.equal(r.cancellati, 1);
});
await t('retention: scaduto anche in altra lista -> solo remove', async () => {
  const log = fakeBrevo([mk('due@x.it', VECCHIO, [7, 9])]);
  const { r } = await conLog(() => runRetention(renv, NOW));
  const w = writes(log);
  assert.equal(w.length, 1);
  assert.equal(w[0].method, 'POST');
  assert.equal(w[0].path, '/contacts/lists/7/contacts/remove');
  assert.deepEqual(w[0].body, { emails: ['due@x.it'] });
  assert.equal(r.tolti_dalla_lista, 1);
  assert.equal(r.cancellati, 0);
});
await t('retention: non scaduto -> nessuna scrittura', async () => {
  const log = fakeBrevo([mk('fresco@x.it', FRESCO)]);
  const { r } = await conLog(() => runRetention(renv, NOW));
  assert.equal(writes(log).length, 0);
  assert.equal(r.scaduti, 0);
});
await t('retention: modifiedAt assente o illeggibile -> saltato', async () => {
  const log = fakeBrevo([{ email: 'a@x.it', listIds: [7] }, mk('b@x.it', 'ieri'), mk('c@x.it', VECCHIO)]);
  const { r } = await conLog(() => runRetention(renv, NOW));
  assert.equal(r.saltati, 2);
  assert.deepEqual(writes(log).map((c) => c.path), ['/contacts/c%40x.it']);
});
await t('retention: RETENTION_DRY_RUN conta e non scrive', async () => {
  const log = fakeBrevo([mk('a@x.it', VECCHIO), mk('b@x.it', VECCHIO, [7, 9])]);
  const { r } = await conLog(() => runRetention({ ...renv, RETENTION_DRY_RUN: 'true' }, NOW));
  assert.equal(writes(log).length, 0);
  assert.equal(r.scaduti, 2);
});
await t('retention: senza chiave o lista esce senza chiamate', async () => {
  const log = fakeBrevo([mk('a@x.it', VECCHIO)]);
  assert.equal((await conLog(() => runRetention({ ...renv, BREVO_API_KEY: '' }, NOW))).r, null);
  assert.equal((await conLog(() => runRetention({ ...renv, BREVO_LIST_ID: '' }, NOW))).r, null);
  assert.equal(log.length, 0);
});
await t('retention: un errore non blocca gli altri e il giro fallisce', async () => {
  const log = fakeBrevo([mk('a@x.it', VECCHIO), mk('b@x.it', VECCHIO), mk('c@x.it', VECCHIO)], { failDelete: ['a@x.it'] });
  const { err } = await conLog(() => runRetention(renv, NOW));
  assert.ok(err && /1 errori/.test(err.message));
  assert.equal(writes(log).length, 3);
});
await t('retention: lettura fallita -> giro fallito, nessuna scrittura', async () => {
  const log = fakeBrevo([mk('a@x.it', VECCHIO)], { failList: true });
  const { err } = await conLog(() => runRetention(renv, NOW));
  assert.ok(err);
  assert.equal(writes(log).length, 0);
});
await t('retention: budget di 40 sottorichieste rispettato', async () => {
  const molti = Array.from({ length: 100 }, (_, i) => mk('u' + i + '@x.it', VECCHIO));
  const log = fakeBrevo(molti);
  const { r } = await conLog(() => runRetention(renv, NOW));
  assert.equal(log.length, 40);
  assert.equal(r.cancellati, 39);   /* 1 lettura + 39 cancellazioni */
  assert.equal(r.rimandati, 61);
});
await t('retention: paginazione oltre 500 contatti', async () => {
  const molti = Array.from({ length: 1200 }, (_, i) => mk('u' + i + '@x.it', FRESCO));
  const log = fakeBrevo(molti);
  const { r } = await conLog(() => runRetention(renv, NOW));
  assert.deepEqual(log.map((c) => c.path.match(/offset=(\d+)/)[1]), ['0', '500', '1000']);
  assert.equal(r.letti, 1200);
});
await t('retention: nei log nessuna email', async () => {
  fakeBrevo([mk('segreta@x.it', VECCHIO), mk('altra@x.it', VECCHIO, [7, 9]), mk('rotta@x.it', VECCHIO)], { failDelete: ['rotta@x.it'] });
  const { righe } = await conLog(() => runRetention(renv, NOW));
  assert.ok(righe.length > 0);
  assert.ok(!righe.join('\n').includes('@'));
});
await t('scheduled: esposto, usa la lista', async () => {
  const log = fakeBrevo([mk('s@x.it', VECCHIO)]);
  await conLog(() => worker.scheduled({}, renv, {}));
  assert.equal(writes(log).length, 1);
});
await t('fetch invariato dopo la cancellazione automatica', async () => {
  globalThis.fetch = originalFetch;
  calls.length = 0;
  const r = await worker.fetch(req('POST', lead, ORIGIN, '6.6.6.6'), env);
  assert.equal(r.status, 200);
  assert.deepEqual(calls.map((c) => c.url.replace('https://api.brevo.com/v3', '')).sort(), ['/contacts', '/smtp/email', '/smtp/email']);
});

async function fetchRaw(text) {
  return worker.fetch(new Request('https://form.example.workers.dev/', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'CF-Connecting-IP': '2.2.2.2' }, body: text }), env);
}
/* --- Script Gmail (worker/gmail): gira in un contesto finto, senza Google --- */
function caricaGmail(conversazioni, prova) {
  const log = [];
  const ctx = { Logger: { log: (...a) => log.push(a.join(' ')) }, Date, Math,
    GmailApp: { search: (q, inizio, n) => { ctx.ricerca = q; return conversazioni.slice(inizio, inizio + n); } } };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL('../gmail/pulizia-preventivi.gs', import.meta.url), 'utf8'), ctx);
  ctx.PROVA = prova;
  return { ctx, log };
}
function conversazione(data, etichette = []) {
  return { cestino: false, getLastMessageDate: () => new Date(data), getFirstMessageSubject: () => 'oggetto',
    getLabels: () => etichette.map((e) => ({ getName: () => e })), moveToTrash() { this.cestino = true; } };
}
const mesiFa = (m, g = 0) => { const d = new Date(); d.setMonth(d.getMonth() - m); d.setDate(d.getDate() - g); return d.toISOString(); };

await t('gmail: cestina solo le scadute, tiene etichetta cliente e conversazioni recenti', async () => {
  const scaduta = conversazione(mesiFa(12));
  const cliente = conversazione(mesiFa(12), ['cliente']);
  const recente = conversazione(mesiFa(10));
  const { ctx } = caricaGmail([scaduta, cliente, recente], false);
  ctx.pulisciPreventivi();
  assert.deepEqual([scaduta.cestino, cliente.cestino, recente.cestino], [true, false, false]);
  assert.match(ctx.ricerca, /from:noreply@celan\.it/);
});
await t('gmail: conta dall ultimo messaggio, non dalla ricerca', async () => {
  const conRisposta = conversazione(mesiFa(1));
  const { ctx } = caricaGmail([conRisposta], false);
  ctx.pulisciPreventivi();
  assert.equal(conRisposta.cestino, false);
});
await t('gmail: in prova non sposta nulla', async () => {
  const scaduta = conversazione(mesiFa(12));
  const { ctx, log } = caricaGmail([scaduta], true);
  ctx.pulisciPreventivi();
  assert.equal(scaduta.cestino, false);
  assert.ok(log.some((l) => l.includes('Da cancellare')));
});
await t('gmail: il file scaricato parte in prova', async () => {
  const { ctx } = caricaGmail([], undefined);
  const src = readFileSync(new URL('../gmail/pulizia-preventivi.gs', import.meta.url), 'utf8');
  assert.match(src, /var PROVA = true;/);
  assert.ok(ctx.dataLimite);
});
await t('gmail: pagine lette per intero prima di spostare', async () => {
  const tante = Array.from({ length: 150 }, () => conversazione(mesiFa(12)));
  const { ctx } = caricaGmail(tante, false);
  ctx.pulisciPreventivi();
  assert.equal(tante.filter((c) => c.cestino).length, 150);
});

console.log(n + ' test passati');
