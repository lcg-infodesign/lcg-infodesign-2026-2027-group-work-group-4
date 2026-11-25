// 1. VARIABILI

let csvPath = 'assets/wid_panel_2000_2024.csv';

// colori: 4 sfumature per ogni continente (dalla più chiara alla più scura)
let palette = {
  'Africa':        ['#FFE3BE', '#FFC77E', '#D18726', '#8D550C'],
  'Asia':          ['#FFBF94', '#ED8A61', '#D96132', '#D14A28'],
  'Europe':        ['#E7ECFF', '#90A5EB', '#4C65B9', '#2A3C7A'],
  'North America': ['#E3F5E1', '#B3D8AD', '#72B768', '#428739'],
  'Oceania':       ['#F3DBFF', '#D08DF4', '#9F4CCB', '#620F8E'],
  'South America': ['#FFDEF4', '#FDAAE1', '#ED5DBD', '#BF218A']
};

// le 4 barre dall'alto in basso: scritta a sinistra e colonna del csv
// (il 9% non è una colonna del csv: lo calcoliamo in readData)
let groups = [
  { label: '1%',  key: 'avg_posttax_usd_top1' },
  { label: '9%',  key: 'avg_posttax_usd_top9' },
  { label: '40%', key: 'avg_posttax_usd_middle40' },
  { label: '50%', key: 'avg_posttax_usd_bottom50' }
];

// colonne del csv con le quote di GDP (servono per la torta)
let shareKeys = ['share_posttax_bottom50', 'share_posttax_middle40', 'share_posttax_top10', 'share_posttax_top1'];

// la legenda della torta, dall'alto in basso
// shareIndex = posizione del gruppo nella lista che restituisce pieShares()
let legendGroups = [
  { name: 'top 1%',     shareIndex: 3 },
  { name: '9%',         shareIndex: 2 },
  { name: '40%',        shareIndex: 1 },
  { name: 'bottom 50%', shareIndex: 0 }
];

// spazi attorno al grafico (in pixel)
let marginLeft = 70;
let marginRight = 30;
let marginTop = 10;
let marginBottom = 44;

// aspetto delle barre
let barShare = 0.55;   // quanto è alta una barra rispetto allo spazio che avrebbe
let rowSpread = 0.8;   // distanza tra una barra e la successiva
let padTop = 55;       // spazio tra la cima delle linee verticali e la prima barra
let padBottom = 55;    // spazio tra l'ultima barra e la linea in fondo
let shadowX = 4;       // ombra delle barre: verso destra
let shadowY = 4;       // ombra delle barre: verso il basso
let panelGap = 28;     // spazio minimo tra il fondo del riquadro GDP SHARE e la linea degli anni
let overallWeight = 3; // spessore della linea dell'income medio

// dati del paese
let iso;               // codice del paese (per esempio "IT")
let years = [];        // anni disponibili, in ordine
let rows = {};         // rows[anno] = tutti i valori di quell'anno
let countryName = '';
let continentName = '';
let yearIndex = 0;     // posizione dell'anno scelto dentro "years"

// scala del grafico (calcolata da chooseScale)
let scaleMax = 1;      // valore a cui arriva l'asse
let tickStep = 1;      // distanza tra una linea verticale e la successiva

// valori animati: si avvicinano un po' alla volta a quelli veri
let shown = [0, 0, 0, 0];
let shownOverall = 0;

// misure dell'istogramma (calcolate a ogni fotogramma da calcLayout)
let barH = 0;          // altezza di una barra
let rowH = 0;          // distanza tra due barre
let startY = 0;        // y della prima barra
let chartTop = 0;      // y della cima delle linee verticali
let chartBottom = 0;   // y della linea in fondo

// pezzi della pagina html
let yearBar, scrollBox;
let subtitleBox;       // il testo "Average income overall: ..."
let subtitleWidth = 200;
let subtitleLeft = 0;  // posizione a riposo del testo (x)
let subtitleGap = 0;   // distanza a riposo tra il testo e la cima del grafico
let chartLeft = 0;     // x del grafico sulla pagina
let lastSubtitle = ''; // ultimo testo scritto (per riscrivere solo se cambia)

// riquadro GDP SHARE
let panel, pieBox, panelCaption, panelInfo;
let legendTexts = [];

// 2. SETUP E LETTURA DEI DATI

// "async" + "await": setup aspetta che il csv e i font siano pronti
async function setup() {
  noCanvas(); // il canvas lo creiamo più avanti, quando i dati sono pronti
  fixHeader(); // l'intestazione deve avere la stessa linea di quella della pagina principale
  yearBar = document.getElementById('yearBar');
  scrollBox = document.getElementById('scrollBox');

  // legge il codice del paese dall'indirizzo: country.html?c=IT&y=2020
  let params = new URLSearchParams(location.search);
  iso = params.get('c');

  let lines = await loadStrings(csvPath);
  readData(lines);

  // se non ci sono anni, il paese non esiste nel csv
  if (years.length == 0) {
    document.getElementById('countryName').textContent = 'NOT FOUND';
    return;
  }

  chooseScale();

  // anno scelto (y nell'indirizzo); se non esiste usa l'ultimo
  let wantedYear = parseFloat(params.get('y'));
  yearIndex = years.indexOf(wantedYear);
  if (yearIndex < 0) yearIndex = years.length - 1;

  document.getElementById('countryName').textContent = countryName.toUpperCase();
  document.title = 'PAY DAY - ' + countryName;
  updateSubtitle();
  drawYearBar();

  await document.fonts.ready; // aspetta che i font siano caricati

  createCanvas(scrollBox.clientWidth, scrollBox.clientHeight).parent('chartBox');
  setupSubtitle();
  createPanel();
}

// intestazione identica a quella dell'index (56px, linea sotto, linea dopo il titolo)
// style.css resta com'è: qui si correggono solo le misure della riga del titolo
function fixHeader() {
  let header = document.querySelector('header');
  let titleRow = header.querySelector('.title-row');
  let title = document.getElementById('countryName');

  header.style.flex = '0 0 56px';      // non si restringe mai, anche se la pagina e' piena
  header.style.paddingTop = '0';

  titleRow.style.alignItems = 'stretch';   // la linea dopo il nome va da sopra a sotto
  titleRow.style.gap = '16px';
  titleRow.style.paddingLeft = '18px';

  title.style.padding = '0 18px 0 2px';    // stesso padding destro dell'h1 dell'index
  title.style.whiteSpace = 'nowrap';       // un nome lungo non va a capo
}

// quando la finestra cambia dimensione, adattiamo canvas e riquadro
function windowResized() {
  if (panel == undefined) return; // la pagina non è ancora pronta
  resizeCanvas(scrollBox.clientWidth, scrollBox.clientHeight);
  placePanel();
}

// il csv usa la virgola per i decimali (0,1886): la trasformiamo in punto e poi in numero
function toNumber(text) {
  return parseFloat(String(text).replace(',', '.'));
}

// legge il csv e tiene solo le righe del paese scelto
function readData(lines) {
  let header = lines[0].split(';'); // nomi delle colonne

  for (let n = 1; n < lines.length; n++) { // si parte da 1: la riga 0 è l'intestazione
    if (lines[n] == '') continue;

    // mette i valori della riga in una scatola con i nomi delle colonne
    // così possiamo scrivere row.year invece di contare le colonne
    let fields = lines[n].split(';');
    let row = {};
    for (let c = 0; c < header.length; c++) {
      row[header[c]] = fields[c];
    }

    if (row.iso2 != iso) continue; // non è il nostro paese: salta

    let year = parseFloat(row.year);
    years.push(year);
    countryName = row.country_name;
    continentName = row.continent;

    // salva i redditi medi dei gruppi
    rows[year] = {};
    for (let g = 0; g < groups.length; g++) {
      rows[year][groups[g].key] = toNumber(row[groups[g].key]);
    }

    // il top 10% contiene già il top 1%, quindi la media del 9% è:
    // (10% * media top10 - 1% * media top1) / 9%
    let top10 = toNumber(row.avg_posttax_usd_top10);
    let top1 = rows[year].avg_posttax_usd_top1;
    rows[year].avg_posttax_usd_top10 = top10; // serve per l'income medio
    rows[year].avg_posttax_usd_top9 = (0.10 * top10 - 0.01 * top1) / 0.09;

    // salva le quote di GDP (per la torta)
    for (let k = 0; k < shareKeys.length; k++) {
      rows[year][shareKeys[k]] = toNumber(row[shareKeys[k]]);
    }

    // GDP del paese in dollari
    rows[year].gdp = toNumber(row.gdp_usd_current);
  }

  years.sort(function (a, b) { return a - b; }); // dal più piccolo al più grande
}

// l'asse arriva al valore più alto dell'1% (di tutti gli anni) più un po' di margine
function chooseScale() {
  let highest = 0;
  for (let i = 0; i < years.length; i++) {
    let value = rows[years[i]].avg_posttax_usd_top1;
    if (value > highest) highest = value;
  }
  scaleMax = highest * 1.1;

  // distanza "tonda" tra le linee (1, 2, 5, 10 volte una potenza di 10), al massimo 6 linee
  let power = Math.pow(10, Math.floor(Math.log10(scaleMax / 5)));
  let steps = [1, 2, 5, 10];
  tickStep = steps[3] * power;
  for (let i = 0; i < steps.length; i++) {
    if (scaleMax / (steps[i] * power) <= 6) {
      tickStep = steps[i] * power;
      break;
    }
  }
}

// 3. FUNZIONI DI AIUTO

// reddito del gruppo g (0 = 1%, 1 = 9%, ...) nell'anno scelto
function getValue(g) {
  return rows[years[yearIndex]][groups[g].key];
}

// true se tutti e 4 i gruppi hanno un numero maggiore di 0
function hasData() {
  for (let g = 0; g < groups.length; g++) {
    if (!(getValue(g) > 0)) return false;
  }
  return true;
}

// reddito medio di tutto il paese: 50% + 40% + 10% (pesi 0.5, 0.4, 0.1)
// il top 1% non si somma perché è già dentro il top 10%
function overallAverage() {
  let r = rows[years[yearIndex]];
  return 0.5 * r.avg_posttax_usd_bottom50 + 0.4 * r.avg_posttax_usd_middle40 + 0.1 * r.avg_posttax_usd_top10;
}

// da dollari a posizione x sul canvas (0 = sinistra, scaleMax = destra)
function xPosition(dollars) {
  return map(constrain(dollars, 0, scaleMax), 0, scaleMax, marginLeft, width - marginRight);
}

// numeri dell'asse in forma corta: 200000 diventa "200K", 1500000 diventa "1.5M"
function formatTick(v) {
  if (v == 0) return '0';
  if (v >= 1000000) return +(v / 1000000).toFixed(2) + 'M';
  return +(v / 1000).toFixed(1) + 'K';
}

// colore del gruppo g, preso dalla palette del continente
function groupColor(g) {
  let shades = palette[continentName];
  if (shades == undefined) return '#999999'; // continente sconosciuto: grigio
  return shades[g];
}

// colore del testo leggibile sopra uno sfondo: scuro se lo sfondo è chiaro, chiaro se è scuro
function readableText(hex) {
  let r = parseInt(hex.slice(1, 3), 16); // spezza '#RRGGBB' nei tre colori
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  let brightness = 0.299 * r + 0.587 * g + 0.114 * b; // quanto è luminoso
  if (brightness > 150) return '#272318';
  return '#FFFCF2';
}

// crea un elemento html con la sua classe css (vedi style.css) e lo mette dentro "parent"
function makeElement(tag, parent, className) {
  let element = document.createElement(tag);
  element.className = className;
  parent.appendChild(element);
  return element;
}

// 4. DISEGNO

function draw() {
  if (years.length == 0 || width == 0) return; // dati o canvas non pronti

  background('#FFFCF2');
  textFont('Geist Mono');
  textWeight(400); // peso normale all'inizio di ogni fotogramma

  animateValues();
  updateSubtitle();
  calcLayout();

  drawGrid();
  drawOverallLine();
  placeSubtitle();
  drawBars();
  drawAxes();
}

// le barre scivolano verso i valori veri: ogni fotogramma fanno il 16% della strada
function animateValues() {
  for (let g = 0; g < groups.length; g++) {
    let target = 0;
    if (hasData()) target = getValue(g);
    shown[g] = lerp(shown[g], target, 0.16);
  }
  if (hasData()) shownOverall = lerp(shownOverall, overallAverage(), 0.16);
}

// calcola dove stanno le barre in base all'altezza del canvas
function calcLayout() {
  let areaTop = marginTop;
  let areaBottom = height - marginBottom;
  let fullRow = (areaBottom - areaTop) / groups.length;

  barH = fullRow * barShare;
  rowH = fullRow * rowSpread;

  let blockH = rowH * (groups.length - 1) + barH; // altezza di tutte e 4 le barre insieme
  startY = areaTop + ((areaBottom - areaTop) - blockH) / 2;

  chartTop = startY - padTop;
  chartBottom = startY + blockH + padBottom;
}

// linee verticali sottili e numeri sotto
function drawGrid() {
  stroke('#CFCBB8');
  strokeWeight(1);
  for (let v = 0; v <= scaleMax; v += tickStep) {
    line(xPosition(v), chartTop, xPosition(v), chartBottom);
  }

  noStroke();
  fill('#272318');
  textSize(12);
  textAlign(CENTER, TOP);
  for (let v = 0; v <= scaleMax; v += tickStep) {
    text(formatTick(v), xPosition(v), chartBottom + 14);
  }
}

// linea verticale spessa: reddito medio di tutto il paese
// è disegnata prima delle barre, così le barre le passano sopra
function drawOverallLine() {
  if (hasData() == false) return;
  stroke('#272318');
  strokeWeight(overallWeight);
  line(xPosition(shownOverall), chartTop, xPosition(shownOverall), chartBottom);
}

// le 4 barre con scritta a sinistra e valore
function drawBars() {
  let x0 = xPosition(0);

  for (let g = 0; g < groups.length; g++) {
    let y = startY + rowH * g;
    let w = max(0, xPosition(shown[g]) - x0); // larghezza della barra

    // scritta a sinistra (1%, 9%...)
    noStroke();
    fill('#272318');
    textSize(14);
    textAlign(RIGHT, CENTER);
    text(groups[g].label, marginLeft - 16, y + barH / 2);

    // la barra si disegna solo se è più lunga di 1 pixel
    if (w > 1) {
      // prima l'ombra (un rettangolo scuro spostato)...
      noStroke();
      fill('#272318');
      rect(x0 + shadowX, y + shadowY, w, barH);

      // ...poi la barra vera sopra
      stroke('#272318');
      strokeWeight(2);
      fill(groupColor(g));
      rect(x0, y, w, barH);
    }

    if (hasData()) drawBarValue(g, y, x0, w);
  }
}

// scrive il reddito del gruppo (numero in grassetto + " USD")
// fuori dalla barra se c'è spazio, altrimenti dentro
function drawBarValue(g, y, x0, w) {
  let number = Math.round(shown[g]).toLocaleString('it-IT');

  noStroke();
  textSize(13);
  textAlign(LEFT, CENTER);

  // misura quanto sono larghe le due parti di testo
  textWeight(700);
  let numberW = textWidth(number);
  textWeight(400);
  let usdW = textWidth(' USD');

  // sceglie dove scrivere e di che colore
  let startX;
  if (x0 + w + 20 + numberW + usdW < width - marginRight) {
    startX = x0 + w + 18; // fuori dalla barra
    fill('#272318');
  } else {
    startX = x0 + w - 18 - numberW - usdW; // dentro la barra
    fill(readableText(groupColor(g)));
  }

  textWeight(700);
  text(number, startX, y + barH / 2);
  textWeight(400);
  text(' USD', startX + numberW, y + barH / 2);
}

// asse verticale a sinistra e asse orizzontale in fondo
function drawAxes() {
  let x0 = xPosition(0);
  stroke('#272318');
  strokeWeight(3);
  line(x0, chartTop, x0, chartBottom);
  line(x0, chartBottom, width - marginRight, chartBottom);
}

// TESTO "AVERAGE INCOME OVERALL" (html, sopra la linea spessa)

// prepara il testo e misura dove si trova a riposo
function setupSubtitle() {
  subtitleBox = document.getElementById('subtitle');
  subtitleBox.style.cssText =
    'position: relative; z-index: 1; width: ' + subtitleWidth + 'px; height: 1.5em; margin: 10px 0 0 0; text-align: center;';

  let sub = subtitleBox.getBoundingClientRect();
  let chart = scrollBox.getBoundingClientRect();
  subtitleLeft = sub.left + window.scrollX;
  subtitleGap = chart.top - sub.top;
  chartLeft = chart.left + window.scrollX;
}

// sposta il testo in modo che stia centrato sopra la linea spessa
function placeSubtitle() {
  if (subtitleBox == undefined) return;

  // x: centro del testo = x della linea (ma mai oltre il margine sinistro di 40px)
  let barX = chartLeft + xPosition(shownOverall);
  let leftEdge = max(40, barX - subtitleWidth / 2);
  subtitleBox.style.left = Math.round(leftEdge - subtitleLeft) + 'px';

  // y: il fondo del testo sta 8px sopra la cima del grafico
  let textH = subtitleBox.scrollHeight;
  subtitleBox.style.top = Math.round(subtitleGap + chartTop - 8 - textH) + 'px';
}

// scrive il testo (solo se è cambiato)
function updateSubtitle() {
  let text = 'No data for this year';
  if (hasData()) {
    text = 'Average income overall: <b>' + Math.round(shownOverall).toLocaleString('it-IT') + '</b> USD';
  }
  if (text != lastSubtitle) {
    document.getElementById('subtitle').innerHTML = text;
    lastSubtitle = text;
  }
}

// ---------------------------------------------------------------------------
// 5. BARRA DEGLI ANNI E TASTIERA
// ---------------------------------------------------------------------------

// scrive in html 7 posti: 3 anni prima, quello scelto al centro, 3 anni dopo
function drawYearBar() {
  let html = '';
  for (let offset = -3; offset <= 3; offset++) {
    let pos = yearIndex + offset;

    if (pos < 0 || pos >= years.length) {
      // non esiste un anno qui: posto vuoto
      html += '<span class="year-button empty"></span>';
    } else if (offset != 0) {
      // anno normale: un bottone
      html += '<button class="year-button" onclick="changeYear(' + pos + ')">' + years[pos] + '</button>';
    } else {
      // anno scelto: numero grande con le due frecce (spente al primo e all'ultimo anno)
      // le due frecce disegnate in SVG, uguali a quelle della pagina principale
      let arrowLeft = '<svg width="24" height="16" viewBox="0 0 24 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 8H2M8 1L1 8l7 7"/></svg>';
      let arrowRight = '<svg width="24" height="16" viewBox="0 0 24 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 8H22M16 1l7 7-7 7"/></svg>';

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
function changeYear(newIndex) {
  if (newIndex < 0 || newIndex >= years.length) return; // anno che non esiste: niente
  yearIndex = newIndex;
  updateSubtitle();
  updatePanel();
  drawYearBar();
  // aggiorna l'indirizzo nel browser senza ricaricare la pagina
  history.replaceState(null, '', '?c=' + iso + '&y=' + years[yearIndex]);
}

// frecce della tastiera
function keyPressed() {
  if (key == 'ArrowLeft') changeYear(yearIndex - 1);
  if (key == 'ArrowRight') changeYear(yearIndex + 1);
}

// 6. RIQUADRO GDP SHARE E TORTA

// quote di GDP dei 4 gruppi nell'anno scelto, nell'ordine della torta:
// bottom 50%, middle 40%, top 9%, top 1%  (null se manca qualche dato)
function pieShares() {
  let r = rows[years[yearIndex]];

  // il top 10% contiene il top 1%: la quota del 9% è la differenza
  let top9 = r.share_posttax_top10 - r.share_posttax_top1;

  let shares = [r.share_posttax_bottom50, r.share_posttax_middle40, top9, r.share_posttax_top1];

  for (let i = 0; i < shares.length; i++) {
    if (!(shares[i] >= 0)) return null; // non è un numero valido
  }
  return shares;
}

// crea il riquadro marrone: titolo, bottone info, didascalia, torta e legenda
// (lo stile di ogni pezzo sta in style.css, nelle classi .gdp-...)
function createPanel() {
  panel = makeElement('div', document.body, 'gdp-panel');

  // intestazione: titolo a sinistra e bottone "i" a destra
  let head = makeElement('div', panel, 'gdp-head');
  let title = makeElement('h2', head, 'gdp-title');
  title.textContent = 'GDP SHARE';

  let infoButton = makeElement('button', head, 'gdp-info-button');
  infoButton.textContent = 'i';
  infoButton.setAttribute('aria-label', 'Info');
  infoButton.onclick = function () {
    // il riquadro parte subito sotto l'intestazione (titolo e bottone restano visibili)
    panelInfo.style.top = (head.offsetTop + head.offsetHeight) + 'px';
    let isOpen = panelInfo.classList.toggle('open');
    infoButton.textContent = isOpen ? 'x' : 'i'; // la "i" diventa "x" finché il riquadro è aperto
    infoButton.setAttribute('aria-label', isOpen ? 'Close' : 'Info');
  };

  // didascalia (la scrive updatePanel)
  panelCaption = makeElement('p', panel, 'gdp-caption');

  // spazio per la torta
  pieBox = makeElement('div', panel, 'gdp-pie');

  // legenda: per ogni gruppo un pallino colorato e una frase (la scrive updatePanel)
  let legend = makeElement('ul', panel, 'gdp-legend');
  for (let i = 0; i < legendGroups.length; i++) {
    let item = makeElement('li', legend, 'gdp-legend-item');
    let dot = makeElement('span', item, 'gdp-dot');
    dot.style.background = groupColor(i); // il colore dipende dal continente
    legendTexts[i] = makeElement('span', item, '');
  }

  // riquadro che si apre con il bottone "i" (sta sopra tutto il resto)
  panelInfo = makeElement('div', panel, 'gdp-info-box');
  panelInfo.innerHTML =
    '<p>Share of a country\u2019s income received by four groups of adults: the poorest <b>50%</b>, the middle <b>40%</b>, ' +
    'the next <b>9%</b> and the richest <b>1%</b>. Together they make the whole pie.</p>' +
    '<p>Data from the <b>World Inequality Database (WID)</b>, which measures each group\u2019s share of ' +
    '<b>post-tax national income</b>: income after taxes and transfers, with household income split equally between adults. ' +
    'The 9% is the top 10% minus the top 1%.</p>';
  // il riquadro sta al posto di caption, torta e legenda: stesso sfondo scuro del pannello, testo chiaro
  panelInfo.style.cssText = 'left: 0; right: 0; bottom: 0; padding: 12px 26px 24px; overflow: auto; ' +
    'color: var(--bg); background: var(--ink); border: 0; box-shadow: none;';

  placePanel();
  updatePanel();

  // la torta è un secondo sketch p5 (modalità istanza): ha il suo canvas, separato dall'istogramma
  new p5(pieSketch, pieBox);
}

// posiziona il riquadro a destra, all'altezza del titolo della pagina
function placePanel() {
  let box = scrollBox.getBoundingClientRect();
  panel.style.width = Math.round(window.innerWidth * 0.291) + 'px';
  panel.style.left = Math.round(window.innerWidth * 0.645 + window.scrollX) + 'px';
  panel.style.top = Math.round(box.top - 87 + window.scrollY) + 'px';
}

// scrive didascalia e legenda per l'anno scelto
function updatePanel() {
  let r = rows[years[yearIndex]];

  // "2018 GDP = 20.656.515 million USD"
  let gdpText = 'n/a';
  if (r.gdp > 0) {
    gdpText = Math.round(r.gdp / 1000000).toLocaleString('it-IT', { useGrouping: 'always' }) + ' million USD';
  }
  panelCaption.textContent = years[yearIndex] + ' GDP = ' + gdpText;

  // "The top 1% earned 15,3% of the country's GDP."
  let shares = pieShares();
  for (let i = 0; i < legendGroups.length; i++) {
    if (shares == null) {
      legendTexts[i].textContent = 'The ' + legendGroups[i].name + ': no data for this year.';
    } else {
      let share = shares[legendGroups[i].shareIndex];
      let percent = (share * 100).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      legendTexts[i].textContent = 'The ' + legendGroups[i].name + ' earned ' + percent + '% of the country\u2019s GDP.';
    }
  }
}

// lato del canvas della torta: circa metà del riquadro, ma mai così grande da far toccare
// il riquadro alla linea degli anni (tra 90 e 240 pixel)
function pieSize() {
  let wanted = panel.clientWidth * 0.53;

  let yearLine = yearBar.getBoundingClientRect().top + window.scrollY;
  let panelTop = panel.getBoundingClientRect().top + window.scrollY;
  let others = panel.offsetHeight - pieBox.offsetHeight; // altezza di tutto il resto (titolo, legenda, margini)
  let room = yearLine - panelTop - others - panelGap;

  return Math.round(constrain(Math.min(wanted, room), 90, 240));
}

// lo sketch della torta
// "p" è l'oggetto p5 di questo sketch: ogni funzione di p5 si scrive con "p." davanti
function pieSketch(p) {
  p.setup = function () {
    p.createCanvas(pieSize(), pieSize());
  };

  p.draw = function () {
    p.clear(); // sfondo trasparente

    // se il riquadro cambia larghezza, la torta si adatta
    if (pieSize() != p.width) p.resizeCanvas(pieSize(), pieSize());

    let shares = pieShares();
    if (shares == null) return; // niente dati: niente torta

    let diameter = p.width - 4;
    let angle = -p.HALF_PI; // si parte da ore 12

    p.stroke('#272318');
    p.strokeWeight(2);

    // colore di ogni spicchio, nello stesso ordine di pieShares:
    // bottom 50% = colore 3, middle 40% = 2, top 9% = 1, top 1% = 0
    let colorOf = [3, 2, 1, 0];

    for (let i = 0; i < shares.length; i++) {
      let sweep = shares[i] * p.TWO_PI; // l'angolo dello spicchio: la sua quota di giro intero
      if (sweep > 0.002) { // salta gli spicchi nulli
        p.fill(groupColor(colorOf[i]));
        p.arc(p.width / 2, p.height / 2, diameter, diameter, angle, angle + sweep, p.PIE);
      }
      angle += sweep; // il prossimo spicchio parte dove finisce questo
    }
  };
}