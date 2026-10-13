# From Transistors to Qubits - Learning Framework (Flask + NumPy)

Four-module educational website (Module A transistor, B logic gates, C quantum, D comparison + noise)
plus a pre/post assessment. All simulation maths runs in Python/NumPy (`engine/`), the browser only draws.

## Run on Replit
1. Create a Repl: **Create App -> Template: Python** (or "Flask"). Name it with your student ID.
2. Delete the template's default `main.py`, then upload this whole folder (drag and drop, or
   *Files -> Upload folder*). You must end up with `main.py`, `requirements.txt`, `engine/`, `static/` at the top level.
3. Open the **Shell** tab and run: `pip install -r requirements.txt`
4. Press **Run** (or in Shell: `python main.py`). The app listens on `0.0.0.0:5000`.
5. Open the **Webview** pane (or the dev URL) to see the site. To make it permanent use **Deploy -> Autoscale / Reserved VM**
   with run command `python main.py`.

## Run locally
    pip install -r requirements.txt
    python main.py        # then open http://localhost:5000

## Structure
    main.py              Flask server + JSON API
    engine/transistor.py BJT / MOSFET switching model (Module A)
    engine/logic.py      Gates, NAND-only builds, CMOS inverter VTC (Module B)
    engine/quantum.py    NumPy state-vector / density-matrix simulator (Module C)
    engine/noise.py      Classical noise, Kraus channels, 3-qubit code (Module D)
    engine/compare.py    Same function on classical and quantum circuits (Module D)
    static/              index.html, style.css, js/ (one file per module)

The front-end loads Chart.js and KaTeX from the jsDelivr CDN, so the browser needs internet access.
