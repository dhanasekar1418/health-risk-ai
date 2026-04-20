import { useState, useEffect } from "react";
import Dashboard from "./pages/Dashboard";
import UploadData from "./pages/UploadData";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import "./App.css";

const API = "http://localhost:5000";

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [stats, setStats] = useState(null);
  const [lastResults, setLastResults] = useState(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API}/stats`);
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error("Stats fetch failed:", e);
    }
  };

  const navItems = [
    { id: "dashboard",  icon: "⊞",  label: "Dashboard" },
    { id: "upload",     icon: "↑",  label: "Upload Data" },
    { id: "reports",    icon: "▤",  label: "Reports" },
    { id: "settings",   icon: "⚙",  label: "Settings" },
  ];

  return (
    <div className="app-shell">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">H</div>
          <div className="brand-text">
            <span className="brand-name">HealthRisk</span>
            <span className="brand-sub">Analyzer</span>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map(item => (
            <button
              key={item.id}
              className={`nav-item ${page === item.id ? "active" : ""}`}
              onClick={() => setPage(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
              {page === item.id && <span className="nav-indicator" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="db-status">
            <span className="db-dot" />
            <span className="db-label">MongoDB Connected</span>
          </div>
          <div className="wf-box">
            <div className="wf-title">Workflow</div>
            {["① Input File","② Preprocess","③ Risk Score","④ Save to DB","⑤ Results"].map((s,i) => (
              <div key={i} className="wf-row">
                <span className="wf-step">{s}</span>
                {i < 4 && <span className="wf-line" />}
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="main-area">
        {page === "dashboard" && (
          <Dashboard
            stats={stats}
            lastResults={lastResults}
            onNavigate={setPage}
            onRefresh={fetchStats}
            API={API}
          />
        )}
        {page === "upload" && (
          <UploadData
            API={API}
            onDone={(results) => {
              setLastResults(results);
              fetchStats();
              setPage("dashboard");
            }}
          />
        )}
        {page === "reports" && (
          <Reports API={API} />
        )}
        {page === "settings" && (
          <Settings API={API} onRefresh={fetchStats} />
        )}
      </main>
    </div>
  );
}
