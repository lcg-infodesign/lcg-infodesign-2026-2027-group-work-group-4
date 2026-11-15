// ===== PARTE COMUNE (copiata e incollata uguale in sketch.js e continent.js) =====
var csvPath = 'assets/wid_panel_2000_2024.csv';   // attenzione: il csv usa il ; come separatore, non la virgola

// i continenti da sinistra a destra. color = [r,g,b]
// TODO: i colori sono provvisori, decidiamo insieme quelli definitivi
var regions = [
  {key:'Africa',        label:['AFRICA'],           color:[138,154,75]},
  {key:'Asia',          label:['ASIA'],             color:[217,98,43]},
  {key:'Europe',        label:['EUROPE'],           color:[62,66,120]},
  {key:'North America', label:['NORTH','AMERICA'],  color:[123,94,160]},
  {key:'South America', label:['SOUTH','AMERICA'],  color:[62,158,148]},
  {key:'Oceania',       label:['OCEANIA'],          color:[58,30,20]}
];

var rawLines;                // le righe del csv così come arrivano da loadStrings
var years = [];
var countries = [];      // un oggetto per paese: {name, region (indice del continente), bottom{anno:valore}, top{anno:valore}}
var yearIdx = 0;
var curB = [];           // valori 'correnti' dei punti: si muovono piano piano verso il valore vero (animazione)
var curT = [];
var xs = [];             // x di ogni linea (la calcola computeLayout)
var slot = 6;            // larghezza di uno slot = lo spazio che ha ogni paese
var hover = -1;
var query = '';          // testo della ricerca, tutto minuscolo
// asse logaritmico: va da 10^logLo a 10^logHi dollari
var logLo = 2;
var logHi = 6;

function $(s){ return document.querySelector(s); }

function fmt(v){ return '$' + Math.round(v).toLocaleString('en-US'); }

function short(v){
  if (v >= 1000000) return (v / 1000000) + 'M';
  if (v >= 1000) return (v / 1000) + 'k';
  return String(v);
}

// dal nome del continente ('Asia') all'indice nell'array regions. Se non esiste ritorna -1
function regionIndex(name){
  for (var i = 0; i < regions.length; i++){
    if (regions[i].key == name) return i;
  }
  return -1;
}

// valori del paese i nell'anno selezionato (b = 50% più povero, t = 1% più ricco)
function getB(i){ return countries[i].bottom[years[yearIdx]]; }
function getT(i){ return countries[i].top[years[yearIdx]]; }
// alcuni paesi hanno buchi nei dati: quelli non li disegniamo
function hasData(i){ return getB(i) > 0 && getT(i) > 0; }
// true se il nome del paese contiene quello che c'è scritto nella ricerca
function isMatch(i){
  if (query == '') return false;
  return countries[i].name.toLowerCase().indexOf(query) != -1;
}

// da dollari a pixel, in scala logaritmica (M sono i margini)
function yOf(v){
  var t = map(log(max(v, 1)) / log(10), logLo, logHi, 0, 1);
  return lerp(height - M.b, M.t, t);
}

// le linee della griglia: 100, 1000, 10000... la prima è la base
function ticks(){
  var list = [];
  for (var e = logLo; e <= floor(logHi); e++) list.push(pow(10, e));
  return list;
}

// legge il csv e riempie countries e years. only = nome del continente se ne vogliamo uno solo (pagina del continente)
function loadData(only){
  var head = rawLines[0].replace('\uFEFF', '').split(';');
  for (var h = 0; h < head.length; h++) head[h] = head[h].trim().replace(/"/g, '');

  var byIso = {};
  var yearList = [];

  for (var l = 1; l < rawLines.length; l++){
    if (rawLines[l] == '') continue;
    var f = rawLines[l].split(';');
    var row = {};
    for (var h = 0; h < head.length; h++){
      row[head[h]] = (f[h] || '').trim().replace(/"/g, '');
    }

    var r = regionIndex(row.continent);
    var y = parseFloat(row.year);
    if (r == -1) continue;
    if (only && row.continent != only) continue;
    if (isNaN(y)) continue;

    if (yearList.indexOf(y) == -1) yearList.push(y);
    if (!byIso[row.iso2]){
      byIso[row.iso2] = {name:row.country_name, region:r, bottom:{}, top:{}};
    }
    byIso[row.iso2].bottom[y] = parseFloat(row.avg_posttax_usd_bottom50.replace(',', '.'));
    byIso[row.iso2].top[y] = parseFloat(row.avg_posttax_usd_top1.replace(',', '.'));
  }

  years = yearList.sort(function(a, b){ return a - b; });
  for (var iso in byIso) countries.push(byIso[iso]);
  countries.sort(function(a, b){
    if (a.region != b.region) return a.region - b.region;
    return a.name.localeCompare(b.name);
  });

  if (countries.length == 0){
    $('#chart').innerHTML = '<div class="error">No data found, check ' + csvPath + ' (and use Live Server)</div>';
    return false;
  }

  // anno di partenza: prima ?y= nell'url, sennò 2018, sennò l'ultimo
  var wanted = years.indexOf(parseInt(new URLSearchParams(location.search).get('y')));
  if (wanted >= 0) yearIdx = wanted;
  else if (years.indexOf(2018) >= 0) yearIdx = years.indexOf(2018);
  else yearIdx = years.length - 1;

  // l'asse lo calcolo su tutti gli anni, così non salta quando si cambia anno
  var lo = 1000000, hi = 1;
  for (var i = 0; i < countries.length; i++){
    for (var k = 0; k < years.length; k++){
      var b = countries[i].bottom[years[k]];
      var t = countries[i].top[years[k]];
      if (b > 0 && b < lo) lo = b;
      if (t > hi) hi = t;
    }
  }
  logLo = floor(log(lo) / log(10));
  logHi = max(ceil(log(hi) / log(10)), logLo + 1);
  return true;
}

// crea il canvas e parte con i valori iniziali (così al primo frame i punti non "volano" dal nulla)
function startCanvas(){
  pixelDensity(min(2, devicePixelRatio));
  createCanvas(chartWidth(), chartHeight());
  $('#chart').appendChild(drawingContext.canvas);
  for (var i = 0; i < countries.length; i++){
    curB[i] = getB(i);
    curT[i] = getT(i);
  }
}

// se la finestra cambia misura ridimensiono il canvas e ricalcolo le posizioni
function windowResized(){
  if (countries.length > 0){
    resizeCanvas(chartWidth(), chartHeight());
    computeLayout();
  }
}

// i punti inseguono i valori dell'anno scelto (16% a ogni frame, per l'effetto morbido).
// se manca il dato restano fermi
function easeValues(){
  for (var i = 0; i < countries.length; i++){
    var b = getB(i), t = getT(i);
    if (b > 0){
      if (curB[i] > 0) curB[i] = lerp(curB[i], b, 0.16);
      else curB[i] = b;
    }
    if (t > 0){
      if (curT[i] > 0) curT[i] = lerp(curT[i], t, 0.16);
      else curT[i] = t;
    }
  }
}

// disegna un paese: una linea + due pallini. bold = evidenziato, faded = sbiadito
function drawCountry(i, bold, faded){
  var col = regions[countries[i].region].color;
  var alpha = faded ? 55 : 255;
  var size = bold ? 8.4 : 6;
  var y0 = yOf(curB[i]);
  var y1 = yOf(curT[i]);

  stroke(col[0], col[1], col[2], alpha);
  strokeWeight(bold ? 2.4 : 1.5);
  line(xs[i], y0, xs[i], y1);
  noStroke();
  fill(col[0], col[1], col[2], alpha);
  circle(xs[i], y0, size);
  circle(xs[i], y1, size);
}

// prima quelli sbiaditi, poi quelli evidenziati sopra, così non vengono coperti
function drawCountryLines(hasFocus){
  for (var i = 0; i < countries.length; i++){
    if (hasData(i) && !isFocus(i)) drawCountry(i, false, hasFocus);
  }
  for (var i = 0; i < countries.length; i++){
    if (hasData(i) && isFocus(i)) drawCountry(i, hasFocus, false);
  }
}

// righe tratteggiate dall'asse ai due pallini del paese sotto il mouse
function drawGuides(i, fromX){
  stroke(37, 36, 27, 90);
  strokeWeight(1);
  drawingContext.setLineDash([2, 3]);
  line(fromX, yOf(curB[i]), xs[i], yOf(curB[i]));
  line(fromX, yOf(curT[i]), xs[i], yOf(curT[i]));
  drawingContext.setLineDash([]);
}

// il mouse è proprio sopra il canvas? (serve per non far comparire il tooltip quando sei su bottoni o finestre)
function mouseOverCanvas(){
  return document.elementFromPoint(winMouseX, winMouseY) === drawingContext.canvas;
}

// aggiorna il paese sotto il mouse e sposta il tooltip vicino al cursore, senza farlo uscire dalla finestra
function updateHover(picked){
  if (picked != hover){
    hover = picked;
    if (hover >= 0) renderTip(hover);
  }
  var tip = $('#tip');
  if (hover >= 0){
    tip.classList.add('on');
    var x = winMouseX + 16, y = winMouseY + 16;
    if (x + tip.offsetWidth > innerWidth - 8) x = winMouseX - tip.offsetWidth - 16;
    if (y + tip.offsetHeight > innerHeight - 8) y = winMouseY - tip.offsetHeight - 16;
    tip.style.left = max(8, x) + 'px';
    tip.style.top = max(8, y) + 'px';
  } else {
    tip.classList.remove('on');
  }
}

// frecce sinistra/destra = anno prima/dopo (ma non se stai scrivendo nella ricerca)
function keyPressed(){
  if (countries.length == 0) return;
  if (document.activeElement.tagName == 'INPUT') return;
  if (keyCode == LEFT_ARROW) setYear(yearIdx - 1);
  if (keyCode == RIGHT_ARROW) setYear(yearIdx + 1);
}

// barra degli anni: 7 slot con l'anno scelto in mezzo.
// gli slot vuoti sono 'ghost' (invisibili) così il resto resta allineato
function renderYearBar(){
  var html = '';
  for (var offset = -3; offset <= 3; offset++){
    var k = yearIdx + offset;
    if (k < 0 || k >= years.length){
      html += '<span class="y ghost"></span>';
    } else if (offset != 0){
      html += '<button class="y" data-k="' + k + '">' + years[k] + '</button>';
    } else {
      html += '<div class="cur">' +
        '<button class="arrow" data-k="' + (k - 1) + '"' + (k == 0 ? ' disabled' : '') + '>&lt;</button>' +
        '<div class="now">' + years[k] + '</div>' +
        '<button class="arrow" data-k="' + (k + 1) + '"' + (k == years.length - 1 ? ' disabled' : '') + '>&gt;</button>' +
        '</div>';
    }
  }
  $('#years').innerHTML = html;
  $('#years').onclick = function(e){
    var b = e.target.closest('button[data-k]');
    if (b) setYear(parseInt(b.dataset.k));
  };
}

// ricerca: i paesi che non corrispondono diventano sbiaditi. onEnter = cosa fare con Invio (facoltativo)
function initSearch(onEnter){
  var box = $('#search');
  var input = $('#q');

  $('#sbtn').onclick = function(){
    box.classList.toggle('open');
    if (box.classList.contains('open')){
      input.focus();
    } else {
      input.value = '';
      query = '';
    }
  };
  input.oninput = function(){
    query = input.value.trim().toLowerCase();
  };
  input.onkeydown = function(e){
    if (e.key == 'Enter' && onEnter) onEnter();
    if (e.key == 'Escape'){
      input.value = '';
      query = '';
      box.classList.remove('open');
      input.blur();
    }
  };
}
// ===== FINE PARTE COMUNE =====

// ===== PAGINA PRINCIPALE =====
// STATO DEL LAVORO (lo aggiorno a mano ogni tanto)
var M = {l:74, r:28, t:16, b:62};     // margini: sinistra, destra, alto, basso (sotto serve spazio per i nomi dei continenti)
var hoverRegion = -1;   // continente sotto il mouse (-1 = nessuno)
var groups = [];        // inizio, fine e centro di ogni gruppo di continente

function chartWidth(){ return max(1000, $('#scroll').clientWidth); }
function chartHeight(){ return max(470, innerHeight - 300); }
function baseY(){ return yOf(ticks()[0]); }

// un paese è 'in primo piano' se ci passo sopra, se passo sul suo continente o se corrisponde alla ricerca
function isFocus(i){
  return i == hover || countries[i].region == hoverRegion || isMatch(i);
}

// se il csv non si carica scrivo un messaggio nella pagina (di solito è perché non si usa Live Server)
function csvError(){
  $('#chart').innerHTML = '<div class="error"><b>Could not load the data.</b><br>Expected file: <code>' + csvPath + '</code>. Use Live Server (or python3 -m http.server) instead of opening the file directly.</div>';
}

// per questo setup fa solo partire il caricamento e il resto sta in startSketch (callback)
function setup(){
  noCanvas();   // il canvas vero lo creo dopo, quando ho i dati
  noLoop();     // draw() parte solo quando il csv è pronto (vedi loop() in fondo a startSketch)
  loadStrings(csvPath, startSketch, csvError);
}

// chiamata da loadStrings appena il csv è arrivato
function startSketch(lines){
  rawLines = lines;
  if (!loadData(null)) return;
  logLo = 2;
  logHi = 6.85;      // asse fisso: da $100 a circa $7M (così gli anni si possono confrontare)
  startCanvas();
  computeLayout();
  renderYearBar();
  initSearch(function(){
    // invio = apre il continente del primo paese trovato
    for (var i = 0; i < countries.length; i++){
      if (isMatch(i)){ openContinent(countries[i].region); return; }
    }
  });
  loop();   // adesso si può disegnare
}

function draw(){
  if (countries.length == 0) return;
  background('#FDFBEC');
  easeValues();
  updateHover(pickLine());
  hoverRegion = pickRegion();

  var T = ticks();
  var y0 = baseY();

  // griglia + valori sull'asse y
  textFont('Space Mono');
  textSize(11);
  for (var k = 0; k < T.length; k++){
    var v = T[k];
    if (k > 0){
      stroke(230, 227, 209);
      strokeWeight(1);
      line(M.l - 4, yOf(v), width - M.r, yOf(v));
    }
    noStroke();
    fill(139, 136, 115);
    textAlign(RIGHT, CENTER);
    text(short(v), M.l - 14, yOf(v));
  }

  var focus = hover >= 0 || hoverRegion >= 0 || query != '';
  drawCountryLines(focus);
  if (hover >= 0) drawGuides(hover, M.l - 4);

  // base spessa
  stroke(37, 36, 27);
  strokeWeight(3);
  line(M.l - 4, y0, width - M.r + 2, y0);

  // nomi dei continenti (quello sotto il mouse si colora)
  textSize(12);
  textAlign(CENTER, TOP);
  for (var g = 0; g < groups.length; g++){
    var gr = groups[g];
    var col = regions[gr.i].color;
    var hot = gr.i == hoverRegion;
    if (hot){
      stroke(col[0], col[1], col[2]);
      strokeWeight(5);
      line(gr.x0, y0, gr.x1, y0);
    }
    noStroke();
    if (hot) fill(col[0], col[1], col[2]);
    else fill(37, 36, 27);
    for (var t = 0; t < regions[gr.i].label.length; t++){
      text(regions[gr.i].label[t], gr.mid, y0 + 16 + t * 16);
    }
  }

  if (hover >= 0 || hoverRegion >= 0) cursor('pointer');
  else cursor('default');
}

// click su una linea o su un continente -> pagina del continente (l'anno lo passo nell'url)
function mouseClicked(){
  if (countries.length == 0 || !mouseOverCanvas()) return;
  var picked = pickLine();
  var r;
  if (picked >= 0) r = countries[picked].region;
  else r = pickRegion();
  if (r >= 0) openContinent(r);
}

function openContinent(r){
  location.href = 'continent.html?c=' + encodeURIComponent(regions[r].key) + '&y=' + years[yearIdx];
}

// i paesi sono già ordinati per continente: uno slot a testa, con un buco tra un continente e l'altro
function computeLayout(){
  var gap = 34;
  var x = M.l;
  xs = [];
  groups = [];
  slot = (width - M.l - M.r - gap * (regions.length - 1)) / countries.length;

  for (var i = 0; i < regions.length; i++){
    var n = 0;
    for (var c = 0; c < countries.length; c++){
      if (countries[c].region == i) n++;
    }
    var x0 = x;
    for (var j = 0; j < n; j++) xs.push(x0 + slot * (j + 0.5));
    x += slot * n;
    groups.push({i:i, x0:x0, x1:x, mid:(x0 + x) / 2});
    x += gap;
  }
}

// trova il paese più vicino al mouse in orizzontale, poi controlla anche la y
// (+18px di tolleranza, le linee sono sottili e sennò è impossibile prenderle)
function pickLine(){
  if (!mouseOverCanvas()) return -1;
  var best = 0;
  for (var j = 1; j < countries.length; j++){
    if (abs(xs[j] - mouseX) < abs(xs[best] - mouseX)) best = j;
  }
  if (abs(xs[best] - mouseX) > max(slot / 2, 3.5)) return -1;
  if (!hasData(best)) return -1;
  if (mouseY >= yOf(curT[best]) - 18 && mouseY <= yOf(curB[best]) + 18) return best;
  return -1;
}

// il mouse è sopra il nome di un continente (quello sotto la base)?
function pickRegion(){
  var y0 = baseY();
  if (!mouseOverCanvas() || mouseY < y0 + 6 || mouseY > y0 + 62) return -1;
  for (var g = 0; g < groups.length; g++){
    if (mouseX >= groups[g].x0 - 16 && mouseX <= groups[g].x1 + 16) return groups[g].i;
  }
  return -1;
}

// qui il tooltip ha solo il nome; i dettagli stanno nella pagina del continente
function renderTip(i){
  $('#tip').innerHTML = '<div class="n">' + countries[i].name + '</div>';
}

// cambia anno: ridisegna la barra, il resto lo fa easeValues() da solo
function setYear(k){
  k = constrain(k, 0, years.length - 1);
  if (k == yearIdx) return;
  yearIdx = k;
  renderYearBar();
  if (hover >= 0) renderTip(hover);
}