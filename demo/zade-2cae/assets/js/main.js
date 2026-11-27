/* ZADE v5: la v3c (GSAP 3.12.5 + ScrollTrigger + Lenis 1.1.13, in locale) con il 3D della v4:
   il visore 3D delle basculanti (scena.js + Three.js r170, caricati dopo). */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isPhone = window.matchMedia("(max-width: 860px)").matches;
  var fine = window.matchMedia("(pointer: fine)").matches;
  var scenaURL = new URL("scena.js", document.currentScript.src).href;
  var api = null; // la scena 3D, quando c'e'
  window.ZADE = { get api() { return api; } };

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
          if (els[j].tagName === "CANVAS" && t.contains(els[j])) {
            var m = els[j], L3 = -1;
            if (api) L3 = api.lumAt(x, y);
            if (L3 > 0.55) return "chiaro";
            break;
          }
          if ((els[j].tagName === "IMG" || els[j].tagName === "VIDEO") && t.contains(els[j]) && getComputedStyle(els[j]).visibility !== "hidden" && +getComputedStyle(els[j]).opacity > 0.5) {
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
    for (var k = 0; k < 7; k++) {
      var x = r.left + 8 + (r.width - 16) * k / 6;
      toneAt.span = [x - 20, x + 20];
      votes[toneAt(x, yMid)]++;
    }
    var fondo = "scuro";
    Object.keys(votes).forEach(function (kk) { if (votes[kk] > votes[fondo]) fondo = kk; });
    if (fondo === "chiaro" && votes.media >= 3) fondo = "media";
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
    if (force > 0) { if (force % 3 === 0) sampleNav(); lastY = y; lastW = w; force--; }
    requestAnimationFrame(navLoop);
  }
  requestAnimationFrame(navLoop);
  window.addEventListener("resize", function () { force = 90; });

  /* ---------- Modulo preventivo ----------
     Senza server: all'invio prepara una mail all'indirizzo giusto (furgoni ->
     info@zadeallestimenti.it, il resto -> info@zadelavorazioni.it) e mostra la conferma.
     Sul sito vero l'invio va fatto lato server (vedi documenti/LEGGIMI-modulo-e-pagine-legali.md). */
  var form = document.getElementById("preventivo");
  var NOMI = { furgone: "Allestimento furgone", basculante: "Porta basculante", cancello: "Cancello, ringhiera, recinzione", altro: "Altro" };
  var MISURE = {
    furgone: ["Modello del furgone", "es. marca, modello e anno"],
    basculante: ["Misure del vano", "es. larghezza 250 x altezza 210 cm"],
    cancello: ["Misure del vano", "es. larghezza 400 x altezza 160 cm"],
    altro: ["Misure", "se le avete"]
  };
  var boxModello = document.getElementById("modelloScelto"), campoModello = document.getElementById("f-modello");
  function aggiornaMisure() {
    var c = form.querySelector('input[name="bisogno"]:checked');
    var m = MISURE[c ? c.value : "basculante"];
    boxModello.hidden = !((c ? c.value : "") === "basculante" && campoModello.value);
    if (typeof aggiornaPrecompilato === "function") aggiornaPrecompilato();
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
      tipo === "basculante" && campoModello.value ? "Modello: " + campoModello.value : "",
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
    form.reset(); toccati = {}; campoModello.value = ""; msgAuto = ""; aggiornaMisure();
    if (configurata) portaNelModulo();
    Object.keys(errId).forEach(function (k) { document.getElementById(errId[k]).textContent = ""; document.getElementById(campi[k]).removeAttribute("aria-invalid"); });
    document.getElementById("copia").firstChild.nodeValue = "Copiate il testo";
    document.getElementById("conferma").hidden = true;
    document.getElementById("campi").hidden = false;
    document.getElementById("f-nome").focus();
  });

  /* ---------- Visore delle basculanti ---------- */
  var RAL = [
    { id: "7016", corto: "7016 antracite", nome: "RAL 7016 grigio antracite", c: "#383e42" },
    { id: "9010", corto: "9010 bianco", nome: "RAL 9010 bianco puro", c: "#f1ede1" },
    { id: "7035", corto: "7035 grigio luce", nome: "RAL 7035 grigio luce", c: "#cbd0cc" },
    { id: "8017", corto: "8017 marrone", nome: "RAL 8017 marrone cioccolato", c: "#45322e" },
    { id: "6005", corto: "6005 verde", nome: "RAL 6005 verde muschio", c: "#114232" },
    { id: "3000", corto: "3000 rosso", nome: "RAL 3000 rosso fuoco", c: "#a72920" }
  ];
  var SIMIL = [
    { id: "chiaro", corto: "Legno chiaro", nome: "effetto legno chiaro", c: "#b47b45", legno: true },
    { id: "scuro", corto: "Legno scuro", nome: "effetto legno scuro", c: "#6b4428", legno: true }
  ];
  var OKUME = [
    { id: "okume", corto: "Okumè naturale", nome: "okumè naturale", c: "#a8663f", legno: true },
    { id: "noce", corto: "Tinta noce", nome: "tinta noce", c: "#5e3c24", legno: true }
  ];
  var TELAIO = [
    { id: "zinc", corto: "Zincato", nome: "acciaio zincato", c: "#a3a8ab", metal: true },
    { id: "7016", corto: "7016 antracite", nome: "RAL 7016 grigio antracite", c: "#383e42" }
  ];
  var MOD = {
    doghe: { nome: "Doghe lisce", spec: ["Doghe <b>150 o 250</b>", "Coibentato"], testo: "Doga verticale, orizzontale o a spina. In tutti i colori RAL.", foto: "mod-doghe-lisce.webp", alt: "Basculante modello Doghe lisce marrone a doghe orizzontali con porta pedonale", fin: RAL, def: "7016", nota: "un esempio: tutti i colori RAL" },
    energy: { nome: "Energy", spec: ["Spessore <b>60 mm</b>", "Coibentato"], testo: "Rivestimento in gres, interno in okumè bianco o noce. Non chiede manutenzione esterna.", foto: "mod-energy.webp", alt: "Basculante modello Energy grigio antracite con porta pedonale, in un muro di mattoni", fin: [RAL[0], RAL[2], RAL[1]], def: "7016", nota: "un esempio: il gres si sceglie con noi" },
    style: { nome: "Style", spec: ["Spessore <b>50 mm</b>", "Coibentato"], testo: "Lastra in alluminio verniciata e laccata, trattata contro la corrosione. Pannello abbinabile al portoncino d'ingresso.", foto: "mod-style.webp", alt: "Basculante modello Style con pannello rosso laccato a bugne sagomate", fin: RAL, def: "3000", nota: "un esempio di laccatura" },
    standard: { nome: "Pannello standard", spec: ["Spessore <b>40 mm</b>", "Coibentato"], testo: "Pannello metallico verniciato a polveri RAL. Il classico che chiude e isola.", foto: "mod-pannello-standard.webp", alt: "Basculante modello Pannello standard verde con porta pedonale e maniglia in ottone", fin: RAL, def: "6005", nota: "un esempio: tutti i colori RAL" },
    simil: { nome: "Metallico simil legno", spec: ["Spessore <b>40 mm</b>", "Coibentato"], testo: "L'aspetto del legno senza le sue cure. Liscio, dogato, rigato o a cassettoni.", foto: "mod-simil-legno.webp", alt: "Basculante modello metallico simil legno con porta pedonale aperta", fin: SIMIL, def: "chiaro", nota: "un esempio di finitura" },
    legno: { nome: "Legno", spec: ["Spessore <b>70 mm</b>", "Coibentato"], testo: "Esterno in multistrato marino okumè da 15 mm, doga verticale od orizzontale.", foto: "mod-legno.webp", alt: "Due garage con basculanti modello Legno e finestrature", fin: OKUME, def: "okume", nota: "un esempio di finitura" },
    grecato: { nome: "Acciaio grecato", spec: ["Lamiera <b>grecata zincata</b>", "Non coibentato"], testo: "Telaio saldato e tubolari orizzontali che tengono in asse il manto a ogni apertura.", foto: "mod-acciaio-grecato.webp", alt: "Basculante modello Acciaio grecato marrone a greca verticale", fin: RAL, def: "8017", nota: "un esempio: tutti i colori RAL" },
    libera: { nome: "Struttura libera", spec: ["Rivestimento <b>a scelta</b>", "Su richiesta"], testo: "Il telaio pronto per legno, alluminio o pvc, come chiede il cliente.", foto: "mod-struttura-libera.webp", alt: "Telaio di basculante nudo, Struttura libera, montato in un'apertura", fin: TELAIO, def: "zinc", nota: "il telaio, prima del rivestimento", noPed: true }
  };
  var stato = { model: "doghe", fin: RAL[0], ped: true };
  var coloriBox = document.getElementById("colori");
  var pedBox = document.getElementById("pedonale");
  var foto = document.getElementById("fotoModello");
  var riassunto = document.getElementById("riassunto");
  function testoScelta() {
    var m = MOD[stato.model];
    var t = m.nome + ", " + stato.fin.nome;
    if (!m.noPed) t += stato.ped ? ", con porta pedonale" : ", senza porta pedonale";
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  function testoBreve() { // per la barra del telefono: una riga sola
    var m = MOD[stato.model], f = stato.fin;
    var c = f.id.length === 4 && /^\d+$/.test(f.id) ? "RAL " + f.id : f.corto;
    return m.nome + ", " + c + (m.noPed ? "" : stato.ped ? ", con pedonale" : ", senza pedonale");
  }
  function disegnaColori() {
    var m = MOD[stato.model];
    coloriBox.textContent = "";
    m.fin.forEach(function (f) {
      var l = document.createElement("label"); l.className = "colore";
      var i = document.createElement("input"); i.type = "radio"; i.name = "colore"; i.value = f.id; i.checked = f.id === stato.fin.id;
      i.setAttribute("aria-label", f.nome);
      var sw = document.createElement("i"); sw.style.setProperty("--c", f.c); sw.setAttribute("aria-hidden", "true");
      var s = document.createElement("span"); s.textContent = f.corto; s.setAttribute("aria-hidden", "true");
      l.appendChild(i); l.appendChild(sw); l.appendChild(s); coloriBox.appendChild(l);
    });
    document.getElementById("notaColore").textContent = m.nota;
  }
  function aggiornaVisore(instant) {
    var m = MOD[stato.model];
    document.getElementById("schedaSpec").innerHTML = m.spec.map(function (s) { return "<span>" + s + "</span>"; }).join("");
    document.getElementById("schedaTesto").textContent = m.testo;
    pedBox.disabled = !!m.noPed;
    riassunto.textContent = window.matchMedia("(max-width: 860px)").matches ? testoBreve() : testoScelta();
    document.getElementById("coloreNome").textContent = stato.fin.nome.charAt(0).toUpperCase() + stato.fin.nome.slice(1);
    if (foto.getAttribute("src") !== "assets/img/" + m.foto) { foto.src = "assets/img/" + m.foto; foto.alt = m.alt; }
    if (api) api.visore({ model: stato.model, fin: stato.fin, ped: stato.ped && !m.noPed, instant: instant });
    if (!instant && typeof portaNelModulo === "function") portaNelModulo();
  }
  document.getElementById("sceltaModello").addEventListener("change", function (e) {
    if (e.target.name !== "modello") return;
    stato.model = e.target.value;
    var m = MOD[stato.model];
    stato.fin = m.fin.filter(function (f) { return f.id === m.def; })[0];
    disegnaColori(); aggiornaVisore();
  });
  coloriBox.addEventListener("change", function (e) {
    var m = MOD[stato.model];
    stato.fin = m.fin.filter(function (f) { return f.id === e.target.value; })[0] || stato.fin;
    aggiornaVisore();
  });
  pedBox.addEventListener("change", function () { stato.ped = pedBox.checked; aggiornaVisore(); });
  // interruttore della porta: dice lo stato (Chiusa / Aperta), non un verbo
  var segStato = document.querySelector(".seg--stato");
  segStato.addEventListener("click", function (e) {
    var b = e.target.closest(".seg-b"); if (!b) return;
    var open = b.dataset.stato === "aperta";
    segStato.querySelectorAll(".seg-b").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
    if (api) api.apri(open);
    portaNelModulo();
  });
  disegnaColori(); aggiornaVisore(true);

  /* ---------- Dal visore al modulo ----------
     Appena l'utente tocca il visore (modello, colore, pedonale, aperta/chiusa) la sua basculante
     entra nel modulo, da qualunque strada ci arrivi: riquadro in cima, "Porta basculante" scelta
     (se non ha gia' scelto altro) e una riga nel Messaggio, solo se il Messaggio e' vuoto. */
  var configurata = false, msgAuto = "";
  var campoMsg = document.getElementById("f-msg");
  function testoPunti() {
    var m = MOD[stato.model], t = m.nome + " · " + stato.fin.nome.charAt(0).toUpperCase() + stato.fin.nome.slice(1);
    if (!m.noPed) t += stato.ped ? " · con porta pedonale" : " · senza porta pedonale";
    return t;
  }
  function frasePreventivo() {
    var m = MOD[stato.model], t = "Vorrei un preventivo per una basculante " + m.nome + ", " + stato.fin.nome;
    if (!m.noPed) t += stato.ped ? ", con porta pedonale" : ", senza porta pedonale";
    return t + ".";
  }
  function portaNelModulo() {
    configurata = true;
    campoModello.value = testoScelta();
    document.getElementById("modelloScelto-testo").textContent = testoPunti();
    var img = document.getElementById("msImg"), src = "assets/img/" + MOD[stato.model].foto;
    if (img.getAttribute("src") !== src) img.src = src;
    if (!form.querySelector('input[name="bisogno"]:checked')) {
      form.querySelector('input[name="bisogno"][value="basculante"]').checked = true;
    }
    aggiornaMisure();
  }
  function aggiornaPrecompilato() {
    var c = form.querySelector('input[name="bisogno"]:checked');
    var bas = c && c.value === "basculante" && campoModello.value;
    // la riga nel Messaggio: si scrive solo se il campo e' vuoto o contiene ancora la nostra riga
    if (bas && (campoMsg.value === "" || campoMsg.value === msgAuto)) { msgAuto = frasePreventivo(); campoMsg.value = msgAuto; }
    if (!bas && msgAuto && campoMsg.value === msgAuto) { campoMsg.value = ""; }
    if (!bas && campoMsg.value === "") msgAuto = "";
  }
  document.getElementById("modelloTogli").addEventListener("click", function () {
    configurata = false; campoModello.value = "";
    if (msgAuto && campoMsg.value === msgAuto) campoMsg.value = "";
    msgAuto = ""; aggiornaMisure();
    form.querySelector('input[name="bisogno"]:checked').focus();
  });
  /* ---------- Visore su telefono: schede Modello / Colore, porta pedonale vicino alla porta ---------- */
  var pannello = document.querySelector(".visore-pannello");
  var tabs = [document.getElementById("tabModello"), document.getElementById("tabColore")];
  function scheda(nome, fuoco) {
    pannello.setAttribute("data-tab", nome);
    tabs.forEach(function (t) {
      var on = t.id === (nome === "modello" ? "tabModello" : "tabColore");
      t.setAttribute("aria-selected", String(on)); t.tabIndex = on ? 0 : -1;
      if (on && fuoco) t.focus();
    });
  }
  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () { scheda(i ? "colore" : "modello"); });
    t.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); scheda(i ? "modello" : "colore", true); }
    });
  });
  scheda("modello");
  var mqTel = window.matchMedia("(max-width: 860px)");
  // su telefono niente sopra la porta: interruttore e porta pedonale scendono nel pannello delle scelte
  var pedLabel = document.querySelector(".spunta--pedonale"), pedCasa = pedLabel.parentNode, pedPrima = pedLabel.nextSibling;
  var comandi = document.querySelector(".palco-comandi"), visStato = document.getElementById("visStato");
  function sistemaPedonale() {
    if (mqTel.matches) {
      if (segStato.parentNode !== visStato) visStato.appendChild(segStato);
      if (pedLabel.parentNode !== visStato) visStato.appendChild(pedLabel);
    } else {
      if (segStato.parentNode !== comandi) comandi.insertBefore(segStato, comandi.firstChild);
      if (pedLabel.parentNode !== pedCasa) pedCasa.insertBefore(pedLabel, pedPrima);
    }
    riassunto.textContent = mqTel.matches ? testoBreve() : testoScelta();
  }
  sistemaPedonale();
  if (mqTel.addEventListener) mqTel.addEventListener("change", sistemaPedonale);
  // la miniatura scelta resta in vista nella fila
  document.getElementById("sceltaModello").addEventListener("change", function (e) {
    var l = e.target.closest(".mod"), fila = l && l.parentNode;
    if (!fila || fila.scrollWidth <= fila.clientWidth) return;
    var x = l.offsetLeft - (fila.clientWidth - l.offsetWidth) / 2;
    fila.scrollTo({ left: Math.max(0, x), behavior: reduce ? "auto" : "smooth" });
  });

  /* ---------- Scena 3D: si carica dopo, quando la pagina e' gia' leggibile ---------- */
  var palcoVis = document.getElementById("palcoVisore");
  function supportaWebGL() {
    try { var c = document.createElement("canvas"); return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl"))); }
    catch (e) { return false; }
  }
  function caricaScena() {
    if (!supportaWebGL() || !window.ResizeObserver) return;
    import(scenaURL).then(function (mod) {
      try { api = mod.avvia(); } catch (e) { api = null; return; }
      api.attach(palcoVis);
      api.visore({ model: stato.model, fin: stato.fin, ped: stato.ped && !MOD[stato.model].noPed, instant: true });
    }).catch(function () { api = null; });
  }
  function quandoPronto(fn) {
    var go = function () { (window.requestIdleCallback || function (f) { setTimeout(f, 1); })(fn, { timeout: 900 }); };
    if (document.readyState === "complete") go(); else window.addEventListener("load", go);
  }
  quandoPronto(caricaScena);

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
      var yy = id === "#top" ? 0 : t.getBoundingClientRect().top + window.scrollY - navH - 16;
      lenis.scrollTo(window.scrollY, { immediate: true, force: true });
      lenis.scrollTo(yy, { duration: 1.4, force: true, onComplete: function () { if (id === "#preventivo") window.focusScelta(); } });
    });
  });

  /* ---------- 1. Apertura: la basculante si alza ---------- */
  var slats = gsap.utils.toArray(".slat");
  var intro = gsap.timeline({ delay: 0.05 });
  intro
    .set(".shutter-led", { opacity: 1 }, 0.15)
    .to(".shutter", { yPercent: -100, duration: 1.1, ease: "power3.inOut" }, 0.15)
    .to(slats, { rotateX: -78, duration: 0.8, ease: "power2.in", stagger: { each: 0.035, from: "start" } }, 0.18)
    .to(".shutter-led", { opacity: 0, duration: 0.3, ease: "none" }, 1.0)
    .fromTo(".hero-media", { scale: 1.14 }, { scale: 1, duration: 1.8, ease: "power3.out" }, 0.15)
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

  /* ---------- Chiusura: le doghe del marchio ZADE si chiudono come una basculante ---------- */
  gsap.fromTo(".foot-marchio", { "--gap": 0.6 }, { "--gap": 0.1, ease: "none", scrollTrigger: { trigger: ".foot", start: "top bottom", end: "bottom bottom", scrub: 0.8 } });

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
