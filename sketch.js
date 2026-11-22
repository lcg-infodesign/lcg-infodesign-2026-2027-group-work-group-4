let csvPath = 'assets/wid_panel_2000_2024.csv';   // dove si trova il file csv 

// i 6 continenti: nome nel csv, nome sotto il grafico, colore (\n vuol dire "vai a capo")
let continents = [
  { key: 'Africa',        label: 'AFRICA',         color: '#8A9A4B' },
  { key: 'Asia',          label: 'ASIA',           color: '#D9622B' },
  { key: 'Europe',        label: 'EUROPE',         color: '#3E4278' },
  { key: 'North America', label: 'NORTH\nAMERICA', color: '#7B5EA0' },
  { key: 'South America', label: 'SOUTH\nAMERICA', color: '#3E9E94' },
  { key: 'Oceania',       label: 'OCEANIA',        color: '#3A1E14' }
];

let marginLeft = 74;   // spazio vuoto a sinistra del grafico
let marginRight = 28;  // spazio vuoto a destra
let marginTop = 16;    // spazio vuoto in alto
let marginBottom = 62; // spazio vuoto in basso (ci stanno i nomi dei continenti)

let axisMin = 2;     // l'asse parte da 10^2 = 100 dollari (stiamo utilizzando un sistema logaritmico)
let axisMax = 6.85;   // e arriva a circa 7 milioni
let axisLabels = ['100', '1k', '10k', '100k', '1M'];   // numeri scritti sull'asse

let years = [];     // tutti gli anni del csv, in ordine
let countries = [];   // tutti i paesi (vedi readData per sapere cosa c'è dentro)
let yearIndex = 0;    // quale anno è scelto (0 = il primo della lista)

let poorBall = [];  // altezza attuale della pallina bassa di ogni paese
let richBall = [];  // altezza attuale della pallina alta di ogni paese
let lineX = [];    // posizione x della linea di ogni paese
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

// da dollari a altezza sullo schermo (scala logaritmica: ogni passo = x10)
function yPosition(dollars) {
  let logValue = Math.log10(max(dollars, 1));
  return map(logValue, axisMin, axisMax, height - marginBottom, marginTop);
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
        lineX.push(x + space / 2);                  // la linea sta al centro del suo spazio
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
      html += '<button class="year-arrow" onclick="changeYear(' + (pos - 1) + ')"' + leftOff + '>&lt;</button>';
      html += '<div class="year-number">' + years[pos] + '</div>';
      html += '<button class="year-arrow" onclick="changeYear(' + (pos + 1) + ')"' + rightOff + '>&gt;</button>';
      html += '</div>';          //tutto ciò per aggiungere un contenere i bottoni e l'anno; &lt e &gt sono codici html per < e >
    }
  }

  yearBar.innerHTML = html; //cambia il contenuto del yearBar con HTML generato
}

// chiamata dai bottoni della barra: cambia anno
function changeYear(newIndex) {
  yearIndex = newIndex;
  drawYearBar();
  // le palline si muovono da sole, ci pensa moveBalls()
}

// --- funzionamenti MOUSE ---

// click su una linea: apre la pagina del suo continente
function mouseClicked() {
  if (hoverCountry < 0) return;   // nessuna linea sotto il mouse: non faccio niente
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

  // trovo la linea più vicina al mouse (guardando solo la x)
  let closest = 0;
  for (let j = 1; j < countries.length; j++) {
    if (abs(lineX[j] - mouseX) < abs(lineX[closest] - mouseX)) closest = j;
  }

  // se è troppo lontana, il mouse non è su nessuna linea
  if (abs(lineX[closest] - mouseX) > max(space / 2, 3.5)) return -1;
  if (hasData(closest) == false) return -1;

  // controllo anche l'altezza (+18 pixel di margine, perché le linee sono sottili)
  let top = yPosition(richBall[closest]) - 18;
  let bottom = yPosition(poorBall[closest]) + 18;
  if (mouseY >= top && mouseY <= bottom) return closest;

  return -1;
}

// mostra il nome del paese vicino al mouse
function updateTooltip() {
  if (hoverCountry < 0) {
    tooltip.classList.remove('visible');
    return;
  }
  tooltip.innerHTML = '<div class="country-name">' + countries[hoverCountry].name + '</div>';
  tooltip.classList.add('visible');   // prima lo accendo, così posso misurare la sua larghezza

  if (winMouseX < windowWidth / 2) {
    // mouse nella metà sinistra: il tooltip sta a destra del mouse
    tooltip.style.left = (winMouseX + 16) + 'px';
  } else {
    // mouse nella metà destra: il tooltip sta a sinistra del mouse
    tooltip.style.left = (winMouseX - tooltip.offsetWidth - 16) + 'px';
  }
  tooltip.style.top = (winMouseY + 16) + 'px';
}

// --- disegno ---

// avvicina una pallina al suo valore vero, di un po' alla volta (16%)
// così quando cambi anno le palline scivolano invece di saltare
function slide(now, target) {
  if (!(target > 0)) return now;          // niente dato: la pallina resta dov'è
  if (!(now > 0)) return target;          // prima volta: salta subito al valore
  return lerp(now, target, 0.16);
}

// animazione palline
function moveBalls() {
  for (let i = 0; i < countries.length; i++) {
    poorBall[i] = slide(poorBall[i], getPoor(i));
    richBall[i] = slide(richBall[i], getRich(i));
  }
}

// disegna un paese = una linea + due palline
function drawCountry(i) {
  let bold = isHighlighted(i);                          // è evidenziato?
  let somethingHighlighted = (hoverCountry >= 0 || searchText != '');

  // il colore è scritto come '#RRGGBB'. Aggiungendo '37' alla fine diventa quasi trasparente
  let colorText = continents[countries[i].continent].color;
  if (somethingHighlighted && bold == false) colorText = colorText + '37';

  // misure normali...
  let ballSize = 6;
  let lineWeight = 1.5;
  // ...più grandi se evidenziato
  if (bold) {
    ballSize = 8.4;
    lineWeight = 2.4;
  }

  let lowY = yPosition(poorBall[i]);
  let highY = yPosition(richBall[i]);

  stroke(colorText);
  strokeWeight(lineWeight);
  line(lineX[i], lowY, lineX[i], highY);   // la linea tra le due palline

  noStroke();
  fill(colorText);
  circle(lineX[i], lowY, ballSize);        // pallina bassa
  circle(lineX[i], highY, ballSize);       // pallina alta
}

// draw ripete questo codice di continuo (circa 60 volte al secondo)
function draw() {
  if (countries.length == 0) return;       // dati non ancora pronti: non disegno

  background('#FDFBEC');
  moveBalls();
  hoverCountry = findCountryUnderMouse();
  updateTooltip();

  let baseline = yPosition(100);           // altezza della linea di base (100 dollari)

  // griglia e numeri sull'asse
  textFont('Geist Mono');
  textSize(11);
  for (let k = 0; k < axisLabels.length; k++) {
    let y = yPosition(pow(10, k + 2));     // 10^2, 10^3, 10^4 ...

    stroke('#E6E3D1');
    strokeWeight(1);
    line(marginLeft - 4, y, width - marginRight, y);   // linea della griglia

    noStroke();
    fill('#8B8873');
    textAlign(RIGHT, CENTER);
    text(axisLabels[k], marginLeft - 14, y);           // numero
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
  strokeWeight(3);
  line(marginLeft - 4, baseline, width - marginRight + 2, baseline);

  // nomi dei continenti sotto la linea di base
  noStroke();
  fill('#25241B');
  textSize(12);
  textLeading(16);                         // distanza tra le due righe di un nome
  textAlign(CENTER, TOP);
  for (let g = 0; g < continents.length; g++) {
    text(continents[g].label, labelX[g], baseline + 16);
  }
}