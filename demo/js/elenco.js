/* Elenco delle demo mostrate dall'hub (/demo/). Una riga per cliente; la demo vera sta in demo/<slug>/index.html.
   - slug:    nome della cartella, difficile da indovinare (es. 'pizzeria-roma-x7k2'): la demo mostra il locale di un prospect
   - nome:    nome del locale, come lo legge il commerciale
   - tipo:    'Pizzeria', 'Ristorante', 'Bar', 'Sagra'...
   - luogo:   comune (facoltativo)
   - stato:   'pronta' oppure 'bozza' (la bozza si vede ma e' segnata)
   Esempio:
   { slug: 'pizzeria-roma-x7k2', nome: 'Pizzeria Roma', tipo: 'Pizzeria', luogo: 'Treviso', stato: 'pronta' }
*/
window.DEMO_ELENCO = [
  { slug: 'inferno-b34d', nome: 'Inferno, Pizza & Takeaway', tipo: 'Pizzeria', luogo: 'Spresiano', stato: 'pronta' },
  { slug: 'pizzaclub-8a87', nome: 'Pizza Club', tipo: 'Pizzeria', luogo: 'Villorba', stato: 'pronta' }
];
