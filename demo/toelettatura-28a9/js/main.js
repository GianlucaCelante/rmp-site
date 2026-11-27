(function () {
  'use strict';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* la pagina parte sempre dall'inizio: niente ripristino dello scroll del browser */
  try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (e) {}
  function inCima() { if (!location.hash) window.scrollTo(0, 0); }
  inCima(); addEventListener('load', function () { setTimeout(inCima, 0); setTimeout(inCima, 120); });
  addEventListener('pageshow', function () { setTimeout(inCima, 0); });
  if (/[?&]statico/.test(location.search)) document.documentElement.classList.add('statico');
  var hasG = !!(window.gsap && window.ScrollTrigger);
  if (hasG) { gsap.registerPlugin(ScrollTrigger); ScrollTrigger.clearScrollMemory('manual'); }

  /* altezza dell'apertura fissata in px: la barra del browser non la fa saltare */
  var lastW = 0;
  function lockH() {
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    document.documentElement.style.setProperty('--hh', window.innerHeight + 'px');
  }
  lockH(); addEventListener('resize', lockH);

  var testata = document.querySelector('[data-testata]');
  var barra = document.querySelector('[data-barra]');
  var apertura = document.querySelector('[data-apertura]');
  var contatti = document.querySelector('[data-contatti]');

  /* lettere della parola gigante */
  var gig = document.querySelector('[data-gigante]');
  gig.innerHTML = gig.textContent.split('').map(function (c) { return '<span class="ch">' + c + '</span>'; }).join('');
  /* la parola gigante occupa tutta la larghezza dell'apertura, senza mai uscire */
  function adatta() {
    var w = apertura.clientWidth - (window.innerWidth < 900 ? 36 : 96);
    gig.style.fontSize = '100px'; gig.style.display = 'inline-block';
    var prova = document.createElement('span');
    prova.textContent = gig.textContent;
    prova.style.cssText = 'position:absolute;left:-9999px;top:0;white-space:nowrap;visibility:hidden;font:900 100px/.8 ' + getComputedStyle(gig).fontFamily + ';letter-spacing:-.065em';
    document.body.appendChild(prova);
    var m = prova.getBoundingClientRect().width * 1.04;
    prova.remove();
    gig.style.display = '';
    var fs = 100 * w / m, max = window.innerHeight * (window.innerWidth < 900 ? .24 : .42);
    gig.style.fontSize = Math.min(fs, max) + 'px';
    /* il cane parte dalla meta' bassa della parola: copre poco e la parola si legge */
    var rA = apertura.getBoundingClientRect(), rG = gig.getBoundingClientRect(), f = parseFloat(gig.style.fontSize);
    var baseline = rG.top - rA.top + f * .8;
    apertura.style.setProperty('--top-cane', Math.round(baseline - f * (window.innerWidth < 900 ? .22 : .5)) + 'px');
  }
  adatta(); addEventListener('resize', adatta);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(adatta); addEventListener('load', function () { adatta(); setTimeout(adatta, 300); }); if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', adatta);

  /* parole dei titoli, ognuna in una maschera */
  document.querySelectorAll('[data-parole]').forEach(function (h) {
    (function wrap(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (t) {
            if (!t) return;
            if (/^\s+$/.test(t)) { frag.appendChild(document.createTextNode(' ')); return; }
            var o = document.createElement('span'); o.className = 'parola';
            var i = document.createElement('span'); i.textContent = t; o.appendChild(i); frag.appendChild(o);
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.tagName !== 'MARK') wrap(n);
      });
    })(h);
  });

  /* bolle */
  if (window.Bolle) {
    window.__bolle = new window.Bolle.Field(apertura, { entrata: true, max: [9, 13] });
    window.__bolle2 = new window.Bolle.Field(contatti, { max: [7, 10], scale: 1.1 });
  }

  /* testata e barra telefono */
  var contattiVisti = false;
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.target === apertura) { var fuori = e.intersectionRatio < .5; testata.classList.toggle('solida', fuori); barra.classList.toggle('su', fuori && !contattiVisti); }
      if (e.target === contatti) { contattiVisti = e.isIntersecting; barra.classList.toggle('su', !contattiVisti && testata.classList.contains('solida')); }
    });
  }, { threshold: [0, .5, 1] });
  io.observe(apertura); io.observe(contatti);

  /* orari: oggi e stato */
  (function () {
    var now = new Date(), g = now.getDay(), h = now.getHours() + now.getMinutes() / 60;
    document.querySelectorAll('[data-orari] > div').forEach(function (r) { if (r.getAttribute('data-giorni').split(',').indexOf(String(g)) > -1) r.classList.add('oggi'); });
    var apre = { 2: [9, 17], 3: [9, 17], 4: [9, 17], 5: [9, 17], 6: [9, 14] }[g], s = document.querySelector('[data-stato]');
    if (apre && h >= apre[0] && h < apre[1]) s.textContent = 'Aperto adesso, fino alle ' + apre[1] + '.';
    else if (apre && h < apre[0]) s.textContent = 'Oggi apriamo alle 9.';
    else {
      var d = (g + 1) % 7, n = 1; while (d === 0 || d === 1) { d = (d + 1) % 7; n++; }
      var nomi = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
      s.textContent = 'Chiuso adesso. Riapriamo ' + (n === 1 ? 'domani' : nomi[d]) + ' alle 9.';
    }
  })();

  if (!hasG || reduce) { var ie = document.querySelector('[data-intro]'); if (ie) ie.remove(); return; }

  /* entrata: lettere che salgono, cane che si affaccia da dietro il blocco */
  var cane = document.querySelector('[data-cane]');
  function entra() {
    var tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.to('.gigante .ch', { y: 0, duration: 1.1, stagger: .06 })
      .fromTo(cane, { opacity: 1, y: '38%' }, { y: 0, duration: 1.2, ease: 'back.out(1.3)' }, .2)
      .fromTo('.blocco-apertura', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1 }, .3);
  }

  /* apertura del sito: una bolla grande si forma, galleggia e scoppia; dal buco compare il sito */
  function intro(done) {
    var el = document.querySelector('[data-intro]'), seen = false;
    if (seen || !window.Bolle) { el.remove(); done(); return; }
    document.documentElement.classList.add('intro-on');
    var f = new window.Bolle.Field(el, { nospawn: true, sat: 1.7, fr0: .05, gain: .95 });
    if (!f.ok) { el.remove(); done(); return; }
    var gocce = el.querySelector('[data-gocce]'); document.body.appendChild(gocce);
    var W = el.clientWidth, H = el.clientHeight, R = Math.min(W, H) * (W < 760 ? .34 : .26), cx = W / 2, cy = H * .47;
    el.style.setProperty('--cx', cx + 'px'); el.style.setProperty('--cy', cy + 'px'); el.style.setProperty('--buco', '0px');
    var b = f.mk(cx, cy, 1); b.still = true; f.bubbles = [b]; f.kick();
    var st = { r: 1, y: cy }, scoppiata = false, partito = false;
    var tl = gsap.timeline();
    tl.to(st, { r: R, duration: .9, ease: 'elastic.out(1, .6)', onUpdate: function () { b.r = st.r; } })
      .to(st, { y: cy - 12, duration: .45, ease: 'sine.inOut', yoyo: true, repeat: 1, onUpdate: function () { b.y = st.y; } }, '-=.25')
      .call(scoppia);
    function scoppia() {
      if (scoppiata) return; scoppiata = true; tl.kill();
      b.r = Math.max(b.r, R * .6); b.pop = .001;
      var colori = ['#CDEBDC', '#FAEAB1', '#DDD5F3', '#CFE6F5', '#FFFFFF', '#F7D4DD'];
      for (var i = 0; i < 22; i++) {
        var g = document.createElement('span'), a = Math.random() * Math.PI * 2, d = b.r * (1.05 + Math.random() * .9), s = 6 + Math.random() * 16;
        g.className = 'goccia'; g.style.cssText = 'width:' + s + 'px;height:' + s + 'px;left:' + (b.x - s / 2) + 'px;top:' + (b.y - s / 2) + 'px;background:' + colori[i % colori.length];
        gocce.appendChild(g);
        gsap.fromTo(g, { x: Math.cos(a) * b.r * .85, y: Math.sin(a) * b.r * .85, scale: 1 }, { x: Math.cos(a) * d, y: Math.sin(a) * d + 30, scale: 0, duration: .9 + Math.random() * .4, ease: 'power3.out' });
      }
      gsap.to(el, { '--buco': Math.hypot(W, H) + 'px', duration: .8, ease: 'power3.in', delay: .08, onComplete: function () { f.stop(); el.remove(); document.documentElement.classList.remove('intro-on'); inCima(); setTimeout(function () { gocce.remove(); }, 900); } });
      setTimeout(function () { if (!partito) { partito = true; done(); } }, 380);
    }
    el.addEventListener('pointerdown', scoppia);
    setTimeout(scoppia, 3200);
  }
  function avvio() { intro(entra); }
  if (cane.complete) avvio(); else { cane.addEventListener('load', avvio); cane.addEventListener('error', avvio); }

  /* scroll dell'apertura: il cane resta, la parola sale, le bolle prendono vento */
  ScrollTrigger.create({ trigger: apertura, start: 'top top', end: 'bottom top', onUpdate: function (st) { if (window.__bolle && window.__bolle.ok) window.__bolle.setLift(st.getVelocity()); } });
  gsap.to('.titolo-h1', { yPercent: -30, ease: 'none', scrollTrigger: { trigger: apertura, start: 'top top', end: 'bottom top', scrub: true } });

  /* titoli parola per parola */
  document.querySelectorAll('[data-parole]').forEach(function (h) {
    gsap.from(h.querySelectorAll('.parola > span'), { yPercent: 110, duration: 1, ease: 'expo.out', stagger: .06, scrollTrigger: { trigger: h, start: 'top 88%', once: true } });
    var mk = h.querySelectorAll('mark.seg'); if (mk.length) gsap.from(mk, { opacity: 0, scale: .7, rotation: -4, duration: .9, ease: 'back.out(2)', delay: .25, scrollTrigger: { trigger: h, start: 'top 88%', once: true } });
  });
  /* schede: salgono; i cani si affacciano dal bordo */
  gsap.utils.toArray('[data-scheda]').forEach(function (el) {
    gsap.from(el, { y: 50, opacity: 0, duration: 1.1, ease: 'expo.out', clearProps: 'transform,opacity', scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
  });
  gsap.utils.toArray('[data-affaccio]').forEach(function (el) {
    gsap.from(el, { y: -36, opacity: 0, duration: 1, ease: 'back.out(2)', scrollTrigger: { trigger: el.parentNode, start: 'top 82%', once: true } });
  });

  var mm = gsap.matchMedia();
  mm.add('(min-width: 900px)', function () {
    if (/[?&]statico/.test(location.search)) return;
    var pista = document.querySelector('[data-pista]');
    var dist = function () { return Math.max(0, pista.scrollWidth - window.innerWidth); };
    gsap.to(pista, { x: function () { return -dist(); }, ease: 'none', scrollTrigger: { trigger: '.clienti', start: 'top top', end: function () { return '+=' + dist(); }, pin: true, scrub: .6, invalidateOnRefresh: true } });
  });
  addEventListener('load', function () { ScrollTrigger.refresh(); requestAnimationFrame(inCima); });
})();
