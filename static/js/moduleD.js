/* Module D - classical vs quantum comparison, noise lab, error correction */
(() => {
  const FN = ['NOT', 'AND', 'OR', 'NAND', 'NOR', 'XOR'];
  const COL = { bit_flip: '#1e4fe0', phase_flip: '#12805c', depolarizing: '#a81c8c', amplitude_damping: '#f2a100', phase_damping: '#44526f' };
  let fn = 'AND', a = 1, b = 1, mode = 'basis', ready = false, cctl, nctl, tctl, qdata = null, ncl = null;

  /* ---------- Lab 1: same function both ways ---------- */
  function inputs() {
    $('#d-in').innerHTML = `<button class="tog ${a ? 'on' : ''}" data-i="a">A = ${a}</button>` + (fn === 'NOT' ? '' : `<button class="tog ${b ? 'on' : ''}" data-i="b">B = ${b}</button>`);
    $('#d-in').style.opacity = mode === 'basis' ? 1 : .4;
  }
  async function compare() {
    const c = cctl.get(), r = await api('/api/compare', { function: fn, a, b, mode, sigma: c.sigma, p: c.p, channel: $('#d-ch').value, shots: 1024 });
    const k = r.classical, q = r.quantum;
    $('#d-eq').textContent = r.equivalent ? 'The quantum circuit reproduces the classical truth table.' : 'Truth tables differ.';
    $('#d-out').innerHTML = `<h3>Classical</h3><div class="pipe"><span>Transistors</span><i>&rarr;</i><span>${fn} gate</span><i>&rarr;</i><span>Digital output</span></div>
      <div class="readouts" id="d-cro"></div>
      <h3 style="margin-top:20px">Quantum</h3><div class="pipe q"><span>Qubits</span><i>&rarr;</i><span>${q.ops.length} gates</span><i>&rarr;</i><span>Measurement of q${q.out_qubit}</span></div>
      <div class="cir">${circuitSVG(q.n, q.ops)}</div>
      <div class="chartbox" style="height:210px"><canvas id="d-ch0"></canvas></div><div class="readouts" id="d-qro0"></div>`;
    readouts($('#d-cro'), mode === 'basis' ? [{ k: 'Output', v: k.out, cls: k.out ? 'on' : 'off' }, { k: 'Output voltage', v: f(k.vout, 1) + ' V' },
      { k: 'Error rate with noise', v: f(k.error_rate * 100, 1) + '%' }, { k: 'Behaviour', v: k.deterministic ? 'deterministic' : 'noisy' }]
      : [{ k: 'Needs', v: '4 separate runs' }, { k: 'One run gives', v: 'one input pair' }]);
    bars('d-ch0', q.labels.map(l => '|' + l + '\u27e9'), [{ label: 'Exact probability', data: q.probs, backgroundColor: C.qu },
      { label: 'Measured (1024 shots)', data: q.counts.map(x => x / q.shots), backgroundColor: C.cl }], 'Probability', { ymax: 1 });
    readouts($('#d-qro0'), mode === 'basis' ? [{ k: `P(output = ${k.out})`, v: f(q.success * 100, 1) + '%', cls: 'on' }, { k: 'Fidelity', v: f(q.fidelity, 3) }, { k: 'Behaviour', v: 'probabilistic' }]
      : [{ k: 'P(output = 1)', v: f(q.p_out1 * 100, 1) + '%' }, { k: 'Entangled', v: q.entangled ? 'yes' : 'no' }, { k: 'State', v: 'all inputs at once' }]);
  }

  /* ---------- Lab 2a: classical noise ---------- */
  async function classical() {
    const s = nctl.get().sigma, r = await api('/api/noise/classical', { sigma: s, vcc: 5 });
    xy('d-ch1', [ds('V_ideal', r.t, r.ideal, C.cl, { stepped: true, borderWidth: 2 }), ds('V_out = V_ideal + n(t)', r.t, r.noisy, C.qu, { borderWidth: 1.5 }),
      ds('threshold', [0, 59], [r.threshold, r.threshold], C.mute, { borderDash: [6, 6], borderWidth: 1.5 })], 'sample', 'voltage (V)', { xmin: 0, xmax: 59 });
    const pts = r.sig.map((x, i) => ({ x, y: r.curve_emp[i] || null }));
    xy('d-ch2', [ds('Q-function theory', r.sig, r.curve_theory, C.cl), { label: 'Monte-Carlo', data: pts, showLine: false, pointRadius: 3, backgroundColor: C.qu },
      dot('your setting', s, Math.max(r.ber_theory, 1e-6), C.amber)], 'noise rms sigma (V)', 'bit-error rate', { ylog: true, ymin: 1e-6, ymax: 1, xmin: 0, xmax: 5 });
    readouts($('#d-nro'), [{ k: 'Bit-error rate (sample)', v: f(r.ber * 100, 2) + '%' }, { k: 'BER (theory)', v: r.ber_theory < 1e-4 ? r.ber_theory.toExponential(1) : f(r.ber_theory * 100, 2) + '%' },
      { k: 'SNR', v: f(r.snr_db, 1) + ' dB' }, { k: 'Noise margin', v: f(r.margin, 1) + ' V' }, { k: '10k&Omega; thermal noise', v: f(r.thermal_uV, 1) + ' &micro;V' }]);
  }

  /* ---------- Lab 2b: quantum noise ---------- */
  async function fetchQ() {
    const t = tctl.get();
    qdata = await api('/api/noise/quantum', { state: $('#d-state').value, t1: t.t1, t2: t.t2 });
    drawQ(); decoh();
  }
  function drawQ() {
    if (!qdata) return;
    const ch = $('#d-qch').value, p = +$('#d-qp').value; $('#d-qp-o').textContent = p.toFixed(3);
    const P = qdata.p, i = Math.min(P.length - 1, Math.round(p / (P[1] - P[0]))), d = qdata.channels[ch];
    const sets = Object.keys(qdata.channels).map(k => ds(k.replace('_', ' ') + ' fidelity', P, qdata.channels[k].fidelity, COL[k], { borderWidth: k === ch ? 4 : 1.3, borderColor: k === ch ? COL[k] : COL[k] + '66' }));
    sets.push(ds('purity (selected)', P, d.purity, C.ink, { borderDash: [5, 5], borderWidth: 2 }), dot('selected p', p, d.fidelity[i], C.amber));
    xy('d-ch3', sets, 'error probability p', 'fidelity / purity', { xmin: 0, xmax: 1, ymin: 0, ymax: 1.02 });
    const v = d.bloch[i], len = Math.hypot(...v);
    drawBloch($('#d-bloch'), v);
    readouts($('#d-qro'), [{ k: 'Fidelity', v: f(d.fidelity[i], 3) }, { k: 'Purity', v: f(d.purity[i], 3) }, { k: 'Bloch length', v: f(len, 3) }, { k: '&langle;X&rangle;, &langle;Z&rangle;', v: `${f(v[0], 2)}, ${f(v[2], 2)}` }]);
  }
  function decoh() {
    if (!qdata) return;
    const d = qdata;
    xy('d-ch4', [ds('qubit |1> decays (T1)', d.t, d.p1_decay, C.qu), ds('coherence of |+> (T2)', d.t, d.coherence, C.cl), ds('transistor bit (re-digitised)', d.t, d.classical_hold, C.mute, { borderDash: [6, 6] })],
      'time (microseconds)', 'remaining signal', { xmin: 0, xmax: d.t[d.t.length - 1], ymin: 0, ymax: 1.05 });
  }

  /* ---------- Lab 3: QEC ---------- */
  async function qec() {
    const r = await api('/api/noise/qec', { theta: +$('#d-th').value, error_qubit: +$('#d-eq-q').value }), d = r.demo;
    xy('d-ch5', [ds('unprotected qubit: p', r.p, r.unprotected, C.mute, { borderDash: [6, 6] }), ds('3-qubit code: 3p^2 - 2p^3', r.p, r.logical_theory, C.qu),
      { label: 'Monte-Carlo', data: r.p.map((x, i) => ({ x, y: r.logical_mc[i] })), showLine: false, pointRadius: 3, backgroundColor: C.cl }], 'physical error probability p', 'error probability', { xmin: 0, xmax: .5, ymin: 0, ymax: .5 });
    $('#d-qcir').innerHTML = circuitSVG(3, r.ops);
    readouts($('#d-qec-ro'), [{ k: 'Error injected on', v: 'q' + r.error_qubit }, { k: 'Fidelity, no code', v: f(d.f_unprotected, 3), cls: 'off' }, { k: 'Fidelity, decoded', v: f(d.f_corrected, 3), cls: 'on' }]);
  }

  MODS.D = { show() {
    if (!ready) { ready = true;
      segment($('#d-fn'), FN, v => { fn = v; inputs(); compare(); }, fn);
      bindSeg($('#d-mode'), v => { mode = v; inputs(); compare(); });
      $('#d-in').onclick = e => { const t = e.target.closest('.tog'); if (!t || mode !== 'basis') return; if (t.dataset.i === 'a') a ^= 1; else b ^= 1; inputs(); compare(); };
      cctl = buildControls($('#d-ctl'), [{ id: 'd-sig', key: 'sigma', label: 'Classical input noise (rms)', min: 0, max: 3, step: .1, value: 1.2, unit: 'V' },
        { id: 'd-pp', key: 'p', label: 'Quantum gate error p', min: 0, max: .15, step: .005, value: .02, dp: 3 }], debounce(compare, 150));
      $('#d-ch').onchange = compare; $('#d-run').onclick = compare;
      nctl = buildControls($('#d-nctl'), [{ id: 'd-ns', key: 'sigma', label: 'Noise rms &sigma; (signal is 0 or 5 V)', min: .1, max: 3, step: .05, value: 1.2, unit: 'V', dp: 2 }], debounce(classical, 80));
      tctl = buildControls($('#d-tctl'), [{ id: 'd-t1', key: 't1', label: 'T<sub>1</sub> (energy relaxation)', min: 10, max: 200, step: 5, value: 50, unit: '&micro;s', dp: 0 },
        { id: 'd-t2', key: 't2', label: 'T<sub>2</sub> (dephasing, capped at 2T<sub>1</sub>)', min: 10, max: 400, step: 5, value: 70, unit: '&micro;s', dp: 0 }], debounce(fetchQ, 150));
      $('#d-state').onchange = fetchQ; $('#d-qch').onchange = drawQ; $('#d-qp').oninput = drawQ;
      $('#d-qec-run').onclick = qec; $('#d-eq-q').onchange = qec; $('#d-th').onchange = qec;
      inputs();
    }
    compare(); classical(); fetchQ(); qec();
  } };
})();
