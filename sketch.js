let csvPath = 'assets/wid_panel_2000_2024.csv';   // dove si trova il file csv 

// i 6 continenti: nome nel csv, nome sotto il grafico, colore (\n vuol dire "vai a capo")
let continents = [
  { key: 'Africa',        label: 'AFRICA',         color: '#8A5A1E' },
  { key: 'Asia',          label: 'ASIA',           color: '#D9532B' },
  { key: 'Europe',        label: 'EUROPE',         color: '#2B3A8C' },
  { key: 'North America', label: 'NORTH\nAMERICA', color: '#4A8F3C' },
  { key: 'South America', label: 'SOUTH\nAMERICA', color: '#B0309A' },
  { key: 'Oceania',       label: 'OCEANIA',        color: '#5B2A9A' }
];

let marginLeft = 74;   // spazio vuoto a sinistra del grafico
let marginRight = 40;  // spazio vuoto a destra
let marginTop = 16;    // spazio vuoto in alto
let marginBottom = 62; // spazio vuoto in basso (ci stanno i nomi dei continenti)
let topSpace = 90;     // spazio sopra la linea del 3M: ci stanno le etichette delle barre tagliate (es. "6M")

// ASSE A DUE TRATTI (lineare, non più logaritmico):
// da 0 a 1M occupa il 76% dell'altezza, da 1M a 3M il resto (più compresso).
// Le barre oltre 3M vengono tagliate e continuano tratteggiate, con il valore scritto sopra.
let splitValue = 1000000;   // dove l'asse cambia scala
let maxValue = 3000000;     // massimo dell'asse
let lowerShare = 0.76;      // quanta altezza occupa il primo tratto (0 -> 1M)

// numeri scritti sull'asse (v = valore in dollari, label = testo)
let majorTicks = [
  { v: 0,       label: '0' },
  { v: 200000,  label: '200K' },
  { v: 400000,  label: '400K' },
  { v: 600000,  label: '600K' },
  { v: 800000,  label: '800K' },
  { v: 1000000, label: '1M' },
  { v: 2000000, label: '2M' },
  { v: 3000000, label: '3M' }
];

let years = [];     // tutti gli anni del csv, in ordine
let countries = [];   // tutti i paesi (vedi readData per sapere cosa c'è dentro)
let yearIndex = 0;    // quale anno è scelto (0 = il primo della lista)

let diffBall = [];  // altezza attuale (animata) della barra di ogni paese = ricchi - poveri
let lineX = [];    // posizione x della barra di ogni paese
let labelX = [];   // posizione x del nome di ogni continente
let space = 6;    // larghezza dello spazio di un paese

let hoverCountry = -1; // paese sotto il mouse (-1 = nessuno)
let searchText = '';   // testo scritto nella ricerca (in minuscolo)

// pezzi della pagina html che ci servono
let tooltip, searchBox, searchInput, searchButton, yearBar, scrollBox;

// setup parte una volta sola. "async" + "await" = aspetta che il csv sia caricato
async function setup() {
  noCanvas();   // il grafico verrà creato quando si hanno i dati

  tooltip = document.getElementById('tooltip');  // --- queste sei linee prendono elementi HTML e li tengono all'interno di variabili
  searchBox = document.getElementById('searchBox');
  searchInput = document.getElementById('searchInput');
  searchButton = document.getElementById('searchButton');
  yearBar = document.getElementById('yearBar');
  scrollBox = document.getElementById('scrollBox');

  let lines = await loadStrings(csvPath);   // si carica il file csv e await tiene set up in pausa affinché il caricamento è finito
  readData(lines);  //readData effetua un parsing, ovvero prende dei string di dati e li organizza in formati utilizzabili in codice (come un array)

  createCanvas(scrollBox.clientWidth, scrollBox.clientHeight).parent('chartBox');
  placeLines();
  drawYearBar();

  // bottone lente: apre o chiude la ricerca
  searchButton.onclick = function () {
    if (searchBox.classList.contains('open')) {
      searchInput.value = '';
      searchText = '';
      searchBox.classList.remove('open');
    } else {
      searchBox.classList.add('open');
      searchInput.focus();
    }
  };

  // ogni volta che scrivi nella ricerca, mi segno il testo
  searchInput.oninput = function () {
    searchText = searchInput.value.trim().toLowerCase();
  };
}

//quando la dimensione della finestra cambia il grafico si adatta
function windowResized() {
  if (countries.length == 0) return;
  resizeCanvas(scrollBox.clientWidth, scrollBox.clientHeight);
  lineX = [];
  labelX = [];
  placeLines();
}

// da nome del continente ('Asia') a numero (1)
function continentNumber(name) {
  for (let i = 0; i < continents.length; i++) {
    if (continents[i].key == name) return i;
  }
}

// legge tutte le righe del csv. --- da qui viene creato l'array "countries"
function readData(lines) {
  // la prima riga contiene i nomi delle colonne
  let header = lines[0].split(';');
  let cards = {};

  for (let n = 1; n < lines.length; n++) {     // n = 1: salto la riga dei nomi
    if (lines[n] == '') continue;            // riga vuota (di solito l'ultima): la salto
    let fields = lines[n].split(';');

    // metto i valori della riga in una scatola con i nomi delle colonne:
    // row.year, row.iso2, row.country_name ...
    let row = {};
    for (let c = 0; c < header.length; c++) {
      row[header[c]] = fields[c];
    }

    let year = parseFloat(row.year);   // parseFloat converte testo in valori numerici

    if (years.includes(year) == false) years.push(year);   // aggiungo l'anno alla lista solo se non c'è già

    // se è la prima volta che il paese è visto viene creato la sua scheda
    if (cards[row.iso2] == undefined) {
      cards[row.iso2] = { iso: row.iso2, name: row.country_name, continent: continentNumber(row.continent), poor: {}, rich: {} }; //cambiato il codice per costruire il link alla pagina di dettaglio
    }

    // le , nel csv diventano . - parseFloat legge solo . come separatore
    cards[row.iso2].poor[year] = parseFloat(row.avg_posttax_usd_bottom50.replace(',', '.'));
    cards[row.iso2].rich[year] = parseFloat(row.avg_posttax_usd_top1.replace(',', '.'));
  }

  //anni in ordine dal più piccolo al più grande
  years.sort(function (a, b) { return a - b; });

  // copia le schede in una lista e vengono organizzate, prima per continente, poi per nome.
  for (let code in cards) countries.push(cards[code]);
  countries.sort(function (a, b) {
    if (a.continent != b.continent) return a.continent - b.continent;
    return a.name.localeCompare(b.name);
  });

  yearIndex = years.length - 1;   // si parte dall'ultimo anno
}

// valore del 50% più povero del paese i, nell'anno scelto
function getPoor(i) { return countries[i].poor[years[yearIndex]]; }

// valore dell'1% più ricco del paese i, nell'anno scelto
function getRich(i) { return countries[i].rich[years[yearIndex]]; }

// la differenza tra i due: è l'altezza della barra
function getDiff(i) { return getRich(i) - getPoor(i); }

// vero sole se entrambi valori sono maggiori di 0, altrimenti è falso
function hasData(i) {
  return getPoor(i) > 0 && getRich(i) > 0;
}

// il paese "i" va evidenziato con l'Hover o con la ricerca sulla barra
function isHighlighted(i) {
  if (i == hoverCountry) return true;
  if (searchText == '') return false;
  return countries[i].name.toLowerCase().includes(searchText);
}

// da dollari a altezza sullo schermo (asse a due tratti: 0 -> 1M poi 1M -> 3M, vedi sopra)
function yPosition(dollars) {
  let base = height - marginBottom;       // altezza dello 0
  let plotTop = marginTop + topSpace;     // altezza del 3M
  let h = base - plotTop;                 // altezza totale dell'asse
  let v = constrain(dollars, 0, maxValue);   // oltre il massimo ci si ferma al massimo

  let share;   // che frazione dell'altezza (0 = base, 1 = cima)
  if (v <= splitValue) {
    share = (v / splitValue) * lowerShare;
  } else {
    share = lowerShare + ((v - splitValue) / (maxValue - splitValue)) * (1 - lowerShare);
  }
  return base - share * h;
}

// numeri con il punto delle migliaia: 1419388 diventa "1.419.388"
function formatFull(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// versione corta per le barre tagliate: 6000000 diventa "6M", 3600000 diventa "3.6M"
function formatShort(v) {
  return (v / 1000000).toFixed(1).replace('.0', '') + 'M';
}

// calcola la x di ogni paese e il centro del nome di ogni continente
function placeLines() {
  let gap = 34;                  // spazio tra un continente e l'altro
  let x = marginLeft;            // da dove parte il disegno

  // spazio per un paese = (larghezza libera - i buchi) / numero di paesi
  let freeWidth = width - marginLeft - marginRight - gap * (continents.length - 1);
  space = freeWidth / countries.length;

  for (let i = 0; i < continents.length; i++) {     // per ogni continente...
    let start = x;
    for (let c = 0; c < countries.length; c++) {    // ...si guardano tutti i paesi
      if (countries[c].continent == i) {            // se è di questo continente
        lineX.push(x + space / 2);                  // la barra sta al centro del suo spazio
        x = x + space;
      }
    }
    labelX.push((start + x) / 2);                   // il nome sta al centro del continente
    x = x + gap;
  }
}

// scrive in html 7 posti: 3 anni prima, l'anno scelto al centro, 3 anni dopo
function drawYearBar() {
  let html = '';

  // le due frecce disegnate in SVG (al posto del testo < e >)
  let arrowLeft = '<svg width="24" height="16" viewBox="0 0 24 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 8H2M8 1L1 8l7 7"/></svg>';
  let arrowRight = '<svg width="24" height="16" viewBox="0 0 24 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 8H22M16 1l7 7-7 7"/></svg>';

  for (let offset = -3; offset <= 3; offset++) {
    let pos = yearIndex + offset;     // posizione dell'anno di questo posto

    if (pos < 0 || pos >= years.length) {
      // non esiste nessun anno qui: posto vuoto invisibile
      html += '<span class="year-button empty"></span>';

    } else if (offset != 0) {
      // anno normale: un bottone che si può cliccare
      html += '<button class="year-button" onclick="changeYear(' + pos + ')">' + years[pos] + '</button>';

    } else {
      // anno scelto: numero grande con le due frecce
      let leftOff = '';                                  // freccia spenta se al primo anno
      if (pos == 0) leftOff = ' disabled';
      let rightOff = '';                                 // freccia spenta se all'ultimo anno
      if (pos == years.length - 1) rightOff = ' disabled';

      html += '<div class="current-year">';
      html += '<button class="year-arrow" onclick="changeYear(' + (pos - 1) + ')"' + leftOff + '>' + arrowLeft + '</button>';
      html += '<div class="year-number">' + years[pos] + '</div>';
      html += '<button class="year-arrow" onclick="changeYear(' + (pos + 1) + ')"' + rightOff + '>' + arrowRight + '</button>';
      html += '</div>';          //tutto ciò per aggiungere un contenere i bottoni e l'anno
    }
  }

  yearBar.innerHTML = html; //cambia il contenuto del yearBar con HTML generato
}

// chiamata dai bottoni della barra: cambia anno
function changeYear(newIndex) {
  if (newIndex < 0 || newIndex >= years.length) return;   // fuori dalla lista: non faccio niente
  yearIndex = newIndex;
  drawYearBar();
  // le barre si muovono da sole, ci pensa moveBalls()
}

// frecce della tastiera: cambiano anno (non se c'è una finestra aperta o se si sta scrivendo nella ricerca)
function keyPressed() {
  if (dialogIsOpen() || document.activeElement == searchInput) return;
  if (keyCode == LEFT_ARROW) changeYear(yearIndex - 1);
  if (keyCode == RIGHT_ARROW) changeYear(yearIndex + 1);
}

// --- funzionamenti MOUSE ---

// click su una barra: apre la pagina del suo continente
function mouseClicked() {
  if (hoverCountry < 0) return;   // nessuna barra sotto il mouse: non faccio niente
  location.href = 'country.html?c=' + countries[hoverCountry].iso + '&y=' + years[yearIndex]; //click porta a country.html, passando il codice del paese (c=IT) e l'anno selezionato (y=2024) > la pagina di dettaglio si apre sullo stesso anno dell'index.
}

// c'è una finestra aperta (METHODOLOGY o TEAM)?
function dialogIsOpen() {
  return document.querySelector('dialog[open]') != null;
}

// quale paese è sotto il mouse? (-1 = nessuno)
function findCountryUnderMouse() {
  // finestra aperta: il grafico è intangibile, nessun paese è sotto il mouse
  if (dialogIsOpen()) return -1;

  // mouse fuori dal grafico
  if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) return -1;

  // trovo la barra più vicina al mouse (guardando solo la x)
  let closest = 0;
  for (let j = 1; j < countries.length; j++) {
    if (abs(lineX[j] - mouseX) < abs(lineX[closest] - mouseX)) closest = j;
  }

  // se è troppo lontana, il mouse non è su nessuna barra
  if (abs(lineX[closest] - mouseX) > max(space / 2, 3.5)) return -1;
  if (hasData(closest) == false) return -1;

  // controllo anche l'altezza: dalla cima della barra (+18 pixel di margine, perché le barre sono sottili) fino alla linea di base
  let top = yPosition(diffBall[closest]) - 18;
  let bottom = yPosition(0) + 4;
  if (mouseY >= top && mouseY <= bottom) return closest;

  return -1;
}

// mostra il riquadro con i dati del paese vicino al mouse
function updateTooltip() {
  if (hoverCountry < 0) {
    tooltip.classList.remove('visible');
    return;
  }

  // il testo del riquadro: nome del paese + i tre valori
  let html = '<div class="tt-name">' + countries[hoverCountry].name + '</div>';
  html += '<div class="tt-row">Top 1% avg income:<b>' + formatFull(getRich(hoverCountry)) + ' USD</b></div>';
  html += '<div class="tt-row">Bottom 50% avg income:<b>' + formatFull(getPoor(hoverCountry)) + ' USD</b></div>';
  html += '<div class="tt-row">Difference:<b>' + formatFull(getDiff(hoverCountry)) + ' USD</b></div>';
  tooltip.innerHTML = html;
  tooltip.classList.add('visible');   // prima lo accendo, così posso misurare la sua larghezza

  if (winMouseX < windowWidth / 2) {
    // mouse nella metà sinistra: il tooltip sta a destra del mouse
    tooltip.style.left = (winMouseX + 16) + 'px';
  } else {
    // mouse nella metà destra: il tooltip sta a sinistra del mouse
    tooltip.style.left = (winMouseX - tooltip.offsetWidth - 16) + 'px';
  }
  // il tooltip non esce dal fondo della finestra
  tooltip.style.top = min(winMouseY + 16, windowHeight - tooltip.offsetHeight - 10) + 'px';
}

// --- disegno ---

// avvicina la barra al suo valore vero, di un po' alla volta (16%)
// così quando cambi anno le barre scivolano invece di saltare
function slide(now, target) {
  if (!(target > 0)) return now;   // niente dato: la barra resta dov'è
  if (!(now > 0)) return target; // prima volta: salta subito al valore
  return lerp(now, target, 0.16);
}

// animazione barre
function moveBalls() {
  for (let i = 0; i < countries.length; i++) {
    let target = undefined;                       // se non ci sono dati il bersaglio non esiste
    if (hasData(i)) target = getDiff(i);
    diffBall[i] = slide(diffBall[i], target);
  }
}

// disegna un paese = una barra sottile che parte dalla linea di base
function drawCountry(i) {
  let bold = isHighlighted(i);  // è evidenziato?
  let somethingHighlighted = (hoverCountry >= 0 || searchText != '');

  // il colore è scritto come '#RRGGBB'. Aggiungendo '40' alla fine diventa quasi trasparente
  let colorText = continents[countries[i].continent].color;
  let faded = somethingHighlighted && bold == false;
  if (faded) colorText = colorText + '40';

  // misura normale...
  let lineWeight = 2;
  // ...più spessa se evidenziato
  if (bold) lineWeight = 3;

  let d = diffBall[i];       // altezza della barra in dollari
  let x = lineX[i];
  let baseY = yPosition(0);    // dove parte la barra
  let topY = yPosition(d);    // dove finisce (oltre 3M si ferma a 3M)

  strokeCap(SQUARE);
  stroke(colorText);
  strokeWeight(lineWeight);
  line(x, baseY, x, topY);   // la barra

  // barra oltre il massimo: prosegue tratteggiata, con il valore scritto sopra
  if (d > maxValue) {
    drawingContext.setLineDash([3, 3]);  // tratteggio
    line(x, topY, x, topY - 26);
    drawingContext.setLineDash([]);  // torna alla linea piena

    noStroke();
    if (faded) fill('#8B887340');
    else fill('#8B8873');
    textSize(11);
    textAlign(CENTER, BOTTOM);
    text(formatShort(d), x, topY - 30);
  }
}

// draw ripete questo codice di continuo (circa 60 volte al secondo)
function draw() {
  if (countries.length == 0) return;       // dati non ancora pronti: non disegno

  background('#FFFCF2');
  moveBalls();
  hoverCountry = findCountryUnderMouse();
  updateTooltip();

  let baseline = yPosition(0);      // altezza della linea di base (0 dollari)

  textFont('Geist Mono');
  textSize(11);

  // linee sottili tra 1M e 3M (una ogni 200K)
  stroke('#DAD7C6');
  strokeWeight(1);
  for (let v = 1200000; v < maxValue; v += 200000) {
    if (v == 2000000) continue;            // il 2M ha già la sua linea scura
    line(marginLeft - 4, yPosition(v), width - marginRight, yPosition(v));
  }

  // griglia e numeri sull'asse
  for (let k = 0; k < majorTicks.length; k++) {
    let y = yPosition(majorTicks[k].v);

    if (majorTicks[k].v >= splitValue) stroke('#25241B');   // 1M, 2M, 3M: linee scure
    else stroke('#E3E0CF');                                  // 200K ... 800K: linee chiare
    strokeWeight(1);
    line(marginLeft - 4, y, width - marginRight, y);         // linea della griglia

    noStroke();
    fill('#25241B');
    textAlign(RIGHT, CENTER);
    text(majorTicks[k].label, marginLeft - 14, y);           // numero
  }

  // paesi: prima quelli normali, poi quelli evidenziati (così stanno sopra)
  for (let i = 0; i < countries.length; i++) {
    if (hasData(i) && isHighlighted(i) == false) drawCountry(i);
  }
  for (let i = 0; i < countries.length; i++) {
    if (hasData(i) && isHighlighted(i)) drawCountry(i);
  }

  // linea di base spessa (copre anche la prima linea della griglia)
  stroke('#25241B');
  strokeWeight(2.5);
  strokeCap(SQUARE);
  line(marginLeft - 4, baseline, width - marginRight + 2, baseline);

  // nomi dei continenti sotto la linea di base
  noStroke();
  fill('#25241B');
  textSize(12);
  textLeading(20);   // distanza tra le due righe di un nome
  textAlign(CENTER, TOP);
  for (let g = 0; g < continents.length; g++) {
    text(continents[g].label, labelX[g], baseline + 22);
  }
}