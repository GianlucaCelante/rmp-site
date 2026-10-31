/* Gestionale: gli schermi dei due PC alternano le schermate, il PC segue il mouse. */
(function(){
  "use strict";
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cols = document.querySelectorAll('.gest__col');
  if (!cols.length || reduce) return;

  cols.forEach(function(col, k){
    var imgs = col.querySelectorAll('.aio__photo img'), i = 0;
    if (imgs.length < 2) return;
    setTimeout(function(){
      setInterval(function(){
        if (document.hidden) return;
        var prev = imgs[i];
        i = (i + 1) % imgs.length;
        prev.classList.remove('on');
        prev.classList.add('prev');            /* resta opaca sotto: il PC non si scarica mai */
        imgs[i].classList.add('on');
        setTimeout(function(){ prev.classList.remove('prev'); }, 900);
      }, 3600);
    }, k * 1200);
  });

  if (!window.matchMedia('(hover:hover) and (pointer:fine)').matches) return;
  cols.forEach(function(col){
    var aio = col.querySelector('.aio'), base = 0;
    col.addEventListener('pointermove', function(e){
      var r = col.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      aio.style.setProperty('--ry', (x * 7) + 'deg');
      aio.style.setProperty('--rx', (-y * 4) + 'deg');
    });
    col.addEventListener('pointerleave', function(){
      aio.style.setProperty('--ry', base + 'deg');
      aio.style.setProperty('--rx', '0deg');
    });
  });
})();

