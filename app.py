from flask import Flask, render_template, request, jsonify, send_file
from deep_translator import GoogleTranslator
import os
import re
from uuid import uuid4

app = Flask(__name__)

OUTPUT_DIR = "outputs"
os.makedirs(OUTPUT_DIR, exist_ok=True)

LANGUAGE_NAMES = {
    "en": "english",
    "si": "sinhala",
    "ta": "tamil",
    "hi": "hindi",
    "fr": "french",
    "es": "spanish",
    "de": "german",
    "ja": "japanese",
    "ko": "korean",
    "ar": "arabic",
    "it": "italian",
    "pt": "portuguese",
    "ru": "russian",
    "tr": "turkish",
    "nl": "dutch",
}

def translate_text_block(text, target_lang):
    target = LANGUAGE_NAMES.get(target_lang, "english")
    try:
        return GoogleTranslator(source="auto", target=target).translate(text)
    except Exception:
        return text

def translate_srt_content(content, target_lang):
    lines = content.splitlines()
    out = []
    timestamp_pattern = re.compile(r"^\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}$")
    buffer = []

    def flush():
        nonlocal buffer, out
        if buffer:
            original = "\n".join(buffer)
            translated = translate_text_block(original, target_lang)
            out.extend(translated.split("\n"))
            buffer = []

    for line in lines:
        stripped = line.strip()
        if stripped.isdigit():
            flush()
            out.append(line)
        elif timestamp_pattern.match(stripped):
            flush()
            out.append(line)
        elif stripped == "":
            flush()
            out.append("")
        else:
            buffer.append(line)

    flush()
    return "\n".join(out)

def translate_vtt_content(content, target_lang):
    lines = content.splitlines()
    out = []
    time_pattern = re.compile(r"^\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}")
    buffer = []

    def flush():
        nonlocal buffer, out
        if buffer:
            original = "\n".join(buffer)
            translated = translate_text_block(original, target_lang)
            out.extend(translated.split("\n"))
            buffer = []

    for line in lines:
        stripped = line.strip()
        if stripped == "WEBVTT":
            flush()
            out.append(line)
        elif time_pattern.match(stripped):
            flush()
            out.append(line)
        elif stripped == "":
            flush()
            out.append("")
        elif stripped.isdigit():
            flush()
            out.append(line)
        else:
            buffer.append(line)

    flush()
    return "\n".join(out)

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/translate", methods=["POST"])
def translate():
    if "subtitle" not in request.files:
        return jsonify({"error": "No subtitle file uploaded"}), 400

    file = request.files["subtitle"]
    target_lang = request.form.get("target_lang", "en")

    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400

    filename = file.filename.lower()
    if not (filename.endswith(".srt") or filename.endswith(".vtt")):
        return jsonify({"error": "Only .srt and .vtt files are supported"}), 400

    raw = file.read()
    try:
        content = raw.decode("utf-8")
    except UnicodeDecodeError:
        try:
            content = raw.decode("latin-1")
        except Exception:
            return jsonify({"error": "Could not read file encoding"}), 400

    if filename.endswith(".srt"):
        translated = translate_srt_content(content, target_lang)
        ext = ".srt"
    else:
        translated = translate_vtt_content(content, target_lang)
        ext = ".vtt"

    output_id = str(uuid4())
    output_name = f"translated_{output_id}{ext}"
    output_path = os.path.join(OUTPUT_DIR, output_name)

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(translated)

    return jsonify({
        "message": "Translation successful",
        "translated_text": translated,
        "download_url": f"/download/{output_name}"
    })

@app.route("/download/<filename>")
def download(filename):
    safe_path = os.path.join(OUTPUT_DIR, filename)
    if os.path.exists(safe_path):
        return send_file(safe_path, as_attachment=True, download_name=filename)
    return "File not found", 404

if __name__ == "__main__":
    app.run(debug=True)
