import { useState, useCallback } from "react";
import "./App.css";

const API_URL = "http://localhost:5000";

// ─── Utility ──────────────────────────────────────────────────────────────────

function getRiskColor(level) {
  if (level === "High") return "#E24B4A";
  if (level === "Medium") return "#EF9F27";
  return "#3B9B5E";
}

function getRiskBg(level) {
  if (level === "High") return "#FEF2F2";
  if (level === "Medium") return "#FFFBEB";
  return "#F0FDF4";
}

// ─── Components ───────────────────────────────────────────────────────────────

function DropZone({ onFile, loading }) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) onFile(file);
    },
    [onFile]
  );

  const handleChange = (e) => {
    const file = e.target.files[0];
    if (file) onFile(file);
  };

  return (
    <div
      className={`dropzone ${dragging ? "dragging" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <div className="drop-icon">📂</div>
      <p className="drop-title">Drop your health data file here</p>
      <p className="drop-sub">Supports CSV, JSON, PDF, TXT</p>
      <label className="upload-btn">
        {loading ? "Analyzing..." : "Choose File"}
        <input
          type="file"
          accept=".csv,.json,.pdf,.txt"
          onChange={handleChange}
          style={{ display: "none" }}
          disabled={loading}
        />
      </label>
    </div>
  );
}

function ScoreCircle({ score, level }) {
  const color = getRiskColor(level);
  const radius = 44;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;

  return (
    <div className="score-circle-wrap">
      <svg width="110" height="110" viewBox="0 0 110 110">
        <circle cx="55" cy="55" r={radius} fill="none" stroke="#E5E7EB" strokeWidth="8" />
        <circle
          cx="55" cy="55" r={radius}
          fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 55 55)"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
        <text x="55" y="52" textAnchor="middle" fontSize="22" fontWeight="600" fill={color}>{score}</text>
        <text x="55" y="68" textAnchor="middle" fontSize="11" fill="#9CA3AF">/ 100</text>
      </svg>
    </div>
  );
}

function ComponentBar({ label, score, level }) {
  const color = getRiskColor(level);
  return (
    <div className="comp-bar">
      <span className="comp-label">{label}</span>
      <div className="bar-track">
        <div
          className="bar-fill"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      <span className="comp-val" style={{ color }}>{score}</span>
    </div>
  );
}

function IssueItem({ issue }) {
  const color = getRiskColor(issue.level);
  return (
    <div className="issue-item">
      <span className="issue-dot" style={{ background: color }} />
      <div>
        <span className="issue-label">{issue.label}: </span>
        <span className="issue-note">{issue.note}</span>
      </div>
    </div>
  );
}

function PatientCard({ result, index }) {
  const [expanded, setExpanded] = useState(false);

  if (result.error) {
    return (
      <div className="patient-card error-card">
        <div className="patient-header">
          <span className="patient-id">{result.patient_id}</span>
          <span className="error-badge">Parse Error</span>
        </div>
        <p className="error-msg">{result.error}</p>
      </div>
    );
  }

  const { risk_score, risk_level, component_scores, issues, suggestions, vitals } = result;
  const color = getRiskColor(risk_level);
  const bg = getRiskBg(risk_level);

  return (
    <div className="patient-card" style={{ borderLeft: `4px solid ${color}` }}>
      {/* Header row */}
      <div className="patient-header" onClick={() => setExpanded(!expanded)} style={{ cursor: "pointer" }}>
        <div className="patient-id-block">
          <span className="patient-id">{result.patient_id}</span>
          {vitals?.age && <span className="patient-age">Age {vitals.age}</span>}
        </div>
        <div className="patient-header-right">
          <span className="risk-badge" style={{ background: bg, color }}>
            {risk_level} Risk
          </span>
          <ScoreCircle score={risk_score} level={risk_level} />
          <span className="expand-icon">{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* Vitals summary pills */}
      <div className="vitals-row">
        {vitals?.heart_rate && <span className="vital-pill">❤️ {vitals.heart_rate} bpm</span>}
        {vitals?.spo2 && <span className="vital-pill">🫁 SpO₂ {vitals.spo2}%</span>}
        {vitals?.temperature && <span className="vital-pill">🌡️ {vitals.temperature}°C</span>}
        {vitals?.bmi && <span className="vital-pill">⚖️ BMI {vitals.bmi}</span>}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="patient-detail">
          {/* Component scores */}
          <div className="detail-section">
            <div className="detail-title">Score breakdown</div>
            <ComponentBar label="Heart Rate" score={component_scores.heart_rate.score} level={component_scores.heart_rate.level} />
            <ComponentBar label="SpO₂" score={component_scores.spo2.score} level={component_scores.spo2.level} />
            <ComponentBar label="Temperature" score={component_scores.temperature.score} level={component_scores.temperature.level} />
            <ComponentBar label="Lifestyle" score={component_scores.lifestyle.score} level={component_scores.lifestyle.level} />
          </div>

          {/* Issues */}
          <div className="detail-section">
            <div className="detail-title">Issues detected</div>
            {issues.map((issue, i) => <IssueItem key={i} issue={issue} />)}
          </div>

          {/* Suggestions */}
          <div className="detail-section suggestions-box">
            <div className="detail-title">💡 Suggestions</div>
            {suggestions.map((s, i) => (
              <div key={i} className="suggestion-item">{s}</div>
            ))}
          </div>

          {/* Formula */}
          <div className="formula-box">
            <span className="formula-text">
              Risk Score = 0.30 × HR({component_scores.heart_rate.score}) + 0.30 × SpO₂({component_scores.spo2.score}) + 0.20 × Temp({component_scores.temperature.score}) + 0.20 × Lifestyle({component_scores.lifestyle.score}) = <strong>{risk_score}</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryBar({ summary }) {
  const total = summary.total;
  return (
    <div className="summary-bar">
      <div className="summary-stat">
        <span className="stat-num">{total}</span>
        <span className="stat-label">Total Patients</span>
      </div>
      <div className="summary-stat" style={{ color: "#E24B4A" }}>
        <span className="stat-num">{summary.high_risk}</span>
        <span className="stat-label">High Risk</span>
      </div>
      <div className="summary-stat" style={{ color: "#EF9F27" }}>
        <span className="stat-num">{summary.medium_risk}</span>
        <span className="stat-label">Medium Risk</span>
      </div>
      <div className="summary-stat" style={{ color: "#3B9B5E" }}>
        <span className="stat-num">{summary.low_risk}</span>
        <span className="stat-label">Low Risk</span>
      </div>
      <div className="risk-bar-strip">
        {summary.high_risk > 0 && (
          <div style={{ width: `${(summary.high_risk / total) * 100}%`, background: "#E24B4A", height: "8px", borderRadius: "4px 0 0 4px" }} />
        )}
        {summary.medium_risk > 0 && (
          <div style={{ width: `${(summary.medium_risk / total) * 100}%`, background: "#EF9F27", height: "8px" }} />
        )}
        {summary.low_risk > 0 && (
          <div style={{ width: `${(summary.low_risk / total) * 100}%`, background: "#3B9B5E", height: "8px", borderRadius: "0 4px 4px 0" }} />
        )}
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [results, setResults] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filename, setFilename] = useState(null);
  const [filter, setFilter] = useState("All");

  const handleFile = async (file) => {
    setLoading(true);
    setError(null);
    setResults(null);
    setSummary(null);
    setFilename(file.name);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_URL}/analyze`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Analysis failed");
      } else {
        setResults(data.results);
        setSummary(data.summary);
      }
    } catch (e) {
      setError("Cannot connect to backend. Make sure Flask server is running on port 5000.");
    } finally {
      setLoading(false);
    }
  };

  const filtered = results?.filter(
    (r) => filter === "All" || r.risk_level === filter
  );

  const reset = () => {
    setResults(null);
    setSummary(null);
    setError(null);
    setFilename(null);
    setFilter("All");
  };

  return (
    <div className="app-root">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="logo">
          <span className="logo-icon">🏥</span>
          <span className="logo-text">HealthRisk<br /><small>Analyzer</small></span>
        </div>
        <nav className="nav">
          <div className="nav-item active">📊 Dashboard</div>
          <div className="nav-item">📁 Upload Data</div>
          <div className="nav-item">📋 Reports</div>
          <div className="nav-item">⚙️ Settings</div>
        </nav>
        <div className="sidebar-footer">
          <div className="workflow-steps">
            <div className="wf-step">① Input File</div>
            <div className="wf-arrow">↓</div>
            <div className="wf-step">② Preprocess</div>
            <div className="wf-arrow">↓</div>
            <div className="wf-step">③ Risk Score</div>
            <div className="wf-arrow">↓</div>
            <div className="wf-step">④ Results</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        <header className="top-bar">
          <div>
            <h1 className="page-title">Health Risk Dashboard</h1>
            <p className="page-sub">Upload a CSV, JSON, PDF, or TXT file with patient vitals</p>
          </div>
          {results && (
            <button className="new-btn" onClick={reset}>+ New Analysis</button>
          )}
        </header>

        {/* Upload zone */}
        {!results && !loading && (
          <div className="upload-section">
            <DropZone onFile={handleFile} loading={loading} />
            {error && <div className="error-box">⚠️ {error}</div>}
            <div className="format-info">
              <div className="format-card">
                <div className="format-icon">📄</div>
                <div className="format-name">CSV</div>
                <div className="format-desc">Spreadsheet with columns: age, heart_rate, spo2, temperature…</div>
              </div>
              <div className="format-card">
                <div className="format-icon">🗂️</div>
                <div className="format-name">JSON</div>
                <div className="format-desc">Array of patient objects or {`{patients: [...]}`}</div>
              </div>
              <div className="format-card">
                <div className="format-icon">📋</div>
                <div className="format-name">PDF / TXT</div>
                <div className="format-desc">Free-text report — fields extracted automatically</div>
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="loading-screen">
            <div className="spinner" />
            <p className="loading-title">Analyzing {filename}...</p>
            <div className="loading-steps">
              <span className="ls active">Reading file</span>
              <span className="ls-arrow">→</span>
              <span className="ls active">Extracting fields</span>
              <span className="ls-arrow">→</span>
              <span className="ls active">Scoring risk</span>
              <span className="ls-arrow">→</span>
              <span className="ls">Generating results</span>
            </div>
          </div>
        )}

        {/* Results */}
        {results && summary && (
          <div className="results-section">
            <div className="file-badge">📁 {filename} — {results.length} patient{results.length > 1 ? "s" : ""} analyzed</div>
            <SummaryBar summary={summary} />

            {/* Filter tabs */}
            <div className="filter-tabs">
              {["All", "High", "Medium", "Low"].map((f) => (
                <button
                  key={f}
                  className={`filter-tab ${filter === f ? "active" : ""}`}
                  onClick={() => setFilter(f)}
                >
                  {f === "All" ? `All (${results.length})` : `${f} Risk (${summary[f.toLowerCase() + "_risk"] || 0})`}
                </button>
              ))}
            </div>

            {/* Patient cards */}
            <div className="patient-list">
              {filtered?.length === 0 && (
                <div className="empty-filter">No patients with {filter} risk level.</div>
              )}
              {filtered?.map((result, i) => (
                <PatientCard key={i} result={result} index={i} />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
