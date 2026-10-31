(function(){
  "use strict";
  document.documentElement.classList.add('js');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- Link con # : scroll dolce nativo ----------------
     Nessun Lenis in home: scrollIntoView nativo, mai un listener nativo
     su window scroll. */
  document.querySelectorAll('a[href^="#"]').forEach(function(a){
    a.addEventListener('click', function(e){
      var href = a.getAttribute('href');
      if (!href || href.length < 2) return;
      var targetEl = document.querySelector(href);
      if (!targetEl) return;
      e.preventDefault();
      /* un foglio fermo (sticky) riporta la posizione in cui e' bloccato,
         non quella nella pagina: per i fogli si misura il segnaposto vuoto
         che sta subito prima (vedi "Fogli che salgono" qui sotto) */
      var go = function(){
        var mark = targetEl.previousElementSibling;
        var y;
        if (mark && mark.classList.contains('sheet-mark')) {
          y = mark.getBoundingClientRect().top + window.pageYOffset + (parseFloat(getComputedStyle(targetEl).marginTop) || 0);
        } else {
          y = targetEl.getBoundingClientRect().top + window.pageYOffset;
        }
        /* sezioni col padding compatto (telefono): il titolo non deve finire sotto la nav fissa */
        var navH = navEl ? navEl.offsetHeight : 72;
        var pad = parseFloat(getComputedStyle(targetEl).paddingTop) || 0;
        if (pad < navH) y -= navH + 16 - pad;
        window.scrollTo({ top: Math.max(0, y), behavior: reduceMotion ? 'auto' : 'smooth' });
      };
      /* dal menu telefono: prima si chiude il menu (sblocca lo scroll), poi si scorre */
      if (a.closest('#navPanel')) setTimeout(go, 80); else go();
      if (history.pushState) history.pushState(null, '', href);
    });
  });

  /* ---------------- Nav: blur solo dopo lo scroll ---------------- */
  var navEl = document.getElementById('siteNav');
  var topSentinel = document.getElementById('top');
  if (navEl && topSentinel && 'IntersectionObserver' in window) {
    var navObserver = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        navEl.classList.toggle('is-scrolled', !entry.isIntersecting);
      });
    }, { threshold: 0 });
    navObserver.observe(topSentinel);
  }

  /* Nav invertita quando sotto la sua fascia c'e' davvero una superficie scura.
     Si guarda l'elemento visibile sotto il centro della nav (non la geometria
     delle sezioni): con i fogli che salgono una sezione scura puo' restare
     "sotto" una chiara senza vedersi. */
  var scuriSel = '.section-dark';
  if (navEl && document.elementsFromPoint) {
    var navAttesa = false;
    var aggiornaNav = function(){
      navAttesa = false;
      var els = document.elementsFromPoint(Math.round(window.innerWidth / 2), Math.round(navEl.offsetHeight / 2));
      var scuro = false;
      for (var k = 0; k < els.length; k++) {
        if (navEl.contains(els[k])) continue;
        scuro = !!els[k].closest(scuriSel);
        break;
      }
      navEl.classList.toggle('nav-on-dark', scuro);
    };
    var chiediNav = function(){ if (!navAttesa) { navAttesa = true; requestAnimationFrame(aggiornaNav); } };
    window.addEventListener('scroll', chiediNav, { passive: true });
    window.addEventListener('resize', chiediNav);
    aggiornaNav();
  }

  /* ---------------- Menu telefono ----------------
     Apre/chiude il pannello; chiude con Esc, tocco su una voce, tocco sul
     pulsante, Tab fuori dal menu o passando a >760px. Il focus va sulla prima
     voce all'apertura e torna al pulsante alla chiusura. */
  var menuBtn = document.getElementById('navMenuBtn');
  var panel = document.getElementById('navPanel');
  if (navEl && menuBtn && panel) {
    var lbl = menuBtn.querySelector('.nav-menu-btn__lbl');
    var panelLinks = panel.querySelectorAll('a');
    var mq = window.matchMedia('(max-width: 760px)');
    var setMenu = function(open, restoreFocus){
      navEl.classList.toggle('menu-open', open);
      document.documentElement.classList.toggle('menu-lock', open);
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (lbl) lbl.textContent = open ? 'Chiudi' : 'Menu';
      if (open) { panelLinks[0].focus({ preventScroll: true }); }
      else if (restoreFocus) { menuBtn.focus({ preventScroll: true }); }
    };
    menuBtn.addEventListener('click', function(){
      setMenu(!navEl.classList.contains('menu-open'), true);
    });
    panelLinks.forEach(function(a){
      a.addEventListener('click', function(){ setMenu(false, false); });
    });
    document.addEventListener('keydown', function(e){
      if (!navEl.classList.contains('menu-open')) return;
      if (e.key === 'Escape') { setMenu(false, true); return; }
      if (e.key === 'Tab') {
        var items = [menuBtn].concat(Array.prototype.slice.call(panelLinks));
        var i = items.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
        else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
      }
    });
    var onMq = function(){ if (!mq.matches) setMenu(false, false); };
    if (mq.addEventListener) mq.addEventListener('change', onMq); else mq.addListener(onMq);
  }

  /* ---------------- Reveal: titoli display, riga per riga ----------------
     Dentro #hero il reveal parte da solo al caricamento (doppio rAF);
     fuori dall'hero parte con IntersectionObserver, come in pizzerie.js. */
  document.querySelectorAll('.display').forEach(function(displayEl){
    var lines = displayEl.querySelectorAll('.line-inner');
    if (!lines.length) return;
    var isHero = !!displayEl.closest('#hero');
    if (isHero) {
      requestAnimationFrame(function(){
        requestAnimationFrame(function(){
          lines.forEach(function(l){ l.classList.add('is-visible'); });
        });
      });
    } else if ('IntersectionObserver' in window) {
      var titleObs = new IntersectionObserver(function(entries, observer){
        entries.forEach(function(entry){
          if (entry.isIntersecting) {
            lines.forEach(function(l){ l.classList.add('is-visible'); });
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.3 });
      titleObs.observe(displayEl);
    } else {
      lines.forEach(function(l){ l.classList.add('is-visible'); });
    }
  });

  /* ---------------- Reveal: fade-up ---------------- */
  if ('IntersectionObserver' in window) {
    var fadeObserver = new IntersectionObserver(function(entries, observer){
      entries.forEach(function(entry){
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    document.querySelectorAll('.fade-up').forEach(function(el){ fadeObserver.observe(el); });
  } else {
    document.querySelectorAll('.fade-up').forEach(function(el){ el.classList.add('is-visible'); });
  }

  /* ---------------- Fogli che salgono ----------------
     Stessa logica di pizzerie.js/sagre.js (pin misurato a runtime + effetto
     "va sotto" quando arriva il foglio dopo). In piu': una sezione piu' alta
     dello schermo si ferma col fondo in basso (--pin-top negativo), cosi'
     nessun contenuto resta nascosto; l'ultima sezione non si ferma mai.
     Prima di ogni foglio un segnaposto vuoto da' la posizione vera per i
     link d'ancora (il foglio fermo riporterebbe quella in cui e' bloccato). */
  var sheets = Array.prototype.slice.call(document.querySelectorAll('.sheet'));
  sheets.forEach(function(sheet){
    var mark = document.createElement('div');
    mark.className = 'sheet-mark';
    mark.setAttribute('aria-hidden', 'true');
    sheet.parentNode.insertBefore(mark, sheet);
  });
  if (sheets.length && !reduceMotion) {
    var measureSheets = function(){
      var vh = window.innerHeight;
      sheets.forEach(function(sheet, i){
        if (i === sheets.length - 1) { sheet.classList.remove('sheet--pin'); return; }
        var h = sheet.offsetHeight;
        sheet.style.setProperty('--pin-top', Math.min(0, vh - h) + 'px');
        sheet.style.transformOrigin = '50% ' + Math.max(h / 2, h - vh / 2) + 'px';   /* scala attorno alla parte visibile */
        sheet.classList.add('sheet--pin');
      });
    };
    var measureT;
    var measureLater = function(){ clearTimeout(measureT); measureT = setTimeout(measureSheets, 150); };
    measureSheets();
    window.addEventListener('resize', measureLater);
    window.addEventListener('load', measureSheets);
    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(measureLater);
      sheets.forEach(function(sheet){ ro.observe(sheet); });
    }
    if ('IntersectionObserver' in window) {
      var sheetObserver = new IntersectionObserver(function(entries){
        entries.forEach(function(entry){
          var prev = sheets[sheets.indexOf(entry.target) - 1];
          if (prev) prev.classList.toggle('sheet--under', entry.isIntersecting);
        });
      }, { rootMargin: '0px 0px -40% 0px', threshold: 0 });   /* va sotto quando il foglio dopo ha passato il 60% dello schermo: con le sezioni corte la soglia al 15% scuriva quella che si stava ancora leggendo */
      sheets.forEach(function(sheet){ sheetObserver.observe(sheet); });
    }
  }
})();

