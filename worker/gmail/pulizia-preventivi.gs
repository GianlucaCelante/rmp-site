/* Sposta nel cestino di Gmail le email di richiesta preventivo scadute.
 * Va installato su https://script.google.com con la casella che riceve gli
 * avvisi del form (vedi worker/README.md).
 *
 * Il tempo si conta dall'ultimo messaggio della conversazione: 11 mesi qui,
 * piu' i 30 giorni dopo cui Gmail svuota da solo il cestino, stanno dentro i
 * 12 mesi promessi dalla privacy.
 *
 * Chi diventa cliente: metti alla conversazione l'etichetta "cliente" e questo
 * script non la tocca piu'.
 */

/* true = elenca soltanto. Metti false dopo aver controllato il log della prova. */
var PROVA = true;

var MESI = 11;
var ETICHETTA_DA_TENERE = 'cliente';
var RICERCA = 'from:noreply@celan.it subject:"richiesta di preventivo" older_than:' + MESI + 'm';
var PER_PAGINA = 100;
var MASSIMO_PER_GIRO = 500;

/* Data limite: adesso meno MESI di calendario (il 31 gennaio diventa 28/29 febbraio). */
function dataLimite(adesso) {
  var d = new Date(adesso.getTime());
  var giorno = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() - MESI);
  var ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(giorno, ultimo));
  return d;
}

function daCancellare(conversazione, limite) {
  var tenuta = conversazione.getLabels().some(function (e) {
    return e.getName() === ETICHETTA_DA_TENERE;
  });
  return !tenuta && conversazione.getLastMessageDate().getTime() < limite.getTime();
}

function pulisciPreventivi() {
  var limite = dataLimite(new Date());
  var scadute = [];
  /* prima si legge tutto: spostando mentre si legge, le pagine scorrerebbero */
  for (var inizio = 0; scadute.length < MASSIMO_PER_GIRO; inizio += PER_PAGINA) {
    var pagina = GmailApp.search(RICERCA, inizio, PER_PAGINA);
    pagina.forEach(function (c) {
      if (scadute.length < MASSIMO_PER_GIRO && daCancellare(c, limite)) scadute.push(c);
    });
    if (pagina.length < PER_PAGINA) break;
  }

  scadute.forEach(function (c) {
    if (PROVA) Logger.log('Da cancellare: %s | %s', c.getLastMessageDate(), c.getFirstMessageSubject());
    else c.moveToTrash();
  });
  Logger.log('%s: %s conversazioni scadute prima del %s', PROVA ? 'PROVA, nulla spostato' : 'Spostate nel cestino', scadute.length, limite);
}

/* Da lanciare una sola volta: fa girare la pulizia ogni notte. */
function installa() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'pulisciPreventivi') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('pulisciPreventivi').timeBased().everyDays(1).atHour(4).create();
  Logger.log('Pulizia programmata ogni notte.');
}
