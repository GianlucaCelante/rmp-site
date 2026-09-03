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
   invece di un foglio di stile, niente webfont ne' SVG (nessun client li
   carica), niente JavaScript.

   Il punto fermo: le immagini partono bloccate in mezzo mondo (Gmail con
   "chiedi prima di mostrare", Outlook aziendale, quasi tutte le app in
   anteprima). Quindi il marchio non puo' vivere solo dentro il PNG: l'alt
   dell'immagine e' vestito con gli stili del marchio, cosi' a immagini
   spente resta la parola "celan" grande e nel rosso giusto, e sopra c'e'
   comunque la fascia d'accento. Nessuna informazione sta dentro un'immagine. */

const SITO = 'https://celan.it';
const LOGO = SITO + '/assets/brand/logo-celan-email.png';
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const INK = '#111110', MUTO = '#6F6D68', RIGA = '#e4e2de', ACCENTO = '#cd3c20', CARTA = '#ffffff', FONDO = '#e9e9e9';

function guscio(occhiello, corpo, piede) {
  return '<!doctype html><html lang="it"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">' +
    '</head><body style="margin:0;padding:0;background:' + FONDO + ';-webkit-text-size-adjust:100%">' +
    /* riga d'anteprima: la legge solo l'elenco dei messaggi */
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">' + esc(occhiello) + '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:' + FONDO + '">' +
    '<tr><td align="center" style="padding:28px 12px">' +
    '<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background:' + CARTA + ';border:1px solid ' + RIGA + ';border-radius:14px;overflow:hidden">' +
    /* fascia d'accento: si vede sempre, anche a immagini spente */
    '<tr><td style="height:5px;line-height:5px;font-size:0;background:' + ACCENTO + '">&nbsp;</td></tr>' +
    '<tr><td style="padding:26px 30px 0">' +
    '<a href="' + SITO + '" style="text-decoration:none;color:' + ACCENTO + '">' +
    '<img src="' + LOGO + '" alt="cèlan" width="190" height="64" style="display:block;border:0;width:190px;max-width:55%;height:auto;font-family:' + FONT + ';font-size:26px;font-weight:700;letter-spacing:-.02em;color:' + ACCENTO + '"></a>' +
    '</td></tr>' +
    '<tr><td style="padding:20px 30px 32px;font-family:' + FONT + ';font-size:16px;line-height:1.6;color:' + INK + '">' + corpo + '</td></tr>' +
    '</table>' +
    '<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px">' +
    '<tr><td style="padding:16px 12px 4px;font-family:' + FONT + ';font-size:12px;line-height:1.7;color:' + MUTO + ';text-align:center">' + piede + '</td></tr>' +
    '</table>' +
    '</td></tr></table></body></html>';
}

/* etichetta piccola in maiuscoletto sopra un titolo */
function occhiello(t) {
  return '<p style="margin:0 0 6px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:' + ACCENTO + ';font-weight:700">' + esc(t) + '</p>';
}
function titolo(t) {
  return '<p style="margin:0;font-size:23px;line-height:1.25;font-weight:700;color:' + INK + '">' + esc(t) + '</p>';
}

function righe(coppie) {
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:20px 0 0">' +
    coppie.map(function ([k, v], i) {
      const bordo = i ? 'border-top:1px solid ' + RIGA + ';' : '';
      return '<tr>' +
        '<td style="' + bordo + 'padding:10px 14px 10px 0;color:' + MUTO + ';font-size:13px;vertical-align:top;white-space:nowrap">' + esc(k) + '</td>' +
        '<td style="' + bordo + 'padding:10px 0;font-size:15px;font-weight:600;vertical-align:top;color:' + INK + '">' + v + '</td>' +
        '</tr>';
    }).join('') + '</table>';
}

function sendNotification(env, lead) {
  const verticale = VERTICALI[lead.verticale];
  const dove = lead.citta ? lead.locale + ', ' + lead.citta : lead.locale;
  const link = (href, testo) => '<a href="' + href + '" style="color:' + ACCENTO + ';text-decoration:none">' + esc(testo) + '</a>';

  const coppie = [['Nome', esc(lead.nome)], ['Locale', esc(lead.locale)]];
  if (lead.citta) coppie.push(['Città', esc(lead.citta)]);
  coppie.push(['Email', link('mailto:' + lead.email, lead.email)]);
  if (lead.telefono) coppie.push(['Telefono', link('tel:' + lead.telefono.replace(/[^0-9+]/g, ''), lead.telefono)]);
  coppie.push(['Formula', esc(formulaDi(lead))]);
  if (lead.aggiunte.length) coppie.push(['Aggiunte', esc(lead.aggiunte.join(', '))]);
  coppie.push(['Sezione', esc(verticale)]);

  const corpo = occhiello('Nuova richiesta') + titolo(dove) + righe(coppie) +
    '<p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:' + MUTO + '">' +
    'Rispondi a questa email per scrivere direttamente a ' + esc(lead.nome) + '.' +
    (lead.pagina ? '<br>Arrivata da ' + link(esc(lead.pagina), lead.pagina) : '') + '</p>';

  const piatto = [['Nome', lead.nome], ['Locale', lead.locale]];
  if (lead.citta) piatto.push(['Città', lead.citta]);
  piatto.push(['Email', lead.email]);
  if (lead.telefono) piatto.push(['Telefono', lead.telefono]);
  piatto.push(['Formula', formulaDi(lead)]);
  if (lead.aggiunte.length) piatto.push(['Aggiunte', lead.aggiunte.join(', ')]);
  piatto.push(['Sezione', verticale]);

  const testo = 'NUOVA RICHIESTA - ' + dove + '\n\n' +
    piatto.map(([k, v]) => k + ': ' + v).join('\n') +
    '\n\nRispondi a questa email per scrivere direttamente a ' + lead.nome + '.' +
    (lead.pagina ? '\nArrivata da ' + lead.pagina : '');

  return brevo(env, '/smtp/email', {
    sender: { name: env.SENDER_NAME || env.SITE_NAME || 'Sito', email: env.SENDER_EMAIL },
    to: env.NOTIFY_TO.split(',').map((e) => ({ email: e.trim() })),
    replyTo: { email: lead.email, name: lead.nome },
    subject: '[' + (env.SITE_NAME || 'Sito') + '] ' + dove + ' - richiesta di preventivo',
    htmlContent: guscio(piatto.map(([k, v]) => k + ': ' + v).join(' - '), corpo,
      'Avviso automatico dal modulo di ' + SITO.replace('https://', '')),
    textContent: testo,
    tags: ['preventivo', lead.verticale]
  });
}

function sendConfirmation(env, lead) {
  const sagre = lead.verticale === 'sagre';
  const site = env.SITE_NAME || 'il sito';

  const recap = [[sagre ? 'Festa' : 'Locale', esc(lead.locale) + (lead.citta ? ', ' + esc(lead.citta) : '')]];
  if (haScelto(lead)) recap.push(['Formula', esc(formulaDi(lead))]);
  if (lead.aggiunte.length) recap.push(['Aggiunte', esc(lead.aggiunte.join(', '))]);

  /* Nessuna promessa di tempi: "prima possibile" non impegna a una
     scadenza che poi va rispettata anche nelle settimane piene. */
  const corpo = occhiello('Richiesta ricevuta') +
    titolo('Grazie ' + lead.nome + ', abbiamo preso in carico la tua richiesta.') +
    '<p style="margin:18px 0 0">Ti scriviamo <strong>prima possibile</strong> con il preventivo per <strong>' + esc(lead.locale) + '</strong>.</p>' +
    righe(recap) +
    '<p style="margin:26px 0 0">Se hai fretta o hai richieste particolari, rispondi pure a questa email.</p>' +
    '<p style="margin:20px 0 0">A presto,<br><strong>' + esc(site) + '</strong></p>';

  const piatto = [[sagre ? 'Festa' : 'Locale', lead.locale + (lead.citta ? ', ' + lead.citta : '')]];
  if (haScelto(lead)) piatto.push(['Formula', formulaDi(lead)]);
  if (lead.aggiunte.length) piatto.push(['Aggiunte', lead.aggiunte.join(', ')]);

  const testo = 'Grazie ' + lead.nome + ', abbiamo preso in carico la tua richiesta.\n\n' +
    'Ti scriviamo prima possibile con il preventivo per ' + lead.locale + '.\n\n' +
    piatto.map(([k, v]) => k + ': ' + v).join('\n') + '\n\n' +
    'Se hai fretta o hai richieste particolari, rispondi pure a questa email.\n\n' +
    'A presto,\n' + site + '\n' + SITO + ' - Commerciale 345 293 3633 - Tecnico 345 760 6166';

  return brevo(env, '/smtp/email', {
    sender: { name: env.SENDER_NAME || site, email: env.SENDER_EMAIL },
    to: [{ email: lead.email, name: lead.nome }],
    /* il mittente e' un noreply senza casella dietro: le risposte vanno
       dirottate sul primo indirizzo che legge davvero gli avvisi */
    replyTo: { email: env.NOTIFY_TO.split(',')[0].trim(), name: site },
    subject: 'La tua richiesta è arrivata',
    htmlContent: guscio('Ti scriviamo prima possibile con il preventivo.', corpo,
      '<strong style="color:' + INK + '">c&egrave;lan</strong> &middot; Gestionale per ristoranti, pizzerie e locali<br>' +
      '<a href="' + SITO + '" style="color:' + MUTO + ';text-decoration:none">celan.it</a>' +
      ' &middot; Commerciale <a href="tel:+393452933633" style="color:' + MUTO + ';text-decoration:none">345 293 3633</a>' +
      ' &middot; Tecnico <a href="tel:+393457606166" style="color:' + MUTO + ';text-decoration:none">345 760 6166</a>'),
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
