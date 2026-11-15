/**
 * Padelurdas · puente entre la app del móvil y tu hoja de Google.
 * Lee y escribe en «Partidos», «Ajustes» y «Faltas». No toca tus fórmulas.
 * Versión rápida: lecturas con caché y escrituras que no vuelven a leer toda la hoja.
 */
const CLAVE = '';                  // opcional: pon una palabra y la misma en config.js (KEY)
const PRIMERA = 6, ULTIMA = 305;   // filas de «Partidos»
const CACHE_S = 300;               // segundos que se guarda la lectura (se borra al escribir)

function doGet(e) {
  return responder_(() => { comprobar_(e.parameter.key); return datos_(e.parameter.fresh === '1'); });
}
function doPost(e) {
  return responder_(() => {
    const b = JSON.parse(e.postData.contents);
    comprobar_(b.key);
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      let r;
      if (b.action === 'add')         r = anadir_(b);
      else if (b.action === 'delete') r = borrar_(b);
      else if (b.action === 'fadd')   r = falta_nueva_(b);
      else if (b.action === 'fdel')   r = falta_borrar_(b);
      else if (b.action === 'fpay')   r = falta_pago_(b);
      else throw new Error('Acción desconocida');
      CacheService.getScriptCache().remove('datos');
      return r;
    } finally { lock.releaseLock(); }
  });
}
function responder_(fn) {
  let out;
  try { out = fn(); } catch (err) { out = { error: String(err.message || err) }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
function comprobar_(k) { if (CLAVE && k !== CLAVE) throw new Error('Clave incorrecta'); }
function marcadorOk_(x, y) { x = Number(x); y = Number(y); return Math.max(x, y) === 6 && Math.min(x, y) >= 0 && Math.min(x, y) <= 5; }

/* ---------- lectura (con caché) ---------- */
function datos_(fresh) {
  const cache = CacheService.getScriptCache();
  if (!fresh) { const c = cache.get('datos'); if (c) return JSON.parse(c); }
  const out = construir_();
  try { cache.put('datos', JSON.stringify(out), CACHE_S); } catch (e) {}
  return out;
}

function construir_() {
  const ss = SpreadsheetApp.getActive(), tz = ss.getSpreadsheetTimeZone();
  const dias = {};
  const f = d => { const k = d.getTime(); return dias[k] || (dias[k] = Utilities.formatDate(d, tz, 'yyyy-MM-dd')); };

  const players = ss.getSheetByName('Ajustes').getRange('A3:A6').getValues().flat().filter(String);

  const vals = ss.getSheetByName('Partidos').getRange(PRIMERA, 1, ULTIMA - PRIMERA + 1, 7).getValues();
  const matches = []; let fecha = '';
  vals.forEach((r, i) => {
    if (r[0] instanceof Date) fecha = f(r[0]);
    if (!([r[1], r[2], r[3]].some(v => v !== '') || r[5] !== '' || r[6] !== '')) return;
    const ok = marcadorOk_(r[5], r[6]);
    matches.push({ row: PRIMERA + i, date: fecha, a: [r[1], r[2]], b: [r[3], r[4]],
      sa: r[5] === '' ? null : r[5], sb: r[6] === '' ? null : r[6], valid: ok, control: ok ? '' : 'Marcador no válido' });
  });

  const fv = faltas_(ss).getDataRange().getValues();
  const faultLog = [];
  for (let i = 1; i < fv.length; i++) {
    const r = fv[i]; if (r[1] === '') continue;
    faultLog.push({ id: String(r[3]), name: r[1],
      date: r[0] instanceof Date ? f(r[0]) : '',
      paid: r[2] instanceof Date ? f(r[2]) : (r[2] ? '1' : '') });
  }
  return { players, matches, faultLog, pts: { win: 2, tb: 1 }, sheetUrl: ss.getUrl() };
}

/* ---------- hoja «Faltas»: Fecha · Jugadora · Pagada el · Id ---------- */
function faltas_(ss) {
  ss = ss || SpreadsheetApp.getActive();
  let sh = ss.getSheetByName('Faltas');
  if (!sh) {
    sh = ss.insertSheet('Faltas');
    sh.getRange(1, 1, 1, 4).setValues([['Fecha', 'Jugadora', 'Pagada el', 'Id']]).setFontWeight('bold');
    sh.getRange('A:A').setNumberFormat('dd/mm/yyyy'); sh.getRange('C:C').setNumberFormat('dd/mm/yyyy');
    sh.setFrozenRows(1);
    const cl = ss.getSheetByName('Clasificación');
    const colB = cl.getRange('B1:C60').getValues();
    const h = colB.findIndex(r => String(r[0]).trim().toUpperCase() === 'DOBLES FALTAS');
    const filas = [];
    if (h >= 0) for (let i = h + 1; i < colB.length && colB[i][0] !== ''; i++)
      for (let k = 0; k < (Number(colB[i][1]) || 0); k++) filas.push(['', colB[i][0], '', Utilities.getUuid()]);
    if (filas.length) sh.getRange(2, 1, filas.length, 4).setValues(filas);
    contadores_(ss);
    return sh;
  }
  // hojas creadas con versiones anteriores: añadir columnas e identificadores que falten
  if (sh.getRange(1, 3).getValue() === '') sh.getRange(1, 3).setValue('Pagada el').setFontWeight('bold');
  if (sh.getRange(1, 4).getValue() === '') sh.getRange(1, 4).setValue('Id').setFontWeight('bold');
  const n = sh.getLastRow() - 1;
  if (n > 0) {
    const rg = sh.getRange(2, 2, n, 3), v = rg.getValues();   // B:D
    let cambios = false;
    v.forEach(r => { if (r[0] !== '' && r[2] === '') { r[2] = Utilities.getUuid(); cambios = true; } });
    if (cambios) { sh.getRange(2, 4, n, 1).setValues(v.map(r => [r[2]])); contadores_(ss); }
  }
  return sh;
}
// «Clasificación» pasa a contar las dobles faltas sola, con una fórmula
function contadores_(ss) {
  try {
    const cl = ss.getSheetByName('Clasificación'), colB = cl.getRange('B1:C60').getValues();
    const h = colB.findIndex(r => String(r[0]).trim().toUpperCase() === 'DOBLES FALTAS');
    if (h >= 0) for (let i = h + 1; i < colB.length && colB[i][0] !== ''; i++)
      cl.getRange(i + 1, 3).setFormula('=COUNTIF(Faltas!$B:$B,B' + (i + 1) + ')');
  } catch (e) {}
}
function buscarFalta_(sh, fid) {
  const n = sh.getLastRow() - 1; if (n < 1) throw new Error('No existe esa doble falta');
  const ids = sh.getRange(2, 4, n, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(fid)) return i + 2;
  throw new Error('No existe esa doble falta (¿otra persona la ha borrado?)');
}
function fechaIso_(s) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }

function falta_nueva_(b) {
  const sh = faltas_();
  const d = fechaIso_(b.date) || new Date();
  sh.appendRow([d, b.name, '', b.fid || Utilities.getUuid()]);
  return { ok: true };
}
function falta_borrar_(b) { const sh = faltas_(); sh.deleteRow(buscarFalta_(sh, b.fid)); return { ok: true }; }
function falta_pago_(b) {
  const sh = faltas_(), row = buscarFalta_(sh, b.fid), c = sh.getRange(row, 3);
  const d = fechaIso_(b.paid);
  if (b.paid && d) c.setValue(d); else c.clearContent();
  return { ok: true };
}

/* ---------- partidos ---------- */
function anadir_(b) {
  const pa = SpreadsheetApp.getActive().getSheetByName('Partidos');
  const four = [].concat(b.a, b.b), sa = Number(b.sa), sb = Number(b.sb);
  if (four.length !== 4 || new Set(four).size !== 4) throw new Error('Jugadoras no válidas');
  if (!marcadorOk_(sa, sb)) throw new Error('Marcador no válido');
  const d = fechaIso_(b.date); if (!d) throw new Error('Fecha no válida');

  const cache = CacheService.getScriptCache();               // evita duplicados si el móvil reintenta
  if (b.id) { if (cache.get('id_' + b.id)) return { row: null }; }

  const col = pa.getRange(PRIMERA, 2, ULTIMA - PRIMERA + 1, 6).getValues();   // B:G
  let ultima = PRIMERA - 1;
  col.forEach((r, i) => { if ([r[0], r[1], r[2], r[4], r[5]].some(v => v !== '')) ultima = PRIMERA + i; });
  const row = ultima + 1;
  if (row > ULTIMA) throw new Error('La hoja está llena (300 sets)');

  const fx = pa.getRange(row, 5, 1, 4).getFormulas()[0];       // E..H
  pa.getRange(row, 1, 1, 4).setValues([[d, b.a[0], b.a[1], b.b[0]]]);
  if (!fx[0]) pa.getRange(row, 5).setValue(b.b[1]);            // si E ya tiene fórmula se respeta
  pa.getRange(row, 6, 1, 2).setValues([[sa, sb]]);
  if (!fx[3]) pa.getRange(ULTIMA, 8, 1, 6).copyTo(pa.getRange(row, 8, 1, 6));   // fila sin fórmulas: copiar

  if (b.id) cache.put('id_' + b.id, '1', 21600);
  return { row: row };
}

function borrar_(b) {
  const pa = SpreadsheetApp.getActive().getSheetByName('Partidos'), row = Number(b.row);
  if (!(row >= PRIMERA && row <= ULTIMA)) throw new Error('Fila no válida');
  const r = pa.getRange(row, 1, 2, 7).getValues(), x = r[0], sig = [x[1], x[2], x[3], x[4], x[5], x[6]].join('|');
  if (b.sig && sig !== b.sig) throw new Error('Esa fila ha cambiado en el Excel. Actualiza y vuelve a intentarlo.');
  if (x[0] !== '' && r[1][0] === '' && r[1][1] !== '') pa.getRange(row + 1, 1).setValue(x[0]);   // la fecha pasa a la siguiente fila
  const fe = pa.getRange(row, 5).getFormula();
  pa.getRange(row, 1, 1, 4).clearContent();
  pa.getRange(row, 6, 1, 2).clearContent();
  if (!fe) pa.getRange(row, 5).clearContent();
  return { ok: true };
}

/* ---------- opcional: tenerlo siempre listo (ejecútalo una vez a mano) ---------- */
function activarRapido() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'calentar_').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('calentar_').timeBased().everyMinutes(5).create();
  calentar_();
}
function calentar_() { datos_(true); }
