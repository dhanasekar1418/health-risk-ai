from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime
import pandas as pd
import json, os, pdfplumber, re, requests
from risk_engine import calculate_risk, extract_fields_from_text
from dotenv import load_dotenv
load_dotenv()

app = Flask(__name__)
CORS(app)

MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017/")
client = MongoClient(MONGO_URI)
db = client["healthrisk"]
analyses_col = db["analyses"]
patients_col  = db["patients"]

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
ALLOWED = {"csv", "json", "pdf", "txt"}

# ── Health check ──────────────────────────────────────────────
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "db": "connected"})

# ── Upload & Analyze ──────────────────────────────────────────
@app.route("/analyze", methods=["POST"])
def analyze():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    file = request.files["file"]
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
            text = ""
            if ext == "pdf":
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
                result["smart_alerts"] = generate_smart_alerts(result)
                results.append(result)
            except Exception as e:
                results.append({"patient_id": str(rec.get("patient_id", f"Patient {i+1}")), "error": str(e), "raw": rec})

        summary = {
            "total": len(results),
            "high_risk":   sum(1 for r in results if r.get("risk_level") == "High"),
            "medium_risk": sum(1 for r in results if r.get("risk_level") == "Medium"),
            "low_risk":    sum(1 for r in results if r.get("risk_level") == "Low"),
        }

        session_doc = {"filename": file.filename, "uploaded_at": datetime.utcnow(), "summary": summary, "patient_count": len(results)}
        session_id = analyses_col.insert_one(session_doc).inserted_id

        for r in results:
            doc = {**r, "session_id": str(session_id), "uploaded_at": datetime.utcnow()}
            doc.pop("_id", None)
            inserted = patients_col.insert_one(doc)
            r["_id"] = str(inserted.inserted_id)

        return jsonify({"results": results, "summary": summary, "filename": file.filename, "session_id": str(session_id)})
    except Exception as e:
        return jsonify({"error": f"Processing failed: {str(e)}"}), 500
    finally:
        if os.path.exists(filepath):
            os.remove(filepath)


def generate_smart_alerts(result):
    alerts = []
    cs = result.get("component_scores", {})
    v = result.get("vitals", {})
    life_score = cs.get("lifestyle", {}).get("score", 0)
    try:
        hr   = float(v.get("heart_rate",  0))
        spo2 = float(v.get("spo2",        100))
        temp = float(v.get("temperature", 37))
    except:
        hr, spo2, temp = 0, 100, 37

    if hr > 100 and spo2 < 95:
        alerts.append({"type": "RESPIRATORY RISK", "color": "#E24B4A",
            "message": f"Elevated HR ({hr:.0f} bpm) combined with low SpO2 ({spo2:.1f}%) strongly suggests respiratory distress or pulmonary compromise."})
    if temp > 38.0 and hr > 100:
        alerts.append({"type": "INFECTION RISK", "color": "#EF9F27",
            "message": f"Fever ({temp:.1f}C) with elevated heart rate ({hr:.0f} bpm) is a classic pattern for systemic infection or sepsis. Monitor closely."})
    if spo2 < 92 and temp > 38.0:
        alerts.append({"type": "CRITICAL - POSSIBLE PNEUMONIA", "color": "#E24B4A",
            "message": f"Low oxygen ({spo2:.1f}%) with fever ({temp:.1f}C) can indicate pneumonia or severe respiratory infection."})
    if hr > 110 and life_score > 50:
        alerts.append({"type": "CARDIOVASCULAR RISK", "color": "#EF9F27",
            "message": "High heart rate combined with poor lifestyle factors significantly elevates long-term cardiovascular risk."})
    if spo2 < 95 and str(v.get("smoking", "")).lower() in ["regular", "heavy"]:
        alerts.append({"type": "LUNG DAMAGE RISK", "color": "#E24B4A",
            "message": "Low oxygen saturation in a regular smoker is a warning sign of chronic lung disease (COPD). Pulmonary function test recommended."})
    return alerts


def load_records_from_file(filepath, ext):
    if ext == "csv":
        df = pd.read_csv(filepath)
        df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
        return df.to_dict(orient="records")
    elif ext == "json":
        with open(filepath, encoding="utf-8") as f:
            data = json.load(f)
        return data.get("patients", data) if isinstance(data, dict) else data
    elif ext in ("pdf", "txt"):
        text = ""
        if ext == "pdf":
            with pdfplumber.open(filepath) as pdf:
                for page in pdf.pages:
                    text += page.extract_text() or ""
        else:
            with open(filepath, encoding="utf-8") as f:
                text = f.read()
        return extract_fields_from_text(text)
    return []


def score_records(raw_records):
    results = []
    for i, rec in enumerate(raw_records):
        try:
            result = calculate_risk(rec)
            result["patient_id"] = str(rec.get("patient_id", rec.get("name", f"Patient {i+1}")))
            result["raw"] = rec
            result["smart_alerts"] = generate_smart_alerts(result)
            results.append(result)
        except Exception as e:
            results.append({"patient_id": str(rec.get("patient_id", f"Patient {i+1}")), "error": str(e), "raw": rec})
    return results


# ── What-If Simulator ─────────────────────────────────────────
@app.route("/simulate", methods=["POST"])
def simulate():
    try:
        data = request.get_json()
        result = calculate_risk(data)
        result["smart_alerts"] = generate_smart_alerts(result)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 400


# ── Auto-detect AI provider from key prefix ───────────────────
def detect_provider(api_key):
    if api_key.startswith("gsk_"):
        return "groq"
    elif api_key.startswith("AIzaSy"):
        return "google"
    elif api_key.startswith("sk-"):
        return "openai"
    else:
        return "groq"


# ── Single unified AI call function ──────────────────────────
def call_ai(prompt, api_key, provider):
    if provider == "groq":
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}"
            },
            json={
                "model": "llama-3.1-8b-instant",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 1000,
                "temperature": 0.2
            },
            timeout=30
        )
        if response.status_code != 200:
            raise Exception(f"Groq error {response.status_code}: {response.text}")
        return response.json()["choices"][0]["message"]["content"].strip()

    elif provider == "google":
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
        response = requests.post(
            url,
            headers={"Content-Type": "application/json"},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"maxOutputTokens": 1000, "temperature": 0.2}
            },
            timeout=30
        )
        if response.status_code != 200:
            raise Exception(f"Gemini error {response.status_code}: {response.text}")
        return response.json()["candidates"][0]["content"]["parts"][0]["text"].strip()

    elif provider == "openai":
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}"
            },
            json={
                "model": "gpt-4o-mini",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 1000,
                "temperature": 0.2
            },
            timeout=30
        )
        if response.status_code != 200:
            raise Exception(f"OpenAI error {response.status_code}: {response.text}")
        return response.json()["choices"][0]["message"]["content"].strip()

    else:
        raise Exception(f"Unknown provider: {provider}")


# ── AI Explanation & Suggestions ──────────────────────────────
@app.route("/ai-suggest", methods=["POST"])
def ai_suggest():
    try:
        api_key = os.environ.get("AI_API_KEY", "").strip()
        if not api_key:
            return jsonify({"error": "AI_API_KEY not set. In PowerShell run: $env:AI_API_KEY='your-key-here' then restart Flask."}), 500

        provider = detect_provider(api_key)

        data = request.get_json() or {}
        vitals = data.get("vitals", {})
        issues = data.get("issues", [])
        score  = data.get("risk_score", 0)
        level  = data.get("risk_level", "Unknown")
        cs     = data.get("component_scores", {})
        alerts = data.get("smart_alerts", [])

        issues_text = "\n".join([f"- {i.get('label')}: {i.get('note')} ({i.get('level')} risk)" for i in issues])
        alerts_text = "\n".join([f"- {a.get('type')}: {a.get('message')}" for a in alerts]) if alerts else "None"

        prompt = f"""You are a clinical health advisor AI. Analyze this patient data.

Patient Vitals:
- Age: {vitals.get('age', 'unknown')}
- Heart Rate: {vitals.get('heart_rate')} bpm
- SpO2: {vitals.get('spo2')}%
- Temperature: {vitals.get('temperature')}C
- Activity: {vitals.get('activity_level')}
- Smoking: {vitals.get('smoking')}
- Alcohol: {vitals.get('alcohol')}
- BMI: {vitals.get('bmi', 'not provided')}

Risk Score: {score}/100 ({level} Risk)
Issues: {issues_text}
Smart Alerts: {alerts_text}

Reply ONLY with valid JSON, no markdown fences, no extra text:
{{
  "explanation": "2-3 sentence clinical explanation of what this combination of values means.",
  "smart_alert_summary": "One sentence about the most critical combination risk, or null.",
  "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3", "suggestion 4"],
  "what_if_insight": "One sentence about the single change that would most reduce risk."
}}"""

        raw_text = call_ai(prompt, api_key, provider)

        # Extract JSON even if AI adds extra text around it
        clean = re.sub(r"```json|```", "", raw_text).strip()
        match = re.search(r'\{.*\}', clean, re.DOTALL)
        if match:
            clean = match.group(0)

        return jsonify(json.loads(clean))

    except json.JSONDecodeError as e:
        return jsonify({"error": f"AI returned invalid JSON: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Test AI connection ────────────────────────────────────────
@app.route("/test-ai", methods=["GET"])
def test_ai():
    api_key = os.environ.get("AI_API_KEY", "").strip()
    if not api_key:
        return jsonify({"status": "error", "message": "AI_API_KEY is not set"})
    provider = detect_provider(api_key)
    try:
        text = call_ai("Say hello in exactly 3 words.", api_key, provider)
        return jsonify({"status": "success", "provider": provider, "key_prefix": api_key[:10] + "...", "response": text})
    except Exception as e:
        return jsonify({"status": "error", "provider": provider, "key_prefix": api_key[:10] + "...", "error": str(e)})


# ── Compare existing session with new file ────────────────────
@app.route("/compare-sessions-with-file", methods=["POST"])
def compare_session_with_file():
    if "file" not in request.files or "session_id" not in request.form:
        return jsonify({"error": "Both an existing session and a file are required."}), 400

    file = request.files["file"]
    session_id = request.form["session_id"]
    ext = file.filename.rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED:
        return jsonify({"error": "Unsupported file type."}), 400

    filename = secure_filename(file.filename)
    temp_path = os.path.join(UPLOAD_FOLDER, f"compare_{datetime.utcnow().timestamp()}_{filename}")
    file.save(temp_path)

    try:
        raw_records = load_records_from_file(temp_path, ext)
        if not raw_records:
            return jsonify({"error": "No patient data found in uploaded file."}), 400

        uploaded_results = score_records(raw_records)
        session_doc = analyses_col.find_one({"_id": ObjectId(session_id)})
        if not session_doc:
            return jsonify({"error": "Saved session not found."}), 404

        s1_patients = list(patients_col.find({"session_id": session_id}))
        for p in s1_patients:
            p["_id"] = str(p["_id"])
            if "uploaded_at" in p:
                p["uploaded_at"] = p["uploaded_at"].isoformat()

        s1_map = {p["patient_id"]: p for p in s1_patients}
        s2_map = {p["patient_id"]: p for p in uploaded_results}

        comparison = []
        for pid in sorted(set(list(s1_map.keys()) + list(s2_map.keys()))):
            p1, p2 = s1_map.get(pid), s2_map.get(pid)
            if p1 and p2:
                delta = p2["risk_score"] - p1["risk_score"]
                comparison.append({
                    "patient_id": pid, "before": p1, "after": p2,
                    "delta": delta,
                    "trend": "improved" if delta < -5 else ("declined" if delta > 5 else "stable")
                })

        session_doc["_id"] = str(session_doc["_id"])
        session_doc["uploaded_at"] = session_doc["uploaded_at"].isoformat()

        return jsonify({
            "comparison": comparison,
            "session_1": session_doc,
            "session_2": {"filename": file.filename, "uploaded_at": datetime.utcnow().isoformat(), "patient_count": len(uploaded_results)},
            "summary": {
                "improved": sum(1 for c in comparison if c["trend"] == "improved"),
                "declined": sum(1 for c in comparison if c["trend"] == "declined"),
                "stable":   sum(1 for c in comparison if c["trend"] == "stable"),
                "total":    len(comparison)
            }
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


# ── Compare two saved sessions ────────────────────────────────
@app.route("/compare-sessions", methods=["POST"])
def compare_sessions():
    try:
        body = request.get_json()
        s1_id = body.get("session_id_1")
        s2_id = body.get("session_id_2")

        s1_patients = list(patients_col.find({"session_id": s1_id}))
        s2_patients = list(patients_col.find({"session_id": s2_id}))

        for p in s1_patients + s2_patients:
            p["_id"] = str(p["_id"])
            if "uploaded_at" in p:
                p["uploaded_at"] = p["uploaded_at"].isoformat()

        s1_map = {p["patient_id"]: p for p in s1_patients}
        s2_map = {p["patient_id"]: p for p in s2_patients}

        comparison = []
        for pid in sorted(set(list(s1_map.keys()) + list(s2_map.keys()))):
            p1, p2 = s1_map.get(pid), s2_map.get(pid)
            if p1 and p2:
                delta = p2["risk_score"] - p1["risk_score"]
                comparison.append({
                    "patient_id": pid, "before": p1, "after": p2,
                    "delta": delta,
                    "trend": "improved" if delta < -5 else ("declined" if delta > 5 else "stable")
                })

        def fmt(s):
            if not s: return None
            s["_id"] = str(s["_id"])
            s["uploaded_at"] = s["uploaded_at"].isoformat()
            return s

        return jsonify({
            "comparison": comparison,
            "session_1": fmt(analyses_col.find_one({"_id": ObjectId(s1_id)})),
            "session_2": fmt(analyses_col.find_one({"_id": ObjectId(s2_id)})),
            "summary": {
                "improved": sum(1 for c in comparison if c["trend"] == "improved"),
                "declined": sum(1 for c in comparison if c["trend"] == "declined"),
                "stable":   sum(1 for c in comparison if c["trend"] == "stable"),
                "total":    len(comparison)
            }
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Standard CRUD ─────────────────────────────────────────────
@app.route("/sessions", methods=["GET"])
def get_sessions():
    sessions = list(analyses_col.find().sort("uploaded_at", -1).limit(50))
    for s in sessions:
        s["_id"] = str(s["_id"])
        s["uploaded_at"] = s["uploaded_at"].isoformat()
    return jsonify(sessions)

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

@app.route("/sessions/<session_id>", methods=["DELETE"])
def delete_session(session_id):
    analyses_col.delete_one({"_id": ObjectId(session_id)})
    patients_col.delete_many({"session_id": session_id})
    return jsonify({"deleted": True})

@app.route("/patients", methods=["GET"])
def get_patients():
    risk_filter = request.args.get("risk_level")
    query = {} if not risk_filter or risk_filter == "All" else {"risk_level": risk_filter}
    patients = list(patients_col.find(query).sort("uploaded_at", -1).limit(200))
    for p in patients:
        p["_id"] = str(p["_id"])
        if "uploaded_at" in p:
            p["uploaded_at"] = p["uploaded_at"].isoformat()
    return jsonify(patients)

@app.route("/stats", methods=["GET"])
def get_stats():
    recent = list(analyses_col.find().sort("uploaded_at", -1).limit(5))
    for r in recent:
        r["_id"] = str(r["_id"])
        r["uploaded_at"] = r["uploaded_at"].isoformat()
    return jsonify({
        "total_patients": patients_col.count_documents({}),
        "total_sessions": analyses_col.count_documents({}),
        "high_risk":   patients_col.count_documents({"risk_level": "High"}),
        "medium_risk": patients_col.count_documents({"risk_level": "Medium"}),
        "low_risk":    patients_col.count_documents({"risk_level": "Low"}),
        "recent_sessions": recent,
    })

if __name__ == "__main__":
    app.run(debug=True, port=5000)