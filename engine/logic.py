"""Module B engine - Boolean gates, NAND universality and a CMOS inverter transfer curve."""
import numpy as np

GATES = ["NOT", "AND", "OR", "NAND", "NOR", "XOR"]

INFO = {
    "NOT": {"expr": "Y = A'", "cmos": 2, "nand": 1, "pull": "1 PMOS up, 1 NMOS down"},
    "AND": {"expr": "Y = A\u00b7B", "cmos": 6, "nand": 2, "pull": "NAND stage + inverter"},
    "OR": {"expr": "Y = A + B", "cmos": 6, "nand": 3, "pull": "NOR stage + inverter"},
    "NAND": {"expr": "Y = (A\u00b7B)'", "cmos": 4, "nand": 1, "pull": "2 PMOS parallel up, 2 NMOS series down"},
    "NOR": {"expr": "Y = (A + B)'", "cmos": 4, "nand": 4, "pull": "2 PMOS series up, 2 NMOS parallel down"},
    "XOR": {"expr": "Y = A\u2295B = A\u00b7B' + A'\u00b7B", "cmos": 12, "nand": 4, "pull": "pass-gate / compound stage"},
}


def gate_np(name, a, b=0):
    a = np.asarray(a, dtype=int)
    b = np.asarray(b, dtype=int)
    table = {
        "NOT": 1 - a,
        "AND": a & b,
        "OR": a | b,
        "NAND": 1 - (a & b),
        "NOR": 1 - (a | b),
        "XOR": a ^ b,
    }
    return table[name]


def gate(name, a, b=0):
    return int(gate_np(name, a, b))


def truth_table(name):
    if name == "NOT":
        a = np.array([0, 1]); b = np.zeros(2, dtype=int)
    else:
        a = np.array([0, 0, 1, 1]); b = np.array([0, 1, 0, 1])
    y = gate_np(name, a, b)
    return [{"a": int(x), "b": None if name == "NOT" else int(z), "y": int(w)} for x, z, w in zip(a, b, y)]


def _nand(a, b):
    return 1 - (a & b)


def nand_only(name, a, b=0):
    """Build the gate from NAND gates only and return the internal nodes."""
    n = []
    if name == "NOT":
        out = _nand(a, a); n.append(("n1", "NAND(A,A)", out))
    elif name == "NAND":
        out = _nand(a, b); n.append(("n1", "NAND(A,B)", out))
    elif name == "AND":
        n1 = _nand(a, b); out = _nand(n1, n1)
        n += [("n1", "NAND(A,B)", n1), ("Y", "NAND(n1,n1)", out)]
    elif name == "OR":
        n1 = _nand(a, a); n2 = _nand(b, b); out = _nand(n1, n2)
        n += [("n1", "NAND(A,A)", n1), ("n2", "NAND(B,B)", n2), ("Y", "NAND(n1,n2)", out)]
    elif name == "NOR":
        n1 = _nand(a, a); n2 = _nand(b, b); n3 = _nand(n1, n2); out = _nand(n3, n3)
        n += [("n1", "NAND(A,A)", n1), ("n2", "NAND(B,B)", n2), ("n3", "NAND(n1,n2)", n3), ("Y", "NAND(n3,n3)", out)]
    else:  # XOR
        n1 = _nand(a, b); n2 = _nand(a, n1); n3 = _nand(b, n1); out = _nand(n2, n3)
        n += [("n1", "NAND(A,B)", n1), ("n2", "NAND(A,n1)", n2), ("n3", "NAND(B,n1)", n3), ("Y", "NAND(n2,n3)", out)]
    return {"nodes": [{"name": a_, "expr": e, "value": int(v)} for a_, e, v in n], "out": int(out)}


def evaluate(p):
    name = str(p.get("gate", "NOT")).upper()
    if name not in GATES:
        raise ValueError("unknown gate")
    a = int(p.get("a", 0)); b = int(p.get("b", 0))
    vdd = float(p.get("vdd", 5.0))
    y = gate(name, a, b)
    ref = nand_only(name, a, b)
    return {"gate": name, "a": a, "b": b, "y": y, "va": a * vdd, "vb": b * vdd, "vy": y * vdd,
            "table": truth_table(name), "info": INFO[name], "nand": ref, "nand_matches": ref["out"] == y,
            "all": {g: gate(g, a, b) for g in GATES}}


def _mos_id(vgs, vds, vt, k):
    vov = np.clip(vgs - vt, 0.0, None)
    vds = np.clip(vds, 0.0, None)
    return np.where(vds < vov, k * (vov * vds - vds ** 2 / 2.0), 0.5 * k * vov ** 2)


def vtc(p):
    """CMOS inverter voltage-transfer curve by vectorised bisection of I_n = I_p."""
    vdd = max(float(p.get("vdd", 5.0)), 1.0)
    vtn = float(p.get("vtn", 1.0)); vtp = float(p.get("vtp", 1.0))
    kn = float(p.get("kn", 1.0)); kp = float(p.get("kp", 1.0))
    vin = np.linspace(0, vdd, 401)
    lo = np.zeros_like(vin); hi = np.full_like(vin, vdd)
    for _ in range(60):
        mid = 0.5 * (lo + hi)
        f = _mos_id(vin, mid, vtn, kn) - _mos_id(vdd - vin, vdd - mid, vtp, kp)
        hi = np.where(f > 0, mid, hi)
        lo = np.where(f > 0, lo, mid)
    vout = 0.5 * (lo + hi)
    gain = np.gradient(vout, vin)
    steep = np.where(gain <= -1.0)[0]
    voh, vol = float(vout[0]), float(vout[-1])
    vm = float(vin[np.argmin(np.abs(vout - vin))])
    res = {"vin": vin.tolist(), "vout": vout.tolist(), "gain": gain.tolist(),
           "voh": voh, "vol": vol, "vm": vm, "gain_max": float(-gain.min())}
    if len(steep):
        vil, vih = float(vin[steep[0]]), float(vin[steep[-1]])
        res.update({"vil": vil, "vih": vih, "nml": vil - vol, "nmh": voh - vih})
    else:
        res.update({"vil": None, "vih": None, "nml": None, "nmh": None})
    return res
