/* Cancellazione automatica dei contatti scaduti dalla lista Brevo
 * BREVO_LIST_ID ("Preventivi sito"): 12 mesi dall'ultima modifica.
 * Il contatto viene aggiornato a ogni nuova richiesta (updateEnabled), quindi
 * modifiedAt e' la data dell'ultima richiesta.
 *
 * Endpoint Brevo usati (documentazione ufficiale):
 *  GET    /contacts/lists/{listId}/contacts?limit=500&offset=N&sort=asc
 *  DELETE /contacts/{email}                      (204)
 *  POST   /contacts/lists/{listId}/contacts/remove  {emails:[...]}  (201)
 *
 * Nei log solo conteggi: mai email o altri dati personali.
 */

const BREVO_API = 'https://api.brevo.com/v3';
export const BUDGET = 40;        /* sottorichieste per esecuzione (limite Cloudflare free: 50) */
const PAGE_LIMIT = 500;          /* massimo consentito da Brevo */
const MAX_PAGES = 10;            /* tetto alle pagine lette: 5000 contatti per giro */
const REMOVE_CHUNK = 50;         /* email per chiamata di rimozione dalla lista */

/* Data limite: `now` meno 12 mesi di calendario (31 mar -> 31 mar; 29 feb ->
   28 feb se l'anno prima non e' bisestile). Un contatto e' scaduto se
   modificato PRIMA di questa data. */
export function cutoffDate(now, months = 12) {
  const d = new Date(now.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

/* Funzione pura: da contatti Brevo a decisioni.
   - delete: scaduto e presente solo nella lista
   - remove: scaduto e presente anche in altre liste
   - skipped: modifiedAt mancante/non valido, email o listIds mancanti */
export function classify(contacts, now, listId) {
  const cutoff = cutoffDate(now);
  const lid = Number(listId);
  const out = { expired: 0, delete: [], remove: [], skipped: 0 };
  for (const c of contacts) {
    const t = c && typeof c.modifiedAt === 'string' ? Date.parse(c.modifiedAt) : NaN;
    if (!c || !c.email || Number.isNaN(t) || !Array.isArray(c.listIds)) { out.skipped++; continue; }
    if (!c.listIds.map(Number).includes(lid)) continue;
    if (t >= cutoff.getTime()) continue;
    out.expired++;
    if (c.listIds.every((x) => Number(x) === lid)) out.delete.push(c.email);
    else out.remove.push(c.email);
  }
  return out;
}

async function call(env, method, path, body) {
  const r = await fetch(BREVO_API + path, {
    method,
    headers: { 'api-key': env.BREVO_API_KEY, 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  /* il messaggio non riporta il percorso: nel DELETE c'e' l'email */
  if (!r.ok) throw new Error(method + ' -> ' + r.status);
  return r;
}

export async function runRetention(env, now = new Date()) {
  if (!env.BREVO_LIST_ID || !env.BREVO_API_KEY) {
    console.log('retention: BREVO_LIST_ID o BREVO_API_KEY mancanti, niente da fare');
    return null;
  }
  const dry = String(env.RETENTION_DRY_RUN) === 'true';
  const listId = Number(env.BREVO_LIST_ID);
  const stats = { letti: 0, scaduti: 0, cancellati: 0, tolti_dalla_lista: 0, saltati: 0, errori: 0, rimandati: 0 };
  let used = 0;

  /* 1. si legge tutto prima (l'offset resterebbe sbagliato se si cancellasse
        mentre si legge) */
  const contacts = [];
  for (let page = 0; page < MAX_PAGES && used < BUDGET; page++) {
    used++;
    try {
      const r = await call(env, 'GET', '/contacts/lists/' + listId + '/contacts?limit=' + PAGE_LIMIT + '&offset=' + (page * PAGE_LIMIT) + '&sort=asc');
      const j = await r.json();
      const batch = Array.isArray(j.contacts) ? j.contacts : [];
      contacts.push(...batch);
      if (batch.length < PAGE_LIMIT) break;
    } catch (e) {
      stats.errori++;
      console.error('retention: lettura pagina fallita (' + e.message + ')');
      break;
    }
  }
  stats.letti = contacts.length;
  const plan = classify(contacts, now, listId);
  stats.scaduti = plan.expired;
  stats.saltati = plan.skipped;

  /* 2. poi si agisce, nel limite del budget; il resto va al giro dopo */
  if (dry) {
    stats.cancellati = plan.delete.length;
    stats.tolti_dalla_lista = plan.remove.length;
  } else {
    for (let i = 0; i < plan.remove.length && used < BUDGET; i += REMOVE_CHUNK) {
      const chunk = plan.remove.slice(i, i + REMOVE_CHUNK);
      used++;
      try {
        const r = await call(env, 'POST', '/contacts/lists/' + listId + '/contacts/remove', { emails: chunk });
        const j = await r.json().catch(() => ({}));
        const ko = j && j.failure && Array.isArray(j.failure.emails) ? j.failure.emails.length : 0;
        stats.tolti_dalla_lista += chunk.length - ko;
        stats.errori += ko;
      } catch (e) {
        stats.errori += chunk.length;
        console.error('retention: rimozione dalla lista fallita (' + e.message + ')');
      }
    }
    for (const email of plan.delete) {
      if (used >= BUDGET) break;
      used++;
      try {
        await call(env, 'DELETE', '/contacts/' + encodeURIComponent(email));
        stats.cancellati++;
      } catch (e) {
        stats.errori++;
        console.error('retention: cancellazione fallita (' + e.message + ')');
      }
    }
    stats.rimandati = plan.expired - stats.cancellati - stats.tolti_dalla_lista - stats.errori;
  }
  console.log('retention' + (dry ? ' (prova, nessuna scrittura)' : '') + ': ' + JSON.stringify(stats) + ' sottorichieste=' + used);
  /* l'esecuzione deve risultare fallita nei log di Cloudflare */
  if (stats.errori) throw new Error('retention: ' + stats.errori + ' errori');
  return stats;
}
