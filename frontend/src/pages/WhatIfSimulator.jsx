import { useState } from "react";

const API = "http://localhost:5000";

function ScoreGauge({ score, level, label }) {
  const color = level === "High" ? "#E24B4A" : level === "Medium" ? "#EF9F27" : "#3B9B5E";
  const r = 52, circ = 2 * Math.PI * r;
  return (
    <div style={{ textAlign: "center" }}>
      <svg width="130" height="130" viewBox="0 0 130 130">
        <circle cx="65" cy="65" r={r} fill="none" stroke="#F1F5F9" strokeWidth="10" />
        <circle cx="65" cy="65" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={circ} strokeDashoffset={circ - (score / 100) * circ}
          strokeLinecap="round" transform="rotate(-90 65 65)"
          style={{ transition: "stroke-dashoffset 0.6s ease" }} />
        <text x="65" y="60" textAnchor="middle" fontSize="26" fontWeight="700" fill={color}>{score}</text>
        <text x="65" y="76" textAnchor="middle" fontSize="11" fill="#94A3B8">/100</text>
      </svg>
      <div style={{ fontSize: 13, fontWeight: 600, color, marginTop: 4 }}>{level} Risk</div>
      <div style={{ fontSize: 11, color: "#94A3B8" }}>{label}</div>
    </div>
  );
}

function Slider({ label, unit, value, min, max, step = 1, onChange, color }) {
  return (
    <div className="sim-slider-row">
      <div className="sim-slider-header">
        <span className="sim-slider-label">{label}</span>
        <span className="sim-slider-val" style={{ color }}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="sim-range" />
      <div className="sim-range-limits"><span>{min}{unit}</span><span>{max}{unit}</span></div>
    </div>
  );
}

export default function WhatIfSimulator() {
  const [vitals, setVitals] = useState({
    age: 40, heart_rate: 90, spo2: 96, temperature: 37.0,
    activity_level: "moderate", smoking: "no", alcohol: "no", bmi: 25
  });
  const [original, setOriginal] = useState(null);
  const [current,  setCurrent]  = useState(null);
  const [loading, setLoading]   = useState(false);
  const [simulating, setSimulating] = useState(false);

  const setV = (key, val) => {
    setVitals(prev => ({ ...prev, [key]: val }));
  };

  const runOriginal = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/simulate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vitals)
      });
      const data = await res.json();
      setOriginal({ ...data, vitals: { ...vitals } });
      setCurrent({ ...data, vitals: { ...vitals } });
    } catch (e) { alert("Backend not reachable"); }
    setLoading(false);
  };

  const runSimulate = async () => {
    setSimulating(true);
    try {
      const res = await fetch(`${API}/simulate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vitals)
      });
      const data = await res.json();
      setCurrent({ ...data, vitals: { ...vitals } });
    } catch (e) {}
    setSimulating(false);
  };

  const reset = () => { setCurrent(original); setVitals(original.vitals); };

  const delta = current && original ? current.risk_score - original.risk_score : 0;
  const deltaColor = delta < 0 ? "#3B9B5E" : delta > 0 ? "#E24B4A" : "#94A3B8";

  const riskColor = (l) => l === "High" ? "#E24B4A" : l === "Medium" ? "#EF9F27" : "#3B9B5E";

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">🔥 What-If Simulator</h1>
          <p className="page-sub">Modify vitals and see how risk changes in real time — "what can be" not just "what is"</p>
        </div>
      </div>

      <div className="sim-layout">
        {/* Controls */}
        <div className="section-card sim-controls">
          <div className="section-title">Adjust Vitals</div>

          <Slider label="Age" unit="y" value={vitals.age} min={10} max={90}
            onChange={v => setV("age", v)} color="#6366F1" />
          <Slider label="Heart Rate" unit=" bpm" value={vitals.heart_rate} min={40} max={160}
            onChange={v => setV("heart_rate", v)} color="#E24B4A" />
          <Slider label="SpO₂ Oxygen" unit="%" value={vitals.spo2} min={80} max={100}
            onChange={v => setV("spo2", v)} color="#3B9B5E" />
          <Slider label="Temperature" unit="°C" value={vitals.temperature} min={35} max={41} step={0.1}
            onChange={v => setV("temperature", parseFloat(v.toFixed(1)))} color="#EF9F27" />
          <Slider label="BMI" unit="" value={vitals.bmi} min={15} max={45} step={0.5}
            onChange={v => setV("bmi", v)} color="#6366F1" />

          <div className="sim-selects">
            {[
              { key: "activity_level", label: "Activity", opts: ["sedentary","low","moderate","active","very_active"] },
              { key: "smoking", label: "Smoking", opts: ["no","occasional","regular","heavy"] },
              { key: "alcohol",  label: "Alcohol",  opts: ["no","occasional","regular","heavy"] },
            ].map(f => (
              <div key={f.key} className="sim-select-row">
                <label className="sim-slider-label">{f.label}</label>
                <select className="sim-select" value={vitals[f.key]} onChange={e => setV(f.key, e.target.value)}>
                  {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div className="sim-btns">
            {!original ? (
              <button className="btn-primary w-full" onClick={runOriginal} disabled={loading}>
                {loading ? "Calculating…" : "Set as Baseline →"}
              </button>
            ) : (
              <>
                <button className="btn-primary" onClick={runSimulate} disabled={simulating}>
                  {simulating ? "…" : "▶ Simulate"}
                </button>
                <button className="btn-secondary" onClick={reset}>Reset</button>
              </>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="sim-results-col">
          {!original ? (
            <div className="section-card sim-empty">
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎛️</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Set your baseline first</div>
              <p style={{ color: "#94A3B8", fontSize: 14 }}>Adjust the sliders to your current vitals, then click "Set as Baseline" to begin exploring what-if scenarios.</p>
            </div>
          ) : (
            <>
              {/* Score comparison */}
              <div className="section-card">
                <div className="section-title">Risk Score Comparison</div>
                <div className="sim-score-row">
                  <ScoreGauge score={original.risk_score} level={original.risk_level} label="Baseline" />
                  <div className="sim-arrow-col">
                    <div className="sim-delta" style={{ color: deltaColor, background: deltaColor + "15" }}>
                      {delta === 0 ? "No change" : delta > 0 ? `▲ +${delta} worse` : `▼ ${delta} better`}
                    </div>
                    <div style={{ fontSize: 24, color: "#CBD5E1" }}>→</div>
                  </div>
                  <ScoreGauge score={current.risk_score} level={current.risk_level} label="Simulated" />
                </div>
              </div>

              {/* Component breakdown */}
              <div className="section-card">
                <div className="section-title">Score Breakdown (Before → After)</div>
                {[
                  ["Heart Rate", "heart_rate"],
                  ["SpO₂",       "spo2"],
                  ["Temperature","temperature"],
                  ["Lifestyle",  "lifestyle"],
                ].map(([name, key]) => {
                  const before = original.component_scores[key]?.score ?? 0;
                  const after  = current.component_scores[key]?.score  ?? 0;
                  const d = after - before;
                  const afterLevel = current.component_scores[key]?.level;
                  const afterColor = riskColor(afterLevel);
                  return (
                    <div key={key} className="sim-comp-row">
                      <span className="sim-comp-name">{name}</span>
                      <div className="sim-comp-bars">
                        <div className="bar-track"><div className="bar-fill" style={{ width: `${before}%`, background: "#CBD5E1" }} /></div>
                        <div className="bar-track"><div className="bar-fill" style={{ width: `${after}%`, background: afterColor, transition: "width 0.5s ease" }} /></div>
                      </div>
                      <span className="sim-comp-delta" style={{ color: d < 0 ? "#3B9B5E" : d > 0 ? "#E24B4A" : "#94A3B8" }}>
                        {d === 0 ? "—" : d > 0 ? `+${d}` : d}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Smart Alerts */}
              {current.smart_alerts?.length > 0 && (
                <div className="section-card">
                  <div className="section-title">⚠️ Smart Alerts (Simulated)</div>
                  {current.smart_alerts.map((a, i) => (
                    <div key={i} className="alert-strip" style={{ borderColor: a.color, background: a.color + "10" }}>
                      <span className="alert-type" style={{ color: a.color }}>{a.type}</span>
                      <p className="alert-msg">{a.message}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* What-if insight */}
              {current.risk_level !== "Low" && (
                <div className="section-card insight-card">
                  <div className="section-title">💡 What-If Insight</div>
                  <p className="insight-text">
                    {current.component_scores.spo2.score > current.component_scores.heart_rate.score
                      ? `Improving SpO₂ from ${vitals.spo2}% to 96%+ would have the biggest impact on your score.`
                      : `Reducing heart rate from ${vitals.heart_rate} bpm to below 100 bpm would most reduce your risk score.`}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
