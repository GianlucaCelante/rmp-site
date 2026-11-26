/* ZADE v3: motion system (GSAP 3.12.5 + ScrollTrigger + Lenis 1.1.13, tutti in locale) */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isPhone = window.matchMedia("(max-width: 860px)").matches;
  var fine = window.matchMedia("(pointer: fine)").matches;

  /* ---------- Video: file giusto per il dispositivo, caricati solo quando servono ---------- */
  function setVideo(v) {
    if (!v || v.dataset.ready) return;
    var src = isPhone ? v.dataset.srcTel : v.dataset.srcPc;
    if (isPhone && v.dataset.posterTel) v.poster = v.dataset.posterTel;
    v.src = src;
    v.dataset.ready = "1";
  }
  function playVideo(v) {
    setVideo(v);
    if (reduce) return;
    var p = v.play();
    if (p && p.catch) p.catch(function () {});
  }
  var heroVideo = document.getElementById("heroVideo");
  setVideo(heroVideo);
  if (reduce) { heroVideo.removeAttribute("autoplay"); } else { playVideo(heroVideo); }

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) playVideo(v);
        else if (v.dataset.ready) v.pause();
      });
    }, { rootMargin: "200px 0px" });
    ["heroVideo", "piegaVideo", "braceVideo"].forEach(function (id) { io.observe(document.getElementById(id)); });
  } else {
    ["piegaVideo", "braceVideo"].forEach(function (id) { playVideo(document.getElementById(id)); });
  }

  /* ---------- Menu telefono ---------- */
  var menuBtn = document.getElementById("menuBtn");
  var menu = document.getElementById("menu");
  var lenis = null;
  function closeMenu() {
    root.classList.remove("menu-open");
    menuBtn.setAttribute("aria-expanded", "false");
    menu.setAttribute("aria-hidden", "true");
    if (lenis) lenis.start();
  }
  menuBtn.addEventListener("click", function () {
    var open = !root.classList.contains("menu-open");
    root.classList.toggle("menu-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    menu.setAttribute("aria-hidden", String(!open));
    if (lenis) { open ? lenis.stop() : lenis.start(); }
  });
  menu.querySelectorAll("a").forEach(function (a) { a.addEventListener("click", closeMenu); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });

  /* ---------- Barra: ogni parte (logo, voci, telefono, menu) legge cosa ha sotto ----------
     Sezioni e foto dichiarano data-tema="scuro|chiaro|media". A ogni cambio di scroll o di
     dimensione si guarda il punto esatto sotto ogni parte della barra. */
  var nav = document.getElementById("nav");
  var parts = Array.prototype.slice.call(nav.querySelectorAll(".nav-part"));
  // luminosita' reale di foto e video nel punto sotto la barra (canvas piccolo, stessa origine)
  var lumCache = typeof WeakMap === "function" ? new WeakMap() : null;
  function lumAt(el, x, y) {
    if (!lumCache) return -1;
    var isVid = el.tagName === "VIDEO";
    var nw = isVid ? el.videoWidth : el.naturalWidth, nh = isVid ? el.videoHeight : el.naturalHeight;
    if (!nw || !nh) return -1;
    var c = lumCache.get(el), now = performance.now();
    if (!c) { c = { cv: document.createElement("canvas"), t: 0 }; c.cv.width = 48; c.cv.height = Math.max(1, Math.round(48 * nh / nw)); c.ctx = c.cv.getContext("2d", { willReadFrequently: true }); lumCache.set(el, c); }
    if (!c.data || (isVid && now - c.t > 350) || c.src !== (el.currentSrc || el.src)) {
      try { c.ctx.drawImage(el, 0, 0, c.cv.width, c.cv.height); c.data = c.ctx.getImageData(0, 0, c.cv.width, c.cv.height).data; c.t = now; c.src = el.currentSrc || el.src; }
      catch (e) { return -1; }
    }
    var r = el.getBoundingClientRect();
    var sc = Math.max(r.width / nw, r.height / nh), dw = nw * sc, dh = nh * sc;
    var pos = (getComputedStyle(el).objectPosition || "50% 50%").split(" ");
    var px0 = parseFloat(pos[0]) / 100, py0 = parseFloat(pos[1] || pos[0]) / 100;
    if (isNaN(px0)) px0 = 0.5; if (isNaN(py0)) py0 = 0.5;
    var ox = r.left + (r.width - dw) * px0, oy = r.top + (r.height - dh) * py0;
    var cx = Math.floor((x - ox) / dw * c.cv.width), cy = Math.floor((y - oy) / dh * c.cv.height);
    var sum = 0, n = 0;
    for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
      var px = Math.min(c.cv.width - 1, Math.max(0, cx + dx)), py = Math.min(c.cv.height - 1, Math.max(0, cy + dy));
      var k = (py * c.cv.width + px) * 4;
      sum += (0.2126 * c.data[k] + 0.7152 * c.data[k + 1] + 0.0722 * c.data[k + 2]) / 255; n++;
    }
    return sum / n;
  }
  function toneAt(x, y) {
    var els = document.elementsFromPoint(x, y);
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (nav.contains(el) || menu.contains(el)) continue;
      var t = el.closest("[data-tema]");
      if (!t) continue;
      var tema = t.getAttribute("data-tema");
      if (tema === "media") {
        // cerca la foto o il video sotto, e se in quel punto e' chiaro usa il testo scuro
        for (var j = i; j < els.length; j++) {
          if ((els[j].tagName === "IMG" || els[j].tagName === "VIDEO") && t.contains(els[j])) {
            // media della luminosita' su tutta la larghezza della parte, non su un punto solo
            var span = toneAt.span || [x - 1, x + 1], tot = 0, cnt = 0;
            for (var q = 0; q <= 6; q++) {
              var L = lumAt(els[j], span[0] + (span[1] - span[0]) * q / 6, y);
              if (L >= 0) { tot += L; cnt++; }
            }
            if (cnt && tot / cnt > 0.55) return "chiaro";
            break;
          }
        }
      }
      return tema;
    }
    return "scuro";
  }
  function sampleNav() {
    if (root.classList.contains("menu-open")) return;
    var r = nav.getBoundingClientRect();
    var yMid = r.bottom - (r.bottom - r.top) / 2 + (parseFloat(getComputedStyle(nav).paddingTop) || 0) / 2;
    // 1. tono del fondo lungo tutta la barra (9 punti)
    var votes = { scuro: 0, chiaro: 0, media: 0 };
    toneAt.span = null;
    for (var k = 0; k < 9; k++) {
      var x = r.left + 8 + (r.width - 16) * k / 8;
      toneAt.span = [x - 20, x + 20];
      votes[toneAt(x, yMid)]++;
    }
    var fondo = "scuro";
    Object.keys(votes).forEach(function (kk) { if (votes[kk] > votes[fondo]) fondo = kk; });
    if (fondo === "chiaro" && votes.media >= 4) fondo = "media";
    if (nav.getAttribute("data-fondo") !== fondo) nav.setAttribute("data-fondo", fondo);
    // 2. ogni parte: se c'e' un pannello pieno prende il suo tono, sopra foto/video legge il proprio punto
    parts.forEach(function (p) {
      var pr = p.getBoundingClientRect();
      if (!pr.width) return;
      // sopra foto e video la barra ha un velo scuro: testo sempre chiaro, leggibile anche sull'acciaio lucido
      var t = fondo;
      if (p.getAttribute("data-tono") !== t) p.setAttribute("data-tono", t);
    });
  }
  var lastY = -1, lastW = -1, force = 240;
  function navLoop() {
    var y = window.scrollY, w = window.innerWidth;
    // dopo ogni movimento continua a leggere per ~1,5 s: le scene scrubbate finiscono dopo lo scroll
    if (y !== lastY || w !== lastW) force = 90;
    if (force > 0) { if (force % 2 === 0) sampleNav(); lastY = y; lastW = w; force--; }
    requestAnimationFrame(navLoop);
  }
  requestAnimationFrame(navLoop);
  window.addEventListener("resize", function () { force = 90; });

  /* ---------- Modulo preventivo ----------
     La demo non ha un server: all'invio prepara una mail all'indirizzo giusto (furgoni ->
     info@zadeallestimenti.it, il resto -> info@zadelavorazioni.it) e mostra la conferma.
     Sul sito vero l'invio va fatto lato server (vedi 02-design/LEGGIMI-modulo-e-pagine-legali.md). */
  var form = document.getElementById("preventivo");
  var NOMI = { furgone: "Allestimento furgone", basculante: "Porta basculante", cancello: "Cancello, ringhiera, recinzione", altro: "Altro" };
  var MISURE = {
    furgone: ["Modello del furgone", "es. marca, modello e anno"],
    basculante: ["Misure del vano", "es. larghezza 250 x altezza 210 cm"],
    cancello: ["Misure del vano", "es. larghezza 400 x altezza 160 cm"],
    altro: ["Misure", "se le avete"]
  };
  function aggiornaMisure() {
    var c = form.querySelector('input[name="bisogno"]:checked');
    var m = MISURE[c ? c.value : "basculante"];
    document.getElementById("l-misure").firstChild.nodeValue = m[0] + " ";
    document.getElementById("f-misure").placeholder = m[1];
  }
  form.addEventListener("change", function (e) { if (e.target.name === "bisogno") aggiornaMisure(); });
  function scegli(val) {
    var r = form.querySelector('input[name="bisogno"][value="' + val + '"]');
    if (r) { r.checked = true; checkField("bisogno"); aggiornaMisure(); }
  }
  // arrivando al modulo, il tasto Tab parte dalla scelta (senza spostare la pagina)
  window.focusScelta = function () {
    var r = form.querySelector('input[name="bisogno"]:checked') || form.querySelector('input[name="bisogno"]');
    if (r) r.focus({ preventScroll: true });
  };
  if (!window.Lenis || reduce) {
    document.querySelectorAll('a[href="#preventivo"]').forEach(function (a) {
      a.addEventListener("click", function () { setTimeout(window.focusScelta, 60); });
    });
  }
  document.querySelectorAll("[data-bisogno]").forEach(function (a) {
    a.addEventListener("click", function () { if (a.dataset.bisogno) scegli(a.dataset.bisogno); });
  });
  var regole = {
    bisogno: function () { return form.querySelector('input[name="bisogno"]:checked') ? "" : "Scegliete di cosa avete bisogno."; },
    nome: function (v) { return v.trim().length >= 2 ? "" : "Scrivete nome e cognome."; },
    email: function (v) {
      v = v.trim();
      if (!v) return "Scrivete un indirizzo email: vi rispondiamo l\u00ec.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return "Controllate l'email: manca la @ o il dominio (esempio: nome@azienda.it).";
      return "";
    },
    telefono: function (v) {
      var d = v.replace(/[^\d]/g, "");
      if (!v.trim()) return "";
      return d.length >= 6 && d.length <= 15 ? "" : "Il numero sembra incompleto: controllate le cifre.";
    },
    messaggio: function (v) { return v.trim().length >= 10 ? "" : "Scrivete almeno una riga su cosa vi serve."; },
    privacy: function () { return form.privacy.checked ? "" : "Per inviare la richiesta serve la presa visione dell'informativa."; }
  };
  var campi = { bisogno: "f-bisogno", nome: "f-nome", email: "f-email", telefono: "f-tel", messaggio: "f-msg", privacy: "f-privacy" };
  var errId = { bisogno: "e-bisogno", nome: "e-nome", email: "e-email", telefono: "e-tel", messaggio: "e-msg", privacy: "e-privacy" };
  var toccati = {};
  function checkField(k) {
    var el = form.elements[k];
    var msg = regole[k](el && el.value !== undefined ? el.value : "");
    document.getElementById(errId[k]).textContent = msg;
    document.getElementById(campi[k]).setAttribute("aria-invalid", msg ? "true" : "false");
    return msg;
  }
  Object.keys(campi).forEach(function (k) {
    var el = document.getElementById(campi[k]);
    var ev = (k === "bisogno" || k === "privacy") ? "change" : "blur";
    el.addEventListener(ev, function () { toccati[k] = true; checkField(k); }, true);
    if (k !== "bisogno" && k !== "privacy") el.addEventListener("input", function () { if (toccati[k] && document.getElementById(errId[k]).textContent) checkField(k); });
  });
  var riepilogo = document.getElementById("riepilogo");
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var errori = Object.keys(campi).filter(function (k) { toccati[k] = true; return checkField(k); });
    if (errori.length) {
      riepilogo.textContent = errori.length === 1 ? "C'\u00e8 un campo da sistemare." : "Ci sono " + errori.length + " campi da sistemare.";
      var primo = document.getElementById(campi[errori[0]]);
      var foc = errori[0] === "bisogno" ? primo.querySelector("input") : primo;
      foc.focus({ preventScroll: true });
      primo.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
      return;
    }
    riepilogo.textContent = "";
    var f = form.elements, tipo = form.querySelector('input[name="bisogno"]:checked').value;
    var dest = tipo === "furgone" ? "info@zadeallestimenti.it" : "info@zadelavorazioni.it";
    var oggetto = "Richiesta preventivo: " + NOMI[tipo] + " - " + f.nome.value.trim();
    var dati = [
      "Richiesta: " + NOMI[tipo],
      "Nome: " + f.nome.value.trim(),
      f.azienda.value.trim() ? "Azienda: " + f.azienda.value.trim() : "",
      "Email: " + f.email.value.trim(),
      f.telefono.value.trim() ? "Telefono: " + f.telefono.value.trim() : "",
      f.misure.value.trim() ? "Misure: " + f.misure.value.trim() : ""
    ].filter(Boolean);
    var righe = dati.concat(["", f.messaggio.value.trim(), "", "Ho letto l'informativa sulla privacy."]);
    var corpo = righe.join("\n");
    var href = "mailto:" + dest + "?subject=" + encodeURIComponent(oggetto) + "&body=" + encodeURIComponent(corpo);
    form.dataset.mailto = href;
    document.getElementById("conferma-testo").textContent = "Abbiamo preparato la mail per " + dest + " con la richiesta gi\u00e0 scritta: si apre nella vostra app di posta, premete Invia per mandarla.";
    var cm = document.getElementById("conferma-mail"); cm.href = "mailto:" + dest; cm.textContent = dest;
    document.getElementById("riapri").href = href;
    document.getElementById("conferma-corpo").value = "A: " + dest + "\nOggetto: " + oggetto + "\n\n" + corpo;
    document.getElementById("campi").hidden = true;
    var conf = document.getElementById("conferma"); conf.hidden = false; conf.focus();
    window.location.href = href;
  });
  document.getElementById("copia").addEventListener("click", function () {
    var ta = document.getElementById("conferma-corpo"), btnC = this;
    function ok() { btnC.firstChild.nodeValue = "Testo copiato"; }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(ok, function () { ta.select(); });
    else { ta.select(); try { document.execCommand("copy"); ok(); } catch (err) {} }
  });
  document.getElementById("nuova").addEventListener("click", function () {
    form.reset(); toccati = {};
    Object.keys(errId).forEach(function (k) { document.getElementById(errId[k]).textContent = ""; document.getElementById(campi[k]).removeAttribute("aria-invalid"); });
    document.getElementById("copia").firstChild.nodeValue = "Copiate il testo";
    document.getElementById("conferma").hidden = true;
    document.getElementById("campi").hidden = false;
    document.getElementById("f-nome").focus();
  });

  /* ---------- Modelli di basculante: fila scorrevole con frecce e contatore ---------- */
  var fila = document.getElementById("filaModelli");
  var schede = Array.prototype.slice.call(fila.querySelectorAll(".card"));
  var conta = document.getElementById("contaModelli");
  var prevB = document.getElementById("modPrev"), nextB = document.getElementById("modNext");
  function indiceCorrente() {
    var fr = fila.getBoundingClientRect(), best = 0, bestD = Infinity;
    schede.forEach(function (c, i) { var d = Math.abs(c.getBoundingClientRect().left - fr.left - (parseFloat(getComputedStyle(fila).paddingLeft) || 0)); if (d < bestD) { bestD = d; best = i; } });
    return best;
  }
  function aggiornaConta() {
    var i = indiceCorrente();
    var fine = fila.scrollLeft + fila.clientWidth >= fila.scrollWidth - 4;
    if (fine) i = schede.length - 1;
    conta.textContent = (i + 1) + " / " + schede.length;
    prevB.disabled = fila.scrollLeft <= 2;
    nextB.disabled = fine;
  }
  function vaiA(i) {
    i = Math.max(0, Math.min(schede.length - 1, i));
    var c = schede[i];
    var pad = parseFloat(getComputedStyle(fila).paddingLeft) || 0;
    fila.scrollTo({ left: c.offsetLeft - pad, behavior: reduce ? "auto" : "smooth" });
  }
  prevB.addEventListener("click", function () { vaiA(indiceCorrente() - 1); });
  nextB.addEventListener("click", function () { vaiA(indiceCorrente() + 1); });
  fila.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight") { e.preventDefault(); vaiA(indiceCorrente() + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); vaiA(indiceCorrente() - 1); }
  });
  var contaRaf = 0;
  fila.addEventListener("scroll", function () { cancelAnimationFrame(contaRaf); contaRaf = requestAnimationFrame(aggiornaConta); }, { passive: true });
  window.addEventListener("resize", aggiornaConta);
  aggiornaConta();

  /* Foto: dopo il caricamento si scaricano anche quelle piu' in basso, cosi' saltando con
     le ancore non compaiono riquadri vuoti */
  window.addEventListener("load", function () {
    setTimeout(function () {
      document.querySelectorAll('img[loading="lazy"]').forEach(function (img) { img.loading = "eager"; });
    }, 1200);
  });

  if (reduce || !window.gsap || !window.ScrollTrigger) return;

  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: "power3.out", duration: 0.9 });

  /* ---------- Lenis: scroll con peso (solo rotella; il tocco resta nativo) ---------- */
  lenis = new Lenis({ duration: 1.15, easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); }, smoothWheel: true, wheelMultiplier: 0.95 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
  gsap.ticker.lagSmoothing(0);

  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href");
      if (id.length < 2) return;
      var t = document.querySelector(id);
      if (!t) return;
      e.preventDefault();
      var navH = nav.getBoundingClientRect().height;
      lenis.scrollTo(id === "#top" ? 0 : t, {
        offset: id === "#top" ? 0 : -(navH + 16), duration: 1.4,
        onComplete: function () { if (id === "#preventivo") window.focusScelta(); }
      });
    });
  });

  /* ---------- 1. Apertura: la basculante si alza ---------- */
  var slats = gsap.utils.toArray(".slat");
  var intro = gsap.timeline({ delay: 0.05 });
  intro
    .fromTo(".hero h1 .ln > span", { y: 0, yPercent: 108 }, { y: 0, yPercent: 0, duration: 0.7, ease: "power4.out", stagger: 0.08 }, 0)
    .fromTo(".hero-kicker", { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.5 }, 0.05)
    .set(".shutter-led", { opacity: 1 }, 0.15)
    .to(".shutter", { yPercent: -100, duration: 1.1, ease: "power3.inOut" }, 0.15)
    .to(slats, { rotateX: -78, duration: 0.8, ease: "power2.in", stagger: { each: 0.035, from: "start" } }, 0.18)
    .to(".shutter-led", { opacity: 0, duration: 0.3, ease: "none" }, 1.0)
    .fromTo(".hero-media", { scale: 1.14 }, { scale: 1, duration: 1.8, ease: "power3.out" }, 0.15)
    .fromTo(".door", { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.06 }, 0.35)
    .set(".shutter", { display: "none" })
    .add(function () { force = 90; });

  // scroll sull'officina: il video si avvicina e si spegne, il blocco chiaro sale sopra come una lamiera
  gsap.timeline({ scrollTrigger: { trigger: ".hero-wrap", start: "top top", end: "bottom bottom", scrub: 0.8 } })
    .to(".hero-media", { scale: 1.14, ease: "none" }, 0)
    .to(".hero-dark", { opacity: 0.75, ease: "none" }, 0)
    .to(".hero-copy", { y: function () { return -window.innerHeight * 0.1; }, autoAlpha: 0, ease: "power1.in", duration: 0.42 }, 0);

  /* ---------- 2. Chi siamo: le righe salgono da una maschera, una dopo l'altra ---------- */
  var mp = document.getElementById("manifesto");
  var mpText = mp.textContent.trim();
  var mpTween = null;
  function splitLinesReal() {
    // raggruppa le parole per riga come le dispone il browser, poi avvolge ogni riga in una maschera
    mp.textContent = mpText;
    mp.setAttribute("aria-label", mpText);
    var words = mpText.split(/\s+/);
    mp.textContent = "";
    var spans = words.map(function (w, i) {
      var sp = document.createElement("span");
      sp.textContent = w + (i < words.length - 1 ? " " : "");
      mp.appendChild(sp);
      return sp;
    });
    var lines = [], top = null;
    spans.forEach(function (sp) {
      if (top === null || Math.abs(sp.offsetTop - top) > 4) { lines.push([]); top = sp.offsetTop; }
      lines[lines.length - 1].push(sp.textContent);
    });
    mp.textContent = "";
    lines.forEach(function (l) {
      var m = document.createElement("span"); m.className = "ln"; m.setAttribute("aria-hidden", "true");
      var inner = document.createElement("span"); inner.textContent = l.join("");
      m.appendChild(inner); mp.appendChild(m);
    });
  }
  function initMp() {
    if (mpTween) { if (mpTween.progress() > 0) return; mpTween.scrollTrigger && mpTween.scrollTrigger.kill(); mpTween.kill(); }
    splitLinesReal();
    mpTween = gsap.fromTo(mp.querySelectorAll(".ln > span"), { yPercent: 105 }, {
      yPercent: 0, duration: 1.1, ease: "power4.out", stagger: 0.09,
      scrollTrigger: { trigger: mp, start: "top 80%", once: true }
    });
  }
  initMp();
  // le righe vanno ricalcolate quando i caratteri veri sono caricati
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(initMp);
  var mpW = window.innerWidth;
  window.addEventListener("resize", function () {
    if (Math.abs(window.innerWidth - mpW) < 40) return;
    mpW = window.innerWidth;
    var done = !mpTween || mpTween.progress() === 1 || !mpTween.scrollTrigger;
    splitLinesReal();
    if (done) gsap.set(mp.querySelectorAll(".ln > span"), { yPercent: 0 });
  });

  /* ---------- 3. Vano: si entra nel furgone ---------- */
  var vt = gsap.timeline({
    scrollTrigger: { trigger: ".vano", start: "top top", end: function () { return "+=" + window.innerHeight * 1.6; }, pin: ".vano-pin", scrub: 1, anticipatePin: 1, invalidateOnRefresh: true }
  });
  vt.fromTo(".vano-frame", { scale: isPhone ? 0.5 : 0.46 }, { scale: 1, ease: "power2.inOut", duration: 1 }, 0)
    .fromTo(".vano-frame img", { scale: 1.5 }, { scale: 1.06, ease: "power2.inOut", duration: 1 }, 0)
    .to(".vano-title", { y: function () { return -window.innerHeight * 0.06; }, autoAlpha: 0, ease: "power1.in", duration: 0.24 }, 0.08)
    .to(".vano-veil", { opacity: 1, ease: "none", duration: 0.35 }, 0.7)
    .fromTo(".vano-copy > *", { y: 40, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.06, duration: 0.3, ease: "power2.out" }, 0.82)
    .to({}, { duration: 0.25 });

  /* ---------- Parallasse leggera delle foto (velocita' diverse) ---------- */
  gsap.utils.toArray("[data-speed]").forEach(function (img) {
    var sp = parseFloat(img.dataset.speed) || 4;
    gsap.fromTo(img, { yPercent: -sp }, {
      yPercent: sp, ease: "none",
      scrollTrigger: { trigger: img.parentNode, start: "top bottom", end: "bottom top", scrub: true }
    });
  });

  /* ---------- Rivelazioni a basculante delle foto ---------- */
  gsap.utils.toArray(".fig .ph").forEach(function (ph) {
    gsap.fromTo(ph, { clipPath: "inset(100% 0% 0% 0%)" }, {
      clipPath: "inset(0% 0% 0% 0%)", duration: 1.3, ease: "power4.out",
      scrollTrigger: { trigger: ph, start: "top 88%", once: true }
    });
  });

  gsap.utils.toArray("[data-reveal]").forEach(function (el) {
    gsap.to(el, { opacity: 1, y: 0, duration: 1, ease: "power4.out", scrollTrigger: { trigger: el, start: "top 88%", once: true } });
  });

  /* ---------- 4. Lavorazioni: titolo, lamiera che si apre ---------- */
  gsap.fromTo(".lav-open h2 .ln > span", { y: 0, yPercent: 108 }, {
    y: 0, yPercent: 0, duration: 1.2, ease: "power4.out", stagger: 0.1,
    scrollTrigger: { trigger: ".lav-open h2", start: "top 85%", once: true }
  });
  gsap.fromTo(".lav-video .pane", { rotateX: 58, yPercent: 8, scale: 0.9, autoAlpha: 0.4 }, {
    rotateX: 0, yPercent: 0, scale: 1, autoAlpha: 1, ease: "none",
    scrollTrigger: { trigger: ".lav-video", start: "top 95%", end: "top 30%", scrub: 1 }
  });
  gsap.fromTo(".lav-video video", { scale: 1.25 }, {
    scale: 1, ease: "none", scrollTrigger: { trigger: ".lav-video", start: "top bottom", end: "bottom top", scrub: true }
  });

  /* ---------- 5. 1980: le cifre si avvicinano, dentro c'e' il fuoco ---------- */
  gsap.fromTo(".anni-mask, .anni-line", { scale: 1.6 }, {
    scale: 1, ease: "none",
    scrollTrigger: { trigger: ".anni", start: "top bottom", end: "center center", scrub: 1 }
  });

  /* ---------- Chiusura: il marchio ZADE si chiude a doghe, dall'alto, come una basculante ---------- */
  gsap.fromTo(".foot-word .band > span", { yPercent: -110 }, {
    yPercent: 0, ease: "power2.out", stagger: { each: 0.12, from: "end" },
    scrollTrigger: { trigger: ".foot-word", start: "top bottom", end: "bottom bottom", scrub: 0.9 }
  });

  /* ---------- Bottoni magnetici (solo mouse) ---------- */
  if (fine) {
    document.querySelectorAll("[data-magnetic]").forEach(function (el) {
      var xTo = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3.out" });
      var yTo = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3.out" });
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * 0.16);
        yTo((e.clientY - r.top - r.height / 2) * 0.28);
      });
      el.addEventListener("pointerleave", function () { xTo(0); yTo(0); });
    });
  }

  window.addEventListener("load", function () { ScrollTrigger.refresh(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
})();
