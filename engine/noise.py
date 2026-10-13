"""Module D engine - classical (additive) noise vs quantum noise channels + error correction."""
import math
import numpy as np
from . import quantum as Q

CHANNELS = ["bit_flip", "phase_flip", "depolarizing", "amplitude_damping", "phase_damping"]
KB = 1.380649e-23


def qfunc(x):
    return 0.5 * math.erfc(x / math.sqrt(2.0))


def classical(p):
    vcc = max(float(p.get("vcc", 5.0)), 1.0)
    sigma = max(float(p.get("sigma", 0.8)), 1e-4)
    n = int(np.clip(int(p.get("n", 4000)), 100, 200000))
    rng = np.random.default_rng(p.get("seed"))
    bits = rng.integers(0, 2, n)
    ideal = bits * vcc
    noisy = ideal + rng.normal(0.0, sigma, n)
    decided = (noisy > vcc / 2).astype(int)
    ber = float(np.mean(decided != bits))
    sig = np.linspace(0.05, vcc, 60)
    theory = [qfunc((vcc / 2) / s) for s in sig]
    emp = [float(np.mean(rng.normal(0, s, 20000) > vcc / 2)) for s in sig]
    r = float(p.get("r", 10000.0)); temp = float(p.get("temp", 300.0)); bw = float(p.get("bw", 1e6))
    m = 60
    return {"t": list(range(m)), "ideal": ideal[:m].tolist(), "noisy": noisy[:m].tolist(),
            "decided": (decided[:m] * vcc).tolist(), "threshold": vcc / 2, "ber": ber,
            "ber_theory": qfunc((vcc / 2) / sigma), "snr_db": 20 * math.log10((vcc / 2) / sigma),
            "sig": sig.tolist(), "curve_theory": theory, "curve_emp": emp,
            "thermal_uV": math.sqrt(4 * KB * temp * r * bw) * 1e6,
            "margin": vcc / 2}


def quantum(p):
    state = str(p.get("state", "plus"))
    prep = {"zero": [], "one": [{"gate": "X", "target": 0}], "plus": [{"gate": "H", "target": 0}]}[state]
    ps = np.linspace(0, 1, 41)
    out = {}
    base = np.array([[1, 0], [0, 0]], dtype=complex)
    for op in prep:
        u = Q.op_unitary(op, 1)
        base = u @ base @ u.conj().T
    for ch in CHANNELS:
        f, pu, bl = [], [], []
        for pv in ps:
            rho = Q.apply_channel(base, ch, pv, 0, 1)
            f.append(float(np.trace(base @ rho).real))
            pu.append(float(np.trace(rho @ rho).real))
            bl.append(Q.bloch_of(rho, 0, 1))
        out[ch] = {"fidelity": f, "purity": pu, "bloch": bl}
    t1 = max(float(p.get("t1", 50.0)), 0.1)
    t2 = min(max(float(p.get("t2", 70.0)), 0.1), 2 * t1)
    t = np.linspace(0, 5 * t1, 120)
    return {"p": ps.tolist(), "channels": out, "t": t.tolist(), "t1": t1, "t2": t2,
            "p1_decay": np.exp(-t / t1).tolist(), "coherence": np.exp(-t / t2).tolist(),
            "classical_hold": np.ones_like(t).tolist()}


def _fid(r, r0):
    r0 = np.asarray(r0); n0 = np.linalg.norm(r0)
    return float((1 + np.dot(r, r0 / n0)) / 2) if n0 > 0 else 1.0


def qec(p):
    rng = np.random.default_rng(p.get("seed"))
    ps = np.linspace(0, 0.5, 51)
    mc = []
    for pv in ps:
        flips = rng.random((20000, 3)) < pv
        mc.append(float(np.mean(flips.sum(axis=1) >= 2)))
    theta = float(p.get("theta", 70.0)); err = int(np.clip(int(p.get("error_qubit", 0)), 0, 2))
    enc = [{"gate": "RY", "target": 0, "angle": theta}, {"gate": "CNOT", "control": 0, "target": 1},
           {"gate": "CNOT", "control": 0, "target": 2}]
    error = [{"gate": "X", "target": err}]
    dec = [{"gate": "CNOT", "control": 0, "target": 1}, {"gate": "CNOT", "control": 0, "target": 2},
           {"gate": "CCX", "controls": [1, 2], "target": 0}]
    orig = Q.run_circuit({"n": 1, "ops": [enc[0]]})["bloch"][0]
    bare = Q.run_circuit({"n": 1, "ops": [enc[0], {"gate": "X", "target": 0}]})["bloch"][0]
    fixed = Q.run_circuit({"n": 3, "ops": enc + error + dec})["bloch"][0]
    return {"p": ps.tolist(), "unprotected": ps.tolist(), "logical_theory": (3 * ps ** 2 - 2 * ps ** 3).tolist(),
            "logical_mc": mc, "ops": enc + error + dec, "error_qubit": err,
            "demo": {"original": orig, "unprotected": bare, "corrected": fixed,
                     "f_unprotected": _fid(bare, orig), "f_corrected": _fid(fixed, orig)}}
