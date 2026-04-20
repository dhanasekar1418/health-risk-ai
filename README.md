# 🏥 HealthRisk Analyzer v2

Full-stack health risk analyzer with **MongoDB**, working sidebar navigation, and all pages functional.

---

## 📁 Structure

```
healthrisk-v2/
├── backend/
│   ├── app.py            ← Flask API + MongoDB
│   ├── risk_engine.py    ← Scoring logic
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx            ← Shell + sidebar navigation
│   │   ├── App.css            ← All styles
│   │   ├── main.jsx
│   │   └── pages/
│   │       ├── Dashboard.jsx  ← Stats + recent patients
│   │       ├── UploadData.jsx ← File upload + results
│   │       ├── Reports.jsx    ← Browse all sessions & patients
│   │       └── Settings.jsx   ← DB status + danger zone
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── sample-data/
    └── patients.csv
```

---

## 🚀 Setup & Run

### 1. Install MongoDB (if not installed)
Download from: https://www.mongodb.com/try/download/community
- Install and start MongoDB service
- Default runs on: `mongodb://localhost:27017/`

### 2. Backend
```bash
cd backend
pip install -r requirements.txt
python app.py
```
Runs on: http://localhost:5000

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```
Runs on: http://localhost:3000

---

## 🗄️ MongoDB Collections

### `healthrisk.analyses`
Stores each file upload session:
```json
{
  "_id": ObjectId,
  "filename": "patients.csv",
  "uploaded_at": ISODate,
  "patient_count": 8,
  "summary": { "total": 8, "high_risk": 2, "medium_risk": 3, "low_risk": 3 }
}
```

### `healthrisk.patients`
Stores every patient result:
```json
{
  "_id": ObjectId,
  "session_id": "...",
  "patient_id": "P001",
  "risk_score": 72,
  "risk_level": "High",
  "vitals": { "age": 45, "heart_rate": 115, "spo2": 93, "temperature": 38.3, ... },
  "issues": [...],
  "suggestions": [...],
  "component_scores": { ... },
  "uploaded_at": ISODate
}
```

---

## 📡 API Endpoints

| Method | Endpoint              | Description                         |
|--------|-----------------------|-------------------------------------|
| GET    | /health               | Server + DB status check            |
| POST   | /analyze              | Upload file → analyze → save to DB  |
| GET    | /stats                | Dashboard stats                     |
| GET    | /sessions             | All upload sessions                 |
| GET    | /sessions/:id         | One session + its patients          |
| DELETE | /sessions/:id         | Delete session + patients           |
| GET    | /patients             | All patients (filter by risk_level) |

---

## 🧭 Pages

| Page        | What it does                                              |
|-------------|-----------------------------------------------------------|
| Dashboard   | Shows totals, risk distribution bar, recent patients      |
| Upload Data | Drag-drop file → analyze → view results → saved to DB     |
| Reports     | Browse sessions, view patients per session, filter by risk|
| Settings    | DB connection status, collection info, clear all data     |

---

## 🎯 Demo Steps
1. Start MongoDB + Flask + React
2. Go to **Upload Data** → drop `sample-data/patients.csv`
3. See results: 2 High Risk, 3 Medium, 3 Low
4. Click **Go to Dashboard** — see live stats
5. Go to **Reports** → click any session → see patients
6. Go to **Settings** → see MongoDB connection status
