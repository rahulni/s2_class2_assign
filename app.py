import os
import logging
from flask import Flask, render_template, request, jsonify
from google import genai

try:
    from google import genai
except Exception:
    genai = None

logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)

@app.route("/")
def index():
    return render_template("index.html")  # Single-page UI

@app.route("/health")
def health():
    return {"status": "ok"}


# API endpoint to explain a 3x3 convolution kernel using Gemini
@app.route("/explain", methods=["POST"])
def explain():
    logging.info("Received explain request")
    data = request.get_json(force=True, silent=True) or {}
    logging.debug("Payload: %s", data)
    kernel = data.get("kernel")
    # optional context params from UI
    bias = data.get('bias')
    iters = data.get('iters')
    autoDivide = data.get('autoDivide')
    grayscale = data.get('grayscale')
    absval = data.get('absval')
    clamp = data.get('clamp')

    if not kernel or len(kernel) != 9:
        return jsonify({"error": "Invalid kernel"}), 400

    prompt = (
        f"Explain how this 3x3 convolution filter works for image processing:\n"
        f"{kernel[0:3]}\n{kernel[3:6]}\n{kernel[6:9]}\n"
    "What does each value signify? How does it affect the image? Describe the process behind the scenes.\n"
    "Also, relate this to convolutional neural networks (CNNs): explain receptive fields, how learned kernels differ from hand-designed kernels, how this kernel would act if used as a learned filter in a CNN (feature maps, activation patterns), and notes about stride/padding and stacking such filters in deeper layers.\n"
    f"Context: bias={bias}, iters={iters}, autoDivide={autoDivide}, grayscale={grayscale}, absval={absval}, clamp={clamp}"
    )

    # prefer reading API key from a local text file for convenience, then env var
    def _load_api_key_from_file():
        candidate = os.path.join(os.path.dirname(__file__), 'gemini_api_key.txt')
        try:
            if os.path.isfile(candidate):
                with open(candidate, 'r', encoding='utf-8') as fh:
                    key = fh.read().strip()
                    if key:
                        logging.info('Loaded GEMINI API key from %s', candidate)
                        return key
        except Exception:
            logging.exception('Failed to read API key file')
        return None

    api_key = _load_api_key_from_file() or os.environ.get('GEMINI_API_KEY')
    if not api_key or genai is None:
        logging.info('GEMINI_API_KEY not configured or genai unavailable; returning local explanation.')
        expl_lines = [
            'Local explanation (Gemini not configured):',
            'Kernel matrix:',
            f"{kernel[0:3]}",
            f"{kernel[3:6]}",
            f"{kernel[6:9]}",
        ]
        center = kernel[4]
        sum_k = sum(kernel)
        expl_lines.append(f"Center coefficient (kernel[1,1]) = {center}: controls contribution of the central pixel.")
        expl_lines.append(f"Sum of kernel = {sum_k}: {'approximately preserves brightness' if abs(sum_k-1.0)<1e-6 else 'may change overall brightness; consider auto-divide'}.")
        expl_lines.append('Positive weights accumulate nearby pixel values; negative weights subtract and produce edge responses.')
        expl_lines.append(f"Applied settings: bias={bias}, iterations={iters}, grayscale={grayscale}, absval={absval}, clamp={clamp}.")
        return jsonify({'explanation': '\n'.join(expl_lines)})

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )
        explanation = response.text
        return jsonify({"explanation": explanation})
    except Exception as e:
        logging.exception('LLM call failed')
        return jsonify({"error": f"LLM call failed: {str(e)}"}), 500


if __name__ == "__main__":
    # Run the Flask dev server
    app.run(host="0.0.0.0", port=5000, debug=True)
