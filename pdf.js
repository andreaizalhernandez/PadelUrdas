/* Generador de PDF mínimo (sin librerías): A4, Helvetica, tablas con paginación.
   Funciona sin conexión y en iPhone/Android (se comparte o guarda con el menú del móvil). */
(function () {
  const W = 595, H = 842, M = 40;
  const WIN = { '–': '-', '—': '-', '’': "'", '‘': "'", '“': '"', '”': '"', '…': '...', '·': '\xb7', '€': '\x80', '•': '\x95' };
  const clean = s => String(s ?? '').replace(/[–—‘’“”…·€•]/g, c => WIN[c])
    .replace(/[^\x20-\xff]/g, '').replace(/[()\\]/g, c => '\\' + c);
  const rgb = h => [1, 3, 5].map(i => (parseInt(h.slice(i, i + 2), 16) / 255).toFixed(3)).join(' ');
  const tw = (s, size, bold) => String(s).length * size * (bold ? 0.56 : 0.52);

  function Doc() {
    this.pages = []; this.cur = null; this.y = 0;
    this.add = function () { this.cur = []; this.pages.push(this.cur); this.y = H - M; return this; };
    this.add();
  }
  Doc.prototype.text = function (x, y, s, size = 10, o = {}) {
    const f = o.bold ? 'F2' : 'F1', c = rgb(o.color || '#16231d');
    if (o.align === 'c') x -= tw(s, size, o.bold) / 2; else if (o.align === 'r') x -= tw(s, size, o.bold);
    this.cur.push(`BT /${f} ${size} Tf ${c} rg ${x.toFixed(1)} ${y.toFixed(1)} Td (${clean(s)}) Tj ET`);
  };
  Doc.prototype.rect = function (x, y, w, h, color) { this.cur.push(`${rgb(color)} rg ${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re f`); };
  Doc.prototype.line = function (x1, y1, x2, y2, color = '#d9e0db', w = 0.5) { this.cur.push(`${rgb(color).replace(/ /g, ' ')} RG ${w} w ${x1} ${y1} m ${x2} ${y2} l S`); };
  Doc.prototype.need = function (h) { if (this.y - h < M + 20) this.add(); };
  Doc.prototype.h = function (s) { this.need(50); this.y -= 14; this.text(M, this.y, s.toUpperCase(), 9, { bold: true, color: '#5b6b62' }); this.y -= 6; this.line(M, this.y, W - M, this.y, '#16231d', 1); this.y -= 4; };
  /* cols: [{t:'Jugadora', w:140, a:'l'|'c'|'r'}] ; rows: arrays de texto o {t, bold, color} */
  Doc.prototype.table = function (cols, rows, o = {}) {
    const rh = o.rh || 17, total = cols.reduce((a, c) => a + c.w, 0), k = (W - 2 * M) / total;
    const head = () => {
      this.need(rh * 2); this.rect(M, this.y - rh + 4, W - 2 * M, rh, '#eef3ea');
      let x = M; cols.forEach(c => { const w = c.w * k; this.text(c.a === 'l' ? x + 5 : x + w / 2, this.y - rh + 9, c.t, 8, { bold: true, color: '#5b6b62', align: c.a === 'l' ? 'l' : 'c' }); x += w; });
      this.y -= rh;
    };
    head();
    rows.forEach(r => {
      if (this.y - rh < M + 20) { this.add(); head(); }
      if (r.group) this.line(M, this.y + 4, W - M, this.y + 4, '#9aa8a0', 0.8);
      let x = M;
      cols.forEach((c, i) => {
        const w = c.w * k, v = r[i] && typeof r[i] === 'object' ? r[i] : { t: r[i] };
        this.text(c.a === 'l' ? x + 5 : x + w / 2, this.y - rh + 8, v.t ?? '', 9, { bold: v.bold, color: v.color, align: c.a === 'l' ? 'l' : 'c' });
        x += w;
      });
      this.line(M, this.y - rh + 4, W - M, this.y - rh + 4);
      this.y -= rh;
    });
    this.y -= 4;
  };
  Doc.prototype.note = function (s) { this.need(14); this.y -= 11; this.text(M, this.y, s, 8, { color: '#5b6b62' }); this.y -= 2; };
  Doc.prototype.blob = function () {
    const out = []; const offs = []; let len = 0;
    const push = s => { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255; out.push(b); len += b.length; };
    const obj = (n, body) => { offs[n] = len; push(`${n} 0 obj\n${body}\nendobj\n`); };
    const np = this.pages.length;
    push('%PDF-1.4\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, `<< /Type /Pages /Kids [${this.pages.map((_, i) => `${5 + i * 2} 0 R`).join(' ')}] /Count ${np} >>`);
    obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    obj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    this.pages.forEach((p, i) => {
      const foot = `BT /F1 8 Tf 0.36 0.42 0.38 rg ${W / 2 - 14} 22 Td (${i + 1} / ${np}) Tj ET`;
      const c = p.join('\n') + '\n' + foot;
      obj(5 + i * 2, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`);
      obj(6 + i * 2, `<< /Length ${c.length} >>\nstream\n${c}\nendstream`);
    });
    const xref = len, n = 5 + np * 2;
    push(`xref\n0 ${n}\n0000000000 65535 f \n` + offs.slice(1, n).map(o => String(o).padStart(10, '0') + ' 00000 n \n').join(''));
    push(`trailer\n<< /Size ${n} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    return new Blob(out, { type: 'application/pdf' });
  };
  window.PadelPDF = { Doc, W, H, M };
})();
