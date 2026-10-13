/* Module B - logic-gate simulator + CMOS inverter VTC */
(() => {
  const GATES = ['NOT', 'AND', 'OR', 'NAND', 'NOR', 'XOR'];
  let gate = 'NAND', a = 0, b = 0, ready = false, vctl;

  function drawGate(r) {
    const two = r.gate !== 'NOT', col = v => v ? C.cl : C.mute, w = v => v ? 5 : 2.5;
    const ya = two ? 62 : 85;
    let s = `<line x1="20" y1="${ya}" x2="150" y2="${ya}" stroke="${col(r.a)}" stroke-width="${w(r.a)}" stroke-linecap="round"/>
      <text x="20" y="${ya - 8}" font-weight="700" font-size="13">A = ${r.a} (${f(r.va, 1)} V)</text>`;
    if (two) s += `<line x1="20" y1="108" x2="150" y2="108" stroke="${col(r.b)}" stroke-width="${w(r.b)}" stroke-linecap="round"/>
      <text x="20" y="130" font-weight="700" font-size="13">B = ${r.b} (${f(r.vb, 1)} V)</text>`;
    const inv = ['NOT', 'NAND', 'NOR'].includes(r.gate);
    s += `<rect x="150" y="38" width="110" height="94" rx="12" fill="#e6edff" stroke="#0d1b38" stroke-width="2.5"/>
      <text x="205" y="92" text-anchor="middle" font-family="Bricolage Grotesque" font-weight="800" font-size="24">${r.gate}</text>
      ${inv ? '<circle cx="267" cy="85" r="7" fill="#fff" stroke="#0d1b38" stroke-width="2.5"/>' : ''}
      <line x1="${inv ? 274 : 260}" y1="85" x2="368" y2="85" stroke="${col(r.y)}" stroke-width="${w(r.y)}" stroke-linecap="round"/>
      <circle cx="388" cy="85" r="15" fill="${r.y ? C.amber : '#d6dbe7'}" stroke="#0d1b38" stroke-width="2.5"/>
      <text x="300" y="68" font-weight="700" font-size="13">Y = ${r.y} (${f(r.vy, 1)} V)</text>`;
    $('#b-svg').innerHTML = s;
  }

  async function run() {
    const r = await api('/api/logic/gate', { gate, a, b });
    $('#b-inputs').innerHTML = `<button class="tog ${a ? 'on' : ''}" data-i="a" aria-pressed="${!!a}">A = ${a}</button>` +
      (gate === 'NOT' ? '' : `<button class="tog ${b ? 'on' : ''}" data-i="b" aria-pressed="${!!b}">B = ${b}</button>`) + `<span class="muted small">Click to toggle a transistor input.</span>`;
    drawGate(r);
    readouts($('#b-readouts'), [{ k: 'Expression', v: r.info.expr }, { k: 'Output Y', v: r.y, cls: r.y ? 'on' : 'off' }, { k: 'CMOS transistors', v: r.info.cmos }, { k: 'NAND gates needed', v: r.info.nand }]);
    $('#b-cmos').innerHTML = `<b>CMOS network:</b> ${r.info.pull}. The output is pulled to V<sub>DD</sub> or to ground, never left floating.`;
    $('#b-table').innerHTML = `<table class="tt"><tr><th>A</th>${gate === 'NOT' ? '' : '<th>B</th>'}<th>Y</th></tr>` +
      r.table.map(t => `<tr class="${t.a === a && (gate === 'NOT' || t.b === b) ? 'hl' : ''}"><td>${t.a}</td>${gate === 'NOT' ? '' : `<td>${t.b}</td>`}<td>${t.y}</td></tr>`).join('') + '</table>';
    $('#b-nand').innerHTML = `<table>${r.nand.nodes.map(n => `<tr><td><b>${n.name}</b></td><td>${n.expr}</td><td>= ${n.value}</td></tr>`).join('')}</table>
      <p class="small"><span class="${r.nand_matches ? 'badge-eq' : ''}">${r.nand_matches ? 'The NAND-only circuit gives the same output.' : 'Mismatch'}</span></p>`;
  }

  async function vtc() {
    const p = vctl.get(), r = await api('/api/logic/vtc', p);
    const sets = [ds('V_out', r.vin, r.vout, C.cl), ds('V_out = V_in', [0, p.vdd], [0, p.vdd], C.mute, { borderDash: [6, 6], borderWidth: 1.5 }), dot('switching point V_M', r.vm, r.vm, C.amber)];
    if (r.vil !== null) {
      const at = x => r.vout[Math.round(x / p.vdd * (r.vin.length - 1))];
      sets.push(dot('V_IL', r.vil, at(r.vil), C.qu), dot('V_IH', r.vih, at(r.vih), C.ok));
    }
    xy('b-ch', sets, 'V_in (V)', 'V_out (V)', { xmin: 0, xmax: p.vdd, ymin: 0, ymax: p.vdd });
    readouts($('#b-vro'), [{ k: 'V<sub>OH</sub>', v: f(r.voh) + ' V' }, { k: 'V<sub>OL</sub>', v: f(r.vol, 3) + ' V' }, { k: 'V<sub>M</sub>', v: f(r.vm) + ' V' },
      { k: 'V<sub>IL</sub>', v: r.vil === null ? 'n/a' : f(r.vil) + ' V' }, { k: 'V<sub>IH</sub>', v: r.vih === null ? 'n/a' : f(r.vih) + ' V' },
      { k: 'NM<sub>L</sub>', v: r.nml === null ? 'n/a' : f(r.nml) + ' V' }, { k: 'NM<sub>H</sub>', v: r.nmh === null ? 'n/a' : f(r.nmh) + ' V' }, { k: 'Max gain', v: f(r.gain_max, 1) }]);
  }

  MODS.B = { show() {
    if (!ready) { ready = true;
      segment($('#b-gates'), GATES, g => { gate = g; run(); }, gate);
      $('#b-inputs').addEventListener('click', e => { const t = e.target.closest('.tog'); if (!t) return; if (t.dataset.i === 'a') a ^= 1; else b ^= 1; run(); });
      vctl = buildControls($('#b-vctl'), [
        { id: 'b-vdd', key: 'vdd', label: 'Supply V<sub>DD</sub>', min: 3, max: 12, step: .5, value: 5, unit: 'V' },
        { id: 'b-vtn', key: 'vtn', label: 'NMOS threshold V<sub>tn</sub>', min: .3, max: 2, step: .05, value: 1, unit: 'V', dp: 2 },
        { id: 'b-vtp', key: 'vtp', label: 'PMOS threshold |V<sub>tp</sub>|', min: .3, max: 2, step: .05, value: 1, unit: 'V', dp: 2 },
        { id: 'b-kn', key: 'kn', label: 'NMOS strength k<sub>n</sub>', min: .2, max: 3, step: .1, value: 1, dp: 1 },
        { id: 'b-kp', key: 'kp', label: 'PMOS strength k<sub>p</sub>', min: .2, max: 3, step: .1, value: 1, dp: 1 }], debounce(vtc, 60));
      renderMath($('#view-B'));
    }
    run(); vtc();
  } };
})();
