import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ProcessingState from "../components/ProcessingState";
import {
  getArchitectureContext,
  createArchitectureDraft,
  updateProgramme
} from "../services/api";



const STATUS_COLORS = {
  draft: { bg: "#f1f5f9", fg: "#475569" },
  "in-review": { bg: "#fef3c7", fg: "#92400e" },
  locked: { bg: "#dcfce7", fg: "#166534" },
  revised: { bg: "#ede9fe", fg: "#6d28d9" }
};

const ELEMENT_TYPE_COLORS = {
  module: "#2563eb",
  activity: "#7c3aed",
  assessment: "#dc2626",
  coaching: "#0891b2",
  project: "#ea580c",
  reflection: "#65a30d",
  break: "#94a3b8"
};

export default function ArchitectureBuilder() {
  const navigate = useNavigate();

  const [opportunityId, setOpportunityId] = useState(null);
  const [clientName, setClientName] = useState("");
  const [context, setContext] = useState(null);
  const [programme, setProgramme] = useState(null);
  const [selectedPhaseOrder, setSelectedPhaseOrder] = useState(null);
  const [selectedElement, setSelectedElement] = useState(null); // { phaseOrder, blockOrder, elementOrder, element }
  const [loading, setLoading] = useState(true);
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const id = localStorage.getItem("pis_opportunity_id");
    if (!id) {
      navigate("/new");
      return;
    }
    setOpportunityId(id);
    loadContext(id);
  }, []);

  const loadContext = async (id) => {
    setLoading(true);
    setError(null);
    try {
      const ctx = await getArchitectureContext(id);
      setContext(ctx);
      setProgramme(ctx.existing_draft || null);
      if (ctx.existing_draft?.phases?.length) {
        setSelectedPhaseOrder(ctx.existing_draft.phases[0].order);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Could not load architecture context");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDraft = async () => {
    setCreatingDraft(true);
    setError(null);
    try {
      const result = await createArchitectureDraft(opportunityId);
      setProgramme(result.programme);
    } catch (err) {
      setError(err.response?.data?.error || "Could not create draft");
    } finally {
      setCreatingDraft(false);
    }
  };

  const handleSave = async () => {
    if (!programme) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateProgramme(programme._id, {
        name: programme.name,
        phases: programme.phases
      });
      setProgramme(updated);
    } catch (err) {
      setError(err.response?.data?.error || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const toggleElementLock = (phaseOrder, blockOrder, elementOrder) => {
    setProgramme((prev) => {
      const next = structuredClone(prev);
      const phase = next.phases.find((p) => p.order === phaseOrder);
      const block = phase?.blocks?.find((b) => b.order === blockOrder);
      const element = block?.elements?.find((e) => e.order === elementOrder);
      if (element) element.user_locked = !element.user_locked;
      return next;
    });
    setSelectedElement((sel) =>
      sel ? { ...sel, element: { ...sel.element, user_locked: !sel.element.user_locked } } : sel
    );
  };

  if (loading) {
    return (
      <ProcessingState
        steps={["Loading brief context", "Loading discovery answers", "Loading existing draft, if any"]}
        estimate="Usually just a moment"
      />
    );
  }

  const statusStyle = STATUS_COLORS[programme?.status] || STATUS_COLORS.draft;
  const dp = programme?.design_parameters || {};

  return (
    <div style={{ display: "flex", background: "#f1f5f9", minHeight: "100vh" }}>
      {/* SIDEBAR — same app-level nav as the rest of the pages */}
      <div style={{ width: "250px", background: "white", padding: "30px 20px", borderRight: "1px solid #dbeafe" }}>
        <h2 style={{ color: "#2563eb", fontSize: "34px", fontWeight: "800", marginBottom: "40px" }}>Proposal AI</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <button className="sideBtn" onClick={() => navigate("/dashboard")}>Dashboard</button>
          <button className="sideBtn" onClick={() => navigate("/new")}>New Opportunity</button>
          <button className="sideBtn" onClick={() => navigate("/questions")}>Decision Questions</button>
          <button className="sideBtn" onClick={() => navigate("/mapping")}>Competency Mapping</button>
          <button className="activeBtn">Architecture (v2)</button>
          <button className="sideBtn" onClick={() => navigate("/architecture")}>Architecture (v1)</button>
          <button className="sideBtn" onClick={() => navigate("/approach")}>Approach Note</button>
          <button className="sideBtn" onClick={() => navigate("/score")}>Proposal Score</button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* ── REGION 1: TOP BAR ── */}
        <div
          style={{
            background: "white",
            padding: "18px 28px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <div>
            <p style={{ color: "#64748b", fontSize: "13px", marginBottom: "4px" }}>
              Opportunities {" > "} {context?.opportunity?.brief_interpretation ? clientName || "..." : "..."} {" > "} Architecture v2
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <h1 style={{ fontSize: "28px", color: "#0f172a", margin: 0 }}>
                {programme?.name || "Programme Architecture"}
              </h1>
              {programme && (
                <span
                  style={{
                    background: statusStyle.bg,
                    color: statusStyle.fg,
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "4px 10px",
                    borderRadius: "999px",
                    textTransform: "uppercase"
                  }}
                >
                  {programme.status}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              className="topBtn"
              disabled={!programme}
              title="Tier-2 AI refinement isn't built yet"
              onClick={() => {}}
              style={{ opacity: programme ? 0.5 : 0.3, cursor: "not-allowed" }}
            >
              Refine with AI
            </button>
            <button
              className="topBtn"
              disabled={!programme}
              title="Locking/versioning endpoints aren't built yet"
              style={{ opacity: programme ? 0.5 : 0.3, cursor: "not-allowed" }}
            >
              Send for Review
            </button>
            <button className="saveBtn" disabled={!programme || saving} onClick={handleSave}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ background: "#fef2f2", color: "#991b1b", padding: "14px 28px", fontWeight: 600 }}>
            {error}
          </div>
        )}

        {!programme ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: "white", padding: "40px", borderRadius: "24px", textAlign: "center", maxWidth: "420px" }}>
              <h2 style={{ marginBottom: "10px" }}>No draft architecture yet</h2>
              <p style={{ color: "#64748b", marginBottom: "20px" }}>
                Create a draft seeded from the brief, discovery answers, and accepted competencies. You'll design
                phases and blocks on top of it.
              </p>
              <button className="applyBtn" disabled={creatingDraft} onClick={handleCreateDraft}>
                {creatingDraft ? "Creating..." : "Create Draft Architecture"}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
            {/* ── REGION 2: LEFT RAIL ── */}
            <div style={{ width: "220px", padding: "20px", borderRight: "1px solid #e2e8f0", overflowY: "auto" }}>
              <p className="railLabel">Phase Navigator</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "24px" }}>
                {(programme.phases || []).length === 0 && (
                  <p style={{ fontSize: "12px", color: "#94a3b8" }}>No phases yet — this shell doesn't build the canvas content, only displays it.</p>
                )}
                {(programme.phases || []).map((phase) => (
                  <button
                    key={phase.order}
                    onClick={() => setSelectedPhaseOrder(phase.order)}
                    style={{
                      textAlign: "left",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: 600,
                      background: selectedPhaseOrder === phase.order ? "#eff6ff" : "transparent",
                      color: selectedPhaseOrder === phase.order ? "#2563eb" : "#334155"
                    }}
                  >
                    {phase.order}. {phase.name}
                  </button>
                ))}
              </div>

              <p className="railLabel">Warnings</p>
              <div style={{ marginBottom: "24px" }}>
                <p style={{ fontSize: "12px", color: "#94a3b8" }}>
                  Validation endpoint isn't built yet — nothing to show here.
                </p>
              </div>

              <p className="railLabel">Metrics</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <MetricRow label="Duration" value={programme.total_duration_days ? `${programme.total_duration_days}d` : "—"} />
                <MetricRow label="Format" value={programme.format || "—"} />
                <MetricRow label="Phases" value={programme.phases?.length ?? 0} />
                <MetricRow label="Version" value={programme.version} />
              </div>
            </div>

            {/* ── REGION 3: CANVAS ── */}
            <div style={{ flex: 1, padding: "20px", overflowX: "auto", minWidth: 0 }}>
              {(programme.phases || []).length === 0 ? (
                <div style={{ background: "white", padding: "30px", borderRadius: "20px", color: "#64748b" }}>
                  This draft has no phases yet. Phase/block authoring is a later slice — for now this canvas
                  renders whatever structure the Programme document already has.
                </div>
              ) : (
                <div style={{ display: "flex", gap: "16px", height: "100%" }}>
                  {programme.phases.map((phase) => (
                    <div
                      key={phase.order}
                      onClick={() => setSelectedPhaseOrder(phase.order)}
                      style={{
                        minWidth: "260px",
                        background: "white",
                        borderRadius: "18px",
                        padding: "16px",
                        border: selectedPhaseOrder === phase.order ? "2px solid #2563eb" : "1px solid #e2e8f0",
                        cursor: "pointer"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                        <h3 style={{ margin: 0, fontSize: "15px" }}>{phase.name}</h3>
                        <span className="phaseBadge">{phase.kind}</span>
                      </div>
                      <p style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "12px" }}>
                        Day {phase.starts_relative_days} · {phase.duration_days}d
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {(phase.blocks || []).map((block) => (
                          <div key={block.order} style={{ background: "#f8fafc", borderRadius: "10px", padding: "10px" }}>
                            <p style={{ fontSize: "12px", fontWeight: 700, margin: 0 }}>{block.title}</p>
                            <p style={{ fontSize: "11px", color: "#94a3b8", margin: "2px 0 6px" }}>
                              {block.duration_minutes}min · {block.modality?.replace(/_/g, " ")}
                            </p>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                              {(block.elements || []).map((el) => (
                                <span
                                  key={el.order}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedElement({ phaseOrder: phase.order, blockOrder: block.order, elementOrder: el.order, element: el });
                                  }}
                                  style={{
                                    fontSize: "10px",
                                    fontWeight: 700,
                                    color: "white",
                                    background: ELEMENT_TYPE_COLORS[el.type] || "#64748b",
                                    padding: "3px 7px",
                                    borderRadius: "999px",
                                    cursor: "pointer",
                                    opacity: el.user_locked ? 1 : 0.85,
                                    outline: el.user_locked ? "2px solid #f59e0b" : "none"
                                  }}
                                  title={el.user_locked ? "User-locked" : el.type}
                                >
                                  {el.type}
                                  {el.user_locked ? " 🔒" : ""}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── REGION 4 / 5: RIGHT RAIL (layer panels) OR INSPECTOR ── */}
            <div style={{ width: "300px", padding: "20px", borderLeft: "1px solid #e2e8f0", overflowY: "auto" }}>
              {selectedElement ? (
                <Inspector
                  selection={selectedElement}
                  onClose={() => setSelectedElement(null)}
                  onToggleLock={() =>
                    toggleElementLock(selectedElement.phaseOrder, selectedElement.blockOrder, selectedElement.elementOrder)
                  }
                />
              ) : (
                <LayerPanels designParameters={dp} programme={programme} context={context} />
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .sideBtn{background:white;border:none;padding:15px;border-radius:14px;text-align:left;cursor:pointer;font-weight:700;transition:0.3s;}
        .sideBtn:hover{background:#eff6ff;}
        .activeBtn{background:linear-gradient(135deg,#2563eb,#7c3aed);color:white;border:none;padding:15px;border-radius:14px;text-align:left;font-weight:700;cursor:pointer;box-shadow:0 10px 20px rgba(37,99,235,0.25);}
        .topBtn{background:white;border:1px solid #dbeafe;padding:10px 16px;border-radius:10px;font-weight:700;font-size:13px;}
        .saveBtn{background:linear-gradient(135deg,#2563eb,#7c3aed);color:white;border:none;padding:10px 20px;border-radius:10px;cursor:pointer;font-weight:700;font-size:13px;}
        .saveBtn:disabled{opacity:0.5;cursor:not-allowed;}
        .applyBtn{padding:12px 22px;border:none;border-radius:10px;background:linear-gradient(135deg,#2563eb,#7c3aed);color:white;font-weight:700;cursor:pointer;font-size:14px;}
        .applyBtn:disabled{opacity:0.6;cursor:not-allowed;}
        .phaseBadge{background:#dbeafe;color:#2563eb;padding:4px 10px;border-radius:999px;font-weight:700;font-size:10px;text-transform:capitalize;height:fit-content;}
        .railLabel{font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:10px;}
        .layerCard{background:white;border-radius:16px;padding:16px;margin-bottom:14px;}
        .layerCard h4{margin:0 0 4px;font-size:13px;}
        .provenanceChip{display:inline-block;background:#f1f5f9;color:#64748b;font-size:10px;font-weight:700;padding:3px 8px;border-radius:999px;margin-bottom:10px;}
        .mixBar{display:flex;justify-content:space-between;font-size:11px;color:#475569;margin-top:6px;}
        .mixBarTrack{background:#f1f5f9;border-radius:999px;height:6px;overflow:hidden;margin-top:2px;}
      `}</style>
    </div>
  );
}

function MetricRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
      <span style={{ color: "#94a3b8" }}>{label}</span>
      <span style={{ fontWeight: 700, color: "#334155" }}>{value}</span>
    </div>
  );
}

function LayerPanels({ designParameters, programme, context }) {
  const shape = designParameters.shape || {};
  const modalityMix = designParameters.modality_mix || {};
  const channelMix = designParameters.channel_mix || {};

  const facultyNames = new Set();
  (programme.phases || []).forEach((p) =>
    (p.blocks || []).forEach((b) => (b.elements || []).forEach((el) => (el.faculty || []).forEach((f) => facultyNames.add(f))))
  );

  const moduleElementCount = (programme.phases || [])
    .flatMap((p) => p.blocks || [])
    .flatMap((b) => b.elements || [])
    .filter((el) => el.type === "module").length;

  return (
    <>
      <div className="layerCard">
        <h4>L1 · Programme Shape</h4>
        <span className="provenanceChip">Seeded from logistics + brief</span>
        <MetricRow label="Duration" value={shape.total_duration_days ? `${shape.total_duration_days}d` : "—"} />
        <MetricRow label="Template" value={shape.template || "—"} />
      </div>

      <div className="layerCard">
        <h4>L2 · Modality Distribution</h4>
        <span className="provenanceChip">Layer 2 · target mix</span>
        {Object.entries(modalityMix).map(([key, val]) => (
          <div key={key}>
            <div className="mixBar"><span>{key.replace(/_/g, " ")}</span><span>{val}%</span></div>
            <div className="mixBarTrack"><div style={{ width: `${val}%`, background: "#2563eb", height: "100%" }} /></div>
          </div>
        ))}
      </div>

      <div className="layerCard">
        <h4>L3 · Learning Channel Mix</h4>
        <span className="provenanceChip">Layer 3 · target mix</span>
        {Object.entries(channelMix).map(([key, val]) => (
          <div key={key}>
            <div className="mixBar"><span>{key.replace(/_/g, " ")}</span><span>{val}%</span></div>
            <div className="mixBarTrack"><div style={{ width: `${val}%`, background: "#7c3aed", height: "100%" }} /></div>
          </div>
        ))}
      </div>

      <div className="layerCard">
        <h4>L4 · Module Selection</h4>
        <span className="provenanceChip">From accepted competencies</span>
        <MetricRow label="Modules placed" value={moduleElementCount} />
        <MetricRow label="Accepted competencies" value={context?.accepted_competencies?.length ?? "—"} />
      </div>

      <div className="layerCard">
        <h4>L5 · Faculty Assignment</h4>
        <span className="provenanceChip">From module elements</span>
        {facultyNames.size === 0 ? (
          <p style={{ fontSize: "12px", color: "#94a3b8" }}>No faculty assigned yet</p>
        ) : (
          Array.from(facultyNames).map((name) => (
            <p key={name} style={{ fontSize: "12px", margin: "4px 0" }}>{name}</p>
          ))
        )}
      </div>

      <div className="layerCard">
        <h4>L6 · Reinforcement &amp; Measurement</h4>
        <span className="provenanceChip">From duration + discovery</span>
        <MetricRow label="Reinforcement" value={designParameters.reinforcement || "—"} />
        <MetricRow label="Measurement (Kirkpatrick)" value={designParameters.measurement_depth ?? "—"} />
      </div>
    </>
  );
}

function Inspector({ selection, onClose, onToggleLock }) {
  const { element } = selection;
  return (
    <div className="layerCard">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h4 style={{ textTransform: "capitalize" }}>{element.type} details</h4>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}>✕</button>
      </div>

      {element.module_id && <MetricRow label="Module" value={element.module_id} />}
      {element.title && <MetricRow label="Title" value={element.title} />}
      {element.faculty?.length > 0 && <MetricRow label="Faculty" value={element.faculty.join(", ")} />}
      {element.notes && (
        <p style={{ fontSize: "12px", color: "#64748b", marginTop: "10px" }}>{element.notes}</p>
      )}
      {element.derived_from && (
        <span className="provenanceChip" style={{ marginTop: "10px" }}>
          Derived from {element.derived_from.layer} · {element.derived_from.source_field}
        </span>
      )}

      <label style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "16px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
        <input type="checkbox" checked={!!element.user_locked} onChange={onToggleLock} />
        Locked (survives future adaptation passes)
      </label>

      <p style={{ fontSize: "11px", color: "#94a3b8", marginTop: "16px" }}>
        Editing other fields here (type-specific forms per Section 7.3) is a later slice.
      </p>
    </div>
  );
}
