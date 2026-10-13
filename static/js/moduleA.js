/* Module A - transistor simulator */
(() => {
  let dev = 'bjt', ctl = null, ready = false;
  const defsFor = d => [
    { id: 'a-vcc', key: 'vcc', label: 'Supply V<sub>CC</sub>', min: 3, max: 12, step: .5, value: 5, unit: 'V' },
    { id: 'a-vin', key: 'vin', label: 'Base / gate voltage V<sub>in</sub>', min: 0, max: 12, step: .05, value: 5, unit: 'V', dp: 2 },
    { id: 'a-vth', key: 'vth', label: d === 'bjt' ? 'Switching threshold V<sub>BE</sub>' : 'Switching threshold V<sub>th</sub>', min: .3, max: 3.5, step: .05, value: d === 'bjt' ? .7 : 2, unit: 'V', dp: 2 },
    { id: 'a-rl', key: 'rl', label: 'Load resistance R<sub>L</sub>', min: 50, max: 2000, step: 10, value: 330, unit: '&Omega;', dp: 0 },
    d === 'bjt' ? { id: 'a-rb', key: 'rb', label: 'Base resistor R<sub>B</sub>', min: 1000, max: 100000, step: 500, value: 10000, unit: '&Omega;', dp: 0 }
                : { id: 'a-k', key: 'k', label: 'Transconductance k', min: .005, max: .1, step: .005, value: .02, unit: 'A/V&sup2;', dp: 3 },
    ...(d === 'bjt' ? [{ id: 'a-beta', key: 'beta', label: 'Current gain &beta;', min: 20, max: 300, step: 5, value: 100, dp: 0 }] : [])
  ];
  function build() {
    const keep = ctl ? ctl.get() : null;
    ctl = buildControls($('#a-controls'), defsFor(dev), run);
    if (keep) { ['vcc', 'vin', 'rl'].forEach(k => ctl.set('a-' + k, keep[k])); }
    renderMath($('#a-controls'));
  }
  async function run() {
    const p = ctl.get();
    const vin = $('#a-vin'); vin.max = p.vcc; if (+vin.value > p.vcc) { vin.value = p.vcc; ctl.refresh(); p.vin = p.vcc; }
    const r = await api('/api/transistor', { device: dev, ...p });
    const op = r.op, on = op.state === 'ON';
    $('#a-led').style.fill = `rgba(242,161,0,${.15 + .85 * op.led})`;
    $('#a-glow').style.opacity = on ? .55 * op.led : 0;
    $('#a-flow').classList.toggle('on', on);
    readouts($('#a-readouts'), [
      { k: 'Transistor', v: op.state, cls: on ? 'on' : 'off' }, { k: 'Region', v: op.region },
      { k: 'Bit read from V<sub>in</sub>', v: op.bit }, { k: 'V<sub>out</sub>', v: f(op.vout) + ' V' },
      { k: 'Load current', v: f(op.i_mA) + ' mA' }, { k: 'Power in transistor', v: f(op.power_mW) + ' mW' }]);
    const c = r.curve;
    xy('a-ch1', [ds('V_out', c.vin, c.vout, C.cl), { label: 'logic threshold', data: [{ x: 0, y: p.vcc / 2 }, { x: p.vcc, y: p.vcc / 2 }], showLine: true, pointRadius: 0, borderColor: C.mute, borderDash: [6, 6], borderWidth: 1.5 },
      dot('operating point', op.vin, op.vout, C.amber)], 'V_in (V)', 'V_out (V)', { xmin: 0, xmax: p.vcc, ymin: 0 });
    xy('a-ch2', [ds('I_load (mA)', c.vin, c.i_mA, C.qu), dot('operating point', op.vin, op.i_mA, C.amber)], 'V_in (V)', 'Current (mA)', { xmin: 0, xmax: p.vcc, ymin: 0 });
    $('#a-table').innerHTML = `<table><tr><th>Logic input</th><th>V<sub>in</sub></th><th>Transistor</th><th>Region</th><th>V<sub>out</sub></th><th>I<sub>load</sub></th><th>LED</th></tr>` +
      r.table.map(t => `<tr><td>${t.logic_in}</td><td>${f(t.vin)} V</td><td><b>${t.state}</b></td><td>${t.region}</td><td>${f(t.vout)} V</td><td>${f(t.i_mA)} mA</td><td>${t.led > .3 ? 'lit' : 'dark'}</td></tr>`).join('') +
      `</table><p class="small muted">Switching starts near V<sub>in</sub> = ${f(r.v_on)} V and the device is fully ON from ${f(r.v_full)} V. Therefore 0/1 maps to OFF/ON as long as V<sub>in</sub> stays well on either side of these values.</p>`;
  }
  MODS.A = { show() {
    if (!ready) { ready = true; build();
      bindSeg($('#a-device'), v => { dev = v; build(); run(); });
      $('#a-low').onclick = () => { ctl.set('a-vin', 0); run(); };
      $('#a-high').onclick = () => { ctl.set('a-vin', $('#a-vin').max); run(); };
    }
    run();
  } };
})();
