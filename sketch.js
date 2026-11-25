let csvPath = 'assets/wid_panel_2000_2024.csv';

// i 6 continenti: nome nel csv, nome sotto il grafico (\n = vai a capo), colore scuro e colore chiaro
let continents = [
  { key: 'Africa',        label: 'AFRICA',         color: '#8A5A1E', light: '#FFE3BE' },
  { key: 'Asia',          label: 'ASIA',           color: '#D9532B', light: '#FFBF94' },
  { key: 'Europe',        label: 'EUROPE',         color: '#2B3A8C', light: '#E7ECFF' },
  { key: 'North America', label: 'NORTH\nAMERICA', color: '#4A8F3C', light: '#E3F5E1' },
  { key: 'South America', label: 'SOUTH\nAMERICA', color: '#B0309A', light: '#FFDEF4' },
  { key: 'Oceania',       label: 'OCEANIA',        color: '#5B2A9A', light: '#F3DBFF' }
];

let marginLeft = 74;   // spazio vuoto a sinistra del grafico
let marginRight = 40;  // spazio vuoto a destra
let marginTop = 16;    // spazio vuoto in alto
let marginBottom = 74; // spazio vuoto in basso (ci stanno i nomi dei continenti)
let topSpace = 90;     // spazio sopra la linea del 3M: ci stanno le etichette delle barre tagliate (es. "6M")

// DUE METRICHE, cambiabili con il bottone in alto (metric = 'usd' oppure 'times')
//   usd   = reddito medio post-tax in dollari (la linea è l'income gap)
//   times = moltiplicatore: il 50% più povero vale sempre 1x, l'1% più ricco è "quante volte" guadagna di più
// ASSE A DUE TRATTI (per tutte e due): il primo tratto occupa il 76% dell'altezza, il secondo il resto (più compresso)
// le linee oltre il massimo vengono tagliate e continuano tratteggiate, con il valore scritto sopra
let metric = 'usd';

let metricAxes = {
  usd: {
    min: 0,
    split: 1000000,   // dove l'asse cambia scala
    max: 3000000,     // massimo dell'asse
    lowerShare: 0.76, // quanta altezza occupa il primo tratto (0 -> 1M)
    fineStart: 1200000, fineStep: 200000, fineSkip: 2000000, // linee sottili tra 1M e 3M (il 2M ha già la sua)
    ticks: [ // numeri scritti sull'asse (v = valore, label = testo)
      { v: 0,       label: '0' },
      { v: 200000,  label: '200K' },
      { v: 400000,  label: '400K' },
      { v: 600000,  label: '600K' },
      { v: 800000,  label: '800K' },
      { v: 1000000, label: '1M' },
      { v: 2000000, label: '2M' },
      { v: 3000000, label: '3M' }
    ],
    legend: ['BOTTOM 50%', 'TOP 1%', 'INCOME GAP']
  },
  times: {
    min: 1,
    split: 100,
    max: 200,
    lowerShare: 0.76,
    fineStart: 120, fineStep: 20, fineSkip: 150,             // linee sottili tra 100x e 200x (il 150x ha già la sua)
    ticks: [
      { v: 1,   label: '1x' },
      { v: 20,  label: '20x' },
      { v: 40,  label: '40x' },
      { v: 60,  label: '60x' },
      { v: 80,  label: '80x' },
      { v: 100, label: '100x' },
      { v: 150, label: '150x' },
      { v: 200, label: '200x' }
    ],
    legend: ['BOTTOM 50% (1x)', 'TOP 1%', 'MULTIPLIER']
  }
};
let currentAxis = metricAxes.usd; // l'asse della metrica scelta

// dati
let years = [];       // tutti gli anni del csv, in ordine
let countries = [];   // tutti i paesi (ogni paese è una scatola: vedi readData)
let yearIndex = 0;    // posizione dell'anno scelto dentro "years"

// valori animati, uno per paese: si avvicinano un po' alla volta a quelli veri
// ogni valore è una "share" (0 = base dell'asse, 1 = cima): così cambiando metrica i pallini scivolano
// da una scala all'altra senza salti, anche se i numeri (dollari / moltiplicatori) sono molto diversi
let poorBall = [];    // 50% più povero (estremo basso)
let richBall = [];    // 1% più ricco (estremo alto)

// posizioni x
let lineX = [];       // x della linea di ogni paese
let labelX = [];      // x del nome di ogni continente
let space = 6;        // larghezza dello spazio di un paese

// interazione
let hoverCountry = -1; // paese sotto il mouse (-1 = nessuno)
let searchText = '';   // testo scritto nella ricerca (in minuscolo)

// pezzi della pagina html
let tooltip, searchBox, searchInput, searchButton, yearBar, scrollBox, usdButton, timesButton;

// 2. SETUP E LETTURA DEI DATI

// "async" + "await": setup aspetta che il csv sia caricato
async function setup() {
  noCanvas(); // il canvas lo creiamo quando i dati sono pronti

  // prende gli elementi html che ci servono
  tooltip = document.getElementById('tooltip');
  searchBox = document.getElementById('searchBox');
  searchInput = document.getElementById('searchInput');
  searchButton = document.getElementById('searchButton');
  yearBar = document.getElementById('yearBar');
  scrollBox = document.getElementById('scrollBox');
  usdButton = document.getElementById('usdButton');
  timesButton = document.getElementById('timesButton');

  let lines = await loadStrings(csvPath);
  readData(lines);

  createCanvas(scrollBox.clientWidth, scrollBox.clientHeight).parent('chartBox');
  placeLines();
  drawYearBar();
  applyMode();

  // i due bottoni in alto a sinistra: scelgono la metrica del grafico
  if (usdButton) usdButton.onclick = function () { setMetric('usd'); };
  if (timesButton) timesButton.onclick = function () { setMetric('times'); };

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

  // ogni volta che scrivi nella ricerca, salviamo il testo
  searchInput.oninput = function () {
    searchText = searchInput.value.trim().toLowerCase();
  };
}

// quando la finestra cambia dimensione, il grafico si adatta
function windowResized() {
  if (countries.length == 0) return;
  resizeCanvas(scrollBox.clientWidth, scrollBox.clientHeight);
  lineX = [];
  labelX = [];
  placeLines();
}

// il csv usa la virgola per i decimali (0,1886): la trasformiamo in punto e poi in numero
function toNumber(text) {
  return parseFloat(String(text).replace(',', '.'));
}

// da nome del continente ('Asia') a numero (1)
function continentNumber(name) {
  for (let i = 0; i < continents.length; i++) {
    if (continents[i].key == name) return i;
  }
}

// legge il csv e crea la lista "countries"
function readData(lines) {
  let header = lines[0].split(';'); // nomi delle colonne
  let byCode = {};                  // scheda di ogni paese, trovata con il suo codice (per esempio "IT")

  for (let n = 1; n < lines.length; n++) { // si parte da 1: la riga 0 è l'intestazione
    if (lines[n] == '') continue;

    // mette i valori della riga in una scatola con i nomi delle colonne
    // così possiamo scrivere row.year invece di contare le colonne
    let fields = lines[n].split(';');
    let row = {};
    for (let c = 0; c < header.length; c++) {
      row[header[c]] = fields[c];
    }

    // aggiunge l'anno alla lista solo se non c'è già
    let year = parseFloat(row.year);
    if (years.includes(year) == false) years.push(year);

    // la prima volta che vediamo un paese, creiamo la sua scheda
    if (byCode[row.iso2] == undefined) {
      byCode[row.iso2] = {
        iso: row.iso2,
        name: row.country_name,
        continent: continentNumber(row.continent),
        poor: {}, // reddito del 50% più povero, per ogni anno
        rich: {}  // reddito dell'1% più ricco, per ogni anno
      };
    }

    byCode[row.iso2].poor[year] = toNumber(row.avg_posttax_usd_bottom50);
    byCode[row.iso2].rich[year] = toNumber(row.avg_posttax_usd_top1);
  }

  years.sort(function (a, b) { return a - b; }); // dal più piccolo al più grande

  // mette le schede in una lista, ordinata prima per continente e poi per nome
  for (let code in byCode) countries.push(byCode[code]);
  countries.sort(function (a, b) {
    if (a.continent != b.continent) return a.continent - b.continent;
    return a.name.localeCompare(b.name);
  });

  yearIndex = years.length - 1; // si parte dall'ultimo anno
}

// calcola la x di ogni paese e il centro del nome di ogni continente
function placeLines() {
  let gap = 34;       // spazio tra un continente e il successivo
  let x = marginLeft; // da dove parte il disegno

  // spazio per un paese = (larghezza libera meno i buchi) diviso il numero di paesi
  let freeWidth = width - marginLeft - marginRight - gap * (continents.length - 1);
  space = freeWidth / countries.length;

  for (let i = 0; i < continents.length; i++) {
    let start = x;
    for (let c = 0; c < countries.length; c++) {
      if (countries[c].continent == i) { // il paese è di questo continente?
        lineX.push(x + space / 2);       // la linea sta al centro del suo spazio
        x = x + space;
      }
    }
    labelX.push((start + x) / 2); // il nome sta al centro del continente
    x = x + gap;
  }
}


// 3. FUNZIONI DI AIUTO

// reddito del 50% più povero del paese i, nell'anno scelto
function getPoor(i) {
  return countries[i].poor[years[yearIndex]];
}

// reddito dell'1% più ricco del paese i, nell'anno scelto
function getRich(i) {
  return countries[i].rich[years[yearIndex]];
}

// la differenza tra i due (income gap, in dollari)
function getDiff(i) {
  return getRich(i) - getPoor(i);
}

// il moltiplicatore: quante volte l'1% più ricco guadagna più del 50% più povero
function getRatio(i) {
  return getRich(i) / getPoor(i);
}

// i due estremi nella metrica scelta: in dollari, oppure in "volte" (il 50% più povero è sempre 1x)
function poorValue(i) {
  if (metric == 'times') return 1;
  return getPoor(i);
}
function richValue(i) {
  if (metric == 'times') return getRatio(i);
  return getRich(i);
}

// true se il paese ha entrambi i valori maggiori di 0
function hasData(i) {
  return getPoor(i) > 0 && getRich(i) > 0;
}

// il paese i è evidenziato? (mouse sopra, oppure il nome contiene il testo cercato)
function isHighlighted(i) {
  if (i == hoverCountry) return true;
  if (searchText == '') return false;
  return countries[i].name.toLowerCase().includes(searchText);
}

// da valore a share (0 = base dell'asse, 1 = cima), asse a due tratti
function shareOf(value) {
  let v = constrain(value, currentAxis.min, currentAxis.max); // oltre il massimo ci si ferma al massimo
  if (v <= currentAxis.split) {
    return ((v - currentAxis.min) / (currentAxis.split - currentAxis.min)) * currentAxis.lowerShare;
  }
  return currentAxis.lowerShare + ((v - currentAxis.split) / (currentAxis.max - currentAxis.split)) * (1 - currentAxis.lowerShare);
}

// da share a posizione y sul canvas
function yFromShare(share) {
  let base = height - marginBottom;     // y della base dell'asse
  let plotTop = marginTop + topSpace;   // y della cima dell'asse
  return base - share * (base - plotTop);
}

// da valore (nella metrica scelta) a posizione y
function yPosition(value) {
  return yFromShare(shareOf(value));
}

// numero con il punto delle migliaia: 1419388 diventa "1.419.388"
function formatFull(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// versione corta per le linee tagliate: 6000000 diventa "6M", 3600000 diventa "3.6M"
function formatShort(v) {
  return (v / 1000000).toFixed(1).replace('.0', '') + 'M';
}

// moltiplicatore scritto bene: 4.8 resta "4.8x", 46.09 diventa "46x"
function formatTimes(n) {
  if (n < 10) return n.toFixed(1) + 'x';
  return Math.round(n) + 'x';
}

// valore di una linea tagliata, scritto nella metrica scelta
function formatCut(v) {
  if (metric == 'times') return formatTimes(v);
  return formatShort(v);
}

// cambia metrica (chiamata dai due bottoni)
function setMetric(name) {
  metric = name;
  applyMode();
}

// applica la metrica scelta: asse e bottone attivo (quello scelto ha i colori invertiti)
function applyMode() {
  currentAxis = metricAxes[metric];
  if (usdButton) usdButton.classList.toggle('active', metric == 'usd');
  if (timesButton) timesButton.classList.toggle('active', metric == 'times');
}

// c'è una finestra aperta (METHODOLOGY o TEAM)?
function dialogIsOpen() {
  return document.querySelector('dialog[open]') != null;
}


// 4. MOUSE E TOOLTIP

// click su una linea: apre la pagina di dettaglio del paese, passando codice (c) e anno (y)
function mouseClicked() {
  if (hoverCountry < 0) return; // nessuna linea sotto il mouse
  location.href = 'country.html?c=' + countries[hoverCountry].iso + '&y=' + years[yearIndex];
}

// quale paese è sotto il mouse? (-1 = nessuno)
function findCountryUnderMouse() {
  if (dialogIsOpen()) return -1; // con una finestra aperta il grafico non risponde

  // mouse fuori dal grafico
  if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) return -1;

  // trova la linea più vicina al mouse (guardando solo la x)
  let closest = 0;
  for (let j = 1; j < countries.length; j++) {
    if (abs(lineX[j] - mouseX) < abs(lineX[closest] - mouseX)) closest = j;
  }

  // se è troppo lontana, il mouse non è su nessuna linea
  if (abs(lineX[closest] - mouseX) > max(space / 2, 3.5)) return -1;
  if (hasData(closest) == false) return -1;

  // controlla anche l'altezza: dalla cima della linea (con un po' di margine) al pallino in basso
  let top = yFromShare(richBall[closest]) - 18;
  let bottom = yFromShare(poorBall[closest]) + 8;
  if (mouseY >= top && mouseY <= bottom) return closest;

  return -1;
}

// mostra il riquadro con i dati del paese sotto il mouse
function updateTooltip() {
  if (hoverCountry < 0) {
    tooltip.classList.remove('visible');
    return;
  }

  // testo del riquadro: nome del paese e i tre valori
  let html = '<div class="tt-name">' + countries[hoverCountry].name.toUpperCase() + '</div>';
  html += '<div class="tt-row">Top 1% avg income:<b>' + formatFull(getRich(hoverCountry)) + ' USD</b></div>';
  html += '<div class="tt-row">Bottom 50% avg income:<b>' + formatFull(getPoor(hoverCountry)) + ' USD</b></div>';
  if (metric == 'times') {
    html += '<div class="tt-row tt-gap">Top 1% earns<b>' + formatTimes(getRatio(hoverCountry)) + ' the Bottom 50%</b></div>';
  } else {
    html += '<div class="tt-row tt-gap">Income gap:<b>' + formatFull(getDiff(hoverCountry)) + ' USD</b></div>';
  }
  tooltip.innerHTML = html;
  tooltip.classList.add('visible'); // prima lo accendiamo, così possiamo misurarlo

  // posizione: a metà della linea, di fianco ad essa
  let i = hoverCountry;
  let rect = scrollBox.getBoundingClientRect(); // il canvas non parte da 0,0 della pagina
  let barX = rect.left + lineX[i];
  let midY = rect.top + (yFromShare(richBall[i]) + yFromShare(poorBall[i])) / 2;

  let w = tooltip.offsetWidth;
  let h = tooltip.offsetHeight;

  // preferisce stare a destra della linea; se non ci sta va a sinistra
  let x = barX + 16;
  if (x + w > windowWidth - 10) x = max(10, barX - w - 16);
  let y = constrain(midY - h / 2, 10, windowHeight - h - 10);

  tooltip.style.left = x + 'px';
  tooltip.style.top = y + 'px';
}

// draw ripete questo codice di continuo (circa 60 volte al secondo)
function draw() {
  if (countries.length == 0) return; // dati non ancora pronti

  background('#FFFCF2');
  moveBalls();
  hoverCountry = findCountryUnderMouse();
  updateTooltip();

  textFont('Geist Mono');

  drawGrid();
  drawLegend();

  // linea di base (l'inizio dell'asse): sottile e trasparente, sta dietro ai paesi
  stroke('#25241B80');
  strokeWeight(1);
  strokeCap(SQUARE);
  line(marginLeft - 4, yPosition(currentAxis.min), width - marginRight + 2, yPosition(currentAxis.min));

  // paesi: prima quelli normali, poi quelli evidenziati (così stanno sopra)
  for (let i = 0; i < countries.length; i++) {
    if (hasData(i) && isHighlighted(i) == false) drawCountry(i);
  }
  for (let i = 0; i < countries.length; i++) {
    if (hasData(i) && isHighlighted(i)) drawCountry(i);
  }

  drawContinentNames();
}

// animazione: ogni fotogramma i pallini fanno il 16% della strada verso la posizione vera
// (vale anche quando cambi metrica: i pallini scivolano da una scala all'altra)
function moveBalls() {
  for (let i = 0; i < countries.length; i++) {
    let poorTarget = undefined; // senza dati non c'è un bersaglio
    let richTarget = undefined;
    if (hasData(i)) {
      poorTarget = shareOf(poorValue(i));
      richTarget = shareOf(richValue(i));
    }
    poorBall[i] = slide(poorBall[i], poorTarget);
    richBall[i] = slide(richBall[i], richTarget);
  }
}

// avvicina "now" a "target"
function slide(now, target) {
  if (target == undefined) return now;  // nessun dato: resta dov'è
  if (now == undefined) return target;  // prima volta: salta subito alla posizione
  return lerp(now, target, 0.16);
}

// linee orizzontali, numeri sull'asse e titolo dell'asse
function drawGrid() {
  textSize(11);

  // linee sottili nel secondo tratto (1M -> 3M oppure 100x -> 200x)
  stroke('#DAD7C6');
  strokeWeight(1);
  for (let v = currentAxis.fineStart; v < currentAxis.max; v += currentAxis.fineStep) {
    if (v == currentAxis.fineSkip) continue; // ha già la sua linea scura
    line(marginLeft - 4, yPosition(v), width - marginRight, yPosition(v));
  }

  // linee principali con il loro numero
  for (let k = 0; k < currentAxis.ticks.length; k++) {
    let y = yPosition(currentAxis.ticks[k].v);

    if (currentAxis.ticks[k].v >= currentAxis.split) stroke('#25241B'); // secondo tratto: scure
    else stroke('#E3E0CF');                                // primo tratto: chiare
    strokeWeight(1);
    line(marginLeft - 4, y, width - marginRight, y);

    noStroke();
    fill('#25241B');
    textAlign(RIGHT, CENTER);
    text(currentAxis.ticks[k].label, marginLeft - 14, y);
  }
}

// disegna un paese: pallino pieno (50% più povero), cerchio vuoto (1% più ricco) e la linea in mezzo
function drawCountry(i) {
  let highlighted = isHighlighted(i);
  let somethingHighlighted = (hoverCountry >= 0 || searchText != '');
  let faded = somethingHighlighted && highlighted == false; // sfumato se è evidenziato un altro paese

  // colore: aggiungendo '40' alla fine di '#RRGGBB' diventa quasi trasparente
  let colorText = continents[countries[i].continent].color;
  if (faded) colorText = colorText + '40';

  // spessore della linea e grandezza dei pallini (più grandi se evidenziato)
  let lineWeight = 2;
  if (highlighted) lineWeight = 3;
  let marker = constrain(space * 0.8, 3, 6);
  if (highlighted) marker += 3;

  let x = lineX[i];
  let poorY = yFromShare(poorBall[i]);
  let richY = yFromShare(richBall[i]);

  // la linea tra i due gruppi
  strokeCap(SQUARE);
  stroke(colorText);
  strokeWeight(lineWeight);
  line(x, poorY, x, richY);

  if (richValue(i) <= currentAxis.max) {
    // estremo alto: cerchio vuoto, riempito con il colore chiaro del continente
    strokeWeight(1.5);
    let lightColor = continents[countries[i].continent].light;
    if (faded) fill(lerpColor(color(lightColor), color('#FFFCF2'), 0.75)); // sfumato ma non trasparente
    else fill(lightColor);
    circle(x, richY, marker + 1);
  } else {
    // l'1% è oltre il massimo: la linea continua tratteggiata e il suo valore è scritto sopra
    strokeWeight(lineWeight);
    noFill();
    drawingContext.setLineDash([3, 3]); // tratteggio
    line(x, richY, x, richY - 26);
    drawingContext.setLineDash([]);     // torna alla linea piena

    noStroke();
    if (faded) fill('#8B887340');
    else fill('#8B8873');
    textSize(11);
    textAlign(CENTER, BOTTOM);
    text(formatCut(richValue(i)), x, richY - 30);
  }

  // estremo basso: pallino pieno, disegnato per ultimo così sta sopra la linea
  noStroke();
  fill(colorText);
  circle(x, poorY, marker + 1);
}

// legenda in alto a destra: pallino = 50% più povero, cerchio vuoto = 1% più ricco, linea = income gap
function drawLegend() {
  push(); // push e pop: le modifiche qui dentro non escono dalla funzione
  textSize(11);
  textAlign(LEFT, CENTER);

  let y = marginTop + 14;
  let items = currentAxis.legend;
  let gapBetween = 22;

  // larghezza totale della legenda (icona + testo, per ogni voce), per allinearla a destra
  let total = 0;
  for (let k = 0; k < items.length; k++) total += 18 + textWidth(items[k]);
  total += gapBetween * (items.length - 1);

  let x = width - marginRight - total;
  for (let k = 0; k < items.length; k++) {
    let cx = x + 6; // centro dell'icona
    stroke('#25241B');
    strokeWeight(1.5);

    if (k == 0) { fill('#25241B'); noStroke(); circle(cx, y, 9); }
    if (k == 1) { fill('#FFFCF2'); circle(cx, y, 9); }
    if (k == 2) {
      line(cx, y - 8, cx, y + 8);
      line(cx - 4, y - 8, cx + 4, y - 8);
      line(cx - 4, y + 8, cx + 4, y + 8);
    }

    noStroke();
    fill('#25241B');
    text(items[k], x + 18, y);
    x += 18 + textWidth(items[k]) + gapBetween;
  }
  pop();
}

// nomi dei continenti sotto la linea di base
function drawContinentNames() {
  noStroke();
  fill('#25241B');
  textSize(12);
  textLeading(20); // distanza tra le due righe di un nome
  textAlign(CENTER, TOP);
  for (let g = 0; g < continents.length; g++) {
    text(continents[g].label, labelX[g], yPosition(currentAxis.min) + 22);
  }
}

// ---------------------------------------------------------------------------
// 6. BARRA DEGLI ANNI E TASTIERA
// ---------------------------------------------------------------------------

// scrive in html 7 posti: 3 anni prima, quello scelto al centro, 3 anni dopo
function drawYearBar() {
  let html = '';

  // le due frecce disegnate in SVG (al posto del testo < e >)
  let arrowLeft = '<svg width="24" height="16" viewBox="0 0 24 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 8H2M8 1L1 8l7 7"/></svg>';
  let arrowRight = '<svg width="24" height="16" viewBox="0 0 24 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 8H22M16 1l7 7-7 7"/></svg>';

  for (let offset = -3; offset <= 3; offset++) {
    let pos = yearIndex + offset; // posizione dell'anno di questo posto

    if (pos < 0 || pos >= years.length) {
      // non esiste un anno qui: posto vuoto
      html += '<span class="year-button empty"></span>';

    } else if (offset != 0) {
      // anno normale: un bottone
      html += '<button class="year-button" onclick="changeYear(' + pos + ')">' + years[pos] + '</button>';

    } else {
      // anno scelto: numero grande con le due frecce (spente al primo e all'ultimo anno)
      let leftOff = '';
      if (pos == 0) leftOff = ' disabled';
      let rightOff = '';
      if (pos == years.length - 1) rightOff = ' disabled';

      html += '<div class="current-year">';
      html += '<button class="year-arrow" onclick="changeYear(' + (pos - 1) + ')"' + leftOff + '>' + arrowLeft + '</button>';
      html += '<div class="year-number">' + years[pos] + '</div>';
      html += '<button class="year-arrow" onclick="changeYear(' + (pos + 1) + ')"' + rightOff + '>' + arrowRight + '</button>';
      html += '</div>';
    }
  }

  yearBar.innerHTML = html;
}

// cambia anno (chiamata dai bottoni e dalle frecce della tastiera)
// i pallini si muovono da soli: ci pensa moveBalls()
function changeYear(newIndex) {
  if (newIndex < 0 || newIndex >= years.length) return; // anno che non esiste: niente
  yearIndex = newIndex;
  drawYearBar();
}

// frecce della tastiera (non se c'è una finestra aperta o se stai scrivendo nella ricerca)
function keyPressed() {
  if (dialogIsOpen() || document.activeElement == searchInput) return;
  if (key == 'ArrowLeft') changeYear(yearIndex - 1);
  if (key == 'ArrowRight') changeYear(yearIndex + 1);
}