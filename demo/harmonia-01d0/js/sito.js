/* Harmônia: orari, appuntamento, movimento */
(function () {
  'use strict';
  var d = document, root = d.documentElement, TEL = '393475642695';
  var riduci = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var conGsap = !!(window.gsap && window.ScrollTrigger);
  function wa(t) { return 'https://wa.me/' + TEL + '?text=' + encodeURIComponent(t); }

  /* ---------- orari (Google Maps, 27/11/2026), ora di Roma ---------- */
  var ORARI = { 0: null, 1: null, 2: [720, 1200], 3: [720, 1200], 4: [720, 1200], 5: [540, 1050], 6: [510, 1050] };
  var NOMI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
  var MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  function adesso() {
    try {
      var p = {};
      new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
        .formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
      return { g: { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[p.weekday], m: (+p.hour) * 60 + (+p.minute), y: +p.year, mo: +p.month - 1, d: +p.day };
    } catch (e) { var n = new Date(); return { g: n.getDay(), m: n.getHours() * 60 + n.getMinutes(), y: n.getFullYear(), mo: n.getMonth(), d: n.getDate() }; }
  }
  function hh(x) { return Math.floor(x / 60) + ':' + ('0' + x % 60).slice(-2); }
  var t = adesso(), o = ORARI[t.g], testo, aperto = false;
  if (o && t.m >= o[0] && t.m < o[1]) { aperto = true; testo = '<strong>Aperto ora</strong>, fino alle ' + hh(o[1]); }
  else if (o && t.m < o[0]) { testo = '<strong>Chiuso ora</strong>, apre oggi alle ' + hh(o[0]); }
  else {
    for (var k = 1; k <= 7; k++) {
      var gg = (t.g + k) % 7;
      if (ORARI[gg]) { testo = '<strong>Chiuso ora</strong>, riapre ' + (k === 1 ? 'domani' : NOMI[gg]) + ' alle ' + hh(ORARI[gg][0]); break; }
    }
  }
  var st = d.getElementById('stato2');
  if (st) { st.innerHTML = '<i></i>' + testo; if (!aperto) st.classList.add('chiuso'); }
  d.querySelectorAll('.ore li').forEach(function (li) {
    if (li.getAttribute('data-d').split(' ').indexOf(String(t.g)) > -1) { li.classList.add('oggi'); li.setAttribute('aria-current', 'date'); }
  });

  /* =====================================================================
     PRENDI APPUNTAMENTO: nessun server. Il modulo compone un messaggio
     WhatsApp con servizio, giorno, ora e nome; Piera conferma.
     ===================================================================== */
  var SERVIZI = ['Ricostruzione unghie', 'Refill', 'Nail art', 'Manicure', 'Pedicure spa', 'Trattamento mani glow', 'Lash Fusion', 'Epilazione brasiliana', 'Solarium', 'Consulenza skincare'];
  var dlg = d.getElementById('appuntamento'), form = d.getElementById('app-form');
  var scelta = { servizio: '', giorno: null, ora: '' };
  var oggi = new Date(t.y, t.mo, t.d), domani = new Date(t.y, t.mo, t.d + 1);
  var limite = new Date(t.y, t.mo, t.d + 75);
  /* festivi nazionali e chiusura 1-6 gennaio (brief: post IG 29/12/2025); la Pasqua si calcola per anno */
  var FESTIVI = ['01-01', '01-06', '04-25', '05-01', '06-02', '08-15', '11-01', '12-08', '12-25', '12-26'];
  function pasqua(y) {
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, dd = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3),
      h = (19 * a + b - dd - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
      mese = Math.floor((h + l - 7 * m + 114) / 31), gg = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, mese - 1, gg);
  }
  function chiuso(dt) {
    var mm = ('0' + (dt.getMonth() + 1)).slice(-2) + '-' + ('0' + dt.getDate()).slice(-2);
    if (FESTIVI.indexOf(mm) > -1) return true;
    if (dt.getMonth() === 0 && dt.getDate() <= 6) return true;
    var p = pasqua(dt.getFullYear()), pq = new Date(p.getFullYear(), p.getMonth(), p.getDate() + 1);
    return dt.getTime() === p.getTime() || dt.getTime() === pq.getTime();
  }
  /* prenotabile: dal giorno dopo, entro 75 giorni, giorno di apertura e non festivo */
  function prenotabile(dt) { return dt >= domani && dt <= limite && !!ORARI[dt.getDay()] && !chiuso(dt); }
  function slotDelGiorno(dt) {
    var o = ORARI[dt.getDay()]; if (!o || !prenotabile(dt)) return [];
    var out = []; for (var m = o[0]; m <= o[1] - 30; m += 30) out.push(m);
    return out;
  }
  var primoLibero = (function () { for (var n = 1; n <= 80; n++) { var x = new Date(t.y, t.mo, t.d + n); if (prenotabile(x)) return x; } return domani; })();
  var meseVisto = new Date(primoLibero.getFullYear(), primoLibero.getMonth(), 1);
  function etichetta(dt) { return NOMI[dt.getDay()] + ' ' + dt.getDate() + ' ' + MESI[dt.getMonth()]; }

  function disegnaServizi() {
    var box = d.getElementById('servizi-l');
    box.innerHTML = SERVIZI.map(function (s) {
      return '<label class="chip"><input type="radio" name="servizio" value="' + s + '"' + (s === scelta.servizio ? ' checked' : '') + '><span>' + s + '</span></label>';
    }).join('');
    box.querySelectorAll('input').forEach(function (i) { i.addEventListener('change', function () { scelta.servizio = i.value; pulisci('serv'); }); });
  }
  function disegnaCalendario() {
    var box = d.getElementById('cal-d'), y = meseVisto.getFullYear(), m = meseVisto.getMonth();
    d.getElementById('cal-mese').textContent = MESI[m] + ' ' + y;
    var primo = (new Date(y, m, 1).getDay() + 6) % 7, giorni = new Date(y, m + 1, 0).getDate(), html = '';
    for (var v = 0; v < primo; v++) html += '<span></span>';
    for (var g = 1; g <= giorni; g++) {
      var dt = new Date(y, m, g), ok = prenotabile(dt);
      var sel = scelta.giorno && dt.getTime() === scelta.giorno.getTime();
      html += '<button type="button" data-g="' + g + '"' + (ok ? '' : ' disabled') + ' aria-pressed="' + (sel ? 'true' : 'false') + '" aria-label="' + etichetta(dt) + (ok ? '' : ', non disponibile') + '"' +
        (dt.getTime() === oggi.getTime() ? ' class="oggi-c"' : '') + '>' + g + '</button>';
    }
    box.innerHTML = html;
    d.querySelector('.cal-nav[data-mese="-1"]').disabled = (y === primoLibero.getFullYear() && m === primoLibero.getMonth());
    d.querySelector('.cal-nav[data-mese="1"]').disabled = new Date(y, m + 1, 1) > limite;
    box.querySelectorAll('button:not(:disabled)').forEach(function (b) {
      b.addEventListener('click', function () {
        scelta.giorno = new Date(y, m, +b.getAttribute('data-g')); scelta.ora = '';
        pulisci('giorno'); disegnaCalendario(); disegnaOre();
        var nb = box.querySelector('[data-g="' + b.getAttribute('data-g') + '"]'); if (nb) nb.focus();
      });
    });
  }
  function disegnaOre() {
    var box = d.getElementById('ore-l');
    if (!scelta.giorno) { box.innerHTML = '<p class="ore-l">Scegli prima il giorno: qui compaiono gli orari di apertura.</p>'; return; }
    var sl = slotDelGiorno(scelta.giorno);
    function gruppo(nome, lista) {
      if (!lista.length) return '';
      return '<div class="ore-gr"><p class="ore-t">' + nome + '</p><div class="chips">' + lista.map(function (m) {
        return '<label class="chip"><input type="radio" name="ora" value="' + hh(m) + '"><span>' + hh(m) + '</span></label>';
      }).join('') + '</div></div>';
    }
    box.innerHTML = gruppo('Mattina', sl.filter(function (m) { return m < 720; })) + gruppo('Pomeriggio', sl.filter(function (m) { return m >= 720; }));
    box.querySelectorAll('input').forEach(function (i) { i.addEventListener('change', function () { scelta.ora = i.value; pulisci('ora'); }); });
    if (conGsap && !riduci) gsap.fromTo(box.querySelectorAll('.chip'), { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: .45, stagger: .02, ease: 'power3.out' });
  }
  function campo(id) { return id === 'nome' ? d.getElementById('f-nome') : id === 'tel' ? d.getElementById('f-tel') : null; }
  function errore(id, msg) {
    var e = d.getElementById('e-' + id); if (e) e.textContent = msg;
    var g = d.getElementById('g-' + id); if (g) g.classList.add('errore');
    var inp = campo(id); if (inp) inp.setAttribute('aria-invalid', 'true');
  }
  function pulisci(id) {
    var e = d.getElementById('e-' + id); if (e) e.textContent = '';
    var g = d.getElementById('g-' + id); if (g) g.classList.remove('errore');
    var inp = campo(id); if (inp) inp.removeAttribute('aria-invalid');
  }
  if (form) {
    d.querySelectorAll('.cal-nav').forEach(function (b) {
      b.addEventListener('click', function () { meseVisto = new Date(meseVisto.getFullYear(), meseVisto.getMonth() + (+b.getAttribute('data-mese')), 1); disegnaCalendario(); });
    });
    d.getElementById('f-nome').addEventListener('input', function () { pulisci('nome'); });
    d.getElementById('f-tel').addEventListener('input', function () { pulisci('tel'); });
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var nome = d.getElementById('f-nome').value.trim(), tel = d.getElementById('f-tel').value.trim();
      var cifre = tel.replace(/[^\d]/g, '').replace(/^(0039|39)(?=\d{9,})/, ''), primo = null;
      if (!scelta.servizio) { errore('serv', 'Scegli il servizio che ti interessa.'); primo = primo || d.querySelector('#servizi-l input'); }
      if (!scelta.giorno) { errore('giorno', 'Scegli un giorno tra quelli in cui siamo aperti.'); primo = primo || d.querySelector('#cal-d button:not(:disabled)'); }
      else if (!scelta.ora) { errore('ora', 'Scegli un orario per quel giorno.'); primo = primo || d.querySelector('#ore-l input'); }
      if (nome.length < 2) { errore('nome', 'Scrivi il tuo nome, così Piera sa chi sei.'); primo = primo || d.getElementById('f-nome'); }
      if (cifre.length < 9 || cifre.length > 11) { errore('tel', cifre.length ? 'Il numero sembra incompleto: controlla le cifre.' : 'Scrivi un numero di telefono per la conferma.'); primo = primo || d.getElementById('f-tel'); }
      if (primo) { primo.focus(); return; }
      var msg = 'Ciao Harmônia, vorrei chiedere un appuntamento.\n' +
        'Servizio: ' + scelta.servizio + '\n' +
        'Giorno: ' + etichetta(scelta.giorno) + ' ' + scelta.giorno.getFullYear() + '\n' +
        'Ora: ' + scelta.ora + '\n' +
        'Nome: ' + nome + '\n' +
        'Telefono: ' + tel + '\n' +
        'Aspetto la vostra conferma.';
      var url = wa(msg);
      form.setAttribute('data-wa', url);
      d.getElementById('app-wa').href = url;
      dlg.classList.add('inviata');
      window.open(url, '_blank', 'noopener');
    });
  }
  function apri(servizio) {
    if (!dlg || !dlg.showModal) return false;
    dlg.classList.remove('inviata');
    if (servizio) scelta.servizio = servizio;
    meseVisto = scelta.giorno ? new Date(scelta.giorno.getFullYear(), scelta.giorno.getMonth(), 1) : new Date(primoLibero.getFullYear(), primoLibero.getMonth(), 1);
    disegnaServizi(); disegnaCalendario(); disegnaOre();
    /* apertura nel fotogramma successivo, fuori dal clic: così resta sempre modale (tastiera e Esc corretti) */
    requestAnimationFrame(function () {
      if (dlg.open) dlg.close();
      dlg.showModal();
      if (conGsap && !riduci) {
        /* sulla finestra solo opacità: leggere la trasformazione di un elemento fisso la toglierebbe dal livello modale */
        gsap.fromTo(dlg, { autoAlpha: 0 }, { autoAlpha: 1, duration: .45, ease: 'power2.out' });
        gsap.fromTo(dlg.querySelectorAll('.app-f, .app-ok'), { y: 40 }, { y: 0, duration: .7, ease: 'expo.out' });
        gsap.fromTo(dlg.querySelectorAll('.app-h, .app-n, .app-g'), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: .7, stagger: .06, ease: 'expo.out', delay: .1 });
      }
    });
    return true;
  }
  function chiudi() {
    if (!dlg.open) return;
    if (conGsap && !riduci) gsap.to(dlg, { autoAlpha: 0, duration: .3, ease: 'power2.in', onComplete: function () { dlg.close(); gsap.set(dlg, { clearProps: 'opacity,visibility' }); } });
    else dlg.close();
  }
  d.querySelectorAll('[data-app]').forEach(function (a) {
    a.addEventListener('click', function (ev) { if (apri(a.getAttribute('data-servizio'))) ev.preventDefault(); });
  });
  if (dlg) {
    dlg.querySelectorAll('[data-chiudi]').forEach(function (b) { b.addEventListener('click', chiudi); });
    dlg.addEventListener('click', function (ev) { if (ev.target === dlg) chiudi(); });
    dlg.addEventListener('cancel', function (ev) { ev.preventDefault(); chiudi(); });
    dlg.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { ev.preventDefault(); chiudi(); } });
  }
  window.__apriAppuntamento = apri;
  if (location.hash === '#appuntamento') setTimeout(function () { apri(); }, 300);

  /* ---------- carosello dei lavori: dito, frecce, trascinamento col mouse, barra di avanzamento ---------- */
  var car = d.getElementById('car-track'), fill = d.getElementById('car-fill');
  if (car) {
    var aggiorna = function () {
      var max = car.scrollWidth - car.clientWidth, p = max > 0 ? car.scrollLeft / max : 1;
      fill.style.transform = 'scaleX(' + (0.12 + p * 0.88) + ')';
      var fr = d.querySelectorAll('.car-b'); fr[0].disabled = car.scrollLeft < 4; fr[1].disabled = car.scrollLeft > max - 4;
    };
    var rafC = 0; car.addEventListener('scroll', function () { if (!rafC) rafC = requestAnimationFrame(function () { rafC = 0; aggiorna(); }); }, { passive: true });
    d.querySelectorAll('.car-b').forEach(function (b) {
      b.addEventListener('click', function () { var c = car.querySelector('.car-c'); car.scrollBy({ left: (+b.getAttribute('data-dir')) * (c.offsetWidth + 12) * (innerWidth < 1024 ? 1 : 2), behavior: riduci ? 'auto' : 'smooth' }); });
    });
    var giu = null;
    car.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') return; giu = { x: e.clientX, s: car.scrollLeft }; car.classList.add('trascina'); });
    window.addEventListener('pointermove', function (e) { if (giu) car.scrollLeft = giu.s - (e.clientX - giu.x); });
    window.addEventListener('pointerup', function () { if (!giu) return; giu = null; car.classList.remove('trascina');
      var c = car.querySelector('.car-c'), passo = c.offsetWidth + 22; car.scrollTo({ left: Math.round(car.scrollLeft / passo) * passo, behavior: 'smooth' }); });
    aggiorna(); window.addEventListener('resize', aggiorna);
  }

  /* ---------- velo tra le pagine (home <-> corsi) ---------- */
  var velo = d.querySelector('.velo');
  d.querySelectorAll('a[href^="corso-"]').forEach(function (a) {
    if (a.closest('.menu')) return;
    a.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey) return; e.preventDefault(); var h = a.getAttribute('href');
      try { sessionStorage.setItem('velo', '1'); } catch (er) {}
      if (!conGsap || riduci) { location.href = h; return; }
      gsap.fromTo(velo, { yPercent: 101 }, { yPercent: 0, duration: .55, ease: 'expo.inOut', onComplete: function () { location.href = h; } });
    });
  });
  try { sessionStorage.removeItem('velo'); } catch (er) {}
  if (root.classList.contains('velo-su')) {
    if (conGsap && !riduci) gsap.fromTo(velo, { yPercent: 0 }, { yPercent: -101, duration: .7, ease: 'expo.inOut', delay: .1, onComplete: function () { root.classList.remove('velo-su'); gsap.set(velo, { clearProps: 'all' }); } });
    else root.classList.remove('velo-su');
  }
  window.addEventListener('pageshow', function (e) { if (e.persisted) { root.classList.remove('velo-su'); if (conGsap) gsap.set(velo, { yPercent: 101 }); } });

  /* ---------- foto: dopo il caricamento della pagina scarico in anticipo anche quelle più in basso ---------- */
  window.addEventListener('load', function () {
    setTimeout(function () { d.querySelectorAll('img[loading="lazy"]').forEach(function (i) { i.loading = 'eager'; }); }, 400);
  });

  /* ---------- testo diviso in lettere ---------- */
  function dividi(el) {
    if (/^H[1-6]$/.test(el.tagName) || el.tagName === 'A') el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    (function giro(nodo) {
      [].slice.call(nodo.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var f = d.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (pz) {
            if (!pz) return;
            if (/^\s+$/.test(pz)) { f.appendChild(d.createTextNode(' ')); return; }
            var w = d.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
            Array.from(pz).forEach(function (c) { var s = d.createElement('span'); s.className = 'ch'; s.textContent = c; w.appendChild(s); });
            f.appendChild(w);
          });
          n.parentNode.replaceChild(f, n);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') giro(n);
      });
    })(el);
  }
  d.querySelectorAll('.split').forEach(dividi);

  /* la parola dell'apertura riempie la larghezza giusta qualunque sia il font;
     gli altri titoli si riducono se una parola non entra nella colonna */
  function adatta() {
    var pw = d.querySelector('.parola-w');
    if (pw) {
      pw.style.fontSize = '100px';
      var largo = pw.querySelector('.w').getBoundingClientRect().width || 1;
      var meta = Math.min(window.innerWidth * (window.innerWidth < 1024 ? .8 : .5), 760);
      var alto = window.innerHeight * (window.innerWidth < 1024 ? .15 : .26);
      pw.style.fontSize = Math.min(100 * meta / largo, alto) + 'px';
    }
    d.querySelectorAll('.split').forEach(function (h) {
      h.style.fontSize = '';
      var spazio = h.clientWidth, max = 0;
      h.querySelectorAll('.w').forEach(function (w) { max = Math.max(max, w.getBoundingClientRect().width); });
      if (max > spazio && spazio > 0) h.style.fontSize = (parseFloat(getComputedStyle(h).fontSize) * spazio / max * .96) + 'px';
    });
  }
  adatta();
  if (d.fonts && d.fonts.ready) d.fonts.ready.then(function () { adatta(); if (window.ScrollTrigger) ScrollTrigger.refresh(); });
  var tAd; window.addEventListener('resize', function () { clearTimeout(tAd); tAd = setTimeout(adatta, 150); });

  /* parole della bio */
  var bio = d.getElementById('bio');
  if (bio) bio.innerHTML = bio.textContent.trim().split(/\s+/).map(function (p) { return '<span class="pw">' + p + '</span>'; }).join(' ');

  if (!conGsap) { root.classList.remove('anim'); root.classList.add('static'); return; }
  gsap.registerPlugin(ScrollTrigger);

  /* barra fissa Chiama/Appuntamento: dopo l'apertura, sparisce sui contatti */
  ScrollTrigger.create({ trigger: '#servizi', start: 'top 35%', endTrigger: '#contatti', end: 'top 85%', toggleClass: { targets: '#barra', className: 'on' } });

  if (riduci) { root.classList.add('static'); return; }

  var mm = gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)', function () {
    var desk = window.matchMedia('(min-width: 1024px)').matches;
    window.__giri = (window.__giri || 0) + 1;

    /* ===== apertura: gli smalti cadono uno sull'altro in un mazzetto, la pila gira come una ruota
       colori e si apre a ventaglio, un riflesso lucido le attraversa, poi arrivano parola e invito ===== */
    var S = gsap.utils.toArray('.punta .s'), L = gsap.utils.toArray('.luce');
    var caduta = -Math.min(window.innerHeight * .55, 520);
    gsap.set('.punta', { '--a': function (i) { return ((i - 4) * 2.5) + 'deg'; } });
    var tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.fromTo(S, { y: caduta, autoAlpha: 0, rotation: -25 }, { y: 0, autoAlpha: 1, rotation: 0, duration: .34, ease: 'power2.in', stagger: .075 }, 0)
      .fromTo(S, { scaleY: .74, scaleX: 1.16 }, { scaleY: 1, scaleX: 1, duration: .55, ease: 'elastic.out(1,.42)', stagger: .075, immediateRender: false }, .34)
      .fromTo('.ventaglio', { rotation: 0 }, { rotation: 360, duration: 1.35, ease: 'power3.inOut', immediateRender: false }, .82)
      .set('.ventaglio', { rotation: 0 }, 2.17)
      .to('.punta', { '--a': function (i, el) { return el.getAttribute('data-a') + 'deg'; }, duration: 1.15, ease: 'back.out(1.3)', stagger: { each: .035, from: 'center' } }, 1.08)
      .fromTo(L, { xPercent: -130, opacity: 1 }, { xPercent: 130, duration: .75, ease: 'power2.inOut', stagger: .045 }, 1.95)
      .set(L, { opacity: 0 }, 3.2)
      .fromTo('.parola-w .ch', { yPercent: 170, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: .8, stagger: .04 }, .05)
      .fromTo('.sub, .piede > *', { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: .55, stagger: .08, ease: 'power3.out' }, .2);
    window.__intro = tl;
    function salta() { if (tl.progress() < 1) tl.progress(1); ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (e) { window.removeEventListener(e, salta); }); }
    ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (e) { window.addEventListener(e, salta, { passive: true }); });

    /* uscendo dall'apertura: il ventaglio gira, la parola sale più lenta (due piani) */
    gsap.to('.ventaglio-giro', { rotation: desk ? 14 : 10, ease: 'none', scrollTrigger: { trigger: '.apertura', start: 'top top', end: 'bottom top', scrub: .6 } });
    gsap.to('.parola-w', { yPercent: -18, ease: 'none', scrollTrigger: { trigger: '.apertura', start: 'top top', end: 'bottom top', scrub: .6 } });

    /* ===== il fondo cambia colore seguendo lo scorrimento: strati fissi a tinta unita, si anima solo l'opacità ===== */
    var secs = gsap.utils.toArray('[data-fondo]'), fondi = d.createElement('div');
    fondi.className = 'fondi'; fondi.setAttribute('aria-hidden', 'true');
    fondi.innerHTML = secs.map(function (x) { return '<i style="background:' + x.getAttribute('data-fondo') + '"></i>'; }).join('');
    d.body.prepend(fondi);
    var strati = fondi.querySelectorAll('i');
    secs.forEach(function (sec, i) {
      if (!i) return;
      /* il cambio parte quando la nuova sezione occupa lo schermo (inizio al 40% dall'alto, fine al 10%) */
      gsap.fromTo(strati[i], { opacity: 0 }, { opacity: 1, ease: 'none', immediateRender: false,
        scrollTrigger: { trigger: sec, start: 'top 40%', end: 'top 10%', scrub: true } });
    });

    /* ===== titoli che si compongono lettera per lettera ===== */
    gsap.utils.toArray('.split').forEach(function (h) {
      gsap.set(h, { autoAlpha: 1 });
      gsap.fromTo(h.querySelectorAll('.ch'), { yPercent: 170, rotation: 6 }, {
        yPercent: 0, rotation: 0, duration: .9, ease: 'expo.out', stagger: { each: .025, amount: .4 },
        scrollTrigger: { trigger: h, start: 'top 90%', once: true }
      });
    });

    /* ===== foto: si rivelano da una maschera a forma di unghia che cresce ===== */
    gsap.utils.toArray('.rev').forEach(function (fig) {
      var m = fig.querySelector('.m'), img = m.querySelector('img');
      /* già nello schermo all'avvio: si vede subito, senza maschera */
      if (fig.getBoundingClientRect().top < window.innerHeight) { gsap.set(m, { scale: 1, borderRadius: 0 }); gsap.set(img, { scale: 1 }); return; }
      var giro = gsap.fromTo(m, { scale: .6 }, { scale: 1.9, duration: .9, ease: 'expo.out', paused: true, immediateRender: false,
        onUpdate: function () { gsap.set(img, { scale: 1.12 / gsap.getProperty(m, 'scale') }); },
        onComplete: function () { gsap.set(m, { scale: 1, borderRadius: 0 }); gsap.fromTo(img, { scale: 1.12 }, { scale: 1, duration: .8, ease: 'power2.out' }); }
      });
      ScrollTrigger.create({ trigger: fig, start: 'top bottom+=80', once: true, onEnter: function () {
        var via = function () { giro.play(); };
        if (img.complete && img.naturalWidth) via(); else if (img.decode) img.decode().then(via, via); else img.addEventListener('load', via);
      } });
    });
    gsap.utils.toArray('.par img').forEach(function (img) {
      gsap.fromTo(img, { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: img.closest('.foto'), start: 'top bottom', end: 'bottom top', scrub: true } });
    });

    /* ===== blocchi di testo ===== */
    ScrollTrigger.batch('.rv', {
      start: 'top 92%', once: true,
      onEnter: function (els) { gsap.fromTo(els, { autoAlpha: 0, y: 34 }, { autoAlpha: 1, y: 0, duration: 1, ease: 'power3.out', stagger: .1, overwrite: true }); }
    });

    /* ===== lavori: le foto entrano da destra, una dopo l'altra ===== */
    gsap.fromTo('.car-c', { x: 70 }, { x: 0, duration: .9, ease: 'expo.out', stagger: .05, scrollTrigger: { trigger: '.car', start: 'top bottom', once: true } });

    /* ===== solarium: la luce si avvicina, la foto di Piera viaggia su un altro piano ===== */
    gsap.fromTo('.sole-bg img', { scale: 1.3 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '.sole', start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.fromTo('.sole-ins', { y: desk ? 80 : 24 }, { y: desk ? -40 : -24, ease: 'none', scrollTrigger: { trigger: '.sole', start: 'top bottom', end: 'bottom top', scrub: true } });

    /* ===== piani in parallasse indicati nell'HTML (data-vel in px) ===== */
    gsap.utils.toArray('[data-vel]').forEach(function (el) {
      var v = +el.getAttribute('data-vel');
      gsap.fromTo(el, { y: -v / 2 }, { y: v / 2, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
    });

    /* ===== la domanda a Piera si scrive come un messaggio ===== */
    var dom = d.getElementById('domanda');
    if (dom) {
      var frase = dom.textContent; dom.setAttribute('aria-label', frase);
      dom.innerHTML = '<span aria-hidden="true">' + Array.from(frase).map(function (c) { return '<span class="tc" style="visibility:hidden">' + c + '</span>'; }).join('') + '<span class="caret"></span></span>';
      var tcs = dom.querySelectorAll('.tc');
      ScrollTrigger.create({ trigger: dom, start: 'top 85%', once: true, onEnter: function () {
        gsap.to(tcs, { visibility: 'visible', duration: .01, stagger: .055, ease: 'none', onComplete: function () { gsap.to(dom.querySelector('.caret'), { autoAlpha: 0, delay: 1.2 }); } });
      } });
    }

    /* ===== bio di Piera: le parole si accendono una dopo l'altra ===== */
    gsap.fromTo('#bio .pw', { opacity: .2 }, { opacity: 1, duration: .5, ease: 'none', stagger: .045, scrollTrigger: { trigger: '#bio', start: 'top 85%', once: true } });

    /* ===== corsi: il filo si stende ===== */
    gsap.fromTo('.corsi-l .linea', { scaleX: 0 }, { scaleX: 1, duration: 1.4, ease: 'expo.inOut', stagger: .15, scrollTrigger: { trigger: '.corsi-l', start: 'top 85%', once: true } });

    /* ===== card regalo: il mazzo si apre ===== */
    gsap.from('.card', { rotation: 0, x: 0, y: function (i) { return -i * (desk ? 90 : 70); }, duration: 1.4, ease: 'expo.out', stagger: .08, scrollTrigger: { trigger: '.mazzo', start: 'top 85%', once: true } });

    /* ===== il numero si compone: le cifre girano come un contatore e si fermano ===== */
    var cifre = gsap.utils.toArray('.numero .ch').filter(function (c) { return /\d/.test(c.textContent); });
    cifre.forEach(function (c) { c.setAttribute('data-v', c.textContent); });
    ScrollTrigger.create({ trigger: '.numero', start: 'top 88%', once: true, onEnter: function () {
      cifre.forEach(function (c, i) {
        var giri = { n: 0 };
        gsap.to(giri, { n: 1, duration: .5 + i * .07, ease: 'none', onUpdate: function () { c.textContent = Math.floor(Math.random() * 10); }, onComplete: function () { c.textContent = c.getAttribute('data-v'); } });
      });
    } });

    /* ===== una piccola unghia segue il puntatore (solo mouse) e si apre sopra ciò che si tocca ===== */
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
      var cur = d.querySelector('.cursore'), xTo = gsap.quickTo(cur, 'x', { duration: .45, ease: 'power3.out' }), yTo = gsap.quickTo(cur, 'y', { duration: .45, ease: 'power3.out' });
      var ultimo = 0;
      window.addEventListener('pointermove', function (e) {
        cur.classList.add('on'); xTo(e.clientX); yTo(e.clientY);
        var dx = e.clientX - ultimo; ultimo = e.clientX;
        gsap.to(cur, { rotation: gsap.utils.clamp(-35, 35, dx * 1.5), duration: .4, overwrite: 'auto' });
      }, { passive: true });
      d.addEventListener('pointerover', function (e) {
        var su = e.target.closest && e.target.closest('a, button, label, .foto, .lav');
        gsap.to(cur, { scale: su ? 2.1 : 1, opacity: su ? .55 : .9, duration: .4, ease: 'expo.out', overwrite: 'auto' });
      });
      d.documentElement.addEventListener('pointerleave', function () { cur.classList.remove('on'); });
    }
  });

  ScrollTrigger.create({ trigger: d.body, start: 'bottom bottom+=2', onEnter: function () { gsap.set('.rv, .split', { autoAlpha: 1 }); } });
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
})();
