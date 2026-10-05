(function(){
  "use strict";
  document.documentElement.classList.add('js');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- Lenis (smooth scroll), con fallback nativo ---------------- */
  var lenis = null;
  if (!reduceMotion && typeof Lenis !== 'undefined') {
    lenis = new Lenis({ autoRaf: true });
  }
  function smoothScrollTo(target){
    if (!target) return;
    if (lenis) {
      lenis.scrollTo(target, { offset: 0 });
    } else if (target.scrollIntoView) {
      target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    }
  }

  /* ---------------- Link con # : scroll dolce ---------------- */
  document.querySelectorAll('a[href^="#"]').forEach(function(a){
    a.addEventListener('click', function(e){
      var href = a.getAttribute('href');
      if (!href || href.length < 2) return;
      var targetEl = document.querySelector(href);
      if (!targetEl) return;
      e.preventDefault();
      smoothScrollTo(targetEl);
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
     (sezione prezzi E banda video: un Set tiene il conto, cosi' uscire da
     una non spegne l'inversione se l'altra e' ancora sotto la nav) */
  var darkSurfaces = document.querySelectorAll('.section-dark, .vband');
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

  /* La banda video si accende: arriva chiara come la pagina e vira al nero
     quando occupa quasi mezzo schermo; tornando su, uscita di scena, si
     rischiara di nuovo. Soglie distanti = niente sfarfallio sul confine. */
  var bandEl = document.querySelector('.vband');
  if (bandEl && !reduceMotion && 'IntersectionObserver' in window) {
    bandEl.classList.add('vband--light');
    var bandObserver = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if (e.intersectionRatio >= 0.45) bandEl.classList.remove('vband--light');
        else if (!e.isIntersecting) bandEl.classList.add('vband--light');
      });
    }, { threshold: [0, 0.45] });
    bandObserver.observe(bandEl);
  }

  /* ---------------- Reveal: titoli display, riga per riga ---------------- */
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
    document.querySelectorAll('.fade-up, .pop').forEach(function(el){ fadeObserver.observe(el); });
  } else {
    document.querySelectorAll('.fade-up, .pop').forEach(function(el){ el.classList.add('is-visible'); });
  }

  /* ---------------- Parallasse leggera sugli screenshot ---------------- */
  if (!reduceMotion && 'IntersectionObserver' in window) {
    var activeParallax = new Set();
    var parallaxRunning = false;
    var pObserver = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if (entry.isIntersecting) activeParallax.add(entry.target);
        else activeParallax.delete(entry.target);
      });
      if (activeParallax.size && !parallaxRunning) runParallax();
    }, { threshold: 0, rootMargin: '15% 0px 15% 0px' });
    document.querySelectorAll('.parallax-img').forEach(function(img){ pObserver.observe(img); });

    function runParallax(){
      parallaxRunning = true;
      var vh = window.innerHeight || document.documentElement.clientHeight;
      activeParallax.forEach(function(img){
        var frame = img.parentElement;
        var rect = frame.getBoundingClientRect();
        var center = rect.top + rect.height / 2;
        var progress = (center - vh / 2) / vh;
        if (progress > 1) progress = 1;
        if (progress < -1) progress = -1;
        var offsetPct = (progress * -4).toFixed(2);
        img.style.transform = 'translateY(' + offsetPct + '%)';
      });
      if (activeParallax.size) {
        requestAnimationFrame(runParallax);
      } else {
        parallaxRunning = false;
      }
    }
  }

  /* ================================================================
     TABLET SCROLLYTELLING (#dentro) - innesto da landing-novu/index.html,
     copiato fedele: IIFE indipendente con proprio 'root' (var locale alla
     closure, non collide con nessuna variabile del blocco qui sopra),
     stesso rootMargin, stessa logica di attivazione step/aria-label.
     ================================================================ */
  (function () {
    var root = document.querySelector('.tablet-demo');
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    /* Con "riduci movimento" il nastro resta sfogliabile (swipe, frecce,
       tastiera): sono navigazione, non animazione. A spegnersi sono il pin,
       il giro del tablet e lo scroll fluido (vedi CSS e motion layer). */
    if (!root || !('IntersectionObserver' in window)) return;
    root.classList.add('js-ready');

    var tablet = root.querySelector('.tablet');
    var labels = [
      'Demo cassa: menu fotografico con giacenze e ordine in corso.',
      'Demo cassa: quantita rapide ed esauriti condivisi.',
      'Demo cassa: varianti e note per la cucina.',
      'Demo cassa: pagamento contante o carta.',
      'Demo cassa: calcolo del resto.',
      'Demo cassa: storico ordini di fine serata.'
    ];

    var track = document.getElementById('tabletTrack');
    var slides = track ? Array.prototype.slice.call(track.querySelectorAll('.tablet__slide')) : [];
    var prevBtn = document.getElementById('tabletPrev');
    var nextBtn = document.getElementById('tabletNext');
    if (!track || !slides.length) return;

    var current = -1;
    /* pallini: uno per schermata, cliccabili (stessa meccanica di pizzerie.js) */
    var dotsBox = document.getElementById('scrollyDots');
    var dots = [];
    if (dotsBox) {
      slides.forEach(function (_, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('aria-label', 'Vai alla schermata ' + (i + 1));
        b.addEventListener('click', function () { vaiA(i); });
        dotsBox.appendChild(b);
        dots.push(b);
      });
    }
    /* aggiorna solo la didascalia e gli indicatori: quale schermata si vede
       lo decide il nastro, non piu' una classe */
    function activate(i) {
      if (i === current) return;
      current = i;
      root.querySelectorAll('.tablet-demo__caption-item').forEach(function (el) {
        el.classList.toggle('is-active', Number(el.dataset.index) === i);
      });
      if (tablet && labels[i]) tablet.setAttribute('aria-label', labels[i]);
      var cue = document.getElementById('scrollyCue');
      if (cue) cue.classList.toggle('is-last', i === slides.length - 1);
      if (prevBtn) prevBtn.disabled = (i === 0);
      if (nextBtn) nextBtn.disabled = (i === slides.length - 1);
      dots.forEach(function (d, k) { d.classList.toggle('on', k === i); });
    }

    /* la schermata "in scena" e' quella che occupa il nastro: root e' il
       nastro stesso, non il viewport */
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) activate(Number(e.target.dataset.index));
      });
    }, { root: track, threshold: 0.6 });
    slides.forEach(function (s) { io.observe(s); });
    activate(0);

    function vaiA(i) {
      var n = Math.max(0, Math.min(slides.length - 1, i));
      track.scrollTo({ left: n * track.clientWidth, behavior: reduce ? 'auto' : 'smooth' });
    }
    if (prevBtn) prevBtn.addEventListener('click', function () { vaiA(current - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { vaiA(current + 1); });
    /* frecce della tastiera quando il nastro ha il fuoco */
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); vaiA(current + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); vaiA(current - 1); }
    });
    /* trackpad: il gesto a due dita orizzontale lo mangia lo smooth scroll,
       che sull'asse X non fa nulla. Se il movimento e' chiaramente laterale
       lo giriamo al nastro; quello verticale resta a Lenis, fluido. */
    var wheelLock = false;
    track.addEventListener('wheel', function (e) {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) * 1.4) return;
      e.preventDefault();
      if (wheelLock) return;
      wheelLock = true;
      vaiA(current + (e.deltaX > 0 ? 1 : -1));
      setTimeout(function () { wheelLock = false; }, 420);
    }, { passive: false });
    /* la prima volta che il nastro entra bene in vista, un piccolo scivolo
       laterale mostra che le schermate scorrono. Solo una volta, mai se
       l'utente ha gia' toccato, mai con reduced motion. */
    var nudged = false;
    function nudge() {
      if (nudged || reduce || current > 0 || track.scrollLeft > 4) { nudged = true; return; }
      nudged = true;
      track.scrollTo({ left: 44, behavior: 'smooth' });
      setTimeout(function () {
        if (track.scrollLeft < track.clientWidth * 0.4) track.scrollTo({ left: 0, behavior: 'smooth' });
      }, 520);
    }
    var nudgeIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { setTimeout(nudge, 900); nudgeIO.disconnect(); }
      });
    }, { threshold: 0.7 });
    nudgeIO.observe(track);
    track.addEventListener('pointerdown', function () { nudged = true; }, { once: true });

    /* Pagina ingrandita col pinch: il nastro smette di scorrere, cosi' il
       trascinamento sposta la pagina invece di cambiare schermata. Era la
       segnalazione: "se zoommo e mi sposto cambio foto". */
    if (window.visualViewport) {
      var vv = window.visualViewport;
      var guardaZoom = function () { root.classList.toggle('is-zoomato', vv.scale > 1.02); };
      vv.addEventListener('resize', guardaZoom);
      vv.addEventListener('scroll', guardaZoom);
      guardaZoom();
    }

    /* al ridimensionamento il passo cambia: si riallinea alla schermata
       corrente (timer locale: la debounce del file vive in un altro scope) */
    var tRes;
    window.addEventListener('resize', function () {
      clearTimeout(tRes);
      tRes = setTimeout(function () {
        track.scrollTo({ left: current * track.clientWidth, behavior: 'auto' });
      }, 200);
    });
  })();

  /* ================================================================
     FORM DI CONTATTO
     ================================================================ */
  var form = document.getElementById('quoteForm');
  var successBox = document.getElementById('formSuccess');
  var successNameEl = document.getElementById('successName');
  function setFieldError(fieldId, message){
    var fieldEl = document.getElementById(fieldId);
    if (!fieldEl) return;
    var errorEl = fieldEl.querySelector('.field-error');
    fieldEl.classList.toggle('has-error', !!message);
    if (errorEl) errorEl.textContent = message || '';
  }

  function validateForm(data){
    var errors = {};
    if (!data.nome || data.nome.trim().length < 2) {
      errors.fieldNome = 'Manca il vostro nome: scrivetelo per farvi rispondere.';
    }
    if (!data.locale || data.locale.trim().length < 2) {
      errors.fieldLocale = 'Manca il nome della festa: scrivetelo per preparare il preventivo giusto.';
    }
    if (!data.citta || data.citta.trim().length < 2) {
      errors.fieldCitta = 'Manca il comune della festa: scrivetelo qui sopra.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((data.email || '').trim())) {
      errors.fieldEmail = 'Serve un indirizzo email per rispondervi: controllate che ci sia la chiocciola.';
    }
    var telDigits = (data.telefono || '').match(/\d/g);
    var telCount = telDigits ? telDigits.length : 0;
    if (data.telefono && data.telefono.trim() && telCount < 8) {
      errors.fieldTelefono = 'Il numero di telefono sembra incompleto: servono almeno 8 cifre.';
    }
    if (!data.privacy) {
      errors.fieldPrivacy = 'Serve il consenso per potervi ricontattare.';
    }
    return errors;
  }

  if (form) {
    var chk = document.getElementById('inpPrivacy');
    if (chk) chk.addEventListener('change', function(){ if (chk.checked) setFieldError('fieldPrivacy', ''); });
    ['inpNome','inpLocale','inpCitta','inpEmail','inpTelefono'].forEach(function(inputId){
      var el = document.getElementById(inputId);
      if (!el) return;
      el.addEventListener('input', function(){
        var fieldEl = el.closest('.field');
        if (fieldEl && fieldEl.classList.contains('has-error')) setFieldError(fieldEl.id, '');
      });
    });
    form.addEventListener('submit', function(e){
      e.preventDefault();
      var data = {
        nome: document.getElementById('inpNome').value,
        locale: document.getElementById('inpLocale').value,
        citta: document.getElementById('inpCitta').value,
        email: document.getElementById('inpEmail').value,
        telefono: document.getElementById('inpTelefono').value,
        serate: document.getElementById('inpSerate').value,
        casse: document.getElementById('inpCasse').value,
        privacy: document.getElementById('inpPrivacy') ? document.getElementById('inpPrivacy').checked : true
      };
      var errors = validateForm(data);
      ['fieldNome','fieldLocale','fieldCitta','fieldEmail','fieldTelefono','fieldPrivacy'].forEach(function(id){ setFieldError(id, ''); });
      var errorKeys = Object.keys(errors);
      if (errorKeys.length) {
        errorKeys.forEach(function(fieldId){ setFieldError(fieldId, errors[fieldId]); });
        var firstField = document.getElementById(errorKeys[0]);
        var firstInput = firstField ? firstField.querySelector('input, select') : null;
        if (firstInput) firstInput.focus();
        return;
      }

      function showSuccess(){
        if (successNameEl) successNameEl.textContent = data.nome ? (' ' + data.nome.trim()) : '';

        /* Il bollino rotante e' un submit del form: senza form non fa piu'
           nulla, quindi esce di scena insieme a lui. */
        var orphanCta = document.querySelector('#contatti .closing-grid .pop');
        if (orphanCta) orphanCta.hidden = true;

        /* Se il titolo non e' ancora entrato in scena, niente reveal a
           sorpresa mentre la pagina si riassesta. */
        document.querySelectorAll('#contatti .line-inner').forEach(function(l){ l.classList.add('is-visible'); });

        if (!successBox) { form.hidden = true; return; }
        successBox.hidden = false;
        successBox.setAttribute('tabindex', '-1');
        requestAnimationFrame(function(){ successBox.classList.add('is-in'); });

        /* preventScroll: il focus da solo farebbe scorrere il browser, che
           con lo smooth scroll attivo si vede come uno scatto. */
        var settle = function(){
          if (lenis) lenis.resize();   /* Lenis rimisura: niente scroll disallineato */
          successBox.focus({ preventScroll: true });
        };

        if (reduceMotion) { form.hidden = true; settle(); return; }

        var h = form.offsetHeight;
        form.style.height = h + 'px';
        form.classList.add('is-leaving');
        requestAnimationFrame(function(){ form.style.height = '0px'; });

        var done = false;
        var finish = function(){
          if (done) return;
          done = true;
          form.hidden = true;
          form.classList.remove('is-leaving');
          form.style.height = '';
          settle();
        };
        form.addEventListener('transitionend', function(e){ if (e.propertyName === 'height') finish(); });
        setTimeout(finish, 700);   /* rete di sicurezza se la transizione non parte */
      }

      var formError = document.getElementById('formError');
      if (formError) { formError.hidden = true; formError.textContent = ''; }

      /* L'endpoint (Cloudflare Worker -> Brevo, vedi worker/README.md) sta in
         data-endpoint sul <form>. Se e' vuoto l'invio e' simulato: comodo per
         anteprime e sviluppo. */
      var endpoint = (form.getAttribute('data-endpoint') || '').trim();
      if (!endpoint) { showSuccess(); return; }

      var hp = form.querySelector('[name="website"]');
      var payload = {
        nome: data.nome.trim(),
        locale: data.locale.trim(),
        citta: data.citta.trim(),
        email: data.email.trim(),
        telefono: data.telefono.trim(),
        serate: data.serate.trim(),
        casse: data.casse.trim(),
        verticale: form.getAttribute('data-verticale') || '',
        website: hp ? hp.value : '',
        pagina: location.href
      };
      var submitBtn = form.querySelector('.form-submit-inline');
      form.classList.add('is-sending');
      if (submitBtn) submitBtn.disabled = true;
      fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        .then(function(r){
          return r.json().catch(function(){ return {}; }).then(function(j){ return { ok: r.ok && j.ok !== false, error: j.error }; });
        })
        .then(function(res){
          if (!res.ok) throw new Error(res.error || 'send');
          showSuccess();
        })
        .catch(function(){
          if (formError) {
            formError.textContent = 'Non siamo riusciti a inviare la richiesta. Riprova tra qualche minuto.';
            formError.hidden = false;
          }
        })
        .then(function(){
          form.classList.remove('is-sending');
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  /* ================================================================
     V5 MOTION LAYER (vedi BRIEF-v5-motion.md) - IIFE isolata: le sue
     variabili locali (sheets, priceCards, statementP, ecc.) non
     toccano quelle dei blocchi sopra. Legge in chiusura 'lenis',
     'reduceMotion' e 'navEl' gia' dichiarate in questo scope: riusa
     la stessa istanza Lenis (mai una seconda new Lenis(...)) e lo
     stesso nodo nav gia' cercato in DOM.
     Prima rete di sicurezza: se reduceMotion e' true si esce subito.
     La seconda rete, indipendente, sono le regole
     @media (prefers-reduced-motion:reduce) nello <style> sopra.
     ================================================================ */
  (function () {
    if (reduceMotion) return;

    function debounce(fn, wait) {
      var t;
      return function () {
        var ctx = this, args = arguments;
        clearTimeout(t);
        t = setTimeout(function () { fn.apply(ctx, args); }, wait);
      };
    }

    /* ---- 2. Stack a fogli: pin misurato a runtime + effetto "va sotto" ---- */
    var sheets = Array.prototype.slice.call(document.querySelectorAll('.sheet'));
    if (sheets.length) {
      var measureSheets = function () {
        var vh = window.innerHeight;
        sheets.forEach(function (sheet) {
          if (sheet.id === 'contatti') { sheet.classList.remove('sheet--pin'); return; }
          sheet.classList.toggle('sheet--pin', sheet.offsetHeight <= vh * 1.05);
        });
      };
      measureSheets();
      window.addEventListener('resize', debounce(measureSheets, 200));

      if ('IntersectionObserver' in window) {
        var sheetObserver = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            var idx = sheets.indexOf(entry.target);
            var prev = sheets[idx - 1];
            if (prev) prev.classList.toggle('sheet--under', entry.isIntersecting);
          });
        }, { threshold: 0.15 });
        sheets.forEach(function (sheet) { sheetObserver.observe(sheet); });
      }
    }

    /* ---- 3. Card prezzi: nessun mazzo sovrapposto. Su mobile le tre schede
       scorrono normalmente e compaiono una alla volta in dissolvenza (la
       classe .fade-up con lo stagger di --i, gia' condivisa col resto della
       pagina): piu' semplici da usare, l'accordion apre senza sorprese. ---- */

    /* ---- 4. Statement: spezza in parole e accende allo scroll ---- */
    var statementP = document.querySelector('.statement p');
    if (statementP && 'IntersectionObserver' in window) {
      (function splitIntoWords(container) {
        var wi = 0;
        function walk(node) {
          if (node.nodeType === 3) {
            var text = node.textContent;
            if (!text) return;
            var frag = document.createDocumentFragment();
            text.split(/(\s+)/).forEach(function (part) {
              if (part === '') return;
              if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
              var span = document.createElement('span');
              span.className = 'w';
              span.style.setProperty('--wi', wi++);
              span.textContent = part;
              frag.appendChild(span);
            });
            node.parentNode.replaceChild(frag, node);
          } else if (node.nodeType === 1) {
            Array.prototype.slice.call(node.childNodes).forEach(walk);
          }
        }
        Array.prototype.slice.call(container.childNodes).forEach(walk);
      })(statementP);

      var statementObserver = new IntersectionObserver(function (entries, observer) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            statementP.classList.add('is-lit');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.5 });
      statementObserver.observe(statementP);
    }

    /* ---- 5. Nav auto-hide: solo lenis.on('scroll', ...), mai un listener nativo sullo scroll ---- */
    if (lenis && navEl) {
      var navFocused = false;
      navEl.addEventListener('focusin', function () {
        navFocused = true;
        navEl.classList.remove('nav--hidden');
      });
      navEl.addEventListener('focusout', function () { navFocused = false; });

      lenis.on('scroll', function (e) {
        if (navFocused || e.scroll <= 120) {
          navEl.classList.remove('nav--hidden');
        } else if (e.direction === 1) {
          navEl.classList.add('nav--hidden');
        } else if (e.direction === -1) {
          navEl.classList.remove('nav--hidden');
        }
      });
    }

    /* ---- 7. Ingresso del tablet: slide dal basso quando la sezione entra
       in vista (stessa meccanica di pizzerie.js). Il giro 3D legato allo
       scroll (js-flip) e' stato tolto: nei test le persone si bloccavano
       credendo la pagina rotta. ---- */
    var revealRoot = document.querySelector('.tablet-demo');
    if (revealRoot) {
      var noMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (noMotion) {
        revealRoot.classList.add('tablet-in');
      } else {
        var inIO = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) {
            if (e.isIntersecting) { revealRoot.classList.add('tablet-in'); inIO.disconnect(); }
          });
        }, { threshold: 0.22 });
        inIO.observe(revealRoot);
      }
    }
  })();
})();

