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

/* ---------------- Le due email ----------------
   Regole del mezzo, non del web: tabelle invece di flex, stili in riga
   invece di un foglio di stile, niente webfont (nessun client li carica) e
   il marchio come PNG servito dal sito. Il logo e' su fondo bianco cotto
   dentro l'immagine: in Gmail scuro un PNG trasparente con le lettere nere
   sparirebbe. Le immagini restano bloccate finche' chi legge non le
   sblocca, quindi nessuna informazione vive dentro un'immagine. */

const SITO = 'https://celan.it';
const LOGO = SITO + '/assets/brand/logo-celan-email.png';
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const INK = '#111110', MUTO = '#6F6D68', RIGA = '#e2e0dc', ACCENTO = '#cd3c20';

function guscio(occhiello, corpo, piede) {
  return '<!doctype html><html lang="it"><body style="margin:0;padding:0;background:#e9e9e9">' +
    /* riga d'anteprima: la vede solo la casella nell'elenco dei messaggi */
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0">' + esc(occhiello) + '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#e9e9e9;padding:28px 12px">' +
    '<tr><td align="center">' +
    '<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid ' + RIGA + ';border-radius:16px">' +
    '<tr><td style="padding:28px 28px 4px">' +
    '<a href="' + SITO + '" style="text-decoration:none"><img src="' + LOGO + '" alt="c&egrave;lan" width="200" style="display:block;border:0;width:200px;max-width:55%;height:auto"></a>' +
    '</td></tr>' +
    '<tr><td style="padding:12px 28px 30px;font-family:' + FONT + ';font-size:16px;line-height:1.6;color:' + INK + '">' + corpo + '</td></tr>' +
    '</table>' +
    '<div style="max-width:560px;padding:16px 12px 0;font-family:' + FONT + ';font-size:12px;line-height:1.6;color:' + MUTO + ';text-align:center">' + piede + '</div>' +
    '</td></tr></table></body></html>';
}

function righe(coppie) {
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:18px 0 4px">' +
    coppie.map(function ([k, v]) {
      return '<tr>' +
        '<td style="padding:9px 12px 9px 0;border-bottom:1px solid ' + RIGA + ';color:' + MUTO + ';font-size:13px;vertical-align:top;white-space:nowrap">' + esc(k) + '</td>' +
        '<td style="padding:9px 0;border-bottom:1px solid ' + RIGA + ';font-size:15px;font-weight:600;vertical-align:top">' + esc(v) + '</td>' +
        '</tr>';
    }).join('') + '</table>';
}

function sendNotification(env, lead) {
  const verticale = VERTICALI[lead.verticale];
  const dove = lead.citta ? lead.locale + ', ' + lead.citta : lead.locale;
  const coppie = [['Nome', lead.nome], ['Locale', lead.locale]];
  if (lead.citta) coppie.push(['Città', lead.citta]);
  coppie.push(['Email', lead.email]);
  if (lead.telefono) coppie.push(['Telefono', lead.telefono]);
  coppie.push(['Formula', formulaDi(lead)]);
  if (lead.aggiunte.length) coppie.push(['Aggiunte', lead.aggiunte.join(', ')]);
  coppie.push(['Sezione', verticale]);

  const corpo =
    '<p style="margin:0 0 4px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:' + ACCENTO + '">Nuova richiesta</p>' +
    '<p style="margin:0;font-size:22px;line-height:1.3;font-weight:700">' + esc(dove) + '</p>' +
    righe(coppie) +
    '<p style="margin:22px 0 0;font-size:14px;color:' + MUTO + '">Rispondi a questa email per scrivere direttamente a ' + esc(lead.nome) + '.' +
    (lead.pagina ? '<br>Arrivata da <a href="' + esc(lead.pagina) + '" style="color:' + ACCENTO + '">' + esc(lead.pagina) + '</a>' : '') +
    '</p>';

  const testo = 'NUOVA RICHIESTA - ' + dove + '\n\n' +
    coppie.map(([k, v]) => k + ': ' + v).join('\n') +
    '\n\nRispondi a questa email per scrivere direttamente a ' + lead.nome + '.' +
    (lead.pagina ? '\nArrivata da ' + lead.pagina : '');

  return brevo(env, '/smtp/email', {
    sender: { name: env.SENDER_NAME || env.SITE_NAME || 'Sito', email: env.SENDER_EMAIL },
    to: env.NOTIFY_TO.split(',').map((e) => ({ email: e.trim() })),
    replyTo: { email: lead.email, name: lead.nome },
    subject: '[' + (env.SITE_NAME || 'Sito') + '] ' + dove + ' - richiesta di preventivo',
    htmlContent: guscio(coppie.map(([k, v]) => k + ': ' + v).join(' - '), corpo, 'Avviso automatico dal modulo di ' + SITO.replace('https://', '')),
    textContent: testo,
    tags: ['preventivo', lead.verticale]
  });
}

function sendConfirmation(env, lead) {
  const tempi = lead.verticale === 'pizzerie' ? 'entro un giorno lavorativo' : 'entro due giorni lavorativi';
  const site = env.SITE_NAME || 'il sito';
  const recap = [['La tua richiesta', lead.locale + (lead.citta ? ', ' + lead.citta : '')]];
  if (haScelto(lead)) recap.push(['Formula', formulaDi(lead)]);
  if (lead.aggiunte.length) recap.push(['Aggiunte', lead.aggiunte.join(', ')]);

  const corpo =
    '<p style="margin:0 0 16px">Ciao ' + esc(lead.nome) + ',</p>' +
    '<p style="margin:0 0 16px">la tua richiesta per <strong>' + esc(lead.locale) + '</strong> &egrave; arrivata. La legge una persona: dietro c&egrave;lan ci siamo in due, e chi ti risponde &egrave; chi poi installa il sistema nel tuo locale.</p>' +
    '<p style="margin:0 0 4px">Ti scriviamo <strong>' + tempi + '</strong> con il preventivo, e dentro ci trovi la lista dell\'attrezzatura che serve al tuo locale, modello per modello, ai prezzi del negozio.</p>' +
    righe(recap) +
    '<p style="margin:22px 0 0">Se nel frattempo ti viene in mente altro, rispondi pure a questa email: arriva a noi.</p>' +
    '<p style="margin:16px 0 0">A presto,<br><strong>' + esc(site) + '</strong></p>';

  const testo = 'Ciao ' + lead.nome + ',\n\n' +
    'la tua richiesta per ' + lead.locale + ' e\' arrivata. La legge una persona: dietro celan ci siamo in due, ' +
    'e chi ti risponde e\' chi poi installa il sistema nel tuo locale.\n\n' +
    'Ti scriviamo ' + tempi + ' con il preventivo, e dentro ci trovi la lista dell\'attrezzatura che serve ' +
    'al tuo locale, modello per modello, ai prezzi del negozio.\n\n' +
    recap.map(([k, v]) => k + ': ' + v).join('\n') +
    '\n\nSe nel frattempo ti viene in mente altro, rispondi pure a questa email: arriva a noi.\n\nA presto,\n' + site;

  return brevo(env, '/smtp/email', {
    sender: { name: env.SENDER_NAME || site, email: env.SENDER_EMAIL },
    to: [{ email: lead.email, name: lead.nome }],
    /* il mittente e' un noreply senza casella dietro: le risposte vanno
       dirottate sul primo indirizzo che legge davvero gli avvisi */
    replyTo: { email: env.NOTIFY_TO.split(',')[0].trim(), name: site },
    subject: 'La tua richiesta è arrivata',
    htmlContent: guscio('Ti scriviamo ' + tempi + ' con il preventivo.', corpo,
      'c&egrave;lan &middot; Gestionale per ristoranti, pizzerie e locali<br>' +
      '<a href="' + SITO + '" style="color:' + MUTO + '">celan.it</a> &middot; Commerciale 345 293 3633 &middot; Tecnico 345 760 6166'),
    textContent: testo,
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
