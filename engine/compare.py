"""Module D engine - the same logic function on a classical and on a quantum circuit."""
import numpy as np
from . import logic, quantum as Q

# function -> (qubits, gate list after the inputs are loaded, output qubit)
SPEC = {
    "NOT": (1, [{"gate": "X", "target": 0}], 0),
    "XOR": (2, [{"gate": "CNOT", "control": 0, "target": 1}], 1),
    "AND": (3, [{"gate": "CCX", "controls": [0, 1], "target": 2}], 2),
    "NAND": (3, [{"gate": "CCX", "controls": [0, 1], "target": 2}, {"gate": "X", "target": 2}], 2),
    "NOR": (3, [{"gate": "X", "target": 0}, {"gate": "X", "target": 1},
                {"gate": "CCX", "controls": [0, 1], "target": 2}], 2),
    "OR": (3, [{"gate": "X", "target": 0}, {"gate": "X", "target": 1},
               {"gate": "CCX", "controls": [0, 1], "target": 2}, {"gate": "X", "target": 2}], 2),
}


def _prep(fn, a, b, mode):
    qs = [0] if fn == "NOT" else [0, 1]
    bits = {0: a, 1: b}
    if mode == "superposition":
        return [{"gate": "H", "target": q} for q in qs]
    return [{"gate": "X", "target": q} for q in qs if bits[q]]


def compare(p):
    fn = str(p.get("function", "AND")).upper()
    if fn not in SPEC:
        raise ValueError("unknown function")
    a = int(p.get("a", 1)); b = int(p.get("b", 1)); mode = str(p.get("mode", "basis"))
    sigma = float(p.get("sigma", 0.0)); vcc = float(p.get("vcc", 5.0))
    ch = str(p.get("channel", "none")); pn = float(p.get("p", 0.0)); shots = int(p.get("shots", 1024))
    n, body, out_q = SPEC[fn]

    # classical: analog voltages + Gaussian noise, thresholded, then the Boolean gate
    rng = np.random.default_rng(p.get("seed"))
    N = 5000
    da = (a * vcc + rng.normal(0, sigma, N) > vcc / 2).astype(int)
    db = (b * vcc + rng.normal(0, sigma, N) > vcc / 2).astype(int)
    y_ideal = logic.gate(fn, a, b)
    y_noisy = logic.gate_np(fn, da, db)
    cls = {"out": y_ideal, "error_rate": float(np.mean(y_noisy != y_ideal)), "deterministic": sigma == 0,
           "vout": y_ideal * vcc}

    ops = _prep(fn, a, b, mode) + body
    q = Q.run_circuit({"n": n, "ops": ops, "channel": ch, "p": pn, "shots": shots, "seed": p.get("seed")})
    probs = np.array(q["probs"])
    p_out1 = float(sum(pr for i, pr in enumerate(probs) if (i >> out_q) & 1))
    equivalent = True
    for aa in (0, 1):
        for bb in (0, 1):
            r = Q.run_circuit({"n": n, "ops": _prep(fn, aa, bb, "basis") + body, "shots": 1})
            pr = np.array(r["probs"])
            got = 1 if sum(pr[i] for i in range(len(pr)) if (i >> out_q) & 1) > 0.5 else 0
            if got != logic.gate(fn, aa, bb):
                equivalent = False
    quantum = {"n": n, "ops": ops, "out_qubit": out_q, "labels": q["labels"], "probs": q["probs"],
               "counts": q["counts"], "shots": shots, "p_out1": p_out1,
               "success": (p_out1 if y_ideal == 1 else 1 - p_out1) if mode == "basis" else None,
               "state_text": q["state_text"], "fidelity": q["fidelity"], "entangled": q["entangled"]}
    return {"function": fn, "a": a, "b": b, "mode": mode, "classical": cls, "quantum": quantum,
            "equivalent": equivalent}
