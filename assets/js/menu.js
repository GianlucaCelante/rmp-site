/* Menu a pagina piena su telefono: apre/chiude il pannello, blocca lo scroll sotto,
   chiude con Esc, tocco su una voce, tocco sul pulsante o passando a >760px. */
(function(){
  "use strict";
  var navEl = document.getElementById('siteNav');
  var menuBtn = document.getElementById('navMenuBtn');
  var panel = document.getElementById('navPanel');
  if (!navEl || !menuBtn || !panel) return;
  var lbl = menuBtn.querySelector('.nav-menu-btn__lbl');
  var panelLinks = panel.querySelectorAll('a');
  var mq = window.matchMedia('(max-width: 760px)');
  function setMenu(open, restoreFocus){
    navEl.classList.toggle('menu-open', open);
    document.documentElement.classList.toggle('menu-lock', open);
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (lbl) lbl.textContent = open ? 'Chiudi' : 'Menu';
    if (open) { panelLinks[0].focus({ preventScroll: true }); }
    else if (restoreFocus) { menuBtn.focus({ preventScroll: true }); }
  }
  menuBtn.addEventListener('click', function(){ setMenu(!navEl.classList.contains('menu-open'), true); });
  panelLinks.forEach(function(a){ a.addEventListener('click', function(){ setMenu(false, false); }); });
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
})();

