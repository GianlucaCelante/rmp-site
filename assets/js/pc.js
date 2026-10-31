/* PC all-in-one: scala il blocco .pc (934x888) alla larghezza del suo contenitore .pc-wrap. */
(function(){
  "use strict";
  var wraps = document.querySelectorAll('.pc-wrap');
  if (!wraps.length) return;
  function scala(w){
    var pc = w.querySelector('.pc');
    if (pc) pc.style.setProperty('--k', (w.clientWidth / 934).toFixed(4));
  }
  wraps.forEach(function(w){
    scala(w);
    if ('ResizeObserver' in window) new ResizeObserver(function(){ scala(w); }).observe(w);
  });
  window.addEventListener('resize', function(){ wraps.forEach(scala); });
})();

