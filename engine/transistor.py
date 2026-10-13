"""Module A engine - transistor as a switch (BJT and MOSFET) driving a load/LED.

All curves are computed with NumPy (vectorised) from simple, textbook models.
Region codes: 0 = cutoff, 1 = active / saturation (amplifier), 2 = fully ON (BJT saturation / MOSFET triode).
"""
import numpy as np

VCE_SAT = 0.2
REGION_NAMES = {
    "bjt": ["Cutoff", "Active", "Saturation"],
    "mosfet": ["Cutoff", "Saturation", "Triode"],
}


def _bjt(vin, vcc, rl, rb, beta, vbe):
    ib = np.clip((vin - vbe) / rb, 0.0, None)
    ic_sat = (vcc - VCE_SAT) / rl
    ic_act = beta * ib
    ic = np.minimum(ic_act, ic_sat)
    vout = vcc - ic * rl
    region = np.where(vin <= vbe, 0, np.where(ic_act < ic_sat, 1, 2))
    return ic, vout, region


def _mos(vgs, vdd, rl, vth, k):
    vov = np.clip(vgs - vth, 0.0, None)
    a = rl * k / 2.0
    b = -(1.0 + rl * k * vov)
    disc = b * b - 4.0 * a * vdd
    vds_tri = (-b - np.sqrt(np.clip(disc, 0, None))) / (2.0 * a)
    tri = (disc >= 0) & (vds_tri <= vov)
    i_sat = 0.5 * k * vov ** 2
    vds_sat = np.clip(vdd - i_sat * rl, 0, None)
    on = vov > 0
    vds = np.where(on, np.where(tri, vds_tri, vds_sat), vdd)
    i = np.where(on, np.where(tri, k * (vov * vds - vds ** 2 / 2.0), i_sat), 0.0)
    region = np.where(~on, 0, np.where(tri, 2, 1))
    return i, vds, region


def simulate(p):
    dev = str(p.get("device", "bjt")).lower()
    if dev not in REGION_NAMES:
        raise ValueError("device must be 'bjt' or 'mosfet'")
    vcc = max(float(p.get("vcc", 5.0)), 1.0)
    rl = max(float(p.get("rl", 330.0)), 1.0)
    vth = float(p.get("vth", 0.7 if dev == "bjt" else 2.0))
    rb = max(float(p.get("rb", 10000.0)), 1.0)
    beta = max(float(p.get("beta", 100.0)), 1.0)
    k = max(float(p.get("k", 0.02)), 1e-6)
    vin_op = float(np.clip(float(p.get("vin", vcc)), 0.0, vcc))

    def model(v):
        v = np.atleast_1d(np.asarray(v, dtype=float))
        return _bjt(v, vcc, rl, rb, beta, vth) if dev == "bjt" else _mos(v, vcc, rl, vth, k)

    vin = np.linspace(0.0, vcc, 241)
    i, vo, reg = model(vin)
    i_max = float(i.max()) if i.max() > 0 else 1e-12
    names = REGION_NAMES[dev]

    on_idx = np.argmax(i > 0.05 * i_max) if np.any(i > 0.05 * i_max) else None
    full_idx = np.argmax(reg == 2) if np.any(reg == 2) else None

    iop, vop, rop = model(vin_op)
    iop, vop, rop = float(iop[0]), float(vop[0]), int(rop[0])
    is_on = iop > 0.5 * i_max

    table = []
    for label, v in (("0 (LOW)", 0.0), ("1 (HIGH)", vcc)):
        ii, vv, rr = model(v)
        table.append({"logic_in": label, "vin": v, "vout": float(vv[0]), "i_mA": float(ii[0] * 1e3),
                      "state": "ON" if ii[0] > 0.5 * i_max else "OFF",
                      "led": float(np.clip(ii[0] / 0.015, 0, 1)), "region": names[int(rr[0])]})
    return {
        "device": dev,
        "curve": {"vin": vin.tolist(), "vout": vo.tolist(), "i_mA": (i * 1e3).tolist(), "region": reg.tolist()},
        "op": {"vin": vin_op, "vout": vop, "vce_or_vds": vop, "i_mA": iop * 1e3,
               "power_mW": vop * iop * 1e3, "region": names[rop], "state": "ON" if is_on else "OFF",
               "logic_out": int(vop > vcc / 2), "bit": int(vin_op > vth),
               "led": float(np.clip(iop / 0.015, 0, 1))},
        "v_on": None if on_idx is None else float(vin[on_idx]),
        "v_full": None if full_idx is None else float(vin[full_idx]),
        "i_max_mA": i_max * 1e3,
        "table": table,
    }
