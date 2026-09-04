/* Banner cookie + Google Analytics 4, senza dipendenze esterne.
 *
 * Uso, in fondo al <body> di ogni pagina:
 *   <script src="../assets/js/consent.js"
 *           data-ga-id="G-XXXXXXXXXX"
 *           data-policy-url="../privacy/#cookie"></script>
 *
 * Regole seguite (Garante privacy, linee guida cookie 10/6/2021 + GDPR):
 *  - gtag.js NON viene scaricato finche' l'utente non accetta: prima del
 *    consenso nessuna richiesta a Google e nessun cookie (Consent Mode
 *    "basic", con i default comunque impostati a "denied").
 *  - "Accetta" e "Rifiuta" hanno la stessa evidenza; chiudere senza
 *    scegliere equivale a non acconsentire.
 *  - La scelta e' salvata in localStorage (dato tecnico, non un cookie di
 *    profilazione) e vale 6 mesi; poi il banner ricompare.
 *  - Le preferenze si possono cambiare in ogni momento da un link con
 *    l'attributo data-consent-open (nel footer).
 *  - Senza data-ga-id il file non fa nulla: niente cookie, niente banner.
 */
(function () {
  'use strict';

  var me = document.currentScript;
  if (!me) return;
  var GA_ID = (me.getAttribute('data-ga-id') || '').trim();
  var POLICY_URL = me.getAttribute('data-policy-url') || '../privacy/#cookie';
  var KEY = 'rmp-consent';
  var TTL_MS = 182 * 24 * 60 * 60 * 1000; /* ~6 mesi */

  /* Consent Mode: default negato, prima di qualunque altra cosa. */
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;
  window.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied'
  });

  if (!GA_ID) {
    /* nessun tracciamento configurato: nessun banner, e il link
       "Preferenze cookie" del footer non ha nulla da aprire */
    document.querySelectorAll('[data-consent-open]').forEach(function (a) {
      var sep = a.previousElementSibling;
      if (sep && sep.classList.contains('footer-sep')) sep.remove();
      a.remove();
    });
    return;
  }

  function readChoice() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var c = JSON.parse(raw);
      if (!c || typeof c.ts !== 'number' || Date.now() - c.ts > TTL_MS) return null;
      return c;
    } catch (e) { return null; }
  }
  function saveChoice(analytics) {
    try { localStorage.setItem(KEY, JSON.stringify({ analytics: !!analytics, ts: Date.now() })); } catch (e) {}
  }

  var gaLoaded = false;
  function loadGA() {
    if (gaLoaded) return;
    gaLoaded = true;
    window.gtag('consent', 'update', { analytics_storage: 'granted' });
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
    document.head.appendChild(s);
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, { anonymize_ip: true });
  }
  function revokeGA() {
    window.gtag('consent', 'update', { analytics_storage: 'denied' });
    /* rimozione best-effort dei cookie GA gia' presenti (stesso dominio) */
    var host = location.hostname.split('.');
    document.cookie.split(';').forEach(function (c) {
      var name = c.split('=')[0].trim();
      if (name !== '_ga' && name.indexOf('_ga_') !== 0 && name !== '_gid') return;
      for (var i = 0; i < host.length - 1; i++) {
        var domain = host.slice(i).join('.');
        document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=' + domain;
      }
      document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    });
  }

  /* ---------- Banner ---------- */
  var banner = null;
  function buildBanner() {
    if (banner) return banner;
    banner = document.createElement('div');
    banner.className = 'consent';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-modal', 'false');
    banner.setAttribute('aria-labelledby', 'consentTitle');
    banner.innerHTML =
      '<div class="consent__box">' +
        '<div class="consent__txt">' +
          '<strong id="consentTitle">Cookie e statistiche</strong>' +
          '<p>Questo sito usa cookie tecnici e, con il tuo consenso, cookie statistici per capire come viene usato. Puoi cambiare idea in ogni momento.</p>' +
          '<a class="consent__link" href="' + POLICY_URL + '">Informativa cookie</a>' +
        '</div>' +
        '<div class="consent__btns">' +
          '<button type="button" class="consent__btn consent__btn--no" data-consent="deny">Rifiuta</button>' +
          '<button type="button" class="consent__btn consent__btn--yes" data-consent="grant">Accetta</button>' +
        '</div>' +
      '</div>';
    banner.addEventListener('click', function (e) {
      var b = e.target.closest('[data-consent]');
      if (!b) return;
      choose(b.getAttribute('data-consent') === 'grant');
    });
    document.body.appendChild(banner);
    return banner;
  }
  function show() {
    buildBanner();
    /* reflow forzato prima della classe, cosi' la transizione parte anche
       al primo frame (niente requestAnimationFrame: nelle schede in
       background non scatta) */
    void banner.offsetHeight;
    banner.classList.add('is-open');
    var first = banner.querySelector('[data-consent="deny"]');
    if (first) first.focus({ preventScroll: true });
  }
  function hide() {
    if (!banner) return;
    banner.classList.remove('is-open');
  }
  function choose(granted) {
    saveChoice(granted);
    hide();
    if (granted) loadGA(); else revokeGA();
  }

  /* ---------- Avvio ---------- */
  var choice = readChoice();
  if (choice === null) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show);
    else show();
  } else if (choice.analytics) {
    loadGA();
  }

  /* Link "Preferenze cookie" (footer): riapre il banner. */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-consent-open]');
    if (!a) return;
    e.preventDefault();
    show();
  });

  window.rmpConsent = { open: show, choice: readChoice };
})();
