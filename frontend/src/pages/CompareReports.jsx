import { useState, useEffect } from "react";

const API = "http://localhost:5000";

const riskColor = (l) => l === "High" ? "#E24B4A" : l === "Medium" ? "#EF9F27" : "#3B9B5E";
const trendIcon = (t) => t === "improved" ? "▼" : t === "declined" ? "▲" : "─";
const trendColor = (t) => t === "improved" ? "#3B9B5E" : t === "declined" ? "#E24B4A" : "#94A3B8";

function MiniBar({ score, color, label }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94A3B8", marginBottom: 3 }}>
        <span>{label}</span><span style={{ color }}>{score}</span>
      </div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${score}%`, background: color }} />
      </div>
    </div>
  );
}

export default function CompareReports() {
  const [sessions, setSessions] = useState([]);
  const [sel1, setSel1] = useState("");
  const [sel2, setSel2] = useState("");
  const [file, setFile] = useState(null);
  const [compareMode, setCompareMode] = useState("session");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API}/sessions`).then(r => r.json()).then(setSessions).catch(() => {});
  }, []);

  const compare = async () => {
    setError(null);
    if (compareMode === "session") {
      if (!sel1 || !sel2 || sel1 === sel2) {
        return setError("Select two different saved uploads to compare.");
      }
      setLoading(true);
      try {
        const res = await fetch(`${API}/compare-sessions`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id_1: sel1, session_id_2: sel2 })
        });
        const data = await res.json();
        setResult(data);
      } catch (e) {
        setError("Error comparing sessions. Please try again.");
      }
      setLoading(false);
      return;
    }

    if (compareMode === "file") {
      if (!sel1 || !file) {
        return setError("Choose one saved upload and a local file from your computer.");
      }
      setLoading(true);
      try {
        const fd = new FormData();
        fd.append("session_id", sel1);
        fd.append("file", file);
        const res = await fetch(`${API}/compare-sessions-with-file`, {
          method: "POST",
          body: fd,
        });
        const data = await res.json();
        setResult(data);
        if (data.error) {
          setError(data.error);
        }
      } catch (e) {
        setError("Error comparing with local file. Check the file format and try again.");
      }
      setLoading(false);
    }
  };

  const fmt = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">📈 Multi-Report Comparison</h1>
          <p className="page-sub">Compare two uploads to track patient health improvements or declines over time</p>
        </div>
      </div>

      <div className="section-card">
        <div className="section-title">Compare Uploads</div>
        <div className="compare-mode-row">
          <button className={compareMode === "session" ? "mode-btn active" : "mode-btn"} onClick={() => setCompareMode("session")}>Compare Saved Uploads</button>
          <button className={compareMode === "file" ? "mode-btn active" : "mode-btn"} onClick={() => setCompareMode("file")}>Compare with Local File</button>
        </div>
        {error && <div className="error-alert" style={{ marginTop: 10 }}>{error}</div>}

        {compareMode === "session" ? (
          <>
            <div className="section-title" style={{ marginTop: 20 }}>Select Two Uploads to Compare</div>
            <div className="compare-select-row">
          <div className="compare-select-block">
            <label className="sim-slider-label">Earlier Report (Before)</label>
            <select className="sim-select full" value={sel1} onChange={e => setSel1(e.target.value)}>
              <option value="">— Choose upload —</option>
              {sessions.map(s => (
                <option key={s._id} value={s._id}>
                  {s.filename} · {fmt(s.uploaded_at)} · {s.patient_count} patients
                </option>
              ))}
            </select>
          </div>
          <div className="compare-vs">VS</div>
          <div className="compare-select-block">
            <label className="sim-slider-label">Recent Report (After)</label>
            <select className="sim-select full" value={sel2} onChange={e => setSel2(e.target.value)}>
              <option value="">— Choose upload —</option>
              {sessions.map(s => (
                <option key={s._id} value={s._id}>
                  {s.filename} · {fmt(s.uploaded_at)} · {s.patient_count} patients
                </option>
              ))}
            </select>
          </div>
          <button className="btn-primary" onClick={compare} disabled={loading || !sel1 || !sel2}>
            {loading ? "Comparing…" : "Compare →"}
          </button>
        </div>
        {sessions.length < 2 && (
          <div className="info-notice">ℹ️ You need at least 2 uploads to compare. Go to Upload Data and upload two files with the same patient IDs.</div>
        )}
          </>
        ) : (
          <>
            <div className="compare-select-row">
              <div className="compare-select-block full-width">
                <label className="sim-slider-label">Select Saved Upload</label>
                <select className="sim-select full" value={sel1} onChange={e => setSel1(e.target.value)}>
                  <option value="">— Choose upload —</option>
                  {sessions.map(s => (
                    <option key={s._id} value={s._id}>
                      {s.filename} · {fmt(s.uploaded_at)} · {s.patient_count} patients
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="compare-file-block">
              <label className="btn-secondary" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                Choose Local File
                <input type="file" accept=".csv,.json,.pdf,.txt" style={{ display: "none" }}
                  onChange={e => { if (e.target.files[0]) setFile(e.target.files[0]); }} />
              </label>
              {file && <span className="file-name">{file.name}</span>}
            </div>
            <button className="btn-primary" onClick={compare} disabled={loading || !sel1 || !file}>
              {loading ? "Comparing…" : "Compare with File →"}
            </button>
            {sessions.length < 1 && (
              <div className="info-notice">ℹ️ Upload at least one file first, then compare it with a local file.</div>
            )}
          </>
        )}
      </div>

      <div className="section-card">
        <div className="section-title">Upload History</div>
        {sessions.length === 0 ? (
          <div className="empty-state">No uploads yet. Upload a file to start comparing.</div>
        ) : (
          <div className="history-grid">
            {sessions.map(s => (
              <div key={s._id} className="history-card">
                <div className="history-title">{s.filename}</div>
                <div className="history-meta">{fmt(s.uploaded_at)} · {s.patient_count} patients</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {result && (
        <>
          {/* Summary */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon" style={{ background: "#6366F122", color: "#6366F1" }}>👥</div>
              <div><div className="stat-value" style={{ color: "#6366F1" }}>{result.summary.total}</div><div className="stat-label">Matched Patients</div></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: "#3B9B5E22", color: "#3B9B5E" }}>📉</div>
              <div><div className="stat-value" style={{ color: "#3B9B5E" }}>{result.summary.improved}</div><div className="stat-label">Improved</div></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: "#E24B4A22", color: "#E24B4A" }}>📈</div>
              <div><div className="stat-value" style={{ color: "#E24B4A" }}>{result.summary.declined}</div><div className="stat-label">Declined</div></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: "#94A3B822", color: "#94A3B8" }}>➡️</div>
              <div><div className="stat-value" style={{ color: "#94A3B8" }}>{result.summary.stable}</div><div className="stat-label">Stable</div></div>
            </div>
          </div>

          {/* Session labels */}
          <div className="compare-session-labels">
            <div className="csl before">
              <span className="csl-badge before-badge">BEFORE</span>
              <span className="csl-name">{result.session_1?.filename}</span>
              <span className="csl-date">{fmt(result.session_1?.uploaded_at)}</span>
            </div>
            <div className="csl after">
              <span className="csl-badge after-badge">AFTER</span>
              <span className="csl-name">{result.session_2?.filename}</span>
              <span className="csl-date">{fmt(result.session_2?.uploaded_at)}</span>
            </div>
          </div>

          {/* Patient comparisons */}
          {result.comparison.map((c, i) => {
            const { before, after, delta, trend } = c;
            const tc = trendColor(trend);
            return (
              <div key={i} className="compare-patient-card" style={{ borderLeft: `4px solid ${tc}` }}>
                <div className="cpc-header">
                  <div className="cpc-name">{c.patient_id}</div>
                  <div className="cpc-trend" style={{ color: tc, background: tc + "15" }}>
                    {trendIcon(trend)} {trend === "improved" ? "Improved" : trend === "declined" ? "Declined" : "Stable"}
                    {delta !== 0 && <span style={{ marginLeft: 6, fontWeight: 700 }}>({delta > 0 ? "+" : ""}{delta} pts)</span>}
                  </div>
                </div>

                <div className="cpc-body">
                  {/* Before */}
                  <div className="cpc-side">
                    <div className="cpc-side-label before-badge-sm">BEFORE</div>
                    <div className="cpc-score-row">
                      <span className="cpc-score" style={{ color: riskColor(before.risk_level) }}>{before.risk_score}</span>
                      <span className="risk-badge" style={{ color: riskColor(before.risk_level), background: riskColor(before.risk_level) + "22" }}>{before.risk_level}</span>
                    </div>
                    <MiniBar score={before.component_scores?.heart_rate?.score ?? 0} color="#E24B4A" label="Heart Rate" />
                    <MiniBar score={before.component_scores?.spo2?.score ?? 0} color="#3B9B5E" label="SpO₂" />
                    <MiniBar score={before.component_scores?.temperature?.score ?? 0} color="#EF9F27" label="Temp" />
                    <MiniBar score={before.component_scores?.lifestyle?.score ?? 0} color="#6366F1" label="Lifestyle" />
                    <div className="cpc-vitals">
                      <span>❤️ {before.vitals?.heart_rate}bpm</span>
                      <span>🫁 {before.vitals?.spo2}%</span>
                      <span>🌡️ {before.vitals?.temperature}°C</span>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="cpc-arrow" style={{ color: tc }}>
                    <div style={{ fontSize: 24 }}>→</div>
                    <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4 }}>
                      {delta === 0 ? "No change" : delta < 0 ? `${Math.abs(delta)} pts better` : `${delta} pts worse`}
                    </div>
                  </div>

                  {/* After */}
                  <div className="cpc-side">
                    <div className="cpc-side-label after-badge-sm">AFTER</div>
                    <div className="cpc-score-row">
                      <span className="cpc-score" style={{ color: riskColor(after.risk_level) }}>{after.risk_score}</span>
                      <span className="risk-badge" style={{ color: riskColor(after.risk_level), background: riskColor(after.risk_level) + "22" }}>{after.risk_level}</span>
                    </div>
                    <MiniBar score={after.component_scores?.heart_rate?.score ?? 0} color="#E24B4A" label="Heart Rate" />
                    <MiniBar score={after.component_scores?.spo2?.score ?? 0} color="#3B9B5E" label="SpO₂" />
                    <MiniBar score={after.component_scores?.temperature?.score ?? 0} color="#EF9F27" label="Temp" />
                    <MiniBar score={after.component_scores?.lifestyle?.score ?? 0} color="#6366F1" label="Lifestyle" />
                    <div className="cpc-vitals">
                      <span>❤️ {after.vitals?.heart_rate}bpm</span>
                      <span>🫁 {after.vitals?.spo2}%</span>
                      <span>🌡️ {after.vitals?.temperature}°C</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
