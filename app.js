(() => {
'use strict';
const CFG = window.PADELURDAS_CONFIG || {};
const VERSION = '15-nov-b';

/* ---------- utilidades ---------- */
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} }
};
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const iso = d => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
const todayISO = () => iso(new Date());
const parts = s => s.split('-').map(Number);
const fmtDate = s => { const [y, m, d] = parts(s); return new Date(y, m - 1, d).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }); };
const fmtMed = s => { const [y, m, d] = parts(s); return new Date(y, m - 1, d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/\./g, ''); };
const fmtTiny = s => { const [y, m, d] = parts(s); return new Date(y, m - 1, d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace(/\./g, ''); };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const sig = m => [...m.a, ...m.b, m.sa, m.sb].join('|');

const I = (p, w = 22) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const ICON = {
  plus: I('<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>'),
  trophy: I('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>'),
  list: I('<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/>'),
  doc: I('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>'),
  crown: I('<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8Z"/>', 18),
  trash: I('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', 18),
  cal: I('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>', 18),
  check: I('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 18),
  print: I('<path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><rect x="7" y="14" width="10" height="7" rx="1"/>', 20),
  beer: I('<path d="M5 8h10v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8Z"/><path d="M15 10h2a2 2 0 0 1 0 6h-2M8 4c0 1 1 1 1 2M12 4c0 1 1 1 1 2"/>', 20),
  racket: I('<ellipse cx="14" cy="9" rx="6" ry="7" transform="rotate(35 14 9)"/><path d="M9.5 13.5L4 19M3 20l2 1"/>', 18)
};

/* ---------- datos de ejemplo (modo demo) ---------- */
const DEMO = {
  players: ['Adela', 'Uxue', 'Txiki', 'Andrea'],
  pts: { win: 2, tb: 1 },
  matches: [
    { row: 6,  date: '2026-09-17', a: ['Txiki', 'Andrea'], b: ['Uxue', 'Adela'],  sa: 3, sb: 6 },
    { row: 7,  date: '2026-09-17', a: ['Txiki', 'Adela'],  b: ['Uxue', 'Andrea'], sa: 6, sb: 5 },
    { row: 8,  date: '2026-09-17', a: ['Txiki', 'Uxue'],   b: ['Andrea', 'Adela'], sa: 2, sb: 6 },
    { row: 9,  date: '2026-10-08', a: ['Txiki', 'Andrea'], b: ['Uxue', 'Adela'],  sa: 4, sb: 6 },
    { row: 10, date: '2026-10-08', a: ['Txiki', 'Adela'],  b: ['Uxue', 'Andrea'], sa: 6, sb: 1 },
    { row: 11, date: '2026-10-08', a: ['Txiki', 'Uxue'],   b: ['Andrea', 'Adela'], sa: 6, sb: 5 }
  ],
  faultLog: [
    { id: 1, date: '2026-09-17', name: 'Uxue', paid: '2026-10-08' }, { id: 2, date: '2026-10-08', name: 'Adela', paid: '' }, { id: 3, date: '2026-10-08', name: 'Uxue', paid: '' }
  ]
};
const validScore = (x, y) => { const hi = Math.max(x, y), lo = Math.min(x, y); return hi === 6 && lo >= 0 && lo <= 5; };

function computeStandings(players, matches, pts) {
  const s = Object.fromEntries(players.map(p => [p, { name: p, played: 0, wins: 0, losses: 0, tbPts: 0, setsFor: 0, setsAgainst: 0, form: [] }]));
  const ordered = [...matches].sort((x, y) => (x.date || '').localeCompare(y.date || '') || x.row - y.row);
  for (const m of ordered) {
    if (m.valid === false || !validScore(m.sa, m.sb)) continue;
    const aWin = m.sa > m.sb;
    [[m.a, m.sa, m.sb, aWin], [m.b, m.sb, m.sa, !aWin]].forEach(([team, f, c, won]) => team.forEach(p => {
      const r = s[p]; if (!r) return;
      r.played++; r.setsFor += f; r.setsAgainst += c;   // juegos a favor / en contra
      if (won) { r.wins++; r.form.push('w'); } else { r.losses++; if (f === 5) { r.tbPts++; r.form.push('t'); } else r.form.push('l'); }
    }));
  }
  const rows = Object.values(s).map(r => ({ ...r, points: r.wins * pts.win + r.tbPts * pts.tb, pct: r.played ? r.wins / r.played : 0 }));
  rows.sort((x, y) => y.points - x.points || y.wins - x.wins || (y.setsFor - y.setsAgainst) - (x.setsFor - x.setsAgainst));
  rows.forEach((r, i) => r.pos = i + 1);
  return rows;
}

/* ---------- API: demo (local) y real (Apps Script) ---------- */
const demoApi = {
  _st() { return LS.get('padel.demo3', JSON.parse(JSON.stringify(DEMO))); },
  _out(st) { return { players: st.players, pts: st.pts, matches: st.matches, faultLog: st.faultLog }; },
  async get() { return this._out(this._st()); },
  async add(m) {
    const st = this._st(), row = Math.max(5, ...st.matches.map(x => x.row)) + 1;
    st.matches.push({ row, date: m.date, a: m.a, b: m.b, sa: m.sa, sb: m.sb });
    LS.set('padel.demo3', st); return { row, data: this._out(st) };
  },
  async del(row) { const st = this._st(); st.matches = st.matches.filter(x => x.row !== row); LS.set('padel.demo3', st); return { data: this._out(st) }; },
  async fault(name, delta, date) {
    const st = this._st();
    if (delta > 0) st.faultLog.push({ id: Math.max(0, ...st.faultLog.map(f => f.id)) + 1, date, name, paid: '' });
    else {
      const mine = st.faultLog.filter(f => f.name === name && !f.paid);
      if (!mine.length) throw new Error('No tiene faltas pendientes que quitar');
      const last = mine[mine.length - 1].id; st.faultLog = st.faultLog.filter(f => f.id !== last);
    }
    LS.set('padel.demo3', st); return { data: this._out(st) };
  },
  async pay(name, undo, date) {
    const st = this._st();
    if (undo) { const p = st.faultLog.filter(f => f.name === name && f.paid).pop(); if (p) p.paid = ''; }
    else { const p = st.faultLog.find(f => f.name === name && !f.paid); if (!p) throw new Error('No debe ninguna caña'); p.paid = date; }
    LS.set('padel.demo3', st); return { data: this._out(st) };
  }
};

const apiUrl = () => LS.get('padel.api', '') || CFG.API_URL || '';
const isDemo = () => !apiUrl();
async function request(method, body) {
  const key = CFG.KEY || '';
  let res;
  if (method === 'GET') res = await fetch(`${apiUrl()}?action=get&key=${encodeURIComponent(key)}`);
  else res = await fetch(apiUrl(), { method: 'POST', body: JSON.stringify({ ...body, key }) }); // text/plain: sin preflight CORS
  let j;
  try { j = await res.json(); } catch { throw new Error('El script no respondió bien. Revisa que esté publicado para «Cualquier persona».'); }
  if (j.error) throw new Error(j.error);
  return j;
}
const realApi = {
  get: () => request('GET'),
  add: m => request('POST', { action: 'add', ...m }),
  del: (row, s) => request('POST', { action: 'delete', row, sig: s }),
  fault: (name, delta, date) => request('POST', { action: 'fault', name, delta, date }),
  pay: (name, undo, date) => request('POST', { action: 'pay', name, undo, date })
};
const api = () => (isDemo() ? demoApi : realApi);

/* ---------- estado ---------- */
const fin = d => {
  d.faultLog = d.faultLog || [];
  d.standings = computeStandings(d.players, d.matches, d.pts);
  d.faults = d.players.map(n => {
    const mine = d.faultLog.filter(f => f.name === n), paid = mine.filter(f => f.paid).length;
    return { name: n, count: mine.length, paid, pending: mine.length - paid };
  });
  return d;
};
const S = {
  tab: LS.get('padel.tab', 'apuntar'),
  data: LS.get('padel.cache', null),
  loading: false, saving: false,
  draft: { date: todayISO(), pairing: null, res: null },   // res: {win:'A'|'B', lost:0..5}
  rep: { preset: 'all', from: '', to: '' },
  queue: LS.get('padel.queue', []),
  conn: { state: 'checking', msg: '' }
};
if (S.data) fin(S.data);
const saveQueue = () => LS.set('padel.queue', S.queue);
const cache = () => LS.set('padel.cache', S.data);
const isNetErr = e => e instanceof TypeError;

/* ---------- helpers de vista ---------- */
const idx = n => Math.max(0, (S.data?.players || []).indexOf(n)) % 4;
const av = (n, small) => `<span class="av c${idx(n)} ${small ? 's' : ''}">${esc((n || '?')[0].toUpperCase())}</span>`;
const avs = team => `<span class="avs">${team.map(n => av(n, true)).join('')}</span>`;
const pairings = p => [[[p[0], p[1]], [p[2], p[3]]], [[p[0], p[2]], [p[1], p[3]]], [[p[0], p[3]], [p[1], p[2]]]];
const names = t => t.join(' y ');
const skeleton = () => `<div class="skel"></div><div class="skel"></div><div class="skel"></div>`;

function currentMatch() {
  const d = S.draft; if (d.pairing === null || !d.res || !S.data) return null;
  const [a, b] = pairings(S.data.players)[d.pairing];
  return { date: d.date, a, b, sa: d.res.win === 'A' ? 6 : d.res.lost, sb: d.res.win === 'B' ? 6 : d.res.lost };
}

/* ---------- pantallas ---------- */
function viewApuntar() {
  const d = S.data, dr = S.draft;
  if (!d) return skeleton();
  const P = pairings(d.players);
  const [A, B] = dr.pairing === null ? [[], []] : P[dr.pairing];
  const m = currentMatch(), { win, tb } = d.pts;
  let summary = '';
  if (m) {
    const aw = m.sa > m.sb, W = aw ? m.a : m.b, L = aw ? m.b : m.a, lost = Math.min(m.sa, m.sb);
    summary = `<div class="summary"><b>${esc(names(W))}</b> ganan 6–${lost} · +${win} puntos cada una<br>
      ${esc(names(L))} · ${lost === 5 ? `+${tb} punto (tie-break)` : '0 puntos'}</div>`;
  }
  const chip = (who, l) => `<button class="sc ${dr.res && dr.res.win === who && dr.res.lost === l ? 'on' : ''}" data-act="res" data-win="${who}" data-lost="${l}">${l}${l === 5 ? '<small>tie-break</small>' : ''}</button>`;
  const grid = who => `<div class="games">${[0, 1, 2, 3, 4, 5].map(l => chip(who, l)).join('')}</div>`;
  return `
    <h1>Nuevo set</h1>
    <p class="sub">Tres toques y listo.</p>
    <label class="date"><span>${ICON.cal} Fecha</span><input type="date" id="date" value="${esc(dr.date)}"></label>

    <h3>Parejas</h3>
    ${P.map(([a, b], i) => `
      <button class="pair-card ${dr.pairing === i ? 'on' : ''}" data-act="pair" data-i="${i}">
        <div class="vs">
          <div class="team">${avs(a)}<span>${esc(a[0])} + ${esc(a[1])}</span></div><b>VS</b>
          <div class="team">${avs(b)}<span>${esc(b[0])} + ${esc(b[1])}</span></div>
        </div>
      </button>`).join('')}

    <h3>Ganadoras y juegos de las rivales</h3>
    ${dr.pairing === null ? `<p class="sub">Elige primero las parejas.</p>` : `
      <div class="res-title">Ganan <em>${esc(names(A))}</em> · 6 a…</div>${grid('A')}
      <div class="res-title" style="margin-top:16px">Ganan <em>${esc(names(B))}</em> · 6 a…</div>${grid('B')}`}
    ${summary}
    <button class="btn lime save" data-act="save" ${m && !S.saving ? '' : 'disabled'}>${S.saving ? 'Guardando…' : 'Guardar set'}</button>`;
}

const formDots = f => `<span class="form" title="Últimos sets">${f.slice(-5).map(x => `<i class="${x}"></i>`).join('')}</span>`;

const mug = (cls) => `<span class="${cls}">${I('<path d="M5 8h10v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8Z" fill="currentColor" fill-opacity=".9"/><path d="M15 10h2a2 2 0 0 1 0 6h-2"/>', 20)}</span>`;

function podium(st) {
  const [f, s2, t] = st, h = { 1: 150, 2: 112, 3: 96 };
  const col = (r, n) => `<div class="pod p${n}">${n === 1 ? `<span class="crown">${ICON.crown}</span>` : ''}${av(r.name)}<span class="nm">${esc(r.name)}</span>
    <div class="blk" style="height:${h[n]}px"><b>${r.points}</b><span>PTS</span><i class="rk">${n}º</i></div></div>`;
  return `<div class="podium">${col(s2, 2)}${col(f, 1)}${col(t, 3)}</div>`;
}

function viewTabla() {
  const d = S.data; if (!d) return skeleton();
  const st = d.standings, valid = d.matches.filter(m => m.valid !== false);
  const last = valid.map(m => m.date).sort().pop();
  const max = Math.max(1, ...st.map(r => r.points));
  const log = [...d.faultLog].reverse();
  const pend = d.faults.reduce((a, f) => a + f.pending, 0), paid = d.faults.reduce((a, f) => a + f.paid, 0);
  return `
    <h1>Clasificación</h1>
    ${valid.length && st.length >= 3 ? podium(st) : ''}
    <ol class="rank">${st.map((r, i) => `
      <li style="--c:var(--c${idx(r.name)});--i:${i}">
        <span class="pos">${r.pos}</span>${av(r.name)}
        <div><span class="nm">${esc(r.name)}</span>
          <span class="st">${r.wins} G · ${r.losses} P · juegos ${r.setsFor}–${r.setsAgainst}</span></div>
        <div class="pt">${r.points}<small>PTS</small></div>
        <div class="bar"><i style="width:${Math.round(r.points / max * 100)}%"></i></div>
        <div class="formrow">${formDots(r.form)}<span>${r.form.length ? 'últimos sets' : 'sin sets'}</span></div>
      </li>`).join('')}</ol>
    <div class="stats">
      <div class="stat"><b>${valid.length}</b><span>sets jugados</span></div>
      <div class="stat"><b>${last ? fmtTiny(last) : '–'}</b><span>último día</span></div>
    </div>

    <h3>Cervezas por dobles faltas</h3>
    <div class="beer-sum">
      <div><b>${pend}</b><span>por pagar</span></div>
      <div><b>${paid}</b><span>pagadas</span></div>
      <div><b>${pend + paid}</b><span>dobles faltas</span></div>
    </div>
    <div class="faults">${d.faults.map(f => `
      <div class="fault">
        <div class="f-top">${av(f.name)}
          <span class="nm">${esc(f.name)}<small class="${f.pending ? 'due' : ''}">${f.pending ? `debe ${f.pending} cerveza${f.pending > 1 ? 's' : ''}` : 'al día'} · ${f.paid} pagada${f.paid === 1 ? '' : 's'}</small></span>
          <div class="stepper">
            <button class="step" data-act="fault" data-n="${esc(f.name)}" data-d="-1" aria-label="Quitar la última doble falta">−</button>
            <span class="n">${f.count}</span>
            <button class="step plus" data-act="fault" data-n="${esc(f.name)}" data-d="1" aria-label="Sumar una doble falta">+</button>
          </div>
        </div>
        <div class="f-bot">
          <div class="mugs">${f.count ? Array.from({ length: Math.min(f.count, 10) }, (_, i) => mug(i < f.paid ? 'paid' : 'due')).join('') + (f.count > 10 ? `<em>+${f.count - 10}</em>` : '') : '<em>Sin dobles faltas</em>'}</div>
          <button class="pay" data-act="pay" data-n="${esc(f.name)}" ${f.pending ? '' : 'disabled'}>${ICON.check} Ha pagado</button>
        </div>
      </div>`).join('')}</div>
    <details class="log"><summary>Registro de dobles faltas <b>${log.length}</b></summary>
      ${log.length ? `<ul>${log.map(f => `<li>${av(f.name, true)}<span class="w">${esc(f.name)}<small>${f.date ? esc(fmtMed(f.date)) : 'Antes de la app'}</small></span>
        ${f.paid ? `<span class="tag ok">Pagada${f.paid === '1' ? '' : ' · ' + esc(fmtTiny(f.paid))}</span>` : `<span class="tag due">Debe</span>`}</li>`).join('')}</ul>` : `<p class="sub" style="padding:8px 4px">Todavía no hay ninguna.</p>`}
    </details>`;
}

function viewHistorial() {
  const d = S.data; if (!d) return skeleton();
  const ms = [...d.matches].sort((x, y) => (y.date || '').localeCompare(x.date || '') || y.row - x.row);
  if (!ms.length) return `<h1>Sets</h1><div class="empty">Todavía no hay sets.<br>Apunta el primero en la pestaña «Apuntar».</div>`;
  let out = `<h1>Sets</h1>`, day = null;
  for (const m of ms) {
    if (m.date !== day) { day = m.date; out += `<div class="day">${esc(m.date ? fmtDate(m.date) : 'Sin fecha')}</div>`; }
    const aw = m.sa > m.sb, ok = m.valid !== false, tbm = ok && Math.min(m.sa, m.sb) === 5;
    out += `<div class="match ${ok ? '' : 'bad'}">
      <div class="side ${ok && aw ? 'win' : ''}">${avs(m.a)}<span>${esc(m.a.join(' · '))}</span></div>
      <div class="score"><span class="${ok && aw ? 'w' : ''}">${m.sa ?? ''}</span><em>–</em><span class="${ok && !aw ? 'w' : ''}">${m.sb ?? ''}</span>${tbm ? '<small>tie-break</small>' : ''}</div>
      <div class="side r ${ok && !aw ? 'win' : ''}">${avs(m.b)}<span>${esc(m.b.join(' · '))}</span></div>
      <button class="del" data-act="del" data-row="${m.row}" aria-label="Borrar set">${ICON.trash}</button>
      ${ok ? '' : `<div class="ctl">⚠ ${esc(m.control || 'Revisa este set en el Excel')}</div>`}
    </div>`;
  }
  return out;
}

/* ---------- informe imprimible ---------- */
function repRange() {
  const r = S.rep, t = todayISO();
  if (r.preset === 'all') return { from: '', to: '' };
  if (r.preset === 'month') return { from: t.slice(0, 8) + '01', to: t };
  if (r.preset === '30') { const x = new Date(); x.setDate(x.getDate() - 29); return { from: iso(x), to: t }; }
  return { from: r.from || '', to: r.to || '' };
}
const inRange = (date, { from, to }) => date ? (!from || date >= from) && (!to || date <= to) : !from && !to;

function viewInforme() {
  const d = S.data; if (!d) return skeleton();
  const rg = repRange(), r = S.rep;
  const ms = d.matches.filter(m => m.valid !== false && inRange(m.date, rg)).sort((x, y) => (x.date || '').localeCompare(y.date || '') || x.row - y.row);
  const st = computeStandings(d.players, ms, d.pts);
  const flog = d.faultLog.filter(f => inRange(f.date, rg));
  const dates = ms.map(m => m.date).filter(Boolean);
  const from = rg.from || dates[0], to = rg.to || dates[dates.length - 1] || todayISO();
  const days = new Set(dates).size;
  const chips = [['all', 'Todo'], ['month', 'Este mes'], ['30', '30 días']].map(([k, l]) => `<button class="chip ${r.preset === k ? 'on' : ''}" data-act="preset" data-p="${k}">${l}</button>`).join('');
  const faultsBy = n => flog.filter(f => f.name === n);
  let lastDay = null;
  return `
    <h1>Informe</h1>
    <p class="sub">Elige el periodo y guarda el informe en PDF.</p>
    <div class="no-print">
      <div class="chips">${chips}</div>
      <div class="range">
        <label>Desde<input type="date" id="rfrom" value="${esc(rg.from)}"></label>
        <label>Hasta<input type="date" id="rto" value="${esc(rg.to)}"></label>
      </div>
      <button class="btn lime save" data-act="print" style="margin-top:12px">${ICON.print} Imprimir / guardar PDF</button>
    </div>

    <article class="paper">
      <header class="p-head">
        <div><span class="p-brand">PADELURDAS</span><h2>Informe del periodo</h2></div>
        <div class="p-per"><b>${from ? esc(fmtMed(from)) : '–'}</b> a <b>${esc(fmtMed(to))}</b><span>${ms.length} sets · ${days} día${days === 1 ? '' : 's'} de juego</span></div>
      </header>

      <h4>Clasificación del periodo</h4>
      <div class="tw"><table>
        <thead><tr><th>#</th><th class="l">Jugadora</th><th>Sets</th><th>G</th><th>P</th><th>%</th><th>Juegos</th><th>Pts</th><th>Dobles faltas</th></tr></thead>
        <tbody>${st.map(x => `<tr><td>${x.pos}</td><td class="l"><b>${esc(x.name)}</b></td><td>${x.played}</td><td>${x.wins}</td><td>${x.losses}</td><td>${Math.round(x.pct * 100)}%</td><td>${x.setsFor}–${x.setsAgainst}</td><td><b>${x.points}</b></td><td>${faultsBy(x.name).length}</td></tr>`).join('')}</tbody>
      </table></div>
      <p class="p-note">G = sets ganados · P = sets perdidos · Pts: ${d.pts.win} por set ganado y ${d.pts.tb} si se pierde 5–6 (tie-break).</p>

      <h4>Sets jugados</h4>
      ${ms.length ? `<div class="tw"><table class="sets">
        <thead><tr><th class="l">Día</th><th class="l">Pareja A</th><th>Res.</th><th class="l">Pareja B</th></tr></thead>
        <tbody>${ms.map(m => { const aw = m.sa > m.sb, nd = m.date !== lastDay; lastDay = m.date;
          return `<tr class="${nd ? 'nd' : ''}"><td class="l">${nd ? esc(m.date ? fmtTiny(m.date) : '–') : ''}</td><td class="l ${aw ? 'w' : ''}">${esc(m.a.join(' y '))}</td><td><b>${m.sa}–${m.sb}</b></td><td class="l ${aw ? '' : 'w'}">${esc(m.b.join(' y '))}</td></tr>`; }).join('')}</tbody>
      </table></div>` : `<p class="p-note">No hay sets en este periodo.</p>`}

      <h4>Dobles faltas y cervezas</h4>
      <div class="tw"><table>
        <thead><tr><th class="l">Jugadora</th><th>Faltas</th><th>Pagadas</th><th>Pendientes</th><th class="l">Fechas</th></tr></thead>
        <tbody>${d.players.map(n => { const f = faultsBy(n), p = f.filter(x => x.paid).length; return `<tr><td class="l"><b>${esc(n)}</b></td><td><b>${f.length}</b></td><td>${p}</td><td><b>${f.length - p}</b></td><td class="l dts">${f.length ? f.map(x => x.date ? esc(fmtTiny(x.date)) : 'antes').join(', ') : '–'}</td></tr>`; }).join('')}</tbody>
      </table></div>
      <footer class="p-foot">Generado el ${esc(fmtMed(todayISO()))}</footer>
    </article>`;
}

/* ---------- render ---------- */
function render() {
  const v = $('#view');
  v.innerHTML = { apuntar: viewApuntar, tabla: viewTabla, historial: viewHistorial, informe: viewInforme }[S.tab]();
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === S.tab));
  const pill = $('#sync'), q = S.queue.length;
  pill.hidden = !(q || S.loading);
  pill.className = 'pill' + (q ? ' warn' : '');
  pill.textContent = q ? `${q} pendiente${q > 1 ? 's' : ''}` : 'Sincronizando…';
  const c = $('#conn'), cs = S.conn.state;
  c.className = 'conn ' + cs;
  c.querySelector('span').textContent = { demo: 'Demo', checking: 'Conectando…', ok: 'Excel conectado', error: 'Sin conexión' }[cs];
  const b = $('#banner');
  b.hidden = cs === 'ok' || cs === 'checking';
  b.className = 'banner' + (cs === 'error' ? ' bad' : '');
  b.textContent = cs === 'demo'
    ? (CFG.API_URL ? 'Modo demo aunque hay URL en config.js: abre Ajustes y pulsa «Forzar actualización».' : 'Modo demo: datos de prueba. Conecta tu Excel desde Ajustes.')
    : cs === 'error' ? 'No se pudo leer el Excel: ' + S.conn.msg : '';
}

function burst() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  try { navigator.vibrate && navigator.vibrate(18); } catch {}
  for (let i = 0; i < 16; i++) {
    const e = document.createElement('i'), ang = Math.random() * Math.PI * 2, dist = 90 + Math.random() * 120;
    e.className = 'conf'; e.style.setProperty('--dx', Math.cos(ang) * dist + 'px'); e.style.setProperty('--dy', Math.sin(ang) * dist - 60 + 'px');
    e.style.background = ['#d9f74a', '#ffb23e', '#5ec8ff', '#c79bff', '#ff8a4c'][i % 5];
    document.body.appendChild(e); setTimeout(() => e.remove(), 950);
  }
}

let toastT;
function toast(msg, opts = {}) {
  const t = $('#toast');
  t.className = 'toast' + (opts.err ? ' err' : '');
  t.innerHTML = `<span>${esc(msg)}</span>${opts.undo ? '<button data-act="undo">Deshacer</button>' : ''}`;
  t.hidden = false; S.undo = opts.undo || null;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; S.undo = null; }, opts.undo ? 7000 : 3500);
}

/* ---------- acciones ---------- */
async function load(quiet) {
  S.loading = !quiet;
  S.conn = isDemo() ? { state: 'demo', msg: '' } : { state: S.conn.state === 'ok' ? 'ok' : 'checking', msg: '' };
  render();
  try {
    S.data = fin(await api().get()); cache();
    if (S.data.sheetUrl) LS.set('padel.sheet', S.data.sheetUrl);
    if (!isDemo()) S.conn = { state: 'ok', msg: '' };
  } catch (e) {
    S.conn = { state: 'error', msg: isNetErr(e) ? 'no se llega al script (revisa la URL y que el acceso sea «Cualquier persona»)' : e.message };
    if (!S.data) toast(S.conn.msg, { err: true });
  }
  S.loading = false; render();
}
function resetDraft() { S.draft = { date: S.draft.date, pairing: null, res: null }; }

async function save() {
  const m = currentMatch(); if (!m || S.saving) return;
  m.id = uid(); S.saving = true; render();
  try {
    const r = await api().add(m);
    S.data = fin(r.data); cache(); resetDraft(); S.saving = false; render(); burst();
    toast('Set guardado', { undo: async () => {
      try { const x = await api().del(r.row, sig(m)); S.data = fin(x.data); cache(); render(); toast('Set deshecho'); }
      catch (e) { toast(e.message, { err: true }); }
    } });
  } catch (e) {
    S.saving = false;
    if (isNetErr(e)) { S.queue.push(m); saveQueue(); resetDraft(); render(); toast('Sin conexión: se enviará solo al volver'); }
    else { render(); toast(e.message, { err: true }); }
  }
}

let flushing = false;
async function flush() {
  if (flushing || !S.queue.length || isDemo()) return;
  flushing = true;
  try {
    while (S.queue.length) { const r = await realApi.add(S.queue[0]); S.queue.shift(); saveQueue(); S.data = fin(r.data); cache(); }
    toast('Sets pendientes enviados');
  } catch (e) { if (!isNetErr(e)) toast(e.message, { err: true }); }
  flushing = false; render();
}

async function mutate(fn, okMsg) {
  try { const r = await fn(); S.data = fin(r.data); cache(); render(); if (okMsg) toast(okMsg); return true; }
  catch (e) { toast(isNetErr(e) ? 'Necesitas conexión para esto' : e.message, { err: true }); return false; }
}

document.addEventListener('click', ev => {
  const tab = ev.target.closest('[data-tab]');
  if (tab) { S.tab = tab.dataset.tab; LS.set('padel.tab', S.tab); render(); scrollTo(0, 0); return; }
  const el = ev.target.closest('[data-act]'); if (!el) return;
  const a = el.dataset.act;
  if (a === 'pair') { S.draft.pairing = +el.dataset.i; render(); }
  else if (a === 'res') { S.draft.res = { win: el.dataset.win, lost: +el.dataset.lost }; render(); }
  else if (a === 'save') save();
  else if (a === 'undo') { const f = S.undo; $('#toast').hidden = true; f && f(); }
  else if (a === 'refresh') { load(); flush(); }
  else if (a === 'fault') {
    const det = $('.log'), open = det && det.open;
    mutate(() => api().fault(el.dataset.n, +el.dataset.d, todayISO())).then(() => { if (open) { const x = $('.log'); if (x) x.open = true; } });
  }
  else if (a === 'pay') {
    const n = el.dataset.n;
    mutate(() => api().pay(n, false, todayISO())).then(ok => { if (!ok) return; burst(); toast(`${n} ha pagado una cerveza`, { undo: () => mutate(() => api().pay(n, true, todayISO()), 'Pago deshecho') }); });
  }
  else if (a === 'del') {
    const m = S.data.matches.find(x => String(x.row) === el.dataset.row); if (!m) return;
    if (confirm(`¿Borrar este set?\n${m.a.join(' y ')} ${m.sa}–${m.sb} ${m.b.join(' y ')}`)) mutate(() => api().del(m.row, sig(m)), 'Set borrado');
  }
  else if (a === 'preset') { S.rep = { preset: el.dataset.p, from: '', to: '' }; render(); }
  else if (a === 'print') { try { window.print(); } catch { toast('Usa Compartir → Imprimir de tu navegador', { err: true }); } }
  else if (a === 'settings') openSettings();
  else if (a === 'hard') hardRefresh();
  else if (a === 'connect') connect();
  else if (a === 'demo') { LS.del('padel.api'); LS.del('padel.cache'); S.data = null; $('#settings').close(); load(); }
});
document.addEventListener('change', ev => {
  const id = ev.target.id;
  if (id === 'date') S.draft.date = ev.target.value || todayISO();
  else if (id === 'rfrom' || id === 'rto') {
    const cur = repRange();
    S.rep = { preset: 'custom', from: id === 'rfrom' ? ev.target.value : cur.from, to: id === 'rto' ? ev.target.value : cur.to };
    render();
  }
});

async function hardRefresh() {
  try { const rs = await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map(r => r.unregister())); } catch {}
  try { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); } catch {}
  location.reload();
}

function openSettings() {
  const dlg = $('#settings');
  $('#apiurl').value = LS.get('padel.api', '') || CFG.API_URL || '';
  const cur = apiUrl(), src = LS.get('padel.api', '') ? 'guardada en este móvil' : 'de config.js';
  $('#setmsg').innerHTML = esc(({ demo: 'Estado: modo demo (sin URL).', checking: 'Estado: conectando…', ok: 'Estado: conectado con tu Excel.', error: 'Estado: error · ' + S.conn.msg }[S.conn.state])) +
    (cur ? `<br>URL ${src}: …${esc(cur.slice(-22))}` : '') + `<br>Versión de la app: ${VERSION}`;
  $('#setmsg').className = 'hint' + (S.conn.state === 'error' ? ' err' : S.conn.state === 'ok' ? ' ok' : '');
  const link = $('#sheetlink'), url = LS.get('padel.sheet', '');
  link.hidden = !url; if (url) link.href = url;
  dlg.showModal();
}
async function connect() {
  const url = $('#apiurl').value.trim(), msg = $('#setmsg');
  if (!/^https:\/\/script\.google\.com\/.+\/exec/.test(url)) { msg.textContent = 'La URL debe empezar por https://script.google.com y terminar en /exec'; msg.className = 'hint err'; return; }
  msg.textContent = 'Probando…'; msg.className = 'hint';
  const old = LS.get('padel.api', '');
  LS.set('padel.api', url);
  try {
    const data = await realApi.get();
    S.data = fin(data); cache(); if (data.sheetUrl) LS.set('padel.sheet', data.sheetUrl);
    S.conn = { state: 'ok', msg: '' }; msg.textContent = '¡Conectado!'; msg.className = 'hint ok'; render();
    setTimeout(() => $('#settings').close(), 700);
  } catch (e) {
    old ? LS.set('padel.api', old) : LS.del('padel.api');
    msg.textContent = isNetErr(e) ? 'No se puede conectar. Revisa la URL y tu conexión.' : e.message; msg.className = 'hint err';
  }
}

/* ---------- arranque ---------- */
$('[data-act=refresh]').innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg>`;
$('.icon-btn[data-act=settings]').innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>`;
const tabIcons = { apuntar: 'plus', tabla: 'trophy', historial: 'list', informe: 'doc' };
document.querySelectorAll('.tabs button').forEach(b => { $('i', b).innerHTML = ICON[tabIcons[b.dataset.tab]]; });
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
window.addEventListener('online', () => { flush(); load(true); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.data) load(true); });
render(); load().then(flush);
})();
