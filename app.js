(() => {
'use strict';
const CFG = window.PADELURDAS_CONFIG || {};
const VERSION = '15-nov-k';

/* altura real de la pantalla (iOS/Android): evita huecos bajo la barra */
function fitApp() {
  let h = Math.round(window.innerHeight);
  /* iPhone instalada: iOS a veces da una altura más corta que la pantalla (deja un hueco abajo) */
  const standalone = navigator.standalone || (matchMedia && matchMedia('(display-mode: standalone)').matches);
  if (standalone && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
    const sh = window.innerWidth <= window.innerHeight ? screen.height : screen.width;
    if (sh > h && sh - h <= 130) h = sh;
  }
  document.documentElement.style.setProperty('--app-h', h + 'px');
}
fitApp();
['resize', 'orientationchange', 'pageshow', 'focus'].forEach(e => window.addEventListener(e, () => { fitApp(); setTimeout(fitApp, 250); }));
window.visualViewport && window.visualViewport.addEventListener('resize', fitApp);

/* ---------- utilidades ---------- */
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} }
};
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const iso = d => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
const todayISO = () => iso(new Date());
const parts = s => s.split('-').map(Number);
const fmtDate = s => { const [y, m, d] = parts(s); return new Date(y, m - 1, d).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }); };
const fmtMed = s => { const [y, m, d] = parts(s); return new Date(y, m - 1, d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/\./g, ''); };
const fmtTiny = s => { const [y, m, d] = parts(s); return new Date(y, m - 1, d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace(/\./g, ''); };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
const sig = m => [...m.a, ...m.b, m.sa, m.sb].join('|');

const I = (p, w = 22) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const MUG = '<path d="M5 8h10v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8Z" fill="currentColor" fill-opacity=".9"/><path d="M15 10h2a2 2 0 0 1 0 6h-2M8 4c0 1 1 1 1 2M12 4c0 1 1 1 1 2"/>';
const ICON = {
  mug: I(MUG, 22),
  plus: I('<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>'),
  trophy: I('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>'),
  list: I('<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/>'),
  doc: I('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>'),
  crown: I('<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8Z"/>', 18),
  trash: I('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', 18),
  cal: I('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>', 18),
  check: I('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 18),
  undo: I('<path d="M3 7v6h6"/><path d="M3.5 13a9 9 0 1 0 2.6-6.4L3 10"/>', 15),
  print: I('<path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><rect x="7" y="14" width="10" height="7" rx="1"/>', 20)
};

/* ---------- reglas y cálculos ---------- */
const validScore = (x, y) => { const hi = Math.max(x, y), lo = Math.min(x, y); return hi === 6 && lo >= 0 && lo <= 5; };
const okMatch = m => m.valid !== false && validScore(m.sa, m.sb);
const byDate = (x, y) => (x.date || '').localeCompare(y.date || '') || x.row - y.row;

function computeStandings(players, matches, pts) {
  const s = Object.fromEntries(players.map(p => [p, { name: p, played: 0, wins: 0, losses: 0, tbPts: 0, setsFor: 0, setsAgainst: 0, form: [] }]));
  for (const m of [...matches].sort(byDate)) {
    if (!okMatch(m)) continue;
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

function pairStats(matches) {
  const m = {};
  for (const x of matches) {
    if (!okMatch(x)) continue;
    [[x.a, x.sa, x.sb], [x.b, x.sb, x.sa]].forEach(([t, f, c]) => {
      const p = [...t].sort(), k = p.join('|');
      const r = m[k] || (m[k] = { pair: p, played: 0, wins: 0, gf: 0, ga: 0 });
      r.played++; r.gf += f; r.ga += c; if (f > c) r.wins++;
    });
  }
  return Object.values(m).sort((a, b) => b.wins / b.played - a.wins / a.played || b.played - a.played || (b.gf - b.ga) - (a.gf - a.ga));
}

function evolution(d) {
  const ms = d.matches.filter(okMatch).sort(byDate);
  const days = [...new Set(ms.map(x => x.date || ''))];
  const cur = Object.fromEntries(d.players.map(p => [p, 0])), cum = Object.fromEntries(d.players.map(p => [p, [0]]));
  days.forEach(day => {
    ms.filter(x => (x.date || '') === day).forEach(x => {
      const aw = x.sa > x.sb;
      [[x.a, aw, x.sa], [x.b, !aw, x.sb]].forEach(([t, won, f]) => t.forEach(p => { if (cur[p] === undefined) return; if (won) cur[p] += d.pts.win; else if (f === 5) cur[p] += d.pts.tb; }));
    });
    d.players.forEach(p => cum[p].push(cur[p]));
  });
  return { days, cum };
}

/* ---------- operaciones (se aplican al instante en el móvil y luego se envían) ---------- */
function applyOp(d, op) {
  d.faultLog = d.faultLog || [];
  if (op.type === 'add') d.matches.push({ row: op.row, date: op.m.date, a: op.m.a, b: op.m.b, sa: op.m.sa, sb: op.m.sb });
  else if (op.type === 'del') d.matches = d.matches.filter(x => x.row !== op.row);
  else if (op.type === 'fadd') d.faultLog.push({ id: op.fid, date: op.date, name: op.name, paid: '' });
  else if (op.type === 'fdel') d.faultLog = d.faultLog.filter(f => f.id !== op.fid);
  else if (op.type === 'fpay') { const f = d.faultLog.find(x => x.id === op.fid); if (f) f.paid = op.paid; }
  return d;
}
function toPost(op) {
  if (op.type === 'add') return { action: 'add', id: op.id, date: op.m.date, a: op.m.a, b: op.m.b, sa: op.m.sa, sb: op.m.sb };
  if (op.type === 'del') return { action: 'delete', row: op.row, sig: op.sig };
  if (op.type === 'fadd') return { action: 'fadd', fid: op.fid, name: op.name, date: op.date };
  if (op.type === 'fdel') return { action: 'fdel', fid: op.fid };
  return { action: 'fpay', fid: op.fid, paid: op.paid };
}

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
    { id: 'd1', date: '2026-09-17', name: 'Uxue', paid: '2026-10-08' }, { id: 'd2', date: '2026-10-08', name: 'Adela', paid: '' }, { id: 'd3', date: '2026-10-08', name: 'Uxue', paid: '' }
  ]
};

/* ---------- API: demo (local) y real (Apps Script) ---------- */
const demoApi = {
  _st() { return LS.get('padel.demo4', clone(DEMO)); },
  async get() { return this._st(); },
  async exec(op) {
    const st = this._st(); let row = null;
    if (op.type === 'add') { row = Math.max(5, ...st.matches.map(x => x.row)) + 1; applyOp(st, { ...op, row }); }
    else applyOp(st, op);
    LS.set('padel.demo4', st); return { row };
  }
};
const apiUrl = () => LS.get('padel.api', '') || CFG.API_URL || '';
const isDemo = () => !apiUrl();
async function request(method, body, fresh) {
  const key = CFG.KEY || '';
  let res;
  if (method === 'GET') res = await fetch(`${apiUrl()}?action=get&key=${encodeURIComponent(key)}${fresh ? '&fresh=1' : ''}`);
  else res = await fetch(apiUrl(), { method: 'POST', body: JSON.stringify({ ...body, key }) });   // text/plain: sin preflight CORS
  let j;
  try { j = await res.json(); } catch { throw new Error('El script no respondió bien. Revisa que esté publicado para «Cualquier persona».'); }
  if (j.error) throw new Error(j.error);
  return j;
}
const realApi = { get: fresh => request('GET', null, fresh), exec: op => request('POST', toPost(op)) };
const api = () => (isDemo() ? demoApi : realApi);

/* ---------- estado ---------- */
const SHAME = [
  ['👑', 'Doble Falta de Oro', 'La cerveza oficial de la pista corre a su cargo'],
  ['🥈', 'Plata del saque flojo', 'Pisando fuerte el camino hacia el trono'],
  ['🥉', 'Bronce del sudor', 'Sospechosa habitual del saque'],
  ['🛡️', 'Muro de cristal', 'Intocable… de momento']
];
function shameHtml(d) {
  const L = d.faults.slice().sort((a, b) => b.count - a.count);
  const max = L[0] ? L[0].count : 0;
  const head = '';
  if (!max) return head + '<div class="shame"><p class="sub" style="margin:0">🎾 Nadie ha fallado el saque todavía… ¡sospechoso! Se rumorea que alguien está sacando con la mano.</p></div>';
  let pos = 0;
  const rows = L.map((f, i) => {
    if (i && f.count !== L[i - 1].count) pos = i;
    const last = f.count === L[L.length - 1].count && f.count < max;
    const [ico, ttl, quip] = last ? SHAME[3] : SHAME[Math.min(pos, 2)];
    const beers = Array.from({ length: Math.min(f.count, 12) }, (_, k) => `<span class="${k < f.paid ? 'bp' : 'bd'}">${I(MUG, 16)}</span>`).join('');
    return `<li class="${pos === 0 && f.count === max ? 'king' : ''}" style="--i:${i}">
      <span class="sh-ico">${ico}</span>${av(f.name)}
      <div class="sh-t"><b>${esc(f.name)}</b><small>${ttl} · ${quip}</small><div class="sh-beers">${beers}${f.count > 12 ? `<em>+${f.count - 12}</em>` : ''}</div></div>
      <div class="sh-n"><b>${f.count}</b><small>${f.count === 1 ? 'doble falta' : 'dobles faltas'}</small><small class="pg">${f.paid} 🍺 pagadas</small></div></li>`;
  }).join('');
  return head + `<ul class="shame">${rows}</ul><p class="sub tip">🍺 llena = ya pagada · 🫗 apagada = pendiente de pagar.</p>`;
}
const fin = d => {
  d.faultLog = d.faultLog || [];
  d.standings = computeStandings(d.players, d.matches, d.pts);
  d.faults = d.players.map(n => {
    const entries = d.faultLog.filter(f => f.name === n), paid = entries.filter(f => f.paid).length;
    return { name: n, count: entries.length, paid, pending: entries.length - paid, entries };
  });
  return d;
};
const S = {
  tab: LS.get('padel.tab', 'apuntar'),
  base: LS.get('padel.base2', null),          // última foto del Excel
  data: null,                                  // foto + cambios pendientes de enviar
  queue: LS.get('padel.q2', []),
  pumping: false, sending: false, offline: false, ver: 0, lastLoad: 0,
  saving: false,
  draft: { date: todayISO(), pairing: null, res: null },
  rep: { preset: 'all', from: '', to: '' },
  filter: '', logOpen: false,
  conn: { state: 'checking', msg: '' }
};
const saveQueue = () => LS.set('padel.q2', S.queue);
const saveBase = () => LS.set('padel.base2', S.base);
const isNetErr = e => e instanceof TypeError;
function rebuild() {
  if (!S.base) { S.data = null; return; }
  const d = clone(S.base); for (const op of S.queue) applyOp(d, op);
  S.data = fin(d);
}
rebuild();

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
    <button class="btn lime save" data-act="save" ${m ? '' : 'disabled'}>Guardar set</button>`;
}

const formDots = f => `<span class="form" title="Últimos sets">${f.slice(-5).map(x => `<i class="${x}"></i>`).join('')}</span>`;

function podium(st) {
  const [f, s2, t] = st, h = { 1: 150, 2: 112, 3: 96 };
  const col = (r, n) => `<div class="pod p${n}">${n === 1 ? `<span class="crown">${ICON.crown}</span>` : ''}${av(r.name)}<span class="nm">${esc(r.name)}</span>
    <div class="blk" style="height:${h[n]}px"><b>${r.points}</b><span>PTS</span><i class="rk">${n}º</i></div></div>`;
  return `<div class="podium">${col(s2, 2)}${col(f, 1)}${col(t, 3)}</div>`;
}

function chartSvg(d) {
  const { days, cum } = evolution(d); if (!days.length) return '';
  const W = 340, H = 180, L = 26, R = 62, T = 12, B = 26, n = days.length;
  const fin_ = d.players.map(p => cum[p][n]);
  const top = Math.max(4, Math.ceil(Math.max(...fin_) / 4) * 4);
  const x = i => L + (W - L - R) * (i / n), y = v => T + (H - T - B) * (1 - v / top);
  const grid = [0, 1, 2, 3, 4].map(k => { const v = top * k / 4; return `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="gl"/><text x="${L - 6}" y="${y(v) + 3.5}" text-anchor="end" class="gt">${Math.round(v)}</text>`; }).join('');
  const step = Math.ceil(n / 4);
  const xl = days.map((dd, i) => ((i + 1) % step === 0 || i === n - 1) ? `<text x="${x(i + 1)}" y="${H - 8}" text-anchor="middle" class="gt">${dd ? esc(fmtTiny(dd)) : ''}</text>` : '').join('');
  const lines = d.players.map(p => `<path d="${cum[p].map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ')}" fill="none" style="stroke:var(--c${idx(p)})" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${x(n)}" cy="${y(cum[p][n])}" r="3.5" style="fill:var(--c${idx(p)})"/>`).join('');
  const lab = d.players.map(p => ({ p, y: y(cum[p][n]) })).sort((a, b) => a.y - b.y);
  lab.forEach((l, i) => { if (i && l.y < lab[i - 1].y + 12) l.y = lab[i - 1].y + 12; });
  const labels = lab.map(l => `<text x="${W - R + 9}" y="${l.y + 4}" class="gn" style="fill:var(--c${idx(l.p)})">${esc(l.p)} ${cum[l.p][n]}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="chartsvg" role="img" aria-label="Evolución de puntos por día de juego">${grid}${xl}${lines}${labels}</svg>`;
}

function mugBtn(e) {
  return `<button class="mug ${e.paid ? 'paid' : 'due'}" data-act="ftoggle" data-id="${esc(e.id)}" title="${e.paid ? 'Pagada · toca para reactivar' : 'Pendiente · toca para marcar como pagada'}" aria-label="${e.paid ? 'Pagada, tocar para reactivar' : 'Pendiente, tocar para marcar como pagada'}">${I(MUG, 22)}</button>`;
}

function viewTabla() {
  const d = S.data; if (!d) return skeleton();
  const st = d.standings, valid = d.matches.filter(okMatch);
  const last = valid.map(m => m.date).sort().pop();
  const max = Math.max(1, ...st.map(r => r.points));
  const log = [...d.faultLog].reverse();
  const pend = d.faults.reduce((a, f) => a + f.pending, 0), paid = d.faults.reduce((a, f) => a + f.paid, 0);
  const pairs = pairStats(d.matches);
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

    ${valid.length ? `<h3>Evolución de puntos</h3><div class="chart">${chartSvg(d)}</div>` : ''}
    ${pairs.length ? `<h3>Mejores parejas</h3><div class="pairs">${pairs.map(p => `
      <div class="pr">${avs(p.pair)}<div class="pn">${esc(p.pair.join(' + '))}<small>${p.played} set${p.played > 1 ? 's' : ''} · ${p.wins} G · ${p.played - p.wins} P · juegos ${p.gf}–${p.ga}</small></div>
        <b>${Math.round(p.wins / p.played * 100)}%</b><div class="bar"><i style="width:${Math.round(p.wins / p.played * 100)}%"></i></div></div>`).join('')}</div>` : ''}

    <button class="rep-link" data-tab="informe">${ICON.doc}<span><b>Informe en PDF</b><small>Sets y estadísticas de un periodo, listo para imprimir</small></span></button>
    <button class="rep-link shame-link" data-tab="verguenza">${I(MUG, 22)}<span><b>Salón de la Vergüenza</b><small>${d.faults.reduce((a, f) => a + f.pending, 0)} cervezas por pagar</small></span></button>`;
}

function viewVerguenza() {
  const d = S.data; if (!d) return skeleton();
  const log = [...d.faultLog].reverse();
  const pend = d.faults.reduce((a, f) => a + f.pending, 0), paid = d.faults.reduce((a, f) => a + f.paid, 0);
  return `
    <h1>Salón de la Vergüenza</h1>
    <p class="sub">Quien falla el saque, paga la ronda. 🍺</p>
    <div class="beer-sum" style="margin-top:14px">
      <div><b>${pend}</b><span>por pagar</span></div>
      <div><b>${paid}</b><span>pagadas</span></div>
      <div><b>${pend + paid}</b><span>dobles faltas</span></div>
    </div>
    <h3>Ranking del vacile</h3>
    ${shameHtml(d)}
    <h3>Apuntar y pagar</h3>
    <p class="sub tip">Toca una jarra para marcarla como pagada o volver a dejarla pendiente.</p>
    <div class="faults">${d.faults.map(f => `
      <div class="fault">
        <div class="f-top">${av(f.name)}
          <span class="nm">${esc(f.name)}<small class="${f.pending ? 'due' : ''}">${f.pending ? `debe ${f.pending} cerveza${f.pending > 1 ? 's' : ''}` : 'al día'} · ${f.paid} pagada${f.paid === 1 ? '' : 's'}</small></span>
          <div class="stepper">
            <button class="step" data-act="fault" data-n="${esc(f.name)}" data-d="-1" aria-label="Quitar la última doble falta pendiente">−</button>
            <span class="n">${f.count}</span>
            <button class="step plus" data-act="fault" data-n="${esc(f.name)}" data-d="1" aria-label="Sumar una doble falta">+</button>
          </div>
        </div>
        <div class="f-bot">
          <div class="mugs">${f.count ? f.entries.slice(-12).map(mugBtn).join('') + (f.count > 12 ? `<em>+${f.count - 12}</em>` : '') : '<em>Sin dobles faltas</em>'}</div>
          <button class="pay" data-act="pay" data-n="${esc(f.name)}" ${f.pending ? '' : 'disabled'}>${ICON.check} Ha pagado</button>
        </div>
      </div>`).join('')}</div>
    <details class="log" ${S.logOpen ? 'open' : ''}><summary>Registro de dobles faltas <b>${log.length}</b></summary>
      ${log.length ? `<ul>${log.map(f => `<li>${av(f.name, true)}<span class="w">${esc(f.name)}<small>${f.date ? esc(fmtMed(f.date)) : 'Antes de la app'}${f.paid && f.paid !== '1' ? ' · pagada el ' + esc(fmtTiny(f.paid)) : ''}</small></span>
        ${f.paid ? `<button class="tag ok" data-act="ftoggle" data-id="${esc(f.id)}">${ICON.undo} Reactivar</button>` : `<button class="tag due" data-act="ftoggle" data-id="${esc(f.id)}">Marcar pagada</button>`}
        <button class="del" data-act="fdel" data-id="${esc(f.id)}" aria-label="Borrar esta doble falta">${ICON.trash}</button></li>`).join('')}</ul>` : `<p class="sub" style="padding:8px 4px">Todavía no hay ninguna.</p>`}
    </details>`;
}

function viewHistorial() {
  const d = S.data; if (!d) return skeleton();
  const f = S.filter;
  const ms = d.matches.filter(m => !f || m.a.includes(f) || m.b.includes(f)).sort((x, y) => byDate(y, x));
  const chips = `<div class="chips">${['', ...d.players].map(p => `<button class="chip ${f === p ? 'on' : ''}" data-act="filter" data-p="${esc(p)}">${p ? esc(p) : 'Todas'}</button>`).join('')}</div>`;
  if (!ms.length) return `<h1>Sets</h1>${chips}<div class="empty">No hay sets${f ? ' de ' + esc(f) : ' todavía'}.<br>Apunta uno en la pestaña «Apuntar».</div>`;
  let out = `<h1>Sets</h1>${chips}`, day = null;
  for (const m of ms) {
    if (m.date !== day) { day = m.date; out += `<div class="day">${esc(m.date ? fmtDate(m.date) : 'Sin fecha')}</div>`; }
    const aw = m.sa > m.sb, ok = m.valid !== false, tbm = ok && Math.min(m.sa, m.sb) === 5;
    const mine = f && (m.a.includes(f) ? aw : !aw);
    out += `<div class="match ${ok ? '' : 'bad'} ${f ? (mine ? 'won' : 'lost') : ''}">
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
  const ms = d.matches.filter(m => m.valid !== false && inRange(m.date, rg)).sort(byDate);
  const st = computeStandings(d.players, ms, d.pts);
  const flog = d.faultLog.filter(f => inRange(f.date, rg));
  const dates = ms.map(m => m.date).filter(Boolean);
  const from = rg.from || dates[0], to = rg.to || dates[dates.length - 1] || todayISO();
  const days = new Set(dates).size;
  const chips = [['all', 'Todo'], ['month', 'Este mes'], ['30', '30 días']].map(([k, l]) => `<button class="chip ${r.preset === k ? 'on' : ''}" data-act="preset" data-p="${k}">${l}</button>`).join('');
  const faultsBy = n => flog.filter(f => f.name === n);
  const pairs = pairStats(ms);
  let lastDay = null;
  return `
    <button class="back no-print" data-tab="tabla">‹ Clasificación</button>
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

      ${pairs.length ? `<h4>Parejas</h4><div class="tw"><table>
        <thead><tr><th class="l">Pareja</th><th>Sets</th><th>G</th><th>P</th><th>%</th><th>Juegos</th></tr></thead>
        <tbody>${pairs.map(p => `<tr><td class="l"><b>${esc(p.pair.join(' + '))}</b></td><td>${p.played}</td><td>${p.wins}</td><td>${p.played - p.wins}</td><td>${Math.round(p.wins / p.played * 100)}%</td><td>${p.gf}–${p.ga}</td></tr>`).join('')}</tbody>
      </table></div>` : ''}

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
  v.innerHTML = '<div class="page">' + ({ apuntar: viewApuntar, tabla: viewTabla, historial: viewHistorial, informe: viewInforme, verguenza: viewVerguenza }[S.tab]()) + '</div>';
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === S.tab || (S.tab === 'informe' && b.dataset.tab === 'tabla')));
  const pill = $('#sync'), q = S.queue.length;
  pill.hidden = !q;
  pill.className = 'pill' + (S.offline ? ' warn' : '');
  pill.textContent = S.offline ? `Sin conexión · ${q} por enviar` : 'Guardando…';
  const c = $('#conn'), cs = S.conn.state;
  c.className = 'conn ' + cs;
  c.querySelector('span').textContent = { demo: 'Demo', checking: 'Conectando…', ok: 'Conectado', error: 'Sin conexión' }[cs];
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

/* ---------- guardar: primero en el móvil, luego se envía en segundo plano ---------- */
function enqueue(op) {
  op.qid = uid(); S.ver++; S.queue.push(op); saveQueue(); rebuild(); render(); pump();
  return op;
}
let retryT;
async function pump() {
  if (S.pumping) return;
  S.pumping = true;
  try {
    while (S.queue.length) {
      const op = S.queue[0]; let r;
      S.sending = true;
      try { r = await api().exec(op); }
      catch (e) {
        S.sending = false;
        if (isNetErr(e)) { S.offline = true; render(); clearTimeout(retryT); retryT = setTimeout(pump, 8000); break; }
        S.queue.shift(); S.ver++; saveQueue();                     // el Excel lo rechazó: se descarta y se vuelve a leer
        toast(e.message, { err: true });
        try { S.base = await api().get(true); saveBase(); } catch {}
        rebuild(); render(); continue;
      }
      S.sending = false; S.offline = false; S.ver++;
      S.queue.shift();
      if (op.type === 'add') {
        if (r.row != null) {
          for (const o of S.queue) if (o.type === 'del' && o.row === op.row) o.row = r.row;   // quien borró el set antes de que llegara
          applyOp(S.base, { ...op, row: r.row }); op.row = r.row;
        }
      } else applyOp(S.base, op);
      if (!isDemo()) S.conn = { state: 'ok', msg: '' };
      saveBase(); saveQueue(); rebuild(); render();
    }
  } finally { S.pumping = false; S.sending = false; render(); }
}

/* ---------- lectura ---------- */
async function load(opts = {}) {
  if (S.queue.length) { pump(); return; }
  const v = S.ver;
  S.conn = isDemo() ? { state: 'demo', msg: '' } : { state: S.conn.state === 'ok' ? 'ok' : 'checking', msg: '' };
  if (!S.base) render();
  try {
    const data = await api().get(!!opts.fresh);
    if (v !== S.ver) return;                                      // mientras tanto se guardó algo: esta lectura ya no vale
    S.base = data; saveBase(); S.lastLoad = Date.now();
    if (data.sheetUrl) LS.set('padel.sheet', data.sheetUrl);
    if (!isDemo()) S.conn = { state: 'ok', msg: '' };
    rebuild();
  } catch (e) {
    S.conn = { state: 'error', msg: isNetErr(e) ? 'no se llega al script (revisa la URL y que el acceso sea «Cualquier persona»)' : e.message };
    if (!S.base) toast(S.conn.msg, { err: true });
  }
  render();
}

/* ---------- acciones ---------- */
function resetDraft() { S.draft = { date: S.draft.date, pairing: null, res: null }; }

function save() {
  const m = currentMatch(); if (!m) return;
  const op = enqueue({ type: 'add', id: uid(), m, row: -Date.now() });
  resetDraft(); render(); burst();
  toast('Set guardado', { undo: () => undoAdd(op) });
}
function undoAdd(op) {
  const i = S.queue.indexOf(op);
  if (i > 0 || (i === 0 && !S.sending)) { S.queue.splice(i, 1); S.ver++; saveQueue(); rebuild(); render(); toast('Set deshecho'); }
  else { enqueue({ type: 'del', row: op.row, sig: sig(op.m) }); toast('Set deshecho'); }
}
function deleteSet(row) {
  const m = S.data.matches.find(x => x.row === row); if (!m) return;
  if (!confirm(`¿Borrar este set?\n${m.a.join(' y ')} ${m.sa}–${m.sb} ${m.b.join(' y ')}`)) return;
  const addOp = S.queue.find(o => o.type === 'add' && o.row === row);
  if (addOp) undoAdd(addOp); else { enqueue({ type: 'del', row, sig: sig(m) }); toast('Set borrado'); }
}

const fault = n => S.data.faults.find(f => f.name === n);
function faultAdd(n) { enqueue({ type: 'fadd', fid: uid(), name: n, date: todayISO() }); }
function faultRemove(n) {
  const e = [...fault(n).entries].reverse().find(x => !x.paid);
  if (!e) return toast('No tiene dobles faltas pendientes que quitar', { err: true });
  enqueue({ type: 'fdel', fid: e.id });
}
function payNext(n) {
  const e = fault(n).entries.find(x => !x.paid); if (!e) return;
  enqueue({ type: 'fpay', fid: e.id, paid: todayISO() }); burst();
  toast(`${n} ha pagado una cerveza`, { undo: () => enqueue({ type: 'fpay', fid: e.id, paid: '' }) });
}
function toggleFault(id) {
  const e = S.data.faultLog.find(f => f.id === id); if (!e) return;
  if (e.paid) { enqueue({ type: 'fpay', fid: id, paid: '' }); toast(`Cerveza de ${e.name} otra vez pendiente`, { undo: () => enqueue({ type: 'fpay', fid: id, paid: e.paid }) }); }
  else { enqueue({ type: 'fpay', fid: id, paid: todayISO() }); burst(); toast(`${e.name} ha pagado una cerveza`, { undo: () => enqueue({ type: 'fpay', fid: id, paid: '' }) }); }
}
function deleteFault(id) {
  const e = S.data.faultLog.find(f => f.id === id); if (!e) return;
  if (confirm(`¿Borrar esta doble falta de ${e.name}?`)) enqueue({ type: 'fdel', fid: id });
}

document.addEventListener('click', ev => {
  const tab = ev.target.closest('[data-tab]');
  if (tab) { S.tab = tab.dataset.tab; LS.set('padel.tab', S.tab); render(); $('#view').scrollTo(0, 0); return; }
  const el = ev.target.closest('[data-act]'); if (!el) return;
  const a = el.dataset.act;
  if (a === 'pair') { S.draft.pairing = +el.dataset.i; render(); }
  else if (a === 'res') { S.draft.res = { win: el.dataset.win, lost: +el.dataset.lost }; render(); }
  else if (a === 'save') save();
  else if (a === 'undo') { const f = S.undo; $('#toast').hidden = true; f && f(); }
  else if (a === 'refresh') { load({ fresh: true }); toast('Actualizando…'); }
  else if (a === 'fault') +el.dataset.d > 0 ? faultAdd(el.dataset.n) : faultRemove(el.dataset.n);
  else if (a === 'pay') payNext(el.dataset.n);
  else if (a === 'ftoggle') toggleFault(el.dataset.id);
  else if (a === 'fdel') deleteFault(el.dataset.id);
  else if (a === 'del') deleteSet(+el.dataset.row);
  else if (a === 'filter') { S.filter = el.dataset.p; render(); }
  else if (a === 'preset') { S.rep = { preset: el.dataset.p, from: '', to: '' }; render(); }
  else if (a === 'print') { try { window.print(); } catch { toast('Usa Compartir → Imprimir de tu navegador', { err: true }); } }
  else if (a === 'theme') setTheme(el.dataset.t);
  else if (a === 'theme-next') setTheme(resolvedTheme() === 'dark' ? 'light' : 'dark');
  else if (a === 'settings') openSettings();
  else if (a === 'connect') connect();
  else if (a === 'hard') hardRefresh();
  else if (a === 'install') installApp();
  else if (a === 'install-x') { LS.set('padel.noinst', 1); updateInstall(); }
  else if (a === 'demo') { LS.del('padel.api'); LS.del('padel.base2'); S.base = null; S.queue = []; saveQueue(); rebuild(); $('#settings').close(); load(); }
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
document.addEventListener('toggle', ev => { if (ev.target.classList && ev.target.classList.contains('log')) S.logOpen = ev.target.open; }, true);

async function hardRefresh() {
  try { const rs = await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map(r => r.unregister())); } catch {}
  try { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); } catch {}
  location.reload();
}

const SUN = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const MOON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
const themePref = () => LS.get('padel.theme', 'light');
const resolvedTheme = () => { const t = themePref(); return t === 'auto' ? (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light') : t; };
function applyTheme() {
  const t = themePref(), r = resolvedTheme();
  if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = r === 'dark' ? '#07140f' : '#15492c';
  const b = $('#themebtn'); if (b) b.innerHTML = r === 'dark' ? SUN : MOON;
  document.querySelectorAll('#seg button').forEach(x => x.classList.toggle('on', x.dataset.t === t));
}
function setTheme(t) { LS.set('padel.theme', t); applyTheme(); }
matchMedia('(prefers-color-scheme:dark)').addEventListener?.('change', applyTheme);

function openSettings() {
  applyTheme();
  const dlg = $('#settings');
  $('#apiurl').value = LS.get('padel.api', '') || CFG.API_URL || '';
  const cur = apiUrl(), src = LS.get('padel.api', '') ? 'guardada en este móvil' : 'de config.js';
  $('#setmsg').innerHTML = esc(({ demo: 'Estado: modo demo (sin URL).', checking: 'Estado: conectando…', ok: 'Estado: conectado con tu Excel.', error: 'Estado: error · ' + S.conn.msg }[S.conn.state])) +
    (cur ? `<br>URL ${src}: …${esc(cur.slice(-22))}` : '') + `<br>Versión de la app: ${VERSION}` + (S.queue.length ? `<br>Cambios por enviar: ${S.queue.length}` : '');
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
    const data = await realApi.get(true);
    S.base = data; saveBase(); if (data.sheetUrl) LS.set('padel.sheet', data.sheetUrl);
    S.conn = { state: 'ok', msg: '' }; rebuild(); msg.textContent = '¡Conectado!'; msg.className = 'hint ok'; render();
    setTimeout(() => $('#settings').close(), 700);
  } catch (e) {
    old ? LS.set('padel.api', old) : LS.del('padel.api');
    msg.textContent = isNetErr(e) ? 'No se puede conectar. Revisa la URL y tu conexión.' : e.message; msg.className = 'hint err';
  }
}

/* ---------- instalar la app ---------- */
let deferred = null;
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function updateInstall() { $('#install').hidden = standalone() || !!LS.get('padel.noinst', 0); }
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; });
window.addEventListener('appinstalled', () => { deferred = null; LS.set('padel.noinst', 1); updateInstall(); toast('App instalada'); });
async function installApp() {
  if (deferred) { deferred.prompt(); try { await deferred.userChoice; } catch {} deferred = null; return; }
  $('#howto-body').innerHTML = isIOS()
    ? `<ol><li>Abre esta página en <b>Safari</b> (no en otro navegador).</li><li>Toca el botón <b>Compartir</b> (el cuadrado con la flecha hacia arriba).</li><li>Elige <b>«Añadir a pantalla de inicio»</b>.</li><li>Toca <b>Añadir</b>. Ya tienes el icono de la pelota.</li></ol>`
    : `<ol><li>Abre esta página en <b>Chrome</b>.</li><li>Toca el menú <b>⋮</b> (arriba a la derecha).</li><li>Elige <b>«Instalar aplicación»</b> o <b>«Añadir a pantalla de inicio»</b>.</li><li>Confirma. Ya tienes el icono de la pelota.</li></ol>`;
  $('#howto').showModal();
}

/* ---------- arranque ---------- */
$('[data-act=refresh]').innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg>`;
applyTheme();
$('.icon-btn[data-act=settings]').innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>`;
const tabIcons = { apuntar: 'plus', tabla: 'trophy', historial: 'list', informe: 'doc', verguenza: 'mug' };
document.querySelectorAll('.tabs button').forEach(b => { $('i', b).innerHTML = ICON[tabIcons[b.dataset.tab]]; });
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
window.addEventListener('online', () => { S.offline = false; pump(); load(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) { pump(); if (Date.now() - S.lastLoad > 20000) load(); } });
setInterval(() => { if (!document.hidden && !S.queue.length && Date.now() - S.lastLoad > 60000) load(); }, 30000);
updateInstall();
render(); load().then(() => pump());
})();
