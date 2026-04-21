import { useState, useCallback } from "react";

const API = "http://localhost:5000";

const riskColor = (l) => l === "High" ? "#E24B4A" : l === "Medium" ? "#EF9F27" : "#3B9B5E";

function ScoreCircle({ score, level }) {
  const color = riskColor(level);
  const r = 36, circ = 2 * Math.PI * r;
  return (
    <svg width="88" height="88" viewBox="0 0 88 88">
      <circle cx="44" cy="44" r={r} fill="none" stroke="#E5E7EB" strokeWidth="6" />
      <circle cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={circ} strokeDashoffset={circ - (score / 100) * circ}
        strokeLinecap="round" transform="rotate(-90 44 44)"
        style={{ transition: "stroke-dashoffset 0.8s ease" }} />
      <text x="44" y="40" textAnchor="middle" fontSize="18" fontWeight="700" fill={color}>{score}</text>
      <text x="44" y="54" textAnchor="middle" fontSize="10" fill="#9CA3AF">/100</text>
    </svg>
  );
}

function AIPanel({ result }) {
  const [ai, setAi] = useState(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const fetch_ai = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/ai-suggest`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vitals: result.vitals, issues: result.issues,
          risk_score: result.risk_score, risk_level: result.risk_level,
          component_scores: result.component_scores, smart_alerts: result.smart_alerts
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAi(data);
      setDone(true);
    } catch (e) {
      setAi({ error: "AI service unavailable. Check backend is running." });
      setDone(true);
    }
    setLoading(false);
  };

  return (
    <div className="detail-block ai-panel">
      <div className="detail-label">🧠 AI-Based Explanation & Suggestions</div>
      {!done && !loading && (
        <button className="btn-ai" onClick={fetch_ai}>Get AI Analysis →</button>
      )}
      {loading && (
        <div className="ai-loading">
          <span className="ai-spinner" /> Generating clinical analysis…
        </div>
      )}
      {ai && !ai.error && (
        <div className="ai-content">
          {/* Explanation */}
          <div className="ai-section">
            <div className="ai-section-label">🔍 Clinical Explanation</div>
            <p className="ai-text">{ai.explanation}</p>
          </div>

          {/* Smart alert from AI */}
          {ai.smart_alert_summary && ai.smart_alert_summary !== "null" && (
            <div className="ai-alert-box">
              <span className="ai-alert-icon">⚠️</span>
              <p className="ai-text">{ai.smart_alert_summary}</p>
            </div>
          )}

          {/* Suggestions */}
          <div className="ai-section">
            <div className="ai-section-label">💊 Personalized Suggestions</div>
            {ai.suggestions?.map((s, i) => (
              <div key={i} className="ai-suggestion-item">
                <span className="sug-num">{i + 1}</span>
                <span>{s}</span>
              </div>
            ))}
          </div>

          {/* What-if insight */}
          {ai.what_if_insight && (
            <div className="ai-insight-box">
              <span>🎯 </span>{ai.what_if_insight}
            </div>
          )}
        </div>
      )}
      {ai?.error && <div className="ai-error">{ai.error}</div>}
    </div>
  );
}

function PatientCard({ result }) {
  const [open, setOpen] = useState(false);
  if (result.error) {
    return (
      <div className="p-card error-p">
        <span className="td-bold">{result.patient_id}</span>
        <span className="err-msg">⚠ {result.error}</span>
      </div>
    );
  }
  const { risk_score, risk_level, risk_color, component_scores, issues, suggestions, vitals, smart_alerts } = result;

  const total_weight = 100;
  const contributions = [
    { name: "Heart Rate", weight: 30, score: component_scores.heart_rate.score, key: "heart_rate" },
    { name: "SpO₂",       weight: 30, score: component_scores.spo2.score,       key: "spo2" },
    { name: "Temperature",weight: 20, score: component_scores.temperature.score, key: "temperature" },
    { name: "Lifestyle",  weight: 20, score: component_scores.lifestyle.score,   key: "lifestyle" },
  ];

  return (
    <div className="p-card" style={{ borderLeft: `4px solid ${risk_color}` }}>
      <div className="p-card-top" onClick={() => setOpen(!open)}>
        <div className="p-left">
          <div className="p-name">{result.patient_id}</div>
          <div className="p-vitals-row">
            {vitals?.age         && <span className="vpill">🎂 {vitals.age}y</span>}
            {vitals?.heart_rate  && <span className="vpill">❤️ {vitals.heart_rate}bpm</span>}
            {vitals?.spo2        && <span className="vpill">🫁 {vitals.spo2}%</span>}
            {vitals?.temperature && <span className="vpill">🌡️ {vitals.temperature}°C</span>}
            {vitals?.bmi         && <span className="vpill">⚖️ BMI {vitals.bmi}</span>}
            {smart_alerts?.length > 0 && (
              <span className="vpill alert-pill">⚠️ {smart_alerts.length} alert{smart_alerts.length > 1 ? "s" : ""}</span>
            )}
          </div>
        </div>
        <div className="p-right">
          <span className="risk-badge" style={{ color: risk_color, background: risk_color + "22" }}>{risk_level} Risk</span>
          <ScoreCircle score={risk_score} level={risk_level} />
          <span className="expand-caret">{open ? "▲" : "▼"}</span>
        </div>
      </div>

      {open && (
        <div className="p-detail-v3">

          {/* ── FEATURE 3: Smart Alerts ── */}
          {smart_alerts?.length > 0 && (
            <div className="detail-full">
              <div className="detail-label">⚠️ Smart Alerts — Combination Patterns</div>
              {smart_alerts.map((a, i) => (
                <div key={i} className="alert-strip" style={{ borderColor: a.color, background: a.color + "10" }}>
                  <span className="alert-type" style={{ color: a.color }}>{a.type}</span>
                  <p className="alert-msg">{a.message}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── FEATURE 4: Risk Breakdown ── */}
          <div className="detail-block">
            <div className="detail-label">📊 Risk Breakdown (Explainable AI)</div>
            {contributions.map(c => {
              const contribution = Math.round((c.weight / 100) * c.score);
              const col = riskColor(component_scores[c.key].level);
              return (
                <div key={c.key} className="breakdown-row">
                  <div className="bd-top">
                    <span className="bd-name">{c.name}</span>
                    <span className="bd-weight">Weight: {c.weight}%</span>
                    <span className="bd-contrib" style={{ color: col }}>Contributes {contribution} pts</span>
                  </div>
                  <div className="bar-row">
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${c.score}%`, background: col }} />
                    </div>
                    <span className="bar-num" style={{ color: col }}>{c.score}</span>
                  </div>
                </div>
              );
            })}
            <div className="formula-pill">
              Score = 0.30×HR({component_scores.heart_rate.score}) + 0.30×SpO₂({component_scores.spo2.score}) + 0.20×Temp({component_scores.temperature.score}) + 0.20×Lifestyle({component_scores.lifestyle.score}) = <b>{risk_score}</b>
            </div>
          </div>

          {/* Issues */}
          <div className="detail-block">
            <div className="detail-label">🔎 Issues Detected</div>
            {issues.map((iss, i) => {
              const c = riskColor(iss.level);
              return (
                <div key={i} className="issue-row">
                  <span className="iss-dot" style={{ background: c }} />
                  <span className="iss-label">{iss.label}:</span>
                  <span className="iss-note">{iss.note}</span>
                </div>
              );
            })}
          </div>

          {/* ── FEATURE 2: AI Explanation ── */}
          <AIPanel result={result} />

        </div>
      )}
    </div>
  );
}

export default function UploadData({ API: _API, onDone }) {
  const [dragging, setDragging] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [results,  setResults]  = useState(null);
  const [summary,  setSummary]  = useState(null);
  const [filename, setFilename] = useState(null);
  const [filter,   setFilter]   = useState("All");

  const handleFile = useCallback(async (file) => {
    setLoading(true); setError(null); setResults(null);
    setFilename(file.name);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`${API}/analyze`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) setError(data.error);
      else { setResults(data.results); setSummary(data.summary); }
    } catch (e) {
      setError("Cannot connect to backend. Is Flask running on port 5000?");
    }
    setLoading(false);
  }, []);

  const filtered = results?.filter(r => filter === "All" || r.risk_level === filter);

  if (results && summary) {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <h1 className="page-title">Analysis Results</h1>
            <p className="page-sub">📁 {filename} — {results.length} patients · saved to MongoDB · click a card to expand</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn-secondary" onClick={() => { setResults(null); setSummary(null); }}>Upload Another</button>
            <button className="btn-primary" onClick={() => onDone(results)}>→ Dashboard</button>
          </div>
        </div>

        <div className="stats-grid">
          {[
            { value: summary.total,       label: "Total",      color: "#6366F1", icon: "👥" },
            { value: summary.high_risk,   label: "High Risk",  color: "#E24B4A", icon: "⚠️" },
            { value: summary.medium_risk, label: "Medium",     color: "#EF9F27", icon: "⚡" },
            { value: summary.low_risk,    label: "Low Risk",   color: "#3B9B5E", icon: "✅" },
          ].map((s, i) => (
            <div key={i} className="stat-card">
              <div className="stat-icon" style={{ background: s.color + "22", color: s.color }}>{s.icon}</div>
              <div><div className="stat-value" style={{ color: s.color }}>{s.value}</div><div className="stat-label">{s.label}</div></div>
            </div>
          ))}
        </div>

        <div className="filter-bar">
          {["All", "High", "Medium", "Low"].map(f => (
            <button key={f} className={`filter-tab ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
              {f === "All" ? `All (${results.length})` : `${f} (${summary[f.toLowerCase() + "_risk"]})`}
            </button>
          ))}
        </div>

        <div className="p-list">
          {filtered?.map((r, i) => <PatientCard key={i} result={r} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Upload Data</h1>
          <p className="page-sub">Upload a patient health data file for AI-powered risk analysis</p>
        </div>
      </div>

      {loading ? (
        <div className="loading-box">
          <div className="spinner" />
          <div className="loading-title">Analyzing {filename}…</div>
          <div className="loading-steps">
            {["Reading file", "Extracting fields", "Scoring risk", "Smart alerts", "Saving to MongoDB"].map((s, i) => (
              <span key={i} className="ls active">{s}{i < 4 && <span className="ls-arr"> → </span>}</span>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div
            className={`dropzone ${dragging ? "drag-over" : ""}`}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          >
            <div className="drop-icon-big">📂</div>
            <div className="drop-title">Drop your health data file here</div>
            <div className="drop-sub">Supports CSV, JSON, PDF, TXT</div>
            <label className="btn-primary" style={{ cursor: "pointer", marginTop: "1rem" }}>
              Choose File
              <input type="file" accept=".csv,.json,.pdf,.txt" style={{ display: "none" }}
                onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); }} />
            </label>
          </div>

          {error && <div className="error-alert">⚠️ {error}</div>}

          <div className="format-grid">
            {[
              { icon: "📄", name: "CSV", desc: "Columns: patient_id, age, heart_rate, spo2, temperature, activity_level, smoking, alcohol, bmi" },
              { icon: "🗂️", name: "JSON", desc: 'Array of patient objects or { "patients": [...] }' },
              { icon: "📋", name: "PDF / TXT", desc: "Free-text health report — fields extracted automatically" },
            ].map(f => (
              <div key={f.name} className="format-card">
                <div className="format-icon">{f.icon}</div>
                <div className="format-name">{f.name}</div>
                <div className="format-desc">{f.desc}</div>
              </div>
            ))}
          </div>

          <div className="sample-section">
            <div className="detail-label">Sample CSV</div>
            <pre className="code-box">{`patient_id,name,age,heart_rate,spo2,temperature,activity_level,smoking,alcohol,bmi
P001,Arjun Sharma,45,115,93,38.3,sedentary,regular,occasional,28.5
P002,Priya Nair,32,72,98,36.8,active,no,no,22.1`}</pre>
          </div>
        </>
      )}
    </div>
  );
}
