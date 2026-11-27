/* Harmônia, pagine dei corsi */
(function () {
  'use strict';
  var d = document, root = d.documentElement;
  var riduci = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var conGsap = !!(window.gsap && window.ScrollTrigger);

  /* titoli in lettere */
  function dividi(el) {
    if (/^H[1-6]$/.test(el.tagName)) el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
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
  function adatta() {
    d.querySelectorAll('.split').forEach(function (h) {
      h.style.fontSize = '';
      var spazio = h.clientWidth, max = 0;
      h.querySelectorAll('.w').forEach(function (w) { max = Math.max(max, w.getBoundingClientRect().width); });
      if (max > spazio && spazio > 0) h.style.fontSize = (parseFloat(getComputedStyle(h).fontSize) * spazio / max * .96) + 'px';
    });
  }
  adatta();
  if (d.fonts && d.fonts.ready) d.fonts.ready.then(function () { adatta(); if (window.ScrollTrigger) ScrollTrigger.refresh(); });
  window.addEventListener('resize', adatta);

  /* velo tra le pagine: copre, cambia pagina, si ritira */
  var velo = d.querySelector('.velo');
  function vai(href) {
    try { sessionStorage.setItem('velo', '1'); } catch (e) {}
    if (!conGsap || riduci || !velo) { location.href = href; return; }
    gsap.fromTo(velo, { yPercent: 101 }, { yPercent: 0, duration: .55, ease: 'expo.inOut', onComplete: function () { location.href = href; } });
  }
  d.querySelectorAll('a[href]').forEach(function (a) {
    var h = a.getAttribute('href');
    if (/^(index\.html|corso-[a-z-]+\.html)/.test(h) && !a.closest('.menu')) a.addEventListener('click', function (e) { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); vai(h); });
  });
  function scopri() {
    try { sessionStorage.removeItem('velo'); } catch (e) {}
    if (!root.classList.contains('velo-su')) return;
    if (!conGsap || riduci) { root.classList.remove('velo-su'); return; }
    gsap.fromTo(velo, { yPercent: 0 }, { yPercent: -101, duration: .7, ease: 'expo.inOut', delay: .1, onComplete: function () { root.classList.remove('velo-su'); gsap.set(velo, { clearProps: 'all' }); } });
  }
  window.addEventListener('pageshow', function (e) { if (e.persisted) { root.classList.remove('velo-su'); if (velo) gsap && gsap.set(velo, { yPercent: 101 }); } });

  if (!conGsap) { root.classList.remove('anim'); root.classList.add('static'); root.classList.remove('velo-su'); return; }
  gsap.registerPlugin(ScrollTrigger);
  if (riduci) { root.classList.add('static'); scopri(); d.querySelectorAll('.cap').forEach(function (c) { c.classList.add('on'); }); return; }

  scopri();
  var desk = matchMedia('(min-width: 1024px)').matches;

  gsap.utils.toArray('.split').forEach(function (h) {
    gsap.set(h, { autoAlpha: 1 });
    /* nelle pagine dei corsi le lettere compaiono salendo di poco, senza restare tagliate a metà */
    gsap.fromTo(h.querySelectorAll('.ch'), { yPercent: 35, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: .7, ease: 'power3.out', stagger: { each: .02, amount: .35 }, scrollTrigger: { trigger: h, start: 'top 92%', once: true } });
  });
  ScrollTrigger.batch('.rv', { start: 'top 94%', once: true, onEnter: function (els) { gsap.fromTo(els, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 1, ease: 'power3.out', stagger: .08, overwrite: true }); } });

  /* foto: maschera a forma di unghia che cresce, dopo la decodifica */
  gsap.utils.toArray('.rev').forEach(function (fig) {
    var m = fig.querySelector('.m'), img = m.querySelector('img');
      /* già nello schermo all'avvio: si vede subito, senza maschera */
      if (fig.getBoundingClientRect().top < window.innerHeight) { gsap.set(m, { scale: 1, borderRadius: 0 }); gsap.set(img, { scale: 1 }); return; }
      var giro = gsap.fromTo(m, { scale: .6 }, { scale: 1.9, duration: .9, ease: 'expo.out', paused: true, immediateRender: false,
        onUpdate: function () { gsap.set(img, { scale: 1.12 / gsap.getProperty(m, 'scale') }); },
      onComplete: function () { gsap.set(m, { scale: 1, borderRadius: 0 }); gsap.fromTo(img, { scale: 1.12 }, { scale: 1, duration: .8, ease: 'power2.out' }); } });
    ScrollTrigger.create({ trigger: fig, start: 'top bottom+=80', once: true, onEnter: function () {
      var via = function () { giro.play(); };
      if (img.complete && img.naturalWidth) via(); else if (img.decode) img.decode().then(via, via); else img.addEventListener('load', via);
    } });
  });
  gsap.utils.toArray('.par img').forEach(function (img) {
    gsap.fromTo(img, { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: img.closest('.foto'), start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  /* programma: il filo si disegna mentre scorri e ogni capitolo si accende quando lo raggiungi */
  gsap.fromTo('.tl-linea i', { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '.tl', start: 'top 70%', end: 'bottom 60%', scrub: true } });
  gsap.utils.toArray('.cap').forEach(function (c) {
    ScrollTrigger.create({ trigger: c, start: 'top 66%', onEnter: function () { c.classList.add('on'); }, onLeaveBack: function () { c.classList.remove('on'); } });
  });

  /* kit: i prodotti arrivano uno alla volta */
  gsap.fromTo('.kit-l li', { autoAlpha: 0, y: 18, scale: .94 }, { autoAlpha: 1, y: 0, scale: 1, duration: .7, ease: 'back.out(1.6)', stagger: .06, scrollTrigger: { trigger: '.kit-l', start: 'top 88%', once: true } });

  /* puntatore */
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    var cur = d.querySelector('.cursore'), xTo = gsap.quickTo(cur, 'x', { duration: .45, ease: 'power3.out' }), yTo = gsap.quickTo(cur, 'y', { duration: .45, ease: 'power3.out' }), ultimo = 0;
    window.addEventListener('pointermove', function (e) { cur.classList.add('on'); xTo(e.clientX); yTo(e.clientY); var dx = e.clientX - ultimo; ultimo = e.clientX; gsap.to(cur, { rotation: gsap.utils.clamp(-35, 35, dx * 1.5), duration: .4, overwrite: 'auto' }); }, { passive: true });
    d.addEventListener('pointerover', function (e) { var su = e.target.closest && e.target.closest('a, button, .foto'); gsap.to(cur, { scale: su ? 2.1 : 1, opacity: su ? .55 : .9, duration: .4, ease: 'expo.out', overwrite: 'auto' }); });
  }
  ScrollTrigger.create({ trigger: d.body, start: 'bottom bottom+=2', onEnter: function () { gsap.set('.rv, .split', { autoAlpha: 1 }); } });
  window.addEventListener('load', function () { ScrollTrigger.refresh(); setTimeout(function () { d.querySelectorAll('img[loading="lazy"]').forEach(function (i) { i.loading = 'eager'; }); }, 400); });
})();
