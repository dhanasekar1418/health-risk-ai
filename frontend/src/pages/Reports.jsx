import { useState, useEffect } from "react";

export default function Reports({ API }) {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [patients, setPatients] = useState([]);
  const [filterRisk, setFilterRisk] = useState("All");
  const [loading, setLoading] = useState(true);
  const [patLoading, setPatLoading] = useState(false);
  const [view, setView] = useState("sessions"); // "sessions" | "patients"
  const [allPatients, setAllPatients] = useState([]);

  useEffect(() => {
    fetchSessions();
    fetchAllPatients();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${API}/sessions`);
      const data = await res.json();
      setSessions(data);
    } catch (e) {}
    setLoading(false);
  };

  const fetchAllPatients = async () => {
    try {
      const res = await fetch(`${API}/patients`);
      const data = await res.json();
      setAllPatients(data);
    } catch (e) {}
  };

  const openSession = async (session) => {
    setSelectedSession(session);
    setPatLoading(true);
    try {
      const res = await fetch(`${API}/sessions/${session._id}`);
      const data = await res.json();
      setPatients(data.patients);
    } catch (e) {}
    setPatLoading(false);
  };

  const deleteSession = async (id, e) => {
    e.stopPropagation();
    if (!confirm("Delete this session and all its patients?")) return;
    await fetch(`${API}/sessions/${id}`, { method: "DELETE" });
    setSessions(prev => prev.filter(s => s._id !== id));
    if (selectedSession?._id === id) { setSelectedSession(null); setPatients([]); }
    fetchAllPatients();
  };

  const filteredAll = allPatients.filter(p => filterRisk === "All" || p.risk_level === filterRisk);

  const riskColor = (l) => l==="High"?"#E24B4A":l==="Medium"?"#EF9F27":"#3B9B5E";

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-sub">All analysis sessions and patient records from MongoDB</p>
        </div>
        <div className="tab-group">
          <button className={`tab-btn ${view==="sessions"?"active":""}`} onClick={()=>setView("sessions")}>By Session</button>
          <button className={`tab-btn ${view==="patients"?"active":""}`} onClick={()=>setView("patients")}>All Patients</button>
        </div>
      </div>

      {/* ── By Session view ── */}
      {view === "sessions" && (
        <div className="reports-layout">
          {/* Session list */}
          <div className="session-panel">
            <div className="panel-title">Upload Sessions ({sessions.length})</div>
            {loading && <div className="empty-state">Loading…</div>}
            {!loading && sessions.length === 0 && (
              <div className="empty-state">No sessions yet. Upload a file first.</div>
            )}
            {sessions.map(s => (
              <div
                key={s._id}
                className={`session-item ${selectedSession?._id === s._id ? "selected" : ""}`}
                onClick={() => openSession(s)}
              >
                <div className="si-top">
                  <span className="si-file">📁 {s.filename}</span>
                  <button className="del-btn" onClick={e => deleteSession(s._id, e)}>🗑</button>
                </div>
                <div className="si-meta">
                  <span>{s.patient_count} patients</span>
                  <span>{new Date(s.uploaded_at).toLocaleDateString()}</span>
                </div>
                <div className="si-risks">
                  <span style={{color:"#E24B4A"}}>High: {s.summary?.high_risk||0}</span>
                  <span style={{color:"#EF9F27"}}>Med: {s.summary?.medium_risk||0}</span>
                  <span style={{color:"#3B9B5E"}}>Low: {s.summary?.low_risk||0}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Patient detail for session */}
          <div className="patient-panel">
            {!selectedSession && (
              <div className="empty-state">← Select a session to view patients</div>
            )}
            {selectedSession && (
              <>
                <div className="panel-title">
                  Patients in "{selectedSession.filename}"
                  <span className="panel-date"> · {new Date(selectedSession.uploaded_at).toLocaleString()}</span>
                </div>
                {patLoading && <div className="empty-state">Loading patients…</div>}
                {!patLoading && (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Patient ID</th><th>Age</th><th>HR</th><th>SpO₂</th><th>Temp</th><th>BMI</th><th>Score</th><th>Risk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {patients.map((p, i) => (
                        <tr key={i}>
                          <td className="td-bold">{p.patient_id}</td>
                          <td>{p.vitals?.age||"—"}</td>
                          <td>{p.vitals?.heart_rate ? `${p.vitals.heart_rate} bpm`:  "—"}</td>
                          <td>{p.vitals?.spo2       ? `${p.vitals.spo2}%`         :  "—"}</td>
                          <td>{p.vitals?.temperature? `${p.vitals.temperature}°C` :  "—"}</td>
                          <td>{p.vitals?.bmi        ||"—"}</td>
                          <td>
                            <span className="score-pill" style={{color:riskColor(p.risk_level),background:riskColor(p.risk_level)+"22"}}>
                              {p.risk_score}
                            </span>
                          </td>
                          <td>
                            <span className="risk-badge" style={{color:riskColor(p.risk_level),background:riskColor(p.risk_level)+"22"}}>
                              {p.risk_level}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── All Patients view ── */}
      {view === "patients" && (
        <div>
          <div className="filter-bar" style={{marginBottom:"1rem"}}>
            {["All","High","Medium","Low"].map(f => (
              <button key={f} className={`filter-tab ${filterRisk===f?"active":""}`} onClick={()=>setFilterRisk(f)}>
                {f} {f!=="All" && `(${allPatients.filter(p=>p.risk_level===f).length})`}
              </button>
            ))}
            <span className="filter-count">{filteredAll.length} patients shown</span>
          </div>
          <div className="section-card" style={{padding:0,overflow:"hidden"}}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Patient ID</th><th>Age</th><th>Heart Rate</th><th>SpO₂</th><th>Temp</th><th>Smoking</th><th>Activity</th><th>Score</th><th>Risk</th><th>Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {filteredAll.length === 0 && (
                  <tr><td colSpan="10" style={{textAlign:"center",padding:"2rem",color:"#9CA3AF"}}>No patients found</td></tr>
                )}
                {filteredAll.map((p, i) => (
                  <tr key={i}>
                    <td className="td-bold">{p.patient_id}</td>
                    <td>{p.vitals?.age||"—"}</td>
                    <td>{p.vitals?.heart_rate ? `${p.vitals.heart_rate} bpm` : "—"}</td>
                    <td>{p.vitals?.spo2       ? `${p.vitals.spo2}%`         : "—"}</td>
                    <td>{p.vitals?.temperature? `${p.vitals.temperature}°C` : "—"}</td>
                    <td>{p.vitals?.smoking||"—"}</td>
                    <td>{p.vitals?.activity_level||"—"}</td>
                    <td>
                      <span className="score-pill" style={{color:riskColor(p.risk_level),background:riskColor(p.risk_level)+"22"}}>
                        {p.risk_score}
                      </span>
                    </td>
                    <td>
                      <span className="risk-badge" style={{color:riskColor(p.risk_level),background:riskColor(p.risk_level)+"22"}}>
                        {p.risk_level}
                      </span>
                    </td>
                    <td style={{fontSize:"12px",color:"#9CA3AF"}}>
                      {p.uploaded_at ? new Date(p.uploaded_at).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
