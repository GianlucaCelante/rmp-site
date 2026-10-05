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
      targetEl.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
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

  /* Nav invertita mentre la sua fascia attraversa una superficie scura
     (qui solo #chi-siamo). Stesso meccanismo di pizzerie.js: un Set tiene
     il conto delle superfici scure attualmente sotto la nav. */
  var darkSurfaces = document.querySelectorAll('.section-dark');
  if (navEl && darkSurfaces.length && 'IntersectionObserver' in window) {
    var sottoNav = new Set();
    var darkObserver = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if (entry.isIntersecting) sottoNav.add(entry.target);
        else sottoNav.delete(entry.target);
      });
      navEl.classList.toggle('nav-on-dark', sottoNav.size > 0);
    }, { rootMargin: '0px 0px -' + (window.innerHeight - 80) + 'px 0px', threshold: 0 });
    darkSurfaces.forEach(function(el){ darkObserver.observe(el); });
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
})();

