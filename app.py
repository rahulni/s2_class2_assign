from flask import Flask, render_template

app = Flask(__name__)

@app.route("/")
def index():
    return render_template("index.html")  # Single-page UI

@app.route("/health")
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    # Run the Flask dev server
    app.run(host="0.0.0.0", port=5000, debug=True)
