/* Hub delle demo: elenco, ricerca e QR a tutto schermo. Nessuna richiesta esterna, nessun cookie. */
(function () {
  'use strict';
  var elenco = (window.DEMO_ELENCO || []).slice().sort(function (a, b) {
    return a.nome.localeCompare(b.nome, 'it');
  });
  var lista = document.getElementById('lista');
  var vuoto = document.getElementById('vuoto');
  var cercaBox = document.getElementById('cercaBox');
  var cerca = document.getElementById('cerca');
  var dlg = document.getElementById('qr');

  /* l'indirizzo della demo si ricava da dove sta l'hub: il QR e' giusto anche in anteprima locale */
  function urlDemo(d) { return new URL(d.slug + '/', location.href).href; }

  function el(tag, cls, testo) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (testo) e.textContent = testo;
    return e;
  }

  function disegna(filtro) {
    var f = (filtro || '').trim().toLowerCase();
    lista.textContent = '';
    var n = 0;
    elenco.forEach(function (d) {
      var testo = (d.nome + ' ' + d.tipo + ' ' + (d.luogo || '')).toLowerCase();
      if (f && testo.indexOf(f) === -1) return;
      n++;
      var li = el('li', 'card' + (d.stato === 'bozza' ? ' card--bozza' : ''));
      var info = el('div', 'card__info');
      info.appendChild(el('p', 'card__tipo', d.tipo + (d.luogo ? ' · ' + d.luogo : '')));
      info.appendChild(el('h2', 'card__nome', d.nome));
      if (d.stato === 'bozza') info.appendChild(el('p', 'card__stato', 'Bozza'));
      var az = el('div', 'card__az');
      var qr = el('button', 'btn', 'Mostra QR');
      qr.type = 'button';
      qr.addEventListener('click', function () { mostra(d); });
      var apri = el('a', 'btn btn--ghost', 'Apri');
      apri.href = d.slug + '/';
      az.appendChild(qr);
      az.appendChild(apri);
      li.appendChild(info);
      li.appendChild(az);
      lista.appendChild(li);
    });
    vuoto.hidden = n > 0;
  }

  function mostra(d) {
    var url = urlDemo(d);
    var q = qrcode(0, 'M');
    q.addData(url);
    q.make();
    document.getElementById('qrTipo').textContent = d.tipo + (d.luogo ? ' · ' + d.luogo : '');
    document.getElementById('qrNome').textContent = d.nome;
    document.getElementById('qrCode').innerHTML = q.createSvgTag({ scalable: true, margin: 2 });
    document.getElementById('qrUrl').textContent = url.replace(/^https?:\/\//, '');
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  }

  document.getElementById('qrChiudi').addEventListener('click', function () { dlg.close(); });

  /* un tocco fuori dal riquadro chiude */
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });

  cercaBox.hidden = elenco.length < 6;
  cerca.addEventListener('input', function () { disegna(cerca.value); });
  disegna('');
})();
