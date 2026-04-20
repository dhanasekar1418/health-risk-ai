from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime
import pandas as pd
import json, os, pdfplumber, re
from risk_engine import calculate_risk, extract_fields_from_text

app = Flask(__name__)
CORS(app)

# ── MongoDB Connection ────────────────────────────────────────
MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017/")
client = MongoClient(MONGO_URI)
db = client["healthrisk"]
analyses_col = db["analyses"]     # stores every upload session
patients_col  = db["patients"]    # stores every individual patient result

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
ALLOWED = {"csv", "json", "pdf", "txt"}


def serial(obj):
    """Convert MongoDB ObjectId / datetime for JSON serialization."""
    if isinstance(obj, ObjectId):
        return str(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Not serializable: {type(obj)}")


# ── Health check ─────────────────────────────────────────────
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "db": "connected"})


# ── Upload & Analyze ─────────────────────────────────────────
@app.route("/analyze", methods=["POST"])
def analyze():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "No file selected"}), 400
    ext = file.filename.rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED:
        return jsonify({"error": "Unsupported file type"}), 400

    filepath = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(filepath)

    try:
        raw_records = []
        if ext == "csv":
            df = pd.read_csv(filepath)
            df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
            raw_records = df.to_dict(orient="records")
        elif ext == "json":
            with open(filepath) as f:
                data = json.load(f)
            raw_records = data.get("patients", data) if isinstance(data, dict) else data
        elif ext in ("pdf", "txt"):
            if ext == "pdf":
                text = ""
                with pdfplumber.open(filepath) as pdf:
                    for page in pdf.pages:
                        text += page.extract_text() or ""
            else:
                with open(filepath) as f:
                    text = f.read()
            raw_records = extract_fields_from_text(text)

        if not raw_records:
            return jsonify({"error": "No patient data found in file"}), 400

        results = []
        for i, rec in enumerate(raw_records):
            try:
                result = calculate_risk(rec)
                result["patient_id"] = str(rec.get("patient_id", rec.get("name", f"Patient {i+1}")))
                result["raw"] = rec
                results.append(result)
            except Exception as e:
                results.append({
                    "patient_id": str(rec.get("patient_id", f"Patient {i+1}")),
                    "error": str(e), "raw": rec
                })

        summary = {
            "total": len(results),
            "high_risk":   sum(1 for r in results if r.get("risk_level") == "High"),
            "medium_risk": sum(1 for r in results if r.get("risk_level") == "Medium"),
            "low_risk":    sum(1 for r in results if r.get("risk_level") == "Low"),
        }

        # ── Save to MongoDB ──────────────────────────────────
        session_doc = {
            "filename":   file.filename,
            "uploaded_at": datetime.utcnow(),
            "summary":    summary,
            "patient_count": len(results),
        }
        session_id = analyses_col.insert_one(session_doc).inserted_id

        # Save each patient with session reference
        for r in results:
            doc = {**r, "session_id": str(session_id), "uploaded_at": datetime.utcnow()}
            doc.pop("_id", None)
            inserted = patients_col.insert_one(doc)
            r["_id"] = str(inserted.inserted_id)

        return jsonify({
            "results":    results,
            "summary":    summary,
            "filename":   file.filename,
            "session_id": str(session_id)
        })

    except Exception as e:
        return jsonify({"error": f"Processing failed: {str(e)}"}), 500
    finally:
        if os.path.exists(filepath):
            os.remove(filepath)


# ── Get all past analysis sessions ───────────────────────────
@app.route("/sessions", methods=["GET"])
def get_sessions():
    sessions = list(analyses_col.find().sort("uploaded_at", -1).limit(50))
    for s in sessions:
        s["_id"] = str(s["_id"])
        s["uploaded_at"] = s["uploaded_at"].isoformat()
    return jsonify(sessions)


# ── Get patients for a specific session ──────────────────────
@app.route("/sessions/<session_id>", methods=["GET"])
def get_session(session_id):
    patients = list(patients_col.find({"session_id": session_id}))
    for p in patients:
        p["_id"] = str(p["_id"])
        if "uploaded_at" in p:
            p["uploaded_at"] = p["uploaded_at"].isoformat()
    session = analyses_col.find_one({"_id": ObjectId(session_id)})
    if session:
        session["_id"] = str(session["_id"])
        session["uploaded_at"] = session["uploaded_at"].isoformat()
    return jsonify({"session": session, "patients": patients})


# ── Get all patients ever ─────────────────────────────────────
@app.route("/patients", methods=["GET"])
def get_patients():
    risk_filter = request.args.get("risk_level")
    query = {}
    if risk_filter and risk_filter != "All":
        query["risk_level"] = risk_filter
    patients = list(patients_col.find(query).sort("uploaded_at", -1).limit(200))
    for p in patients:
        p["_id"] = str(p["_id"])
        if "uploaded_at" in p:
            p["uploaded_at"] = p["uploaded_at"].isoformat()
    return jsonify(patients)


# ── Delete a session and its patients ────────────────────────
@app.route("/sessions/<session_id>", methods=["DELETE"])
def delete_session(session_id):
    analyses_col.delete_one({"_id": ObjectId(session_id)})
    patients_col.delete_many({"session_id": session_id})
    return jsonify({"deleted": True})


# ── Stats for dashboard ───────────────────────────────────────
@app.route("/stats", methods=["GET"])
def get_stats():
    total_patients = patients_col.count_documents({})
    total_sessions = analyses_col.count_documents({})
    high  = patients_col.count_documents({"risk_level": "High"})
    medium = patients_col.count_documents({"risk_level": "Medium"})
    low   = patients_col.count_documents({"risk_level": "Low"})
    recent = list(analyses_col.find().sort("uploaded_at", -1).limit(5))
    for r in recent:
        r["_id"] = str(r["_id"])
        r["uploaded_at"] = r["uploaded_at"].isoformat()
    return jsonify({
        "total_patients": total_patients,
        "total_sessions": total_sessions,
        "high_risk": high,
        "medium_risk": medium,
        "low_risk": low,
        "recent_sessions": recent,
    })


if __name__ == "__main__":
    app.run(debug=True, port=5000)
