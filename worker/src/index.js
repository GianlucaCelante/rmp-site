/* Cloudflare Worker: riceve il form "Richiedi il preventivo" delle landing
 * e lo inoltra tramite Brevo.
 *
 *  1. email di avviso al Titolare (NOTIFY_TO), con reply-to del richiedente;
 *  2. email di conferma al richiedente (se SEND_CONFIRMATION = "true");
 *  3. contatto aggiunto/aggiornato in Brevo, con attributi e lista (se
 *     BREVO_LIST_ID e' impostato).
 *
 * La chiave Brevo vive SOLO nel secret BREVO_API_KEY del Worker
 * (`wrangler secret put BREVO_API_KEY`), mai nel sito.
 * Variabili in wrangler.toml: ALLOWED_ORIGINS, NOTIFY_TO, SENDER_EMAIL,
 * SENDER_NAME, SITE_NAME, SEND_CONFIRMATION, BREVO_LIST_ID, DRY_RUN.
 */

const BREVO_API = 'https://api.brevo.com/v3';

/* Le formule che ogni landing puo' mandare. La chiave vuota vale "non
   l'ha indicata": il form pizzerie lascia il select libero di restare sul
   segnaposto, quello sagre ha invece la voce esplicita "non-so". */
const ESPERIENZE = {
  sagre: { 'non-so': 'Non lo so ancora', lite: 'La base', completa: 'Festa M', premium: 'Festa L', custom: 'Su misura' },
  pizzerie: {
    '': 'Da definire insieme',
    asporto: 'Canone solo asporto (290 euro/anno)',
    completo: 'Canone completo, sala e cucina (390 euro/anno)',
    apertura: 'Sta per aprire, ancora da decidere'
  }
};
const VERTICALI = { sagre: 'Sagre e feste di paese', pizzerie: 'Pizzerie, ristoranti e locali' };

/* Limite di frequenza best-effort per isolate (5 invii / 10 minuti per IP).
   Per una protezione vera aggiungere una regola "Rate limiting" nel
   pannello Cloudflare sul percorso del Worker. */
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > RATE_MAX;
}

function corsHeaders(origin, allowed) {
  const h = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
  if (!allowed.length || allowed.includes(origin)) h['Access-Control-Allow-Origin'] = origin || '*';
  return h;
}
function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }
  });
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* Nome leggibile della formula scelta, e se una scelta c'e' stata davvero. */
function formulaDi(lead) { return ESPERIENZE[lead.verticale][lead.esperienza]; }
function haScelto(lead) { return lead.esperienza !== '' && lead.esperienza !== 'non-so'; }

function validate(body) {
  const clean = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
  const lead = {
    nome: clean(body.nome, 120),
    locale: clean(body.locale, 200),
    citta: clean(body.citta, 120),
    email: clean(body.email, 200),
    telefono: clean(body.telefono, 40),
    esperienza: clean(body.esperienza, 20),
    aggiunte: (Array.isArray(body.aggiunte) ? body.aggiunte : []).slice(0, 10).map((v) => clean(v, 120)).filter(Boolean),
    verticale: clean(body.verticale, 20) || 'sagre',
    pagina: clean(body.pagina, 300)
  };
  const errors = [];
  if (lead.nome.length < 2) errors.push('nome');
  if (lead.locale.length < 2) errors.push('locale');
  if (!EMAIL_RE.test(lead.email)) errors.push('email');
  /* citta e telefono: obbligatori dove il form li chiede (pizzerie),
     accettati e riportati se arrivano da altrove */
  if (lead.verticale === 'pizzerie') {
    if (lead.citta.length < 2) errors.push('citta');
    if ((lead.telefono.match(/\d/g) || []).length < 8) errors.push('telefono');
  }
  const formule = ESPERIENZE[lead.verticale];
  if (!formule) {
    errors.push('verticale');
  } else {
    if (lead.esperienza === '' && formule['non-so']) lead.esperienza = 'non-so';
    if (!(lead.esperienza in formule)) errors.push('esperienza');
  }
  return { lead, errors };
}

async function brevo(env, path, payload) {
  const r = await fetch(BREVO_API + path, {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error('Brevo ' + path + ' -> ' + r.status + ' ' + t.slice(0, 300));
  }
  return r;
}

function sendNotification(env, lead) {
  const verticale = VERTICALI[lead.verticale];
  const rows = [
    ['Nome', lead.nome], ['Festa / locale', lead.locale]
  ];
  if (lead.citta) rows.push(['Citta', lead.citta]);
  rows.push(['Email', lead.email]);
  if (lead.telefono) rows.push(['Telefono', lead.telefono]);
  rows.push(['Formula', formulaDi(lead)]);
  if (lead.aggiunte.length) rows.push(['Aggiunte', lead.aggiunte.join(', ')]);
  rows.push(['Verticale', verticale], ['Pagina', lead.pagina || '-']);
  const html = '<h2 style="font-family:sans-serif">Nuova richiesta di preventivo (' + esc(verticale) + ')</h2>' +
    '<table style="font-family:sans-serif;border-collapse:collapse">' +
    rows.map(([k, v]) => '<tr><td style="padding:6px 12px 6px 0;color:#666">' + esc(k) + '</td><td style="padding:6px 0"><strong>' + esc(v) + '</strong></td></tr>').join('') +
    '</table><p style="font-family:sans-serif;color:#666">Rispondi a questa email per scrivere direttamente al richiedente.</p>';
  const text = rows.map(([k, v]) => k + ': ' + v).join('\n');
  return brevo(env, '/smtp/email', {
    sender: { name: env.SENDER_NAME || env.SITE_NAME || 'Sito', email: env.SENDER_EMAIL },
    to: env.NOTIFY_TO.split(',').map((e) => ({ email: e.trim() })),
    replyTo: { email: lead.email, name: lead.nome },
    subject: '[' + (env.SITE_NAME || 'Sito') + '] Preventivo ' + verticale + ': ' + lead.locale,
    htmlContent: html,
    textContent: text,
    tags: ['preventivo', lead.verticale]
  });
}

function sendConfirmation(env, lead) {
  const formula = formulaDi(lead);
  const tempi = lead.verticale === 'pizzerie' ? 'entro un giorno lavorativo' : 'entro due giorni lavorativi';
  const site = env.SITE_NAME || 'il sito';
  const html = '<div style="font-family:sans-serif;line-height:1.5">' +
    '<p>Ciao ' + esc(lead.nome) + ',</p>' +
    '<p>abbiamo ricevuto la tua richiesta per <strong>' + esc(lead.locale) + '</strong>' +
    (haScelto(lead) ? ' (formula indicata: ' + esc(formula) + ')' : '') + '.</p>' +
    '<p>Ti rispondiamo ' + tempi + ' con il preventivo scritto. Se nel frattempo vuoi aggiungere qualcosa, rispondi pure a questa email.</p>' +
    '<p>' + esc(site) + '</p></div>';
  const text = 'Ciao ' + lead.nome + ',\n\nabbiamo ricevuto la tua richiesta per ' + lead.locale +
    (haScelto(lead) ? ' (formula indicata: ' + formula + ')' : '') + '.\nTi rispondiamo ' + tempi +
    ' con il preventivo scritto. Se nel frattempo vuoi aggiungere qualcosa, rispondi pure a questa email.\n\n' + site;
  return brevo(env, '/smtp/email', {
    sender: { name: env.SENDER_NAME || site, email: env.SENDER_EMAIL },
    to: [{ email: lead.email, name: lead.nome }],
    replyTo: { email: env.NOTIFY_TO.split(',')[0].trim() },
    subject: 'Abbiamo ricevuto la tua richiesta di preventivo',
    htmlContent: html,
    textContent: text,
    tags: ['conferma', lead.verticale]
  });
}

function addContact(env, lead) {
  const payload = {
    email: lead.email,
    updateEnabled: true,
    attributes: {
      NOME: lead.nome,
      LOCALE: lead.locale,
      CITTA: lead.citta,
      TELEFONO: lead.telefono,
      FORMULA: formulaDi(lead),
      AGGIUNTE: lead.aggiunte.join(', '),
      VERTICALE: lead.verticale,
      ORIGINE: 'form-sito'
    }
  };
  if (env.BREVO_LIST_ID) payload.listIds = [Number(env.BREVO_LIST_ID)];
  return brevo(env, '/contacts', payload);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const cors = corsHeaders(origin, allowed);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ ok: false, error: 'method' }, 405, cors);
    if (allowed.length && !allowed.includes(origin)) return json({ ok: false, error: 'origin' }, 403, cors);

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (rateLimited(ip)) return json({ ok: false, error: 'rate' }, 429, cors);

    let body;
    try { body = await request.json(); } catch { return json({ ok: false, error: 'json' }, 400, cors); }
    if (!body || typeof body !== 'object') return json({ ok: false, error: 'json' }, 400, cors);

    /* honeypot: i bot compilano il campo nascosto; si finge successo */
    if (body.website) return json({ ok: true }, 200, cors);

    const { lead, errors } = validate(body);
    if (errors.length) return json({ ok: false, error: 'validation', fields: errors }, 400, cors);

    if (String(env.DRY_RUN) === 'true') return json({ ok: true, dryRun: true, lead }, 200, cors);
    if (!env.BREVO_API_KEY || !env.NOTIFY_TO || !env.SENDER_EMAIL) return json({ ok: false, error: 'config' }, 500, cors);

    const jobs = [sendNotification(env, lead), addContact(env, lead)];
    if (String(env.SEND_CONFIRMATION) === 'true') jobs.push(sendConfirmation(env, lead));
    const results = await Promise.allSettled(jobs);

    /* l'avviso al Titolare e' l'unico passo indispensabile */
    if (results[0].status === 'rejected') {
      console.error('notifica fallita:', results[0].reason && results[0].reason.message);
      return json({ ok: false, error: 'send' }, 502, cors);
    }
    results.slice(1).forEach((r) => { if (r.status === 'rejected') console.warn('passo secondario fallito:', r.reason && r.reason.message); });
    return json({ ok: true }, 200, cors);
  }
};
