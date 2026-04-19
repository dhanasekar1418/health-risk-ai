from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import json
import os
import pdfplumber
import re
from risk_engine import calculate_risk, extract_fields_from_text

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {"csv", "json", "pdf", "txt"}


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/analyze", methods=["POST"])
def analyze():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "Unsupported file type. Use CSV, JSON, PDF, or TXT"}), 400

    ext = file.filename.rsplit(".", 1)[1].lower()
    filepath = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(filepath)

    try:
        records = []

        if ext == "csv":
            df = pd.read_csv(filepath)
            df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
            records = df.to_dict(orient="records")

        elif ext == "json":
            with open(filepath, "r") as f:
                data = json.load(f)
            if isinstance(data, list):
                records = data
            elif isinstance(data, dict):
                # Single patient or {patients: [...]}
                if "patients" in data:
                    records = data["patients"]
                else:
                    records = [data]

        elif ext in ("pdf", "txt"):
            if ext == "pdf":
                text = ""
                with pdfplumber.open(filepath) as pdf:
                    for page in pdf.pages:
                        text += page.extract_text() or ""
            else:
                with open(filepath, "r") as f:
                    text = f.read()
            records = extract_fields_from_text(text)

        if not records:
            return jsonify({"error": "No patient data found in file"}), 400

        results = []
        for i, rec in enumerate(records):
            try:
                result = calculate_risk(rec)
                result["patient_id"] = rec.get("patient_id", rec.get("name", f"Patient {i+1}"))
                result["raw"] = rec
                results.append(result)
            except Exception as e:
                results.append({
                    "patient_id": rec.get("patient_id", f"Patient {i+1}"),
                    "error": str(e),
                    "raw": rec
                })

        summary = {
            "total": len(results),
            "high_risk": sum(1 for r in results if r.get("risk_level") == "High"),
            "medium_risk": sum(1 for r in results if r.get("risk_level") == "Medium"),
            "low_risk": sum(1 for r in results if r.get("risk_level") == "Low"),
        }

        return jsonify({"results": results, "summary": summary, "filename": file.filename})

    except Exception as e:
        return jsonify({"error": f"Failed to process file: {str(e)}"}), 500
    finally:
        if os.path.exists(filepath):
            os.remove(filepath)


if __name__ == "__main__":
    app.run(debug=True, port=5000)
