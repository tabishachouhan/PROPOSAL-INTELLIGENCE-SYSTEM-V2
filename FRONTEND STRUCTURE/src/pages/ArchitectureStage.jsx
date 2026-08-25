import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ProcessingState from "../components/ProcessingState";
import { getOpportunity, buildArchitecture } from "../services/api";

const MODALITY_CHANNELS = [
  { key: "sync_in_person", label: "Sync in-person" },
  { key: "sync_virtual", label: "Sync virtual" },
  { key: "async_self_paced", label: "Async self-paced" },
  { key: "async_social", label: "Async social" }
];

const LEARNING_CHANNELS = [
  { key: "lecture", label: "Lecture" },
  { key: "case", label: "Case" },
  { key: "simulation", label: "Simulation" },
  { key: "action_learning", label: "Action learning" },
  { key: "coaching", label: "Coaching" },
  { key: "peer_learning", label: "Peer" },
  { key: "reflection", label: "Reflection" }
];

const rebalanceMix = (mix, changedKey, rawValue) => {
  const keys = Object.keys(mix);
  const clamped = Math.max(0, Math.min(100, Math.round(rawValue)));
  const others = keys.filter((k) => k !== changedKey);
  const othersCurrentTotal = others.reduce((s, k) => s + (Number(mix[k]) || 0), 0);
  const remaining = 100 - clamped;
  const next = { ...mix, [changedKey]: clamped };

  if (othersCurrentTotal <= 0) {
    const even = others.length ? remaining / others.length : 0;
    others.forEach((k) => { next[k] = Math.round(even); });
  } else {
    others.forEach((k) => {
      next[k] = Math.round(((Number(mix[k]) || 0) / othersCurrentTotal) * remaining);
    });
  }

  const drift = 100 - keys.reduce((s, k) => s + next[k], 0);
  if (drift !== 0 && others.length) {
    next[others[others.length - 1]] += drift;
  }
  return next;
};

export default function ArchitectureStage() {
  const navigate = useNavigate();
  const TEMPLATES = [
    { label: "1-Day Briefing",    params: { total_duration_days: 1, format: "residential", reinforcement: "light" } },
    { label: "3-Day Intensive",   params: { total_duration_days: 3, format: "residential", reinforcement: "medium" } },
    { label: "5-Day Residential", params: { total_duration_days: 5, format: "residential", reinforcement: "heavy" } },
    { label: "Hybrid Sprint",     params: { total_duration_days: 3, format: "hybrid", reinforcement: "medium" } },
    { label: "Virtual Series",    params: { total_duration_days: 4, format: "virtual", reinforcement: "medium" } },
  ];

  const [opportunityId, setOpportunityId] = useState(null);
  const [clientName, setClientName] = useState("");
  const [architecture, setArchitecture] = useState(null);
  const [designParameters, setDesignParameters] = useState(null);
  const [suggestedDefaults, setSuggestedDefaults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorRedirect, setErrorRedirect] = useState(null);

  useEffect(() => {
    const id = localStorage.getItem("pis_opportunity_id");
    if (!id) {
      navigate("/new");
      return;
    }
    setOpportunityId(id);
    loadArchitecture(id);
  }, []);

  const loadArchitecture = async (id, force = false, overrideParams = null) => {
    setLoading(true);
    setError(null);
    setErrorRedirect(null);
    try {
      const oppRes = await getOpportunity(id);
      const opp = oppRes.data || oppRes; 
      setClientName(opp.client_name);

      if (opp.architecture?.phases?.length > 0 && !force && !overrideParams) {
        setArchitecture(opp.architecture);
        setDesignParameters(opp.architecture.design_parameters || null);
        const result = await buildArchitecture(id, false, null);
        setSuggestedDefaults(result.suggested_defaults || null);
        setLoading(false);
        return;
      }

      const result = await buildArchitecture(id, force || !!overrideParams, overrideParams);
      setArchitecture(result.architecture);
      setDesignParameters(result.architecture.design_parameters || null);
      setSuggestedDefaults(result.suggested_defaults || null);
    } catch (err) {
      setError(err.response?.data?.error || "Could not load architecture");
      setErrorRedirect(err.response?.data?.redirect_to || null);
    } finally {
      setLoading(false);
    }
  };
  const handleParameterChange = (key, value) => {
    setDesignParameters({ ...designParameters, [key]: value });
  };

  const handleMixSliderChange = (mixKey, channelKey, value) => {
    const currentMix = designParameters?.[mixKey] || {};
    const nextMix = rebalanceMix(currentMix, channelKey, value);
    setDesignParameters({ ...designParameters, [mixKey]: nextMix });
  };

  const resetMixToSuggested = (mixKey) => {
    if (!suggestedDefaults?.[mixKey]) return;
    setDesignParameters({ ...designParameters, [mixKey]: { ...suggestedDefaults[mixKey] } });
  };

  const handleApplyParameters = () => {
    if (!designParameters?.total_duration_days || designParameters.total_duration_days <= 0) return;
    loadArchitecture(opportunityId, true, designParameters);
  };

  const applyTemplate = (templateParams) => {
    setDesignParameters({ ...designParameters, ...templateParams });
    loadArchitecture(opportunityId, true, templateParams);
  };

  if (loading) {
    return (
      <ProcessingState
        steps={[
          "Loading brief, competencies, and modules",
          "Applying design parameters",
          "Sequencing phases and blocks",
          "Checking coverage and load warnings"
        ]}
        estimate="Usually takes 10-15 seconds"
      />
    );
  }

  const totalModules = (architecture?.phases || [])
    .flatMap((p) => p.blocks || [])
    .flatMap((b) => b.modules || []).length;

  const facultyCount = architecture?.derived_metrics?.faculty_utilisation?.length || 0;

  const coverage = architecture?.derived_metrics?.competency_coverage;
  const coveragePct = coverage?.total
    ? Math.round((coverage.covered / coverage.total) * 100)
    : 100;

  const warnings = architecture?.derived_metrics?.warnings || [];

  const modalityTarget = designParameters?.modality_mix || {};
  const modalityActual = architecture?.derived_metrics?.modality_actual_mix || {};
  const channelTarget = designParameters?.channel_mix || {};
  const channelActual = architecture?.derived_metrics?.channel_actual_mix || {};
  const seventyTwentyTen = architecture?.derived_metrics?.seventy_twenty_ten || { formal: 0, social: 0, experiential: 0 };

  return (
    <div style={{ display: "flex", background: "#f1f5f9", minHeight: "100vh" }}>

      {/* SIDEBAR */}
      <div style={{ width: "250px", background: "white", padding: "30px 20px", borderRight: "1px solid #dbeafe" }}>
        <h2 style={{ color: "#2563eb", fontSize: "34px", fontWeight: "800", marginBottom: "40px" }}>
          Proposal AI
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <button className="sideBtn" onClick={() => navigate("/dashboard")}>Dashboard</button>
          <button className="sideBtn" onClick={() => navigate("/new")}>New Opportunity</button>
          <button className="sideBtn" onClick={() => navigate("/questions")}>Decision Questions</button>
          <button className="sideBtn" onClick={() => navigate("/mapping")}>Competency Mapping</button>
          <button className="activeBtn">Programme Architecture</button>
          <button className="sideBtn" onClick={() => navigate("/approach")}>Approach Note</button>
          <button className="sideBtn" onClick={() => navigate("/score")}>Proposal Score</button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ flex: 1, padding: "30px" }}>

        {/* HEADER */}
        <div style={{ background: "white", padding: "25px", borderRadius: "24px", marginBottom: "25px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ color: "#64748b", marginBottom: "10px" }}>
              Opportunities {" > "} {clientName || "..."} {" > "} Architecture
            </p>
            <h1 style={{ fontSize: "52px", color: "#0f172a", margin: 0 }}>
              Programme Architecture
            </h1>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <button className="topBtn" onClick={() => loadArchitecture(opportunityId)}>
              Refresh Validation
            </button>
            <button className="topBtn" onClick={() => alert("Export not built yet")}>
              Export PDF
            </button>
            <button className="saveBtn" onClick={() => navigate("/approach")}>
              Save & Continue
            </button>
          </div>
        </div>

        {error && (
          <div style={{ background: "#fef2f2", color: "#991b1b", padding: "16px", borderRadius: "14px", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 600 }}>{error}</span>
            {errorRedirect && (
              <button className="topBtn" onClick={() => navigate(errorRedirect)}>
                Go Back
              </button>
            )}
          </div>
        )}

        {architecture && (
          <>
            {/* STATS */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "20px", marginBottom: "24px" }}>
              <div className="statCard"><h3>Total Days</h3><h1>{architecture.total_days ?? "-"}</h1></div>
              <div className="statCard"><h3>Total Modules</h3><h1>{totalModules}</h1></div>
              <div className="statCard"><h3>Faculty</h3><h1>{facultyCount}</h1></div>
              <div className="statCard"><h3>Competency Coverage</h3><h1>{coveragePct}%</h1></div>
            </div>

            {/* BODY */}
            <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: "24px" }}>

              {/* LEFT: PHASES */}
              <div>
                {(architecture.phases || []).map((phase, index) => (
                  <div key={index} className="phaseCard">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                      <h2>{phase.phase}</h2>
                      <span className="phaseBadge">{phase.duration}</span>
                    </div>
                    <div style={{ display: "grid", gap: "14px" }}>
                      {(phase.blocks || []).map((block, idx) => (
                        <div key={idx} className="moduleCard">
                          <div>
                            <h3>{block.title}</h3>
                            <p>
                              {block.time_slot}
                              {block.modules?.length ? ` • ${block.modules.join(", ")}` : ""}
                            </p>
                            {(block.modality || block.channel) && (
                              <p style={{ marginTop: "4px" }}>
                                {block.modality && <span className="tagChip">{block.modality.replace(/_/g, " ")}</span>}
                                {block.channel && <span className="tagChip">{block.channel.replace(/_/g, " ")}</span>}
                              </p>
                            )}
                          </div>
                          <span className="phaseBadge">{block.duration_hrs}h</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* RIGHT PANEL */}
              <div style={{ display: "grid", gap: "20px" }}>


                {/* DESIGN PARAMETERS — Layer 1: Programme Shape */}
                <div className="rightCard">
                  <h2>Design Parameters</h2>
                  <span className="provenanceChip">Layer 1 · Shape — seeded from Logistics duration &amp; format</span>
                  <label className="paramLabel">Duration (days)</label>
                  <input
                    type="number"
                    min="1"
                    className="paramInput"
                    value={designParameters?.total_duration_days ?? ""}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setDesignParameters({
                        ...designParameters,
                        total_duration_days: raw === "" ? "" : Number(raw)
                      });
                    }}
                  />
                  <label className="paramLabel">Format</label>
                  <select
                    className="paramInput"
                    value={designParameters?.format || "residential"}
                    onChange={(e) => handleParameterChange("format", e.target.value)}
                  >
                    <option value="residential">Residential</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="virtual">Virtual</option>
                    <option value="modular">Modular</option>
                  </select>
                  <label className="paramLabel">Reinforcement</label>
                  <select
                    className="paramInput"
                    value={designParameters?.reinforcement || "medium"}
                    onChange={(e) => handleParameterChange("reinforcement", e.target.value)}
                  >
                    <option value="light">Light</option>
                    <option value="medium">Medium</option>
                    <option value="heavy">Heavy</option>
                  </select>
                  <label className="paramLabel">Measurement Depth (Kirkpatrick 1-4)</label>
                  <select
                    className="paramInput"
                    value={designParameters?.measurement_depth ?? 2}
                    onChange={(e) => handleParameterChange("measurement_depth", Number(e.target.value))}
                  >
                    <option value={1}>1 — Reaction only</option>
                    <option value={2}>2 — Learning / knowledge check</option>
                    <option value={3}>3 — Behaviour change on the job</option>
                    <option value={4}>4 — Tied to a business KPI</option>
                  </select>

                  <button className="applyBtn" onClick={handleApplyParameters}>
                    Apply Changes & Regenerate
                  </button>
                </div>

                {/* LAYER 2: MODALITY DISTRIBUTION */}
                <div className="rightCard">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <h2>Modality Distribution</h2>
                    <button className="resetLink" onClick={() => resetMixToSuggested("modality_mix")}>Reset to suggested</button>
                  </div>
                  <span className="provenanceChip">Layer 2 · seeded from Logistics format ({designParameters?.format || "residential"})</span>
                  {MODALITY_CHANNELS.map(({ key, label }) => {
                    const target = modalityTarget[key] ?? 0;
                    const actual = modalityActual[key];
                    const drift = actual !== undefined ? Math.abs(actual - target) : null;
                    return (
                      <div key={key} style={{ marginTop: "14px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: 700, color: "#334155" }}>
                          <span>{label}</span>
                          <span>
                            {target}%
                            {actual !== undefined && (
                              <span style={{ color: drift > 10 ? "#f59e0b" : "#94a3b8", marginLeft: "6px" }}>
                                (actual {actual}%)
                              </span>
                            )}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          className="mixSlider"
                          value={target}
                          onChange={(e) => handleMixSliderChange("modality_mix", key, Number(e.target.value))}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* LAYER 3: LEARNING CHANNEL MIX */}
                <div className="rightCard">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <h2>Learning Channel Mix</h2>
                    <button className="resetLink" onClick={() => resetMixToSuggested("channel_mix")}>Reset to suggested</button>
                  </div>
                  <span className="provenanceChip">Layer 3 · seeded from audience level ({designParameters?.audience_level || "Mid"})</span>
                  {LEARNING_CHANNELS.map(({ key, label }) => {
                    const target = channelTarget[key] ?? 0;
                    const actual = channelActual[key];
                    return (
                      <div key={key} style={{ marginTop: "14px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: 700, color: "#334155" }}>
                          <span>{label}</span>
                          <span>
                            {target}%
                            {actual !== undefined && <span style={{ color: "#94a3b8", marginLeft: "6px" }}>(actual {actual}%)</span>}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          className="mixSlider"
                          value={target}
                          onChange={(e) => handleMixSliderChange("channel_mix", key, Number(e.target.value))}
                        />
                      </div>
                    );
                  })}

                  {/* 70-20-10 achieved ratio */}
                  <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid #e2e8f0" }}>
                    <p style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", marginBottom: "8px" }}>
                      70-20-10 achieved ratio
                    </p>
                    {[
                      { label: "Experiential", pct: seventyTwentyTen.experiential, color: "#2563eb" },
                      { label: "Social", pct: seventyTwentyTen.social, color: "#7c3aed" },
                      { label: "Formal", pct: seventyTwentyTen.formal, color: "#f59e0b" }
                    ].map((row) => (
                      <div key={row.label} style={{ marginBottom: "8px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#475569", marginBottom: "3px" }}>
                          <span>{row.label}</span>
                          <span>{row.pct}%</span>
                        </div>
                        <div style={{ background: "#f1f5f9", borderRadius: "999px", height: "8px", overflow: "hidden" }}>
                          <div style={{ width: `${Math.min(100, row.pct)}%`, background: row.color, height: "100%" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* VALIDATION */}
                <div className="rightCard">
                  <h2>Validation</h2>
                  {warnings.length === 0 && <p className="success">✓ No issues detected</p>}
                  {warnings.map((w, i) => (
                    <p key={i} className="warning">⚠ {w}</p>
                  ))}
                </div>

                {/* RATIONALE */}
                {architecture.rationale && Object.values(architecture.rationale).some(Boolean) && (
                  <div className="rightCard">
                    <h2>Why This Design</h2>
                    {architecture.rationale.shape_reason && <p>{architecture.rationale.shape_reason}</p>}
                    {architecture.rationale.modality_reason && <p style={{ marginTop: "10px" }}>{architecture.rationale.modality_reason}</p>}
                    {architecture.rationale.sequencing_reason && <p style={{ marginTop: "10px" }}>{architecture.rationale.sequencing_reason}</p>}
                    {architecture.rationale.faculty_reason && <p style={{ marginTop: "10px" }}>{architecture.rationale.faculty_reason}</p>}
                  </div>
                )}

              </div>

            </div>
          </>
        )}

      </div>

      {/* CSS */}
      <style>{`
        .sideBtn{background:white;border:none;padding:15px;border-radius:14px;text-align:left;cursor:pointer;font-weight:700;transition:0.3s;}
        .sideBtn:hover{background:#eff6ff;}
        .activeBtn{background:linear-gradient(135deg,#2563eb,#7c3aed);color:white;border:none;padding:15px;border-radius:14px;text-align:left;font-weight:700;cursor:pointer;box-shadow:0 10px 20px rgba(37,99,235,0.25);}
        .topBtn{background:white;border:1px solid #dbeafe;padding:12px 18px;border-radius:12px;cursor:pointer;font-weight:700;}
        .saveBtn{background:linear-gradient(135deg,#2563eb,#7c3aed);color:white;border:none;padding:12px 22px;border-radius:12px;cursor:pointer;font-weight:700;}
        .statCard{background:white;padding:24px;border-radius:20px;}
        .statCard h3{color:#64748b;margin-bottom:10px;}
        .statCard h1{color:#2563eb;font-size:52px;}
        .phaseCard{background:white;padding:24px;border-radius:24px;margin-bottom:24px;}
        .phaseBadge{background:#dbeafe;color:#2563eb;padding:8px 16px;border-radius:999px;font-weight:700;}
        .moduleCard{background:#f8fafc;border:1px solid #dbeafe;padding:18px;border-radius:18px;display:flex;justify-content:space-between;align-items:center;}
        .moduleCard p{color:#64748b;margin-top:6px;}
        .tagChip{display:inline-block;background:#ede9fe;color:#6d28d9;font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;margin-right:6px;text-transform:capitalize;}
        .rightCard{background:white;padding:24px;border-radius:24px;}
        .rightCard h2{margin-bottom:8px;}
        .provenanceChip{display:inline-block;background:#f1f5f9;color:#64748b;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;margin-bottom:14px;}
        .paramLabel{display:block;font-size:13px;font-weight:700;color:#64748b;margin-bottom:6px;margin-top:14px;}
        .paramInput{width:100%;padding:10px;border-radius:10px;border:1px solid #dbeafe;font-weight:600;}
        .applyBtn{width:100%;margin-top:18px;padding:12px;border:none;border-radius:10px;background:linear-gradient(135deg,#2563eb,#7c3aed);color:white;font-weight:700;cursor:pointer;font-size:14px;}
        .applyBtn:hover{opacity:0.92;}
        .resetLink{background:none;border:none;color:#2563eb;font-size:12px;font-weight:700;cursor:pointer;padding:0;}
        .resetLink:hover{text-decoration:underline;}
        .mixSlider{width:100%;margin-top:4px;accent-color:#2563eb;}
        .warning{color:#f59e0b;margin-bottom:10px;}
        .success{color:#10b981;}
      `}</style>

    </div>
  );
}
