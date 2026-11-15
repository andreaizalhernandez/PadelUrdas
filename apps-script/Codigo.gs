/**
 * Padelurdas · puente entre la app del móvil y tu hoja de Google.
 * Lee y escribe en las pestañas «Partidos», «Ajustes» y «Clasificación».
 * No toca ninguna fórmula: solo rellena Fecha, Jugadoras 1-3 (y la 4 si no es fórmula) y los sets.
 */
const CLAVE = '';            // opcional: pon una palabra y la misma en config.js (KEY)
const PRIMERA = 6, ULTIMA = 305;   // filas de «Partidos»

function doGet(e)  { return responder_(() => { comprobar_(e.parameter.key); return datos_(); }); }
function doPost(e) {
  return responder_(() => {
    const b = JSON.parse(e.postData.contents);
    comprobar_(b.key);
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      if (b.action === 'add')    return anadir_(b);
      if (b.action === 'delete') return borrar_(b);
      if (b.action === 'fault')  return falta_(b);
      if (b.action === 'pay')    return pagar_(b);
      throw new Error('Acción desconocida');
    } finally { lock.releaseLock(); }
  });
}
function responder_(fn) {
  let out;
  try { out = fn(); } catch (err) { out = { error: String(err.message || err) }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
function comprobar_(k) { if (CLAVE && k !== CLAVE) throw new Error('Clave incorrecta'); }

/* ---------- lectura ---------- */
function datos_() {
  const ss = SpreadsheetApp.getActive(), tz = ss.getSpreadsheetTimeZone();
  const aj = ss.getSheetByName('Ajustes');
  const players = aj.getRange('A3:A6').getValues().flat().filter(String);

  const pa = ss.getSheetByName('Partidos');
  const vals = pa.getRange(PRIMERA, 1, ULTIMA - PRIMERA + 1, 13).getValues();
  const matches = []; let fecha = '';
  vals.forEach((r, i) => {
    if (r[0] instanceof Date) fecha = Utilities.formatDate(r[0], tz, 'yyyy-MM-dd');
    const usada = [r[1], r[2], r[3]].some(v => v !== '') || r[5] !== '' || r[6] !== '';
    if (!usada) return;
    matches.push({
      row: PRIMERA + i, date: fecha, a: [r[1], r[2]], b: [r[3], r[4]],
      sa: r[5] === '' ? null : r[5], sb: r[6] === '' ? null : r[6],
      valid: marcadorOk_(r[5], r[6]), control: marcadorOk_(r[5], r[6]) ? '' : 'Marcador no válido'
    });
  });

  const faultLog = faltas_().getDataRange().getValues().slice(1)
    .filter(r => r[1] !== '')
    .map((r, i) => ({ id: i + 2, name: r[1],
      date: r[0] instanceof Date ? Utilities.formatDate(r[0], tz, 'yyyy-MM-dd') : '',
      paid: r[2] instanceof Date ? Utilities.formatDate(r[2], tz, 'yyyy-MM-dd') : (r[2] ? '1' : '') }));

  return {
    players, matches, faultLog,
    pts: { win: 2, tb: 1 },   // ganar el set = 2 · perder 5-6 (tie-break) = 1
    sheetUrl: ss.getUrl()
  };
}

/* ---------- escritura ---------- */
function anadir_(b) {
  const ss = SpreadsheetApp.getActive(), pa = ss.getSheetByName('Partidos');
  const players = ss.getSheetByName('Ajustes').getRange('A3:A6').getValues().flat().filter(String);
  const four = [].concat(b.a, b.b);
  if (four.length !== 4 || new Set(four).size !== 4 || four.some(n => players.indexOf(n) < 0)) throw new Error('Jugadoras no válidas');
  const sa = Number(b.sa), sb = Number(b.sb);
  if (!marcadorOk_(sa, sb)) throw new Error('Marcador no válido');
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(b.date || '');
  if (!m) throw new Error('Fecha no válida');

  // evitar duplicados si el móvil reintenta el envío
  const props = PropertiesService.getDocumentProperties();
  const vistos = JSON.parse(props.getProperty('ids') || '[]');
  if (b.id && vistos.indexOf(b.id) >= 0) return Object.assign({ row: null }, { data: datos_() });

  // siempre después del último partido (así las fechas heredadas no se mezclan)
  const col = pa.getRange(PRIMERA, 2, ULTIMA - PRIMERA + 1, 6).getValues();
  let ultima = PRIMERA - 1;
  col.forEach((r, i) => { if ([r[0], r[1], r[2], r[4], r[5]].some(v => v !== '')) ultima = PRIMERA + i; });
  const row = ultima + 1;
  if (row > ULTIMA) throw new Error('La hoja está llena (300 partidos)');

  pa.getRange(row, 1).setValue(new Date(+m[1], +m[2] - 1, +m[3]));
  pa.getRange(row, 2, 1, 3).setValues([[b.a[0], b.a[1], b.b[0]]]);
  if (!pa.getRange(row, 5).getFormula()) pa.getRange(row, 5).setValue(b.b[1]);   // si ya hay fórmula, se respeta
  pa.getRange(row, 6, 1, 2).setValues([[sa, sb]]);
  if (!pa.getRange(row, 8).getFormula())                                           // fila sin fórmulas: copiar de la última
    pa.getRange(ULTIMA, 8, 1, 6).copyTo(pa.getRange(row, 8, 1, 6));
  SpreadsheetApp.flush();

  if (b.id) { vistos.push(b.id); props.setProperty('ids', JSON.stringify(vistos.slice(-100))); }
  return { row: row, data: datos_() };
}

function borrar_(b) {
  const pa = SpreadsheetApp.getActive().getSheetByName('Partidos'), row = Number(b.row);
  if (!(row >= PRIMERA && row <= ULTIMA)) throw new Error('Fila no válida');
  const r = pa.getRange(row, 1, 1, 7).getValues()[0];
  const firma = [r[1], r[2], r[3], pa.getRange(row, 5).getValue(), r[5], r[6]].join('|');
  if (b.sig && firma !== b.sig) throw new Error('Esa fila ha cambiado en el Excel. Actualiza y vuelve a intentarlo.');
  // si el partido tenía fecha y los siguientes la heredaban, se la pasamos al siguiente
  if (r[0] !== '' && pa.getRange(row + 1, 1).getValue() === '' && pa.getRange(row + 1, 2).getValue() !== '')
    pa.getRange(row + 1, 1).setValue(r[0]);
  pa.getRange(row, 1).clearContent();
  pa.getRange(row, 2, 1, 3).clearContent();
  pa.getRange(row, 6, 1, 2).clearContent();
  if (!pa.getRange(row, 5).getFormula()) pa.getRange(row, 5).clearContent();
  SpreadsheetApp.flush();
  return { data: datos_() };
}

function marcadorOk_(x, y) { x = Number(x); y = Number(y); return Math.max(x, y) === 6 && Math.min(x, y) >= 0 && Math.min(x, y) <= 5; }

/* Hoja «Faltas»: una fila por doble falta (fecha + jugadora). Se crea sola la primera vez
   con las cuentas que ya tenías en «Clasificación» (sin fecha). */
function faltas_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName('Faltas');
  if (sh) { if (sh.getRange(1, 3).getValue() === '') sh.getRange(1, 3).setValue('Pagada el').setFontWeight('bold'); return sh; }
  sh = ss.insertSheet('Faltas');
  sh.getRange(1, 1, 1, 3).setValues([['Fecha', 'Jugadora', 'Pagada el']]).setFontWeight('bold');
  sh.getRange('A:A').setNumberFormat('dd/mm/yyyy'); sh.getRange('C:C').setNumberFormat('dd/mm/yyyy');
  sh.setFrozenRows(1);
  const cl = ss.getSheetByName('Clasificación');
  const colB = cl.getRange('B1:C60').getValues();
  const h = colB.findIndex(r => String(r[0]).trim().toUpperCase() === 'DOBLES FALTAS');
  const filas = [];
  if (h >= 0) for (let i = h + 1; i < colB.length && colB[i][0] !== ''; i++)
    for (let k = 0; k < (Number(colB[i][1]) || 0); k++) filas.push(['', colB[i][0]]);
  if (filas.length) sh.getRange(2, 1, filas.length, 2).setValues(filas);
  return sh;
}

function falta_(b) {
  const ss = SpreadsheetApp.getActive(), sh = faltas_();
  const players = ss.getSheetByName('Ajustes').getRange('A3:A6').getValues().flat().filter(String);
  if (players.indexOf(b.name) < 0) throw new Error('Jugadora no encontrada');
  if (Number(b.delta) > 0) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(b.date || '');
    sh.appendRow([m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(), b.name]);
  } else {
    const v = sh.getDataRange().getValues();
    let ok = false;   // quita la última doble falta que aún no se ha pagado
    for (let i = v.length - 1; i >= 1; i--) if (v[i][1] === b.name && v[i][2] === '') { sh.deleteRow(i + 1); ok = true; break; }
    if (!ok) throw new Error('No tiene faltas pendientes que quitar');
  }
  // mantener el contador de «Clasificación» al día
  const n = sh.getDataRange().getValues().slice(1).filter(r => r[1] === b.name).length;
  const cl = ss.getSheetByName('Clasificación'), colB = cl.getRange('B1:C60').getValues();
  const h = colB.findIndex(r => String(r[0]).trim().toUpperCase() === 'DOBLES FALTAS');
  if (h >= 0) for (let i = h + 1; i < colB.length && colB[i][0] !== ''; i++)
    if (colB[i][0] === b.name) cl.getRange(i + 1, 3).setValue(n);
  SpreadsheetApp.flush();
  return { data: datos_() };
}

/* Marca como pagada la doble falta pendiente más antigua (o deshace el último pago). */
function pagar_(b) {
  const sh = faltas_(), v = sh.getDataRange().getValues();
  if (b.undo) {
    for (let i = v.length - 1; i >= 1; i--) if (v[i][1] === b.name && v[i][2] !== '') { sh.getRange(i + 1, 3).clearContent(); break; }
  } else {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(b.date || '');
    const f = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date();
    let ok = false;
    for (let i = 1; i < v.length; i++) if (v[i][1] === b.name && v[i][2] === '') { sh.getRange(i + 1, 3).setValue(f); ok = true; break; }
    if (!ok) throw new Error('No debe ninguna cerveza');
  }
  SpreadsheetApp.flush();
  return { data: datos_() };
}
