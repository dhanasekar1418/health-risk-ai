import { useState, useEffect } from "react";
import Dashboard from "./pages/Dashboard";
import UploadData from "./pages/UploadData";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import WhatIfSimulator from "./pages/WhatIfSimulator";
import CompareReports from "./pages/CompareReports";
import "./App.css";

const API = "http://localhost:5000";

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [stats, setStats] = useState(null);
  const [lastResults, setLastResults] = useState(null);

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API}/stats`);
      setStats(await res.json());
    } catch (e) {}
  };

  const navItems = [
    { id: "dashboard",  icon: "⊞",  label: "Dashboard",        badge: null },
    { id: "upload",     icon: "↑",  label: "Upload Data",       badge: null },
    { id: "reports",    icon: "▤",  label: "Reports",           badge: null },
    { id: "separator" },
    { id: "simulator",  icon: "🔥", label: "What-If Simulator", badge: "NEW" },
    { id: "compare",    icon: "📈", label: "Compare Reports",   badge: "NEW" },
    { id: "separator2" },
    { id: "settings",   icon: "⚙",  label: "Settings",          badge: null },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">H</div>
          <div className="brand-text">
            <span className="brand-name">HealthRisk</span>
            <span className="brand-sub">Analyzer v3</span>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map((item, i) => {
            if (item.id?.startsWith("separator")) {
              return <div key={i} className="nav-separator" />;
            }
            return (
              <button
                key={item.id}
                className={`nav-item ${page === item.id ? "active" : ""}`}
                onClick={() => setPage(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
                {item.badge && <span className="nav-badge">{item.badge}</span>}
                {page === item.id && <span className="nav-indicator" />}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="db-status">
            <span className="db-dot" />
            <span className="db-label">MongoDB Connected</span>
          </div>
          <div className="wf-box">
            <div className="wf-title">5 Unique Features</div>
            {[
              "🔥 What-If Simulator",
              "🧠 AI Explanation",
              "⚠️ Smart Alerts",
              "📊 Risk Breakdown",
              "📈 Multi-Report Compare",
            ].map((s, i) => (
              <div key={i} className="wf-row">
                <span className="wf-step">{s}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main className="main-area">
        {page === "dashboard"  && <Dashboard stats={stats} lastResults={lastResults} onNavigate={setPage} onRefresh={fetchStats} API={API} />}
        {page === "upload"     && <UploadData API={API} onDone={(r) => { setLastResults(r); fetchStats(); setPage("dashboard"); }} />}
        {page === "reports"    && <Reports API={API} />}
        {page === "simulator"  && <WhatIfSimulator />}
        {page === "compare"    && <CompareReports />}
        {page === "settings"   && <Settings API={API} onRefresh={fetchStats} />}
      </main>
    </div>
  );
}
