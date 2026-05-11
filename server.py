"""
Aether Weather — server.py
Flask backend to serve the weather app.
Run: python server.py
Then open: http://localhost:5000
"""

from flask import Flask, send_from_directory, jsonify
import os

app = Flask(__name__, static_folder=".")

# ── Serve index.html ──────────────────────────────────
@app.route("/")
def index():
    return send_from_directory(".", "index.html")

# ── Serve static assets (CSS, JS) ────────────────────
@app.route("/<path:filename>")
def static_files(filename):
    return send_from_directory(".", filename)

# ── Health check endpoint ─────────────────────────────
@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "app": "Aether Weather"})

# ─────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"\n✅  Aether Weather running at http://localhost:{port}")
    print("📌  Or just open index.html directly in your browser!\n")
    app.run(debug=True, host="0.0.0.0", port=port)
