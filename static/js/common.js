/* Shared helpers: DOM, API, charts, circuit diagram, Bloch sphere. */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const C = { cl: '#1e4fe0', qu: '#a81c8c', amber: '#f2a100', ink: '#0d1b38', ok: '#12805c', bad: '#c42b2b', grid: '#e3e8f1', mute: '#8794ad' };
const MODS = {};

async function api(path, body) {
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || 'Request failed');
  return j;
}
const debounce = (fn, ms = 100) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const f = (x, d = 2) => (x === null || x === undefined || Number.isNaN(x)) ? 'n/a' : Number(x).toFixed(d);

function renderMath(el = document.body) {
  if (window.renderMathInElement) renderMathInElement(el, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '\\(', right: '\\)', display: false }], throwOnError: false });
}

/* sliders: defs [{id,key,label,min,max,step,value,unit,dp}] -> returns a getter for {key: value} */
function buildControls(host, defs, onChange) {
  host.innerHTML = defs.map(d => `<div class="ctl"><div class="ctl-top"><span>${d.label}</span><output id="${d.id}-o"></output></div>
    <input type="range" id="${d.id}" min="${d.min}" max="${d.max}" step="${d.step}" value="${d.value}" aria-label="${d.label.replace(/<[^>]+>/g, '')}"></div>`).join('');
  const upd = () => defs.forEach(d => { $('#' + d.id + '-o').textContent = (+$('#' + d.id).value).toFixed(d.dp ?? 1) + (d.unit ? ' ' + d.unit : ''); });
  host.oninput = () => { upd(); onChange(); };
  upd();
  return {
    get: () => Object.fromEntries(defs.map(d => [d.key || d.id, +$('#' + d.id).value])),
    set: (id, v) => { $('#' + id).value = v; upd(); },
    refresh: upd
  };
}
function readouts(host, items) {
  host.innerHTML = items.map(i => `<div class="ro"><span>${i.k}</span><b class="${i.cls || ''}">${i.v}</b></div>`).join('');
}
function segment(host, items, onPick, current) {
  host.innerHTML = items.map(it => `<button data-v="${it}" class="${it === current ? 'on' : ''}">${it}</button>`).join('');
  host.onclick = e => { const b = e.target.closest('button'); if (!b) return; $$('button', host).forEach(x => x.classList.toggle('on', x === b)); onPick(b.dataset.v); };
}
function bindSeg(host, onPick) {
  host.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $$('button', host).forEach(x => x.classList.toggle('on', x === b)); onPick(b.dataset.v); });
}

/* ---------- charts ---------- */
Chart.defaults.font.family = "'Hanken Grotesk', system-ui, sans-serif";
Chart.defaults.color = '#44526f';
const charts = {};
function mkChart(id, cfg) {
  if (charts[id]) charts[id].destroy();
  cfg.options = Object.assign({ responsive: true, maintainAspectRatio: false, animation: false }, cfg.options);
  return (charts[id] = new Chart($('#' + id), cfg));
}
function xyOpts(xl, yl, o = {}) {
  return { scales: { x: { type: 'linear', title: { display: true, text: xl }, grid: { color: C.grid }, min: o.xmin, max: o.xmax },
      y: { type: o.ylog ? 'logarithmic' : 'linear', title: { display: true, text: yl }, grid: { color: C.grid }, min: o.ymin, max: o.ymax } },
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } } };
}
const ds = (label, xs, ys, color, o = {}) => Object.assign({ label, data: xs.map((x, i) => ({ x, y: ys[i] })), showLine: true, borderColor: color,
  backgroundColor: color, pointRadius: 0, borderWidth: 2.5, tension: 0 }, o);
const dot = (label, x, y, color) => ({ label, data: [{ x, y }], showLine: false, pointRadius: 7, backgroundColor: color, borderColor: '#fff', borderWidth: 2 });
const xy = (id, datasets, xl, yl, o) => mkChart(id, { type: 'scatter', data: { datasets }, options: xyOpts(xl, yl, o) });
function bars(id, labels, datasets, yl, o = {}) {
  return mkChart(id, { type: 'bar', data: { labels, datasets }, options: { scales: { y: { beginAtZero: true, max: o.ymax, title: { display: !!yl, text: yl }, grid: { color: C.grid } }, x: { grid: { display: false } } },
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } } } });
}

/* ---------- quantum circuit diagram (SVG string) ---------- */
function circuitSVG(n, ops) {
  const gw = 62, rh = 52, x0 = 66, W = x0 + Math.max(ops.length, 1) * gw + 54, H = n * rh;
  const y = q => 26 + q * rh;
  let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Quantum circuit diagram">`;
  for (let q = 0; q < n; q++) s += `<text x="6" y="${y(q) + 5}">q${q}</text><line class="wire" x1="34" y1="${y(q)}" x2="${W - 12}" y2="${y(q)}"/>`;
  ops.forEach((op, i) => {
    const x = x0 + i * gw, ctr = op.controls || (op.control != null ? [op.control] : []), t = op.target, g = op.gate;
    if (['CNOT', 'CCX', 'CZ'].includes(g)) {
      const qs = [...ctr, t], lo = Math.min(...qs), hi = Math.max(...qs);
      s += `<line class="link" x1="${x}" y1="${y(lo)}" x2="${x}" y2="${y(hi)}"/>`;
      ctr.forEach(c => s += `<circle class="dot" cx="${x}" cy="${y(c)}" r="5.5"/>`);
      if (g === 'CZ') s += `<circle class="dot" cx="${x}" cy="${y(t)}" r="5.5"/>`;
      else s += `<circle class="tgt" cx="${x}" cy="${y(t)}" r="13"/><line class="link" x1="${x - 13}" y1="${y(t)}" x2="${x + 13}" y2="${y(t)}"/><line class="link" x1="${x}" y1="${y(t) - 13}" x2="${x}" y2="${y(t) + 13}"/>`;
    } else {
      const ang = ['RX', 'RY', 'RZ'].includes(g) ? `<text x="${x}" y="${y(t) + 27}" font-size="10" text-anchor="middle">${op.angle}&deg;</text>` : '';
      s += `<rect class="gbox" x="${x - 17}" y="${y(t) - 15}" width="34" height="30" rx="6"/><text x="${x}" y="${y(t) + 5}" text-anchor="middle">${g}</text>${ang}`;
    }
  });
  for (let q = 0; q < n; q++) s += `<rect class="gbox c" x="${W - 46}" y="${y(q) - 14}" width="30" height="28" rx="5"/><path d="M${W - 41} ${y(q) + 6} a10 10 0 0 1 20 0" fill="none" stroke="#1e4fe0" stroke-width="2"/><line x1="${W - 31}" y1="${y(q) + 6}" x2="${W - 24}" y2="${y(q) - 6}" stroke="#1e4fe0" stroke-width="2"/>`;
  return s + '</svg>';
}

/* ---------- Bloch sphere on a canvas ---------- */
function drawBloch(canvas, v, color = C.qu) {
  const ctx = canvas.getContext('2d'), W = canvas.width, cx = W / 2, cy = W / 2, R = W * 0.34, az = -0.6, el = 0.42;
  const P = (x, y, z) => { const x1 = x * Math.cos(az) - y * Math.sin(az), y1 = x * Math.sin(az) + y * Math.cos(az); return [cx + R * x1, cy - R * (z * Math.cos(el) + y1 * Math.sin(el))]; };
  ctx.clearRect(0, 0, W, W);
  ctx.lineWidth = 2; ctx.strokeStyle = '#0d1b38'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
  const ring = (fn, dash) => { ctx.beginPath(); for (let i = 0; i <= 80; i++) { const a = i / 80 * 2 * Math.PI, [px, py] = P(...fn(a)); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([]); };
  ctx.strokeStyle = '#8794ad'; ctx.lineWidth = 1.5;
  ring(a => [Math.cos(a), Math.sin(a), 0], [6, 6]); ring(a => [Math.cos(a), 0, Math.sin(a)], [2, 6]); ring(a => [0, Math.cos(a), Math.sin(a)], [2, 6]);
  const axis = (a, b, lab, off) => { const [x1, y1] = P(...a), [x2, y2] = P(...b); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    const [lx, ly] = P(...off); ctx.fillStyle = '#0d1b38'; ctx.font = '700 26px Hanken Grotesk, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(lab, lx, ly + 8); };
  axis([0, 0, -1], [0, 0, 1], '', [0, 0, 0]);
  axis([-1, 0, 0], [1, 0, 0], '', [0, 0, 0]); axis([0, -1, 0], [0, 1, 0], '', [0, 0, 0]);
  ctx.fillStyle = '#0d1b38'; ctx.font = '700 26px Hanken Grotesk, sans-serif'; ctx.textAlign = 'center';
  [['|0\u27e9', [0, 0, 1.25]], ['|1\u27e9', [0, 0, -1.25]], ['|+\u27e9', [1.3, 0, 0]], ['|+i\u27e9', [0, 1.35, 0]]].forEach(([t, p]) => { const [x, y] = P(...p); ctx.fillText(t, x, y + 8); });
  const [vx, vy] = P(...v), [sx, sy] = P(v[0], v[1], 0);
  ctx.setLineDash([4, 5]); ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(vx, vy); ctx.lineTo(sx, sy); ctx.lineTo(cx, cy); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = color; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(vx, vy); ctx.stroke();
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(vx, vy, 11, 0, 7); ctx.fill();
}
