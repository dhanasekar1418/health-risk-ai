import { useState, useCallback } from "react";

function ScoreCircle({ score, level }) {
  const color = level === "High" ? "#E24B4A" : level === "Medium" ? "#EF9F27" : "#3B9B5E";
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
  const { risk_score, risk_level, risk_color, component_scores, issues, suggestions, vitals } = result;
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
          </div>
        </div>
        <div className="p-right">
          <span className="risk-badge" style={{ background: risk_color+"22", color: risk_color }}>
            {risk_level} Risk
          </span>
          <ScoreCircle score={risk_score} level={risk_level} />
          <span className="expand-caret">{open ? "▲" : "▼"}</span>
        </div>
      </div>

      {open && (
        <div className="p-detail">
          {/* Component bars */}
          <div className="detail-block">
            <div className="detail-label">Score Breakdown</div>
            {[
              ["Heart Rate", component_scores.heart_rate],
              ["SpO₂",       component_scores.spo2],
              ["Temperature",component_scores.temperature],
              ["Lifestyle",  component_scores.lifestyle],
            ].map(([name, cs]) => {
              const c = cs.level==="High"?"#E24B4A":cs.level==="Medium"?"#EF9F27":"#3B9B5E";
              return (
                <div key={name} className="bar-row">
                  <span className="bar-name">{name}</span>
                  <div className="bar-track"><div className="bar-fill" style={{width:`${cs.score}%`,background:c}} /></div>
                  <span className="bar-num" style={{color:c}}>{cs.score}</span>
                </div>
              );
            })}
            <div className="formula-pill">
              Score = 0.30×HR({component_scores.heart_rate.score}) + 0.30×SpO₂({component_scores.spo2.score}) + 0.20×Temp({component_scores.temperature.score}) + 0.20×Lifestyle({component_scores.lifestyle.score}) = <b>{risk_score}</b>
            </div>
          </div>

          {/* Issues */}
          <div className="detail-block">
            <div className="detail-label">Issues Detected</div>
            {issues.map((iss, i) => {
              const c = iss.level==="High"?"#E24B4A":iss.level==="Medium"?"#EF9F27":"#3B9B5E";
              return (
                <div key={i} className="issue-row">
                  <span className="iss-dot" style={{background:c}} />
                  <span className="iss-label">{iss.label}:</span>
                  <span className="iss-note">{iss.note}</span>
                </div>
              );
            })}
          </div>

          {/* Suggestions */}
          <div className="detail-block sug-block">
            <div className="detail-label">💡 Suggestions</div>
            {suggestions.map((s, i) => <div key={i} className="sug-item">{s}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function UploadData({ API, onDone }) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [summary, setSummary] = useState(null);
  const [filename, setFilename] = useState(null);
  const [filter, setFilter] = useState("All");

  const handleFile = useCallback(async (file) => {
    setLoading(true); setError(null); setResults(null);
    setFilename(file.name);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`${API}/analyze`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error); }
      else { setResults(data.results); setSummary(data.summary); }
    } catch (e) {
      setError("Cannot connect to backend. Is Flask running on port 5000?");
    }
    setLoading(false);
  }, [API]);

  const filtered = results?.filter(r => filter === "All" || r.risk_level === filter);

  if (results && summary) {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <h1 className="page-title">Analysis Results</h1>
            <p className="page-sub">📁 {filename} — {results.length} patients analyzed · saved to MongoDB</p>
          </div>
          <div style={{display:"flex",gap:"10px"}}>
            <button className="btn-secondary" onClick={() => { setResults(null); setSummary(null); }}>Upload Another</button>
            <button className="btn-primary" onClick={() => onDone(results)}>Go to Dashboard →</button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="stats-grid">
          <div className="stat-card"><div className="stat-icon" style={{background:"#6366F122",color:"#6366F1"}}>👥</div><div><div className="stat-value" style={{color:"#6366F1"}}>{summary.total}</div><div className="stat-label">Total</div></div></div>
          <div className="stat-card"><div className="stat-icon" style={{background:"#E24B4A22",color:"#E24B4A"}}>⚠️</div><div><div className="stat-value" style={{color:"#E24B4A"}}>{summary.high_risk}</div><div className="stat-label">High Risk</div></div></div>
          <div className="stat-card"><div className="stat-icon" style={{background:"#EF9F2722",color:"#EF9F27"}}>⚡</div><div><div className="stat-value" style={{color:"#EF9F27"}}>{summary.medium_risk}</div><div className="stat-label">Medium Risk</div></div></div>
          <div className="stat-card"><div className="stat-icon" style={{background:"#3B9B5E22",color:"#3B9B5E"}}>✅</div><div><div className="stat-value" style={{color:"#3B9B5E"}}>{summary.low_risk}</div><div className="stat-label">Low Risk</div></div></div>
        </div>

        {/* Filter */}
        <div className="filter-bar">
          {["All","High","Medium","Low"].map(f => (
            <button key={f} className={`filter-tab ${filter===f?"active":""}`} onClick={() => setFilter(f)}>
              {f === "All" ? `All (${results.length})` : `${f} (${summary[f.toLowerCase()+"_risk"]})`}
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
          <p className="page-sub">Upload a patient health data file to analyze</p>
        </div>
      </div>

      {loading ? (
        <div className="loading-box">
          <div className="spinner" />
          <div className="loading-title">Analyzing {filename}…</div>
          <div className="loading-steps">
            {["Reading file","Extracting fields","Scoring risk","Saving to MongoDB"].map((s,i) => (
              <span key={i} className="ls active">{s}{i<3&&<span className="ls-arr"> → </span>}</span>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div
            className={`dropzone ${dragging ? "drag-over" : ""}`}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if(f) handleFile(f); }}
          >
            <div className="drop-icon-big">📂</div>
            <div className="drop-title">Drop your health data file here</div>
            <div className="drop-sub">Supports CSV, JSON, PDF, TXT</div>
            <label className="btn-primary" style={{cursor:"pointer",marginTop:"1rem"}}>
              Choose File
              <input type="file" accept=".csv,.json,.pdf,.txt" style={{display:"none"}} onChange={e => { if(e.target.files[0]) handleFile(e.target.files[0]); }} />
            </label>
          </div>

          {error && <div className="error-alert">⚠️ {error}</div>}

          <div className="format-grid">
            {[
              { icon:"📄", name:"CSV",      desc:"Columns: patient_id, age, heart_rate, spo2, temperature, activity_level, smoking, alcohol, bmi" },
              { icon:"🗂️",  name:"JSON",     desc:'Array of patient objects, or { "patients": [...] }' },
              { icon:"📋", name:"PDF / TXT", desc:"Free-text health report — fields extracted automatically via pattern matching" },
            ].map(f => (
              <div key={f.name} className="format-card">
                <div className="format-icon">{f.icon}</div>
                <div className="format-name">{f.name}</div>
                <div className="format-desc">{f.desc}</div>
              </div>
            ))}
          </div>

          <div className="sample-section">
            <div className="detail-label">Sample CSV row</div>
            <pre className="code-box">{`patient_id,name,age,heart_rate,spo2,temperature,activity_level,smoking,alcohol,bmi
P001,Arjun Sharma,45,115,93,38.3,sedentary,regular,occasional,28.5
P002,Priya Nair,32,72,98,36.8,active,no,no,22.1`}</pre>
          </div>
        </>
      )}
    </div>
  );
}
