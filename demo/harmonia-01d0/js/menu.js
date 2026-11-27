/* Harmônia: testata fissa e menu, uguali su tutte le pagine */
(function () {
  'use strict';
  var d = document, root = d.documentElement;
  var riduci = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var conGsap = !!window.gsap;
  var testa = d.getElementById('testata'), menu = d.getElementById('menu'), bottone = d.querySelector('.menu-b');
  if (!testa) return;

  /* testata: diventa piena dopo l'apertura, si nasconde scendendo e torna risalendo */
  var ultimo = 0, rif = 0;
  function guarda() {
    rif = 0;
    var y = window.scrollY || 0;
    testa.classList.toggle('solida', y > 40);
    testa.classList.toggle('nascosta', y > 260 && y > ultimo + 4 && !root.classList.contains('menu-aperto'));
    if (y < ultimo - 4) testa.classList.remove('nascosta');
    ultimo = y;
  }
  if (window.ScrollTrigger) { ScrollTrigger.create({ start: 0, end: 'max', onUpdate: guarda }); }
  guarda();

  /* sottomenu Corsi (desktop) */
  d.querySelectorAll('.menu-d .has-sub > button').forEach(function (b) {
    var li = b.parentNode;
    b.addEventListener('click', function () { var on = b.getAttribute('aria-expanded') !== 'true'; b.setAttribute('aria-expanded', on); li.classList.toggle('aperto', on); });
    li.addEventListener('keydown', function (e) { if (e.key === 'Escape') { b.setAttribute('aria-expanded', 'false'); li.classList.remove('aperto'); b.focus(); } });
    d.addEventListener('click', function (e) { if (!li.contains(e.target)) { b.setAttribute('aria-expanded', 'false'); li.classList.remove('aperto'); } });
  });

  /* menu a tutto schermo (telefono e tablet) */
  if (!menu || !menu.showModal) return;
  function apri() {
    menu.showModal(); root.classList.add('menu-aperto'); bottone.setAttribute('aria-expanded', 'true');
    if (conGsap && !riduci) {
      /* sulla finestra solo opacità: la trasformazione di un elemento fisso la toglierebbe dal livello modale */
      gsap.fromTo(menu, { autoAlpha: 0 }, { autoAlpha: 1, duration: .35, ease: 'power2.out' });
      gsap.fromTo(menu.querySelectorAll('.menu-l > li, .menu-in > .btn, .menu-c'), { y: 36, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .8, ease: 'expo.out', stagger: .05, delay: .05 });
      gsap.fromTo(menu.querySelectorAll('.menu-sub a'), { y: 10, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .6, ease: 'expo.out', stagger: .04, delay: .35 });
    }
  }
  function chiudi(poi) {
    if (!menu.open) { if (poi) poi(); return; }
    var fine = function () { menu.close(); root.classList.remove('menu-aperto'); bottone.setAttribute('aria-expanded', 'false'); if (conGsap) gsap.set(menu, { clearProps: 'opacity,visibility' }); if (poi) poi(); else bottone.focus(); };
    if (conGsap && !riduci) gsap.to(menu, { autoAlpha: 0, duration: .25, ease: 'power2.in', onComplete: fine }); else fine();
  }
  bottone.addEventListener('click', apri);
  menu.querySelectorAll('[data-chiudi-menu]').forEach(function (b) { b.addEventListener('click', function () { chiudi(); }); });
  menu.addEventListener('cancel', function (e) { e.preventDefault(); chiudi(); });
  menu.addEventListener('click', function (e) { if (e.target === menu || e.target.classList.contains('menu-in')) chiudi(); });
  /* i link chiudono il menu prima di andare: stessa pagina = scorrimento all'ancora, altra pagina = navigazione */
  menu.querySelectorAll('a[href]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (a.hasAttribute('data-app') && d.getElementById('appuntamento')) { chiudi(function () {}); return; }
      var h = a.getAttribute('href'), m = h.match(/^index\.html(#.+)$/), qui = /index\.html$|\/$/.test(location.pathname) || location.pathname.indexOf('.html') < 0;
      if (m && qui) { e.preventDefault(); chiudi(function () { var t = d.querySelector(m[1]); if (t) t.scrollIntoView({ behavior: riduci ? 'auto' : 'smooth' }); history.replaceState(null, '', m[1]); }); }
      else if (/^tel:|^https?:/.test(h)) { chiudi(function () {}); }
      else { e.preventDefault(); chiudi(function () { var dest = d.querySelector('a.via-velo[href="' + h + '"]'); location.href = h; }); }
    });
  });
})();
