# 🏥 Health Risk Analyzer

A full-stack web application that **reads patient health data from uploaded files** (CSV, JSON, PDF, TXT) and outputs AI-scored health risk assessments.

---

## 📁 Project Structure

```
health-risk-analyzer/
├── backend/
│   ├── app.py              ← Flask API server
│   ├── risk_engine.py      ← Risk scoring logic + PDF/text parser
│   └── requirements.txt    ← Python dependencies
├── frontend/
│   ├── src/
│   │   ├── App.jsx         ← Main React app
│   │   ├── App.css         ← All styles
│   │   └── main.jsx        ← Entry point
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── sample-data/
    ├── patients.csv        ← Sample CSV (8 patients)
    ├── patients.json       ← Sample JSON (4 patients)
    └── report.txt          ← Sample free-text report
```

---

## 🚀 How to Run

### Step 1 — Start the Backend (Flask)

```bash
cd backend
pip install -r requirements.txt
python app.py
```

Backend runs at: **http://localhost:5000**

### Step 2 — Start the Frontend (React)

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: **http://localhost:3000**

---

## 🔄 Functional Workflow

```
User uploads file (CSV / JSON / PDF / TXT)
         ↓
Backend reads & parses file
         ↓
Fields extracted: age, heart_rate, spo2, temperature, activity, smoking, alcohol, bmi
         ↓
Risk Engine scores each vital:
  • Heart Rate scoring
  • SpO₂ oxygen scoring  
  • Temperature scoring
  • Lifestyle scoring
         ↓
Weighted Risk Score calculation:
  Score = 0.30×HR + 0.30×SpO₂ + 0.20×Temp + 0.20×Lifestyle
         ↓
Risk Level assigned: Low / Medium / High
         ↓
Issues detected + Suggestions generated
         ↓
JSON response → Frontend renders dashboard
```

---

## 📊 Risk Scoring Logic

| Vital | Threshold | Risk Level |
|-------|-----------|------------|
| SpO₂ | < 90% | High |
| SpO₂ | 90–94% | Medium |
| Heart Rate | > 130 bpm | High |
| Heart Rate | > 110 bpm | Medium |
| Temperature | > 38.5°C | High |
| Temperature | > 38.0°C | Medium |
| Lifestyle | Heavy smoking/alcohol + sedentary | High |

**Weighted Formula:**
```
Risk Score = 0.30 × HR_score + 0.30 × SpO₂_score + 0.20 × Temp_score + 0.20 × Lifestyle_score
```

---

## 📂 Supported File Formats

### CSV
Must have columns (any order, flexible naming):
```
patient_id, name, age, heart_rate, spo2, temperature, activity_level, smoking, alcohol, bmi
```

### JSON
Single patient or array or `{patients: [...]}`:
```json
[
  { "age": 45, "heart_rate": 115, "spo2": 93, "temperature": 38.3, "smoking": "regular" }
]
```

### PDF / TXT
Free-text health reports — fields auto-extracted via regex:
```
Patient: P001
Age: 45
Heart Rate: 115 bpm
SpO2: 93%
Temperature: 38.3
```

---

## 🎯 Demo Scenario

Upload `sample-data/patients.csv` to see:
- **Suresh Pillai (P005)** → 🔴 High Risk (Score: 85) — HR 130, SpO₂ 89%, fever 39.1°C
- **Priya Nair (P002)** → 🟢 Low Risk (Score: 12) — all vitals normal
- **Arjun Sharma (P001)** → 🟡 Medium Risk (Score: 52) — elevated HR, low SpO₂

---

## ⚙️ API Reference

### POST /analyze
Upload a file for analysis.

**Request:** `multipart/form-data` with field `file`

**Response:**
```json
{
  "filename": "patients.csv",
  "summary": {
    "total": 8,
    "high_risk": 2,
    "medium_risk": 3,
    "low_risk": 3
  },
  "results": [
    {
      "patient_id": "P001",
      "risk_score": 52,
      "risk_level": "Medium",
      "component_scores": { ... },
      "issues": [ ... ],
      "suggestions": [ ... ],
      "vitals": { ... }
    }
  ]
}
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Backend | Python Flask |
| File Parsing | Pandas (CSV), JSON stdlib, pdfplumber (PDF) |
| Risk Engine | Custom weighted scoring algorithm |
| Styling | Pure CSS (no UI library needed) |
