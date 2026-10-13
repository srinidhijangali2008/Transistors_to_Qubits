/* Home page demo, router and assessment */
const QUIZ = [
  ['In a transistor switch, what decides whether we read a 0 or a 1?', ['The colour of the LED', 'Whether the voltage is above or below a threshold', 'The temperature of the transistor', 'The number of resistors'], 1],
  ['Which quantum gate is the counterpart of the classical NOT gate?', ['H', 'Z', 'X', 'CNOT'], 2],
  ['What does the Hadamard gate do to |0>?', ['Flips it to |1>', 'Creates an equal superposition', 'Does nothing', 'Measures it'], 1],
  ['A qubit has amplitudes alpha and beta. Which must hold?', ['alpha + beta = 1', '|alpha|^2 + |beta|^2 = 1', 'alpha = beta', 'alpha and beta are both 0 or 1'], 1],
  ['After applying H to |0>, measuring many times gives:', ['Always 0', 'Always 1', 'About 50% 0 and 50% 1', 'A value between 0 and 1'], 2],
  ['Which classical gate has no reversible form without extra bits, and needs a Toffoli (CCX) in a quantum circuit?', ['NOT', 'AND', 'Wire', 'Buffer'], 1],
  ['Additive transistor noise is modelled as V_out = V_ideal + n(t). What fixes small errors in a digital circuit?', ['Re-digitising with a threshold', 'Cloning the signal', 'Measuring twice', 'Using a Z gate'], 0],
  ['In the 3-qubit repetition code, when does the logical qubit fail?', ['When any one qubit flips', 'When two or more qubits flip', 'Never', 'Only when no qubit flips'], 1]
];

/* ---------- hero demo ---------- */
(() => {
  let bit = 0, th = 0, n0 = 0, n1 = 0;
  const tally = () => { const m = Math.max(n0, n1, 1); $('#h-tally').innerHTML = `<div class="z" style="height:${20 + 40 * n0 / m}px">${n0}</div><div style="height:${20 + 40 * n1 / m}px">${n1}</div>`; };
  $('#h-flip').onclick = () => { bit ^= 1; $('#h-bit').textContent = bit; $('#h-led').classList.toggle('on', !!bit); $('#h-flip').innerHTML = bit ? 'Set V<sub>in</sub> = 0' : 'Set V<sub>in</sub> = 1'; };
  $('#h-hada').onclick = () => { th = 90; $('#h-coin').textContent = '|+\u27e9'; $('#h-msg').textContent = 'In superposition: P(0) = P(1) = 50%. Measure it a few times.'; };
  $('#h-meas').onclick = async () => {
    const r = await api('/api/quantum/qubit', { theta: th, phi: 0, shots: 1 }), c = $('#h-coin');
    c.classList.remove('spin'); void c.offsetWidth; c.classList.add('spin');
    r.n1 ? n1++ : n0++; tally(); c.textContent = r.n1 ? '1' : '0';
    $('#h-msg').textContent = th ? 'Random result. Repeat to build up the 50/50 histogram.' : 'No superposition yet, so the result is always 0.';
  };
  $('#h-reset').onclick = () => { th = 0; n0 = n1 = 0; tally(); $('#h-coin').textContent = '|0\u27e9'; $('#h-msg').textContent = 'Back to |0\u27e9.'; };
})();

/* ---------- assessment ---------- */
(() => {
  let mode = 'pre';
  const store = () => JSON.parse(localStorage.getItem('t2q-scores') || '{}');
  const save = s => localStorage.setItem('t2q-scores', JSON.stringify(s));
  function results() {
    const s = store(), pre = s.pre, post = s.post, row = (l, v, q) => `<p><b>${l}: ${v === undefined ? 'not taken' : v + '%'}</b></p>${v === undefined ? '' : `<div class="bar ${q ? 'q' : ''}"><i style="width:${v}%"></i></div>`}`;
    let g = '';
    if (pre !== undefined && post !== undefined) {
      const gain = pre >= 100 ? 0 : (post - pre) / (100 - pre);
      g = `<p style="margin-top:14px"><b>Normalised gain g = ${gain.toFixed(2)}</b> (${gain >= .7 ? 'high' : gain >= .3 ? 'medium' : gain > 0 ? 'low' : 'no improvement'})</p>`;
    }
    $('#as-res').innerHTML = row('Pre-test', pre, false) + row('Post-test', post, true) + g;
  }
  function render() {
    $('#as-body').innerHTML = QUIZ.map((q, i) => `<div class="quiz-q"><b>${i + 1}. ${q[0]}</b>${q[1].map((o, j) => `<label><input type="radio" name="q${i}" value="${j}"> ${o}</label>`).join('')}</div>`).join('') +
      `<button class="btn primary" id="as-submit">Submit ${mode}-test</button><span id="as-msg" class="small muted" style="margin-left:10px"></span>`;
    $('#as-submit').onclick = () => {
      let score = 0, missing = 0;
      QUIZ.forEach((q, i) => { const sel = $(`input[name=q${i}]:checked`); if (!sel) { missing++; return; } const ok = +sel.value === q[2]; if (ok) score++;
        $$(`input[name=q${i}]`).forEach(inp => { const l = inp.parentElement; if (+inp.value === q[2]) l.classList.add('right'); else if (inp.checked) l.classList.add('wrong'); }); });
      if (missing) { $('#as-msg').textContent = `Answer all questions first (${missing} left).`; $$('.quiz-q label').forEach(l => l.classList.remove('right', 'wrong')); return; }
      const pct = Math.round(100 * score / QUIZ.length), s = store(); s[mode] = pct; save(s); results();
      $('#as-msg').textContent = `You scored ${score}/${QUIZ.length} (${pct}%). Correct answers are marked.`;
    };
  }
  MODS.assess = { show() { render(); results(); } };
  bindSeg($('#as-mode'), v => { mode = v; render(); });
  $('#as-reset').onclick = () => { localStorage.removeItem('t2q-scores'); results(); };
})();

/* ---------- router ---------- */
function route() {
  const r = (location.hash.replace('#/', '') || 'home').split('?')[0];
  const key = ['home', 'A', 'B', 'C', 'D', 'assess'].includes(r) ? r : 'home';
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + key));
  $$('.nav .link').forEach(l => l.classList.toggle('on', l.dataset.route === key));
  window.scrollTo(0, 0);
  if (MODS[key]) MODS[key].show();
}
window.addEventListener('hashchange', route);
renderMath();
route();
