"""Transistor-to-Qubit Learning Framework - Flask server (Python + NumPy engines)."""
import os
from functools import wraps
from flask import Flask, jsonify, request, send_from_directory
from engine import transistor, logic, quantum, noise, compare

app = Flask(__name__, static_folder="static", static_url_path="/static")


def api(fn):
    @wraps(fn)
    def wrapper(*a, **k):
        try:
            return jsonify(fn(request.get_json(silent=True) or {}, *a, **k))
        except Exception as exc:  # report bad input to the UI instead of a 500 page
            return jsonify({"error": str(exc)}), 400
    return wrapper


@app.route("/")
def home():
    return send_from_directory("static", "index.html")


@app.post("/api/transistor")
@api
def r_transistor(p): return transistor.simulate(p)


@app.post("/api/logic/gate")
@api
def r_gate(p): return logic.evaluate(p)


@app.post("/api/logic/vtc")
@api
def r_vtc(p): return logic.vtc(p)


@app.post("/api/quantum/qubit")
@api
def r_qubit(p): return quantum.qubit_state(p)


@app.post("/api/quantum/run")
@api
def r_run(p): return quantum.run_circuit(p)


@app.post("/api/noise/classical")
@api
def r_nc(p): return noise.classical(p)


@app.post("/api/noise/quantum")
@api
def r_nq(p): return noise.quantum(p)


@app.post("/api/noise/qec")
@api
def r_qec(p): return noise.qec(p)


@app.post("/api/compare")
@api
def r_compare(p): return compare.compare(p)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)
