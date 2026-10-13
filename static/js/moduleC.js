/* Module C - qubit explorer and circuit builder */
(() => {
  let qctl, ready = false, ops = [], n = 2;
  const cx = (re, im) => Math.abs(im) < 1e-9 ? f(re, 3) : `${f(re, 3)}${im >= 0 ? '+' : '-'}${f(Math.abs(im), 3)}i`;

  async function qubit() {
    const p = qctl.get(), r = await api('/api/quantum/qubit', p);
    drawBloch($('#c-bloch1'), r.bloch);
    readouts($('#c-qro'), [{ k: '&alpha;', v: cx(r.alpha.re, r.alpha.im) }, { k: '&beta;', v: cx(r.beta.re, r.beta.im) },
      { k: 'P(0) = |&alpha;|&sup2;', v: f(r.p0 * 100, 1) + '%' }, { k: 'P(1) = |&beta;|&sup2;', v: f(r.p1 * 100, 1) + '%' },
      { k: '|&alpha;|&sup2; + |&beta;|&sup2;', v: f(r.norm, 3) }, { k: `Measured (${r.shots} shots)`, v: `${r.n0} : ${r.n1}` }]);
    bars('c-ch1', ['P(0)', 'P(1)'], [{ label: 'Predicted |amplitude|^2', data: [r.p0, r.p1], backgroundColor: C.qu },
      { label: 'Measured frequency', data: [r.n0 / r.shots, r.n1 / r.shots], backgroundColor: C.cl }], 'Probability', { ymax: 1 });
  }

  /* ---- circuit builder ---- */
  const opts = (arr, sel) => arr.map(i => `<option ${i === sel ? 'selected' : ''}>${i}</option>`).join('');
  function syncSelects() {
    n = +$('#c-n').value;
    const g = $('#c-gate').value, qs = [...Array(n).keys()];
    const t = +($('#c-target').value || 0);
    $('#c-target').innerHTML = opts(qs, Math.min(t, n - 1));
    const tt = +$('#c-target').value, others = qs.filter(q => q !== tt);
    const ctrlGate = ['CNOT', 'CZ'].includes(g);
    $('#c-ctrl').innerHTML = opts(others); $('#c-ctrl').disabled = !ctrlGate;
    $('#c-angle-wrap').style.display = ['RX', 'RY', 'RZ'].includes(g) ? '' : 'none';
    $('#c-add').disabled = (['CNOT', 'CZ'].includes(g) && n < 2) || (g === 'CCX' && n < 3);
    $('#c-add').title = $('#c-add').disabled ? 'This gate needs more qubits' : '';
  }
  function draw() {
    ops = ops.filter(o => [o.target, ...(o.controls || []), ...(o.control != null ? [o.control] : [])].every(q => q < n));
    $('#c-cir').innerHTML = circuitSVG(n, ops);
    $('#c-chips').innerHTML = ops.map((o, i) => {
      const c = o.controls || (o.control != null ? [o.control] : []);
      return `<span class="opchip">${o.gate}${o.angle !== undefined ? '(' + o.angle + '&deg;)' : ''} ${c.length ? 'c' + c.join(',') + '&rarr;' : ''}q${o.target}<button data-rm="${i}" aria-label="Remove gate">&times;</button></span>`;
    }).join('') || '<span class="muted small">No gates yet: the circuit stays in |0&#10217; on every qubit.</span>';
  }
  async function run() {
    draw();
    const ch = $('#c-noise').value, p = +$('#c-p').value;
    const r = await api('/api/quantum/run', { n, ops, channel: ch, p, shots: +$('#c-shots').value });
    readouts($('#c-ro'), [{ k: 'Fidelity vs ideal', v: f(r.fidelity, 3) }, { k: 'Purity', v: f(r.purity, 3) }, { k: 'Entangled', v: r.entangled ? 'yes' : 'no', cls: r.entangled ? 'on' : 'off' },
      { k: 'Noise', v: ch === 'none' ? 'off' : `${ch.replace('_', ' ')}, p=${p}` }]);
    $('#c-state').textContent = r.pure ? '|\u03c8\u27e9 = ' + r.state_text : r.state_text;
    const lab = r.labels.map(l => '|' + l + '\u27e9');
    bars('c-ch2', lab, [{ label: 'Ideal probability', data: r.ideal_probs, backgroundColor: '#d8c4d3' }, { label: 'With noise (exact)', data: r.probs, backgroundColor: C.qu },
      { label: `Measured (${r.shots} shots)`, data: r.counts.map(c => c / r.shots), backgroundColor: C.cl }], 'Probability', { ymax: 1 });
    $('#c-blochs').innerHTML = r.bloch.map((_, q) => `<div style="text-align:center"><canvas class="bloch" id="cb${q}" width="400" height="400" style="width:165px"></canvas><b>q${q}</b></div>`).join('');
    r.bloch.forEach((v, q) => drawBloch($('#cb' + q), v, q % 2 ? C.cl : C.qu));
  }
  const PRESETS = {
    bell: { n: 2, ops: [{ gate: 'H', target: 0 }, { gate: 'CNOT', control: 0, target: 1 }] },
    flip: { n: 1, ops: [{ gate: 'X', target: 0 }] }, super: { n: 1, ops: [{ gate: 'H', target: 0 }] },
    ghz: { n: 3, ops: [{ gate: 'H', target: 0 }, { gate: 'CNOT', control: 0, target: 1 }, { gate: 'CNOT', control: 0, target: 2 }] }, clear: { n: 2, ops: [] }
  };

  MODS.C = { show() {
    if (!ready) { ready = true;
      qctl = buildControls($('#c-qctl'), [
        { id: 'c-th', key: 'theta', label: 'Polar angle &theta;', min: 0, max: 180, step: 1, value: 90, unit: '&deg;', dp: 0 },
        { id: 'c-ph', key: 'phi', label: 'Phase angle &phi;', min: 0, max: 360, step: 1, value: 0, unit: '&deg;', dp: 0 },
        { id: 'c-sh', key: 'shots', label: 'Shots', min: 10, max: 2000, step: 10, value: 200, dp: 0 }], debounce(qubit, 60));
      $$('[data-q]').forEach(b => b.onclick = () => { const [t, p] = b.dataset.q.split(','); qctl.set('c-th', t); qctl.set('c-ph', p); qubit(); });
      $('#c-measure').onclick = qubit;
      $('#c-n').onchange = () => { syncSelects(); draw(); };
      $('#c-gate').onchange = syncSelects; $('#c-target').onchange = syncSelects;
      $('#c-add').onclick = () => {
        const g = $('#c-gate').value, t = +$('#c-target').value, op = { gate: g, target: t };
        if (['CNOT', 'CZ'].includes(g)) op.control = +$('#c-ctrl').value;
        if (g === 'CCX') op.controls = [0, 1, 2].filter(q => q !== t);
        if (['RX', 'RY', 'RZ'].includes(g)) op.angle = +$('#c-angle').value;
        ops.push(op); run();
      };
      $('#c-chips').onclick = e => { const b = e.target.closest('[data-rm]'); if (b) { ops.splice(+b.dataset.rm, 1); run(); } };
      $$('[data-p]').forEach(b => b.onclick = () => { const p = PRESETS[b.dataset.p]; n = p.n; $('#c-n').value = n; ops = JSON.parse(JSON.stringify(p.ops)); syncSelects(); run(); });
      $('#c-run').onclick = run; $('#c-noise').onchange = run; $('#c-p').onchange = run; $('#c-shots').onchange = run;
      syncSelects(); ops = JSON.parse(JSON.stringify(PRESETS.bell.ops)); n = 2;
    }
    qubit(); run();
  } };
})();
