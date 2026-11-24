let csvPath = 'assets/wid_panel_2000_2024.csv';

let shadowX = 4, shadowY = 4; //posizione dell'ombra in pixel: x positivo = destra, y positivo = giù
let panelShadow = 8; //ombra del riquadro GDP SHARE in pixel (verso destra e verso il basso)

//palette continenti
let palette = {
  'Africa':        ['#FFE3BE', '#FFC77E', '#D18726', '#8D550C'],
  'Asia':          ['#FFBF94', '#ED8A61', '#D96132', '#D14A28'],
  'Europe':        ['#E7ECFF', '#90A5EB', '#4C65B9', '#2A3C7A'],
  'North America': ['#E3F5E1', '#B3D8AD', '#72B768', '#428739'],
  'Oceania':       ['#F3DBFF', '#D08DF4', '#9F4CCB', '#620F8E'],
  'South America': ['#FFDEF4', '#FDAAE1', '#ED5DBD', '#BF218A']
};

//gruppi
let groups = [
  { label: '1%',  key: 'avg_posttax_usd_top1' },
  { label: '10%', key: 'avg_posttax_usd_top10' },
  { label: '40%', key: 'avg_posttax_usd_middle40' },
  { label: '50%', key: 'avg_posttax_usd_bottom50' }
];

//colonne del csv con gli share post-tax dei gruppi > servono per il grafico a torta
let shareKeys = ['share_posttax_bottom50', 'share_posttax_middle40', 'share_posttax_top10', 'share_posttax_top1'];

// scale per l'istogramma, dalla più piccola alla più grande: 
// "upTo" è fino a >= dell'1% del paese;
// max: valore a cui arriva l'asse; 
// breakValue: dove avviene il salto di scala (null = scala lineare, senza salto, gli altri da 1 milione)
// stepBefore è la distanza tra due numeri prima del salto e stepAfter quella dopo il salto
// ticks: numeri scritti sull'asse
let scales = [
  { upTo: 250000,   max: 250000,  breakValue: null, minor: 50000,
    ticks: [0, 50000, 100000, 150000, 200000, 250000] },
  { upTo: 500000,   max: 500000,  breakValue: null, minor: 50000,
    ticks: [0, 100000, 200000, 300000, 400000, 500000] },
  { upTo: 1000000,  max: 1000000, breakValue: null, minor: 50000,
    ticks: [0, 200000, 400000, 600000, 800000, 1000000] },
  { upTo: 4000000,  max: 4000000, breakValue: 1000000, stepBefore: 200000, stepAfter: 1000000, minor: 200000,
    ticks: [0, 200000, 400000, 600000, 800000, 1000000, 2000000, 3000000, 4000000] },
  { upTo: Infinity, max: 7000000, breakValue: 1000000, stepBefore: 200000, stepAfter: 1000000, minor: 200000,
    ticks: [0, 200000, 400000, 600000, 800000, 1000000, 2000000, 3000000, 4000000, 5000000, 6000000, 7000000] }
];
let scale; //scala selez per il paese

let marginLeft = 70, marginRight = 30, marginTop = 10, marginBottom = 44; //margini attorno al grafico dentro il canvas: marginLeft > 1%, 10%...; marginBottom > numeri dell'asse
let barShare = 0.55; //spessore di una barra rispetto allo spazio che avrebbe da sola
let rowSpread = 0.8; //distanza tra le barre
let padTop = 55; // spazio tra la cima delle linee verticali e la prima barra
let padBottom = 55; // spazio tra l'ultima barra (50%) e la linea orizzontale in fondo

let iso, years = [], rows = {};   //iso=codice paese, years=anni disponibili, rows = { avg_posttax_usd_...: numero }>dati paese
let countryName = '', continentName = '', yearIndex = 0;
let shown = [0, 0, 0, 0]; //lunghezza attuale di ogni barra > per creare animazione
let shownOverall = 0; //avg income overall animato
let lastSubtitle = ''; //ultimo testo scritto > non riscrive la pagina quando non cambia nulla
let yearBar, scrollBox; //contengono elementi pag html
let subtitleBox; //il paragrafo "Average income overall: ..." (#subtitle), che si sposta sopra la barra dell'avg income overall
let subtitleLeft = 0, subtitleGap = 0; //posizione di #subtitle a riposo: x sulla pagina e distanza (in verticale) dalla cima del canvas
let chartLeft = 0; //x sulla pagina dell'inizio del canvas dell'istogramma
let subtitleWidth = 200; //larghezza della didascalia in pixel: il testo va a capo su due righe, come nell'immagine di riferimento
let overallWeight = 3; //spessore della barra dell'avg income overall (le linee principali sono 1.8, gli assi 3)
let panel; //riquadro marrone GDP SHARE (div creato da createPie): contiene titolo, didascalia, torta e legenda
let pieBox; //div dentro il riquadro che contiene il canvas del grafico a torta
let panelCaption; //didascalia "anno GDP = ..."
let legendTexts = []; //le 4 descrizioni della legenda (una per gruppo percentile)
//gruppi percentili nell'ordine della legenda (dall'alto in basso); il pallino ha il colore groupColor(i) > stesso colore delle barre
//shareIndex: posizione del gruppo nella lista di pieShares (bottom50, middle40, top9, top1)
let legendGroups = [
  { name: 'top 1%',     shareIndex: 3 },
  { name: '9%',         shareIndex: 2 },
  { name: '40%',        shareIndex: 1 },
  { name: 'bottom 50%', shareIndex: 0 }
];

async function setup() {
  noCanvas(); //crea il canvas solo quando i dati sono pronti
  yearBar = document.getElementById('yearBar');
  scrollBox = document.getElementById('scrollBox');

  let params = new URLSearchParams(location.search);
  iso = params.get('c');

  let lines = await loadStrings(csvPath);
  readData(lines, iso); //readData prende solo le righe del paese scelto

    if (years.length == 0) {
    document.getElementById('countryName').textContent = 'NOT FOUND';
    return; //se la lista degli anni è vuota, il paese non esiste nel CSV ed esce dalla funzione
  }

  chooseScale(); //sceglie scala giusta

  let wantedYear = parseFloat(params.get('y')); //legge l'anno dall'indirizzo (y), parseFloat lo trasforma da testo a numero.
  yearIndex = years.indexOf(wantedYear); // cerca la sua posizione nella lista degli anni.
  if (yearIndex < 0) yearIndex = years.length - 1;  // se non lo trova usa l'ultimo anno

  // nome paese
  document.getElementById('countryName').textContent = countryName.toUpperCase(); //nome maiuscolo
  document.title = 'PAY DAY - ' + countryName; //nome scheda browser
  updateSubtitle(); //per scrivere avarage income overall
  drawYearBar(); 

  await document.fonts.ready; //aspetta che i font siano caricati

  createCanvas(scrollBox.clientWidth, scrollBox.clientHeight).parent('chartBox'); //canvas grande quanto lo spazio disponibile e lo mette nel chartbox (css)

  // se #scrollBox cambia dimensione (finestra, font, testo) canvas si ridimensiona
  new ResizeObserver(function () {
    resizeCanvas(scrollBox.clientWidth, scrollBox.clientHeight);
  }).observe(scrollBox);

  setupSubtitle(); //prepara la didascalia dell'avg income overall per seguire la sua barra

  createPie(); //crea il riquadro GDP SHARE (con la torta dentro) a destra dell'istogramma
}

// legge solo le righe del paese selezionato
function readData(lines, code) {
  let header = lines[0].split(';'); //legge la prima riga del csv (nomi colonne), divise da ;

  for (let n = 1; n < lines.length; n++) {  //ciclo parte dalla seconda riga
    if (lines[n] == '') continue; //se riga è vuota passa a quella dopo
    let fields = lines[n].split(';'); // taglia la riga nei suoi valori
    let row = {};   //crea una scatola row e ci mette ogni valore con il nome della sua colonna, così si può scrivere row.iso2 o row.year invece di contare le colonne
    for (let c = 0; c < header.length; c++) row[header[c]] = fields[c];
    if (row.iso2 != code) continue; //salta la riga se non è il paese selez

    let year = parseFloat(row.year); //trasforma anno da testo a numero
    years.push(year); //aggiunge alla lista

    //salva nome paese e continente
    countryName = row.country_name;
    continentName = row.continent;

    //ciclo per far si che prenda il valore dalla colonna giusta
    rows[year] = {};
    for (let g = 0; g < groups.length; g++) {
      rows[year][groups[g].key] = parseFloat(String(row[groups[g].key]).replace(',', '.')); //cambia da , a . per i numeri dal 10.000 in su perchè mi piace di più il punto,, penso sia più comprensibile
    }

    //stesso ciclo per gli share post-tax (nel csv hanno la virgola: 0,1886) > rows[year].share_posttax_top1 ecc.
    for (let k = 0; k < shareKeys.length; k++) {
      rows[year][shareKeys[k]] = parseFloat(String(row[shareKeys[k]]).replace(',', '.'));
    }

    //GDP del paese in dollari correnti, per la didascalia del riquadro GDP SHARE
    rows[year].gdp = parseFloat(String(row.gdp_usd_current).replace(',', '.'));
  }
  years.sort(function (a, b) { return a - b; }); //ordina anni dal più piccolo al più grande
}

//sceglie la scala in base al avg income del top 1%
function chooseScale() {
  let highest = 0;

  //parte da 0 e legge l'1% di ogni anno, se trova un valore più alto di quello che ha in mano, lo tiene
  for (let i = 0; i < years.length; i++) {
    let v = rows[years[i]].avg_posttax_usd_top1;
    if (v > highest) highest = v;
  } 

  //prova le scale partendo dal più piccolo > il primo abbastanza grande per contenere il valore dell'1% più grande fa finire i ciclo
  for (let i = 0; i < scales.length; i++) {
    if (highest <= scales[i].upTo) {
      scale = scales[i];
      return;
    }
  }
}

//dà il valore del gruppo numero g per l'anno scelto: prima trova l'anno, poi la scatola di quell'anno, poi la colonna
function getValue(g) { return rows[years[yearIndex]][groups[g].key]; }

//controlla i 4 gruppi percentili: se anche uno solo non è un numero maggiore di 0, risponde "falso" (niente dati). Se sono tutti validi, risponde "vero"
function hasData() {
  for (let g = 0; g < groups.length; g++) if (!(getValue(g) > 0)) return false;
  return true;
}

//calcola avg income overall: senza top 1 perchè già incluso nel top 10 > quindi 50% + 40% + 10% (pesi 0.5, 0.4, 0.1)
function overallAverage() {
  let r = rows[years[yearIndex]];
  return 0.5 * r.avg_posttax_usd_bottom50 + 0.4 * r.avg_posttax_usd_middle40 + 0.1 * r.avg_posttax_usd_top10;
}

//prepara #subtitle: resta nel suo posto della pagina (così il resto del layout non si muove) ma lo spostiamo con left/top
//misura una volta sola dove si trova a riposo, poi placeSubtitle lo sposta
function setupSubtitle() {
  subtitleBox = document.getElementById('subtitle');
  Object.assign(subtitleBox.style, {
    position: 'relative', //si può spostare con left/top senza liberare il suo spazio
    zIndex: '1', //sopra il canvas
    width: subtitleWidth + 'px',
    height: '1.5em', //altezza di una riga (come il min-height del css): la seconda riga esce verso il basso senza spingere giù l'istogramma
    margin: '10px 0 0 0', //tolto il margine sinistro di 38px: la x la decide placeSubtitle
    textAlign: 'center' //testo centrato sulla barra
  });

  let sub = subtitleBox.getBoundingClientRect();
  let chart = scrollBox.getBoundingClientRect();
  subtitleLeft = sub.left + window.scrollX; //x a riposo
  subtitleGap = chart.top - sub.top; //distanza tra la cima di #subtitle (a riposo) e la cima del canvas
  chartLeft = chart.left + window.scrollX;
}

//mette la didascalia centrata sopra la barra dell'avg income overall, poco sopra la cima del grafico (top = y della cima delle linee nel canvas)
function placeSubtitle(top) {
  if (subtitleBox == undefined) return; //se setupSubtitle non è ancora stata chiamata non fa niente

  //x: centro della didascalia = x della barra; non esce dal margine sinistro della pagina (40px, come il padding del body)
  let barX = chartLeft + xPosition(shownOverall);
  let leftEdge = max(40, barX - subtitleWidth / 2);
  subtitleBox.style.left = Math.round(leftEdge - subtitleLeft) + 'px';

  //y: il fondo della didascalia (alta quanto il suo testo, anche su due righe) sta 8px sopra la cima del grafico
  let textH = subtitleBox.scrollHeight;
  subtitleBox.style.top = Math.round(subtitleGap + top - 8 - textH) + 'px';
}

//sottotitolo avg income overall
function updateSubtitle() {
  let text = 'No data for this year';
  if (hasData()) text = 'Average income overall: <b>' + Math.round(shownOverall).toLocaleString('it-IT') + '</b> USD';
  if (text != lastSubtitle) { // riscrive solo se il testo è cambiato
    document.getElementById('subtitle').innerHTML = text;
    lastSubtitle = text;
  }
}

//da numero dollari a posizione x della scala (con salto di scala se c'è)
function xPosition(dollars) {
  let x0 = marginLeft, x1 = width - marginRight; //x0 è dove parte l'asse a sinistra, x1 dove finisce a destra
  let v = constrain(dollars, 0, scale.max); //se il valore va fuori dalla scala, lo riporta dentro >> così non va mai meno di 0 e mai più del massimo
  
  //se non c'è salto di scala, map fa una proporzione > 0 dollari sta a x0, il massimo sta a x1, il resto dei valori è in una posizione proporzionata in base a 0 e il massimo
  if (scale.breakValue == null) return map(v, 0, scale.max, x0, x1); 

  //scala con salto: ogni passo (distanza tra due linee) prima del salto (stepBefore) e ogni passo dopo (stepAfter) occupano la stessa larghezza
  let partsBefore = scale.breakValue / scale.stepBefore;
  let partsAfter = (scale.max - scale.breakValue) / scale.stepAfter;
  let xBreak = x0 + (x1 - x0) * partsBefore / (partsBefore + partsAfter); //punto dove c'è il milione
  if (v <= scale.breakValue) return map(v, 0, scale.breakValue, x0, xBreak);
  return map(v, scale.breakValue, scale.max, xBreak, x1);
}

//trasforma i numeri dell'asse x in scritte (M/K)
function formatTick(v) {
  if (v == 0) return '0'; //0 resta 0
  if (v >= 1000000) return (v / 1000000) + 'M'; //milioni diventano M
  return (v / 1000) + 'K'; //migliaia diventano K
}

//palette dei gruppi percentili che cambiano in base al continente
function groupColor(g) {
  let shades = palette[continentName];
  if (shades == undefined) return '#999999'; //se continente non c'è esce grigio (ma non dovrebbe succedere > per sicurezza)
  return shades[g]; //restituisce il colore numero g
}

//sceglie un colore leggibile per il numero se dentro una barra
function readableText(hex) {
  let r = parseInt(hex.slice(1, 3), 16); //spezza il codice colore RRGGBB
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  let brightness = 0.299 * r + 0.587 * g + 0.114 * b; //formula che calcola quanto è luminoso
  return brightness > 150 ? '#272318' : '#FFFCF2'; //se colore è maggiore di 150 (luminoso) il testo è scuro, il contrario il testo è bianco
}

function draw() {
  if (years.length == 0 || width == 0) return; //se non ci sono dati o il canvas non esiste ancora, non disegna
  background('#FFFCF2');

  //animazione: le barre scivolano verso il valore (target) dell'anno scelto
  for (let g = 0; g < groups.length; g++) {
    let target = hasData() ? getValue(g) : 0;
    shown[g] = lerp(shown[g], target, 0.16); //lerp avvicina il valore mostrato del 16% a quello vero, ad ogni fotogramma = animazione fluida
  }
  //stessa animazione per avg income overall
  if (hasData()) shownOverall = lerp(shownOverall, overallAverage(), 0.16);
  updateSubtitle();

  //spazio del grafico > da qui dipende la dimensione delle barre
  let areaTop = marginTop, areaBottom = height - marginBottom;
  let fullRow = (areaBottom - areaTop) / groups.length;
  let barH = fullRow * barShare; // altezza di una barra
  let rowH = fullRow * rowSpread; // distanza da una barra alla successiva
  let blockH = rowH * (groups.length - 1) + barH; // altezza del blocco delle 4 barre
  let startY = areaTop + ((areaBottom - areaTop) - blockH) / 2; // posizione della prima barra

  //grafico arriva poco sopra la prima barra e poco sotto l'ultima
  let top = startY - padTop;
  let bottom = startY + blockH + padBottom;

  //griglia
  textFont('Geist Mono');
  textSize(12);
  stroke('#CFCBB8');
  strokeWeight(1);

  //parte da 0 e va avanti a distanza di minor (distanza delle linee chiare)
  for (let v = 0; v <= scale.max; v += scale.minor) {
    line(xPosition(v), top, xPosition(v), bottom); //per ogni passo disegna una linea verticale
  }
  
  //ridisegna sopra le linee principali quelle dei numeri
  for (let t = 0; t < scale.ticks.length; t++) {
    let v = scale.ticks[t];
    if (scale.breakValue == null) { // scala lineare > linee grigio scuro
      stroke('#9A9688');
    } else if (v >= scale.breakValue) {  //scala con salto > scure dal milione in poi
      stroke('#272318');
    } else {
      continue; // sotto il salto restano chiare
    }
    strokeWeight(1.8); //linea dei milioni è più spessa
    line(xPosition(v), top, xPosition(v), bottom);
  }

  //numeri sull'asse x
  noStroke();
  fill('#272318');
  textAlign(CENTER, TOP);
  for (let t = 0; t < scale.ticks.length; t++) {
    text(formatTick(scale.ticks[t]), xPosition(scale.ticks[t]), bottom + 14); //scrive ogni numero sotto la sua linea, 14px sotto la fine del grafico
  }

  //barra verticale dell'avg income overall: più spessa delle linee della griglia, nella posizione (animata) del valore
  //è disegnata prima delle barre, quindi le barre dei gruppi passano sopra
  if (hasData()) {
    stroke('#272318');
    strokeWeight(overallWeight);
    line(xPosition(shownOverall), top, xPosition(shownOverall), bottom);
  }
  placeSubtitle(top); //sposta la didascalia sopra la barra

  let x0 = xPosition(0);

  for (let g = 0; g < groups.length; g++) {
    let y = startY + rowH * g; //y è la posizione verticale di una barra
    let w = max(0, xPosition(shown[g]) - x0); //w è la larghezza della barra = la distanza tra l'inizio e la fine (mai negativa)

    //gruppo percentile (sx dell'istogramma)
    noStroke();
    fill('#272318');
    textAlign(RIGHT, CENTER);
    textSize(14);
    text(groups[g].label, marginLeft - 16, y + barH / 2); //percentuale a sinistra dell'istogramma', allineata a destra e centrata verticalmente

    // disegno barra
    if (w > 1) { //disegna barra solo se è più lunga di 1 px
      
      //ombra: 
      let shadowLeft = x0 + shadowX;
      let shadowWidth = w;
      //calcola dove parte l'ombra e quanto larga; se la barra è più corta dello spostamento > si allarga per coprire lo spazio vuoto
      if (abs(shadowX) > w) {
        shadowLeft = x0 + min(0, shadowX);
        shadowWidth = w + abs(shadowX);
      }

      //disegna ombra
      noStroke();
      fill('#272318');
      rect(shadowLeft, y + shadowY, shadowWidth, barH);
      
      //disegna la barra vera sopra l'ombra
      stroke('#272318');
      strokeWeight(2);
      fill(groupColor(g)); //colore preso dalla palette
      rect(x0, y, w, barH);
    }

    //reddito medio del gruppo percentuale + USD
      if (hasData()) {
      noStroke();
      textSize(13);
      textAlign(LEFT, CENTER);

      //pesi diversi: numeri in bold, usd normale
      let number = Math.round(shown[g]).toLocaleString('it-IT');
      textStyle(BOLD);
      let numberW = textWidth(number); //larghezza del numero in grassetto
      textStyle(NORMAL);
      let usdW = textWidth(' USD'); //larghezza di " USD" normale

      // fuori dalla barra se c'è spazio, altrimenti dentro (allineato al bordo destro)
      let fits = x0 + w + 20 + numberW + usdW < width - marginRight;
      let startX = fits ? x0 + w + 18 : x0 + w - 18 - numberW - usdW;
      fill(fits ? '#272318' : readableText(groupColor(g))); //se è dentro la barra prende il colore calcolato dalla funzione readableText

      textStyle(BOLD);
      text(number, startX, y + barH / 2);
      textStyle(NORMAL);
      text(' USD', startX + numberW, y + barH / 2);
    }
  }

  // asse y percentuali e asse y numeri (0, 200k, 300k, ecc...)
  stroke('#272318');
  strokeWeight(3);
  line(x0, top, x0, bottom);
  strokeWeight(3);
  line(x0, bottom, width - marginRight, bottom);
}

//barra degli anni (stessa dell'index)
function drawYearBar() {
  let html = '';
  for (let offset = -3; offset <= 3; offset++) {
    let pos = yearIndex + offset;
    if (pos < 0 || pos >= years.length) {
      html += '<span class="year-button empty"></span>';
    } else if (offset != 0) {
      html += '<button class="year-button" onclick="changeYear(' + pos + ')">' + years[pos] + '</button>';
    } else {
      let leftOff = pos == 0 ? ' disabled' : '';
      let rightOff = pos == years.length - 1 ? ' disabled' : '';
      html += '<div class="current-year">';
      html += '<button class="year-arrow" onclick="changeYear(' + (pos - 1) + ')"' + leftOff + '>&lt;</button>';
      html += '<div class="year-number">' + years[pos] + '</div>';
      html += '<button class="year-arrow" onclick="changeYear(' + (pos + 1) + ')"' + rightOff + '>&gt;</button>';
      html += '</div>';
    }
  }
  yearBar.innerHTML = html;
}

//cambiare anno
function changeYear(newIndex) {
  if (newIndex < 0 || newIndex >= years.length) return; //se la posizione richiesta non esiste, non fa niente
  yearIndex = newIndex; //salva il nuovo anno
  updateSubtitle(); //aggiorna il sottotitolo
  updatePanel(); //aggiorna didascalia e legenda del riquadro GDP SHARE
  drawYearBar(); //ricostruisce la barra degli anni
  history.replaceState(null, '', '?c=' + iso + '&y=' + years[yearIndex]); //cambia l'indirizzo nella barra del browser (senza ricaricare la pagina) con il nuovo anno
}

// frecce sinistra / destra per muoversi di anno
function keyPressed() {
  if (keyCode == LEFT_ARROW) changeYear(yearIndex - 1);
  if (keyCode == RIGHT_ARROW) changeYear(yearIndex + 1);
}

//calcola gli share post-tax dei 4 gruppi per l'anno scelto, nell'ordine in cui compaiono nella torta (in senso orario da ore 12)
//risponde null se manca qualche dato
function pieShares() {
  let r = rows[years[yearIndex]];

  //il top 10% contiene già il top 1% > lo share del 9% è la differenza tra i due
  let share_posttax_top9 = r.share_posttax_top10 - r.share_posttax_top1;

  let shares = [r.share_posttax_bottom50, r.share_posttax_middle40, share_posttax_top9, r.share_posttax_top1];

  //se anche uno solo non è un numero (o è negativo) risponde "niente dati"
  for (let i = 0; i < shares.length; i++) if (!(shares[i] >= 0)) return null;
  return shares;
}

//crea il riquadro GDP SHARE: titolo, bottone info, didascalia, torta e legenda
//la torta è un secondo sketch p5 (modalità istanza), così non tocca il canvas dell'istogramma
function createPie() {
  //riquadro marrone: bordo color sfondo + ombra piena spostata in basso a destra (stile neobrutalista, come le barre)
  panel = document.createElement('div');
  Object.assign(panel.style, {
    position: 'absolute', //fuori dal flusso della pagina > lo posizionamo noi (placePie)
    padding: '28px 30px 32px',
    color: '#FFFCF2',
    background: '#272318',
    border: '2px solid #FFFCF2',
    boxShadow: panelShadow + 'px ' + panelShadow + 'px 0 #272318'
  });
  document.body.appendChild(panel);

  //intestazione: titolo a sinistra, bottone info a destra
  let head = document.createElement('div');
  Object.assign(head.style, { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' });
  panel.appendChild(head);

  let title = document.createElement('h2');
  title.textContent = 'GDP SHARE';
  Object.assign(title.style, { margin: '0', font: '900 30px var(--title)', lineHeight: '1.1' }); //stesso font dei titoli della pagina
  head.appendChild(title);

  //bottone quadrato con "i": per ora si può cliccare ma non succede nulla
  let infoButton = document.createElement('button');
  infoButton.textContent = 'i';
  infoButton.setAttribute('aria-label', 'Info');
  Object.assign(infoButton.style, {
    flex: '0 0 auto', width: '40px', height: '40px', padding: '0',
    color: '#FFFCF2', background: 'transparent', border: '2px solid #FFFCF2', borderRadius: '0',
    fontSize: '20px', cursor: 'pointer'
  });
  head.appendChild(infoButton);

  //didascalia: "2018 GDP = $20.656.515 million" (la scrive updatePanel)
  panelCaption = document.createElement('p');
  Object.assign(panelCaption.style, { margin: '14px 0 0', fontSize: '15px', fontWeight: '600' });
  panel.appendChild(panelCaption);

  //contenitore del canvas della torta, centrato nel riquadro
  pieBox = document.createElement('div');
  Object.assign(pieBox.style, { display: 'flex', justifyContent: 'center', margin: '26px 0 28px' });
  panel.appendChild(pieBox);

  //legenda: per ogni gruppo un pallino colorato + la descrizione (la scrive updatePanel)
  let legend = document.createElement('ul');
  Object.assign(legend.style, { display: 'flex', flexDirection: 'column', gap: '14px', margin: '0', padding: '0', listStyle: 'none' });
  panel.appendChild(legend);

  for (let i = 0; i < legendGroups.length; i++) {
    let item = document.createElement('li');
    Object.assign(item.style, { display: 'flex', alignItems: 'center', gap: '14px', fontSize: '14px', lineHeight: '1.3' });

    let dot = document.createElement('span'); //pallino: stesso colore del gruppo nelle barre e nella torta
    Object.assign(dot.style, { flex: '0 0 20px', width: '20px', height: '20px', borderRadius: '50%', background: groupColor(i) });

    legendTexts[i] = document.createElement('span');

    item.appendChild(dot);
    item.appendChild(legendTexts[i]);
    legend.appendChild(item);
  }

  placePanel(); //posizione e larghezza
  updatePanel(); //testi
  new p5(pieSketch, pieBox);

  //se cambia la dimensione dell'istogramma (finestra, font) il riquadro si riposiziona
  new ResizeObserver(placePanel).observe(scrollBox);
}

//posizione del riquadro (come nell'immagine di riferimento): a destra, con la cima poco sopra l'istogramma, larghezza circa 29% della pagina
function placePanel() {
  let box = scrollBox.getBoundingClientRect(); //posizione dell'istogramma nella finestra

  panel.style.width = Math.round(window.innerWidth * 0.291) + 'px';
  panel.style.left = Math.round(window.innerWidth * 0.645 + window.scrollX) + 'px';
  panel.style.top = Math.round(box.top - 87 + window.scrollY) + 'px'; //87px sopra l'istogramma: all'altezza del titolo della pagina
}

//scrive didascalia e legenda per l'anno scelto (si chiama alla creazione e a ogni cambio anno)
function updatePanel() {
  let r = rows[years[yearIndex]];

  //"2018 GDP = $20.656.515 million" (GDP in milioni di dollari; n/a se manca il dato)
  let gdpText = 'n/a';
  if (r.gdp > 0) gdpText = '$' + Math.round(r.gdp / 1000000).toLocaleString('it-IT', { useGrouping: 'always' }) + ' million';
  panelCaption.textContent = years[yearIndex] + ' GDP = ' + gdpText;

  //"The top 1% earned 15,3% of the country's GDP." (stesso formato italiano dei numeri dell'istogramma)
  let shares = pieShares();
  for (let i = 0; i < legendGroups.length; i++) {
    if (shares == null) {
      legendTexts[i].textContent = 'The ' + legendGroups[i].name + ': no data for this year.';
      continue;
    }
    let percent = (shares[legendGroups[i].shareIndex] * 100).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    legendTexts[i].textContent = 'The ' + legendGroups[i].name + ' earned ' + percent + '% of the country\u2019s GDP.';
  }
}

//lato del canvas della torta: segue la larghezza del riquadro (circa metà), tra 140 e 240 px
function pieSize() {
  return Math.round(constrain(panel.clientWidth * 0.53, 140, 240));
}

//sketch della torta: spicchi in senso orario da ore 12 = bottom 50%, middle 40%, top 9%, top 1%
function pieSketch(p) {
  p.setup = function () {
    p.createCanvas(pieSize(), pieSize());
  };

  p.draw = function () {
    p.clear(); //sfondo trasparente
    if (pieSize() != p.width) p.resizeCanvas(pieSize(), pieSize()); //se il riquadro cambia larghezza, la torta la segue

    let shares = pieShares();
    if (shares == null) return; //niente dati per quest'anno > niente torta

    let d = p.width - 4; //diametro (lascia spazio al bordo)
    let angle = -p.HALF_PI; //parte da ore 12
    p.stroke('#272318'); //bordo tra gli spicchi: stesso marrone del riquadro (e delle barre)
    p.strokeWeight(2);

    //ogni spicchio ha un angolo proporzionale al suo share (il totale degli share è 1 = giro intero)
    //colori della palette del continente, come le barre: top 1% = 0, top 9% = 1, middle 40% = 2, bottom 50% = 3
    let colorOf = [3, 2, 1, 0]; //colore di ogni spicchio, nello stesso ordine di pieShares
    for (let i = 0; i < shares.length; i++) {
      let sweep = shares[i] * p.TWO_PI;
      if (sweep > 0.002) { //salta spicchi nulli
        p.fill(groupColor(colorOf[i]));
        p.arc(p.width / 2, p.height / 2, d, d, angle, angle + sweep, p.PIE);
      }
      angle += sweep;
    }
  };
}
