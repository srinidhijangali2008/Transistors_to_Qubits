"""Module C engine - a small NumPy quantum simulator (state vectors + density matrices).

Qubit ordering follows Qiskit: basis index = sum(q_i * 2**i), bit-strings are printed q_{n-1}...q_0.
"""
import numpy as np

I2 = np.eye(2, dtype=complex)
X = np.array([[0, 1], [1, 0]], dtype=complex)
Y = np.array([[0, -1j], [1j, 0]], dtype=complex)
Z = np.array([[1, 0], [0, -1]], dtype=complex)
H = np.array([[1, 1], [1, -1]], dtype=complex) / np.sqrt(2)
S = np.diag([1, 1j]).astype(complex)
T = np.diag([1, np.exp(1j * np.pi / 4)]).astype(complex)
FIXED = {"I": I2, "X": X, "Y": Y, "Z": Z, "H": H, "S": S, "T": T}


def rot(axis, deg):
    th = np.radians(deg) / 2.0
    c, s = np.cos(th), np.sin(th)
    if axis == "X":
        return np.array([[c, -1j * s], [-1j * s, c]], dtype=complex)
    if axis == "Y":
        return np.array([[c, -s], [s, c]], dtype=complex)
    return np.array([[np.exp(-1j * th), 0], [0, np.exp(1j * th)]], dtype=complex)


def embed(op, t, n):
    full = np.array([[1]], dtype=complex)
    for q in range(n - 1, -1, -1):
        full = np.kron(full, op if q == t else I2)
    return full


def controlled(n, controls, target, kind="X"):
    dim = 2 ** n
    u = np.zeros((dim, dim), dtype=complex)
    for i in range(dim):
        if all((i >> c) & 1 for c in controls):
            if kind == "X":
                u[i ^ (1 << target), i] = 1
            else:
                u[i, i] = -1 if (i >> target) & 1 else 1
        else:
            u[i, i] = 1
    return u


def kraus(name, p):
    p = float(np.clip(p, 0.0, 1.0))
    if name == "bit_flip":
        return [np.sqrt(1 - p) * I2, np.sqrt(p) * X]
    if name == "phase_flip":
        return [np.sqrt(1 - p) * I2, np.sqrt(p) * Z]
    if name == "depolarizing":
        return [np.sqrt(1 - 3 * p / 4) * I2] + [np.sqrt(p / 4) * m for m in (X, Y, Z)]
    if name == "amplitude_damping":
        return [np.array([[1, 0], [0, np.sqrt(1 - p)]], dtype=complex),
                np.array([[0, np.sqrt(p)], [0, 0]], dtype=complex)]
    if name == "phase_damping":
        return [np.array([[1, 0], [0, np.sqrt(1 - p)]], dtype=complex),
                np.array([[0, 0], [0, np.sqrt(p)]], dtype=complex)]
    raise ValueError("unknown noise channel")


def apply_channel(rho, name, p, t, n):
    out = np.zeros_like(rho)
    for k in kraus(name, p):
        e = embed(k, t, n)
        out += e @ rho @ e.conj().T
    return out


def involved(op):
    ctr = op.get("controls") or ([op["control"]] if op.get("control") is not None else [])
    return list(ctr) + [op["target"]]


def op_unitary(op, n):
    g = op["gate"].upper()
    t = int(op["target"])
    ctr = [int(c) for c in (op.get("controls") or ([op["control"]] if op.get("control") is not None else []))]
    for q in ctr + [t]:
        if not 0 <= q < n:
            raise ValueError("qubit index out of range")
    if len(set(ctr + [t])) != len(ctr + [t]):
        raise ValueError("control and target must be different qubits")
    if g in FIXED:
        return embed(FIXED[g], t, n)
    if g in ("RX", "RY", "RZ"):
        return embed(rot(g[1], float(op.get("angle", 90))), t, n)
    if g == "CNOT":
        return controlled(n, ctr[:1], t, "X")
    if g == "CCX":
        return controlled(n, ctr[:2], t, "X")
    if g == "CZ":
        return controlled(n, ctr[:1], t, "Z")
    raise ValueError(f"unknown gate {g}")


def label(i, n):
    return format(i, f"0{n}b")


def fmt_amp(c):
    if abs(c.imag) < 1e-9:
        return f"{c.real:.3f}"
    if abs(c.real) < 1e-9:
        return f"{c.imag:.3f}i"
    return f"({c.real:.3f}{c.imag:+.3f}i)"


def bloch_of(rho, t, n):
    return [float(np.trace(rho @ embed(m, t, n)).real) for m in (X, Y, Z)]


def run_circuit(p):
    n = int(p.get("n", 2))
    if not 1 <= n <= 4:
        raise ValueError("1 to 4 qubits supported")
    ops = p.get("ops", [])
    ch = str(p.get("channel", "none"))
    pn = float(p.get("p", 0.0))
    shots = int(np.clip(int(p.get("shots", 1024)), 1, 100000))
    dim = 2 ** n
    rho = np.zeros((dim, dim), dtype=complex); rho[0, 0] = 1
    ideal = rho.copy()
    for op in ops:
        u = op_unitary(op, n)
        rho = u @ rho @ u.conj().T
        ideal = u @ ideal @ u.conj().T
        if ch != "none" and pn > 0:
            for q in involved(op):
                rho = apply_channel(rho, ch, pn, q, n)
    probs = np.clip(np.diag(rho).real, 0, None); probs /= probs.sum()
    iprobs = np.clip(np.diag(ideal).real, 0, None); iprobs /= iprobs.sum()
    rng = np.random.default_rng(p.get("seed"))
    counts = rng.multinomial(shots, probs)
    purity = float(np.trace(rho @ rho).real)
    fidelity = float(np.trace(ideal @ rho).real)
    res = {"n": n, "labels": [label(i, n) for i in range(dim)], "probs": probs.tolist(),
           "ideal_probs": iprobs.tolist(), "counts": counts.tolist(), "shots": shots,
           "purity": purity, "fidelity": fidelity,
           "bloch": [bloch_of(rho, q, n) for q in range(n)], "pure": purity > 0.9999}
    if res["pure"]:
        w, v = np.linalg.eigh(rho)
        psi = v[:, -1]
        k = int(np.argmax(np.abs(psi) > 1e-6))
        psi = psi / (psi[k] / abs(psi[k]))
        res["amps"] = [{"label": label(i, n), "re": float(a.real), "im": float(a.imag)} for i, a in enumerate(psi)]
        terms = [f"{fmt_amp(a)}|{label(i, n)}\u27e9" for i, a in enumerate(psi) if abs(a) > 1e-6]
        res["state_text"] = " + ".join(terms).replace("+ -", "- ")
        res["entangled"] = bool(n > 1 and any(np.linalg.norm(b) < 0.999 for b in res["bloch"]))
    else:
        res["amps"] = None
        res["state_text"] = "mixed state (density matrix) - noise has destroyed purity"
        res["entangled"] = False
    return res


def qubit_state(p):
    th = np.radians(float(p.get("theta", 0.0)))
    ph = np.radians(float(p.get("phi", 0.0)))
    shots = int(np.clip(int(p.get("shots", 100)), 1, 100000))
    a = np.cos(th / 2)
    b = np.exp(1j * ph) * np.sin(th / 2)
    p0, p1 = abs(a) ** 2, abs(b) ** 2
    n1 = int(np.random.default_rng(p.get("seed")).binomial(shots, p1))
    return {"alpha": {"re": float(a.real), "im": float(a.imag)}, "beta": {"re": float(b.real), "im": float(b.imag)},
            "p0": float(p0), "p1": float(p1), "norm": float(p0 + p1),
            "bloch": [float(np.sin(th) * np.cos(ph)), float(np.sin(th) * np.sin(ph)), float(np.cos(th))],
            "shots": shots, "n0": shots - n1, "n1": n1}
