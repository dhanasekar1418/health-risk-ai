import { useEffect, useState } from "react";

function StatCard({ value, label, color, icon }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: color + "22", color }}>{icon}</div>
      <div>
        <div className="stat-value" style={{ color }}>{value ?? "—"}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

function RiskBadge({ level }) {
  const map = { High: "#E24B4A", Medium: "#EF9F27", Low: "#3B9B5E" };
  const color = map[level] || "#888";
  return (
    <span className="risk-badge" style={{ background: color + "22", color }}>
      {level || "—"}
    </span>
  );
}

export default function Dashboard({ stats, lastResults, onNavigate, onRefresh, API }) {
  const [recentPatients, setRecentPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecent();
  }, [stats]);

  const fetchRecent = async () => {
    try {
      const res = await fetch(`${API}/patients`);
      const data = await res.json();
      setRecentPatients(data.slice(0, 10));
    } catch (e) {}
    setLoading(false);
  };

  const total = stats?.total_patients || 0;
  const high = stats?.high_risk || 0;
  const medium = stats?.medium_risk || 0;
  const low = stats?.low_risk || 0;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">Overview of all patient health risk data</p>
        </div>
        <button className="btn-primary" onClick={() => onNavigate("upload")}>
          + Upload New File
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <StatCard value={total}   label="Total Patients"  color="#6366F1" icon="👤" />
        <StatCard value={high}    label="High Risk"       color="#E24B4A" icon="⚠️" />
        <StatCard value={medium}  label="Medium Risk"     color="#EF9F27" icon="⚡" />
        <StatCard value={low}     label="Low Risk"        color="#3B9B5E" icon="✅" />
        <StatCard value={stats?.total_sessions || 0} label="Total Uploads" color="#0EA5E9" icon="📁" />
      </div>

      {/* Risk distribution bar */}
      {total > 0 && (
        <div className="section-card">
          <div className="section-title">Risk Distribution</div>
          <div className="dist-bar-wrap">
            <div className="dist-bar">
              {high   > 0 && <div style={{ width:`${(high/total)*100}%`,   background:"#E24B4A" }} title={`High: ${high}`} />}
              {medium > 0 && <div style={{ width:`${(medium/total)*100}%`, background:"#EF9F27" }} title={`Medium: ${medium}`} />}
              {low    > 0 && <div style={{ width:`${(low/total)*100}%`,    background:"#3B9B5E" }} title={`Low: ${low}`} />}
            </div>
            <div className="dist-legend">
              <span><span className="leg-dot" style={{background:"#E24B4A"}} />High ({high})</span>
              <span><span className="leg-dot" style={{background:"#EF9F27"}} />Medium ({medium})</span>
              <span><span className="leg-dot" style={{background:"#3B9B5E"}} />Low ({low})</span>
            </div>
          </div>
        </div>
      )}

      {/* Recent Patients */}
      <div className="section-card">
        <div className="section-header">
          <div className="section-title">Recent Patients</div>
          <button className="btn-link" onClick={() => onNavigate("reports")}>View all →</button>
        </div>
        {loading ? (
          <div className="empty-state">Loading...</div>
        ) : recentPatients.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📂</div>
            <p>No patients yet. <button className="btn-link" onClick={() => onNavigate("upload")}>Upload a file</button> to get started.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Age</th>
                <th>Heart Rate</th>
                <th>SpO₂</th>
                <th>Temp</th>
                <th>Score</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {recentPatients.map((p, i) => (
                <tr key={i}>
                  <td className="td-bold">{p.patient_id}</td>
                  <td>{p.vitals?.age || "—"}</td>
                  <td>{p.vitals?.heart_rate ? `${p.vitals.heart_rate} bpm` : "—"}</td>
                  <td>{p.vitals?.spo2 ? `${p.vitals.spo2}%` : "—"}</td>
                  <td>{p.vitals?.temperature ? `${p.vitals.temperature}°C` : "—"}</td>
                  <td>
                    <span className="score-pill" style={{color: p.risk_color, background: p.risk_color+"22"}}>
                      {p.risk_score}
                    </span>
                  </td>
                  <td><RiskBadge level={p.risk_level} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent sessions */}
      {stats?.recent_sessions?.length > 0 && (
        <div className="section-card">
          <div className="section-title">Recent Uploads</div>
          <div className="sessions-list">
            {stats.recent_sessions.map((s, i) => (
              <div key={i} className="session-row">
                <span className="session-file">📁 {s.filename}</span>
                <span className="session-count">{s.patient_count} patients</span>
                <span className="session-date">{new Date(s.uploaded_at).toLocaleString()}</span>
                <div className="session-mini-risks">
                  <span style={{color:"#E24B4A"}}>▲{s.summary?.high_risk||0}</span>
                  <span style={{color:"#EF9F27"}}>◆{s.summary?.medium_risk||0}</span>
                  <span style={{color:"#3B9B5E"}}>●{s.summary?.low_risk||0}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
