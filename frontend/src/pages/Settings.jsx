import { useState, useEffect } from "react";

export default function Settings({ API, onRefresh }) {
  const [dbStatus, setDbStatus] = useState("checking");
  const [stats, setStats] = useState(null);
  const [clearing, setClearing] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    checkDB();
    fetchStats();
  }, []);

  const checkDB = async () => {
    try {
      const res = await fetch(`${API}/health`);
      const data = await res.json();
      setDbStatus(data.status === "ok" ? "connected" : "error");
    } catch (e) {
      setDbStatus("error");
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API}/stats`);
      const data = await res.json();
      setStats(data);
    } catch (e) {}
  };

  const clearAll = async () => {
    if (!confirm("⚠️ This will delete ALL patients and sessions from MongoDB. Are you sure?")) return;
    setClearing(true);
    try {
      const sessRes = await fetch(`${API}/sessions`);
      const sessions = await sessRes.json();
      for (const s of sessions) {
        await fetch(`${API}/sessions/${s._id}`, { method: "DELETE" });
      }
      setMsg({ type: "success", text: "All data cleared from MongoDB." });
      fetchStats();
      onRefresh();
    } catch (e) {
      setMsg({ type: "error", text: "Failed to clear data." });
    }
    setClearing(false);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">System configuration and database management</p>
        </div>
      </div>

      {msg && (
        <div className={`alert-box ${msg.type}`} style={{marginBottom:"1rem"}}>
          {msg.type === "success" ? "✅" : "❌"} {msg.text}
          <button className="btn-link" onClick={() => setMsg(null)} style={{marginLeft:"1rem"}}>✕</button>
        </div>
      )}

      {/* DB Status */}
      <div className="section-card">
        <div className="section-title">Database Connection</div>
        <div className="settings-row">
          <div>
            <div className="settings-label">MongoDB URI</div>
            <div className="settings-value mono">mongodb://localhost:27017/healthrisk</div>
          </div>
          <div className="db-status-badge" style={{
            background: dbStatus === "connected" ? "#3B9B5E22" : "#E24B4A22",
            color: dbStatus === "connected" ? "#3B9B5E" : "#E24B4A"
          }}>
            <span className="db-dot" style={{background: dbStatus==="connected"?"#3B9B5E":"#E24B4A"}} />
            {dbStatus === "connected" ? "Connected" : dbStatus === "checking" ? "Checking…" : "Disconnected"}
          </div>
        </div>
        <div className="settings-row" style={{marginTop:"1rem",flexWrap:"wrap",gap:"12px"}}>
          {[
            { label: "Database",    value: "healthrisk" },
            { label: "Collections", value: "analyses, patients" },
            { label: "Total Docs",  value: stats ? (stats.total_patients + stats.total_sessions) : "—" },
          ].map(item => (
            <div key={item.label} className="info-tile">
              <div className="info-tile-label">{item.label}</div>
              <div className="info-tile-value">{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Collections info */}
      <div className="section-card">
        <div className="section-title">MongoDB Collections</div>
        <div className="coll-grid">
          <div className="coll-card">
            <div className="coll-icon">📦</div>
            <div className="coll-name">analyses</div>
            <div className="coll-count">{stats?.total_sessions ?? "—"} documents</div>
            <div className="coll-desc">Stores each file upload session with filename, timestamp, and summary stats.</div>
          </div>
          <div className="coll-card">
            <div className="coll-icon">👤</div>
            <div className="coll-name">patients</div>
            <div className="coll-count">{stats?.total_patients ?? "—"} documents</div>
            <div className="coll-desc">Stores every patient result — vitals, risk score, issues, and suggestions.</div>
          </div>
        </div>
      </div>

      {/* Risk thresholds */}
      <div className="section-card">
        <div className="section-title">Risk Scoring Thresholds</div>
        <table className="data-table">
          <thead>
            <tr><th>Vital</th><th>Threshold</th><th>Risk Level</th></tr>
          </thead>
          <tbody>
            {[
              ["SpO₂",       "< 92%",     "High"],
              ["SpO₂",       "92 – 94%",  "Medium"],
              ["Heart Rate", "> 130 bpm", "High"],
              ["Heart Rate", "110 – 130", "Medium"],
              ["Temperature","≥ 38.5°C",  "High"],
              ["Temperature","38 – 38.5°C","Medium"],
            ].map(([v,t,l],i) => (
              <tr key={i}>
                <td>{v}</td>
                <td className="mono">{t}</td>
                <td>
                  <span className="risk-badge" style={{
                    color: l==="High"?"#E24B4A":"#EF9F27",
                    background: l==="High"?"#E24B4A22":"#EF9F2722"
                  }}>{l}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="formula-pill" style={{marginTop:"1rem"}}>
          Weighted Formula: Risk Score = 0.30×HR + 0.30×SpO₂ + 0.20×Temp + 0.20×Lifestyle
        </div>
      </div>

      {/* Danger zone */}
      <div className="section-card danger-zone">
        <div className="section-title" style={{color:"#E24B4A"}}>⚠️ Danger Zone</div>
        <div className="settings-row">
          <div>
            <div className="settings-label">Clear All Data</div>
            <div className="settings-value">Permanently delete all sessions and patients from MongoDB.</div>
          </div>
          <button className="btn-danger" onClick={clearAll} disabled={clearing}>
            {clearing ? "Clearing…" : "Clear All Data"}
          </button>
        </div>
      </div>
    </div>
  );
}
