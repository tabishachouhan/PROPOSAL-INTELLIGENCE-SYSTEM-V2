import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { writeApproachNote, recommendModules, buildArchitecture, downloadApproachNotePpt } from "../services/api";

export default function ApproachStage() {
  const navigate = useNavigate();
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const opportunityId = localStorage.getItem("pis_opportunity_id");
  const clientName = localStorage.getItem("pis_client_name") || "Proposal";

  // Legacy (v1) flat-paragraph labels — kept so old opportunities still render.
  const SECTION_LABELS = {
    context_and_challenge: "📌 Context & Challenge",
    programme_philosophy: "🎯 Programme Philosophy",
    learning_journey: "🗺️ Learning Journey",
    faculty_bench: "👥 Faculty Bench",
    evaluation_approach: "📊 Evaluation Approach",
    analogous_engagements: "🏆 Analogous Engagements",
    commercial_terms: "💼 Commercial Terms",
  };

  useEffect(() => {
    if (!opportunityId) {
      navigate("/new");
      return;
    }
    runFullPipeline();
  }, []);

  const runFullPipeline = async () => {
    setLoading(true);
    setError("");

    try {
      setLoadingStep("Step 1/3 — Recommending modules...");
      try {
        await recommendModules(opportunityId);
      } catch (e) {
        console.log("Modules already done or error:", e.message);
      }

      setLoadingStep("Step 2/3 — Building programme architecture...");
      try {
        await buildArchitecture(opportunityId);
      } catch (e) {
        console.log("Architecture already done or error:", e.message);
      }

      setLoadingStep("Step 3/3 — Writing approach note...");
      const data = await writeApproachNote(opportunityId);

      const approachNote = data.approach_note;
      if (!approachNote) throw new Error("No approach note returned");
      setNote(approachNote);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Failed to write approach note");
    }

    setLoading(false);
    setLoadingStep("");
  };

  // C.4 — Legacy fallback: version missing/1 with the old flat `sections`
  // object means this opportunity was written before the v2 schema existed.
  const isLegacy = !!note?.sections && note?.version !== 2;

  const handleDownloadPpt = async () => {
    setDownloading(true);
    setDownloadError("");
    try {
      await downloadApproachNotePpt(opportunityId, clientName);
    } catch (err) {
      setDownloadError(err?.response?.data?.error || err.message || "Failed to generate PPT");
    }
    setDownloading(false);
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#eef2ff", fontFamily: "Inter, sans-serif" }}>
      {/* SIDEBAR */}
      <div style={{ width: "240px", background: "white", borderRight: "1px solid #e2e8f0" }}>
        <div style={{ padding: "35px 25px" }}>
          <h1 style={{ color: "#2563eb", fontSize: "28px", fontWeight: "800" }}>
            🚀 Proposal
            <br />
            Intelligence
          </h1>
        </div>
        <div style={{ padding: "20px" }}>
          <div style={menuStyle} onClick={() => navigate("/new")}>📄 New Opportunity</div>
          <div style={menuStyle} onClick={() => navigate("/questions")}>❓ Questions</div>
          <div style={menuStyle} onClick={() => navigate("/mapping")}>🧠 Competency Mapping</div>
          <div style={menuStyle} onClick={() => navigate("/architecture")}>🏗️ Architecture</div>
          <div style={menuActive}>📝 Approach Note</div>
          <div style={menuStyle} onClick={() => navigate("/score")}>📈 Proposal Score</div>
          <div style={{ ...menuStyle, marginTop: "40px", color: "#94a3b8" }} onClick={() => navigate("/dashboard")}>
            ← Dashboard
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, padding: "40px" }}>
        <div style={{ background: "white", borderRadius: "28px", padding: "40px", border: "1px solid #dbe4ff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <h1 style={{ fontSize: "42px", color: "#0f172a", fontWeight: "800", marginBottom: "10px" }}>
                Approach Note
              </h1>
              <p style={{ color: "#64748b", marginBottom: "30px" }}>
                {isLegacy ? "A 7-section professional proposal document" : "A structured, phase-by-phase approach note"}
              </p>
            </div>

            {note && !loading && (
              <button
                onClick={handleDownloadPpt}
                disabled={downloading}
                style={{
                  padding: "14px 22px",
                  background: downloading ? "#94a3b8" : "linear-gradient(135deg,#15294F,#C9A227)",
                  color: "white",
                  border: "none",
                  borderRadius: "12px",
                  fontWeight: "700",
                  fontSize: "15px",
                  cursor: downloading ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {downloading ? "⏳ Building PPT..." : "⬇️ Download PPT"}
              </button>
            )}
          </div>

          {downloadError && (
            <div
              style={{
                color: "#b91c1c",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "10px",
                padding: "10px 16px",
                marginBottom: "20px",
                fontSize: "14px",
              }}
            >
              ⚠️ {downloadError}
            </div>
          )}

          {/* LOADING */}
          {loading && (
            <div style={{ textAlign: "center", padding: "80px 40px" }}>
              <div style={{ fontSize: "48px", marginBottom: "20px" }}>✍️</div>
              <p style={{ color: "#0f172a", fontSize: "20px", fontWeight: "700", marginBottom: "10px" }}>
                {loadingStep}
              </p>
              <p style={{ color: "#94a3b8", fontSize: "14px" }}>Running full pipeline — this takes 20-30 seconds</p>
              <div style={{ display: "flex", justifyContent: "center", gap: "12px", marginTop: "30px" }}>
                {["Modules", "Architecture", "Approach Note"].map((step, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "20px",
                      background: loadingStep.includes(`${i + 1}/3`) ? "#2563eb" : "#e2e8f0",
                      color: loadingStep.includes(`${i + 1}/3`) ? "white" : "#94a3b8",
                      fontSize: "13px",
                      fontWeight: "600",
                    }}
                  >
                    {step}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ERROR */}
          {error && !loading && (
            <div style={{ color: "red", padding: "20px", background: "#fef2f2", borderRadius: "12px", marginBottom: "20px" }}>
              <p style={{ fontWeight: "700", marginBottom: "8px" }}>⚠️ {error}</p>
              <button onClick={runFullPipeline} style={retryBtn}>
                Try Again
              </button>
            </div>
          )}

          {/* CONTENT */}
          {note && !loading && (
            <>
              <div style={successBanner}>
                <span style={{ fontSize: "20px" }}>✅</span>
                <span style={{ fontWeight: "600", color: "#166534" }}>Approach note written successfully!</span>
              </div>

              {isLegacy ? <LegacySections sections={note.sections} labels={SECTION_LABELS} /> : <StructuredNote note={note} />}

              <button onClick={() => navigate("/score")} style={nextBtn}>
                Next → Score Proposal 📊
              </button>
            </>
          )}
        </div>
      </div>

      {/* CSS — .phaseCard / .phaseBadge / .moduleCard / .tagChip reused verbatim
          from ArchitectureStage.jsx so the Learning Journey looks identical
          to the Architecture stage, just fed a different data source (C.1). */}
      <style>{`
        .phaseCard{background:white;padding:24px;border-radius:24px;margin-bottom:24px;border:1px solid #e2e8f0;}
        .phaseBadge{background:#dbeafe;color:#2563eb;padding:8px 16px;border-radius:999px;font-weight:700;}
        .moduleCard{background:#f8fafc;border:1px solid #dbeafe;padding:18px;border-radius:18px;display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;}
        .moduleCard p{color:#64748b;margin-top:6px;}
        .tagChip{display:inline-block;background:#ede9fe;color:#6d28d9;font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;margin-right:6px;text-transform:capitalize;}

        .mappingTable, .investmentTable{width:100%;border-collapse:collapse;}
        .mappingTable th, .investmentTable th{
          text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;
          color:#64748b;padding:10px 14px;border-bottom:2px solid #e2e8f0;
        }
        .mappingTable td, .investmentTable td{
          padding:14px;border-bottom:1px solid #eef2f7;color:#334155;font-size:14px;vertical-align:top;
        }
        .mappingTable tr:last-child td, .investmentTable tr:last-child td{border-bottom:none;}
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// C.1 + C.2 + C.3 — the new structured (v2) note
// ---------------------------------------------------------------------------
function StructuredNote({ note }) {
  return (
    <>
      <Prose title="📌 Context & Challenge" text={note.context_and_challenge} />
      <Prose title="🎯 Programme Philosophy" text={note.programme_philosophy} />

      {/* C.1 — Learning Journey rendered with the exact phase-card layout
          from ArchitectureStage.jsx, reading learning_journey instead of
          architecture.phases. Shape is identical by design (Member A). */}
      <SectionHeading>🗺️ Learning Journey</SectionHeading>
      {(note.learning_journey || []).map((phase, i) => (
        <div key={i} className="phaseCard">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h2 style={{ margin: 0, fontSize: "20px" }}>{phase.phase}</h2>
            <span className="phaseBadge">{phase.duration}</span>
          </div>
          <div>
            {(phase.blocks || []).map((block, j) => (
              <div key={j} className="moduleCard">
                <div>
                  <h3 style={{ margin: 0, fontSize: "15px" }}>{block.title}</h3>
                  <p>
                    {block.faculty}
                    {block.modules?.length ? ` • ${block.modules.join(", ")}` : ""}
                  </p>
                  {block.format && (
                    <p style={{ marginTop: "4px" }}>
                      <span className="tagChip">{block.format.replace(/_/g, " ")}</span>
                    </p>
                  )}
                </div>
                <span className="phaseBadge">{block.duration_hrs}h</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      {!note.learning_journey?.length && <EmptyNote text="No phased journey available yet." />}

      {/* C.2 — Theme → Module mapping table, same tabular pattern used for
          Competency Mapping / Module Recommendation results. */}
      <SectionHeading>🧭 Theme → Module Mapping</SectionHeading>
      <TableCard>
        <table className="mappingTable">
          <thead>
            <tr>
              <th>Theme</th>
              <th>Description</th>
              <th>Modules</th>
            </tr>
          </thead>
          <tbody>
            {(note.theme_module_mapping || []).map((row, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 700 }}>{row.theme}</td>
                <td>{row.description}</td>
                <td>
                  {(row.modules || []).map((m, k) => (
                    <span key={k} className="tagChip" style={{ marginBottom: "4px" }}>
                      {m}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
            {!note.theme_module_mapping?.length && (
              <tr>
                <td colSpan={3} style={{ color: "#94a3b8", textAlign: "center", padding: "24px" }}>
                  No theme-module mapping available yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableCard>

      <Prose title="👥 Faculty Bench" text={note.faculty_bench} />
      <Prose title="📊 Evaluation Approach" text={note.evaluation_approach} />
      <Prose title="🏆 Analogous Engagements" text={note.analogous_engagements} />

      {/* C.3 — Investment table with a visible flag whenever pricing is a
          placeholder rather than a real, client-confirmed figure. Reads
          is_confirmed directly rather than guessing from the note text. */}
      <SectionHeading>💼 Investment</SectionHeading>
      {!note.investment?.is_confirmed && (
        <div style={pendingBanner}>
          <span style={{ fontSize: "18px" }}>⚠️</span>
          <span>Pricing to be confirmed with commercial team — no confirmed client budget on file yet.</span>
        </div>
      )}
      <TableCard>
        <table className="investmentTable">
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {(note.investment?.line_items || []).map((item, i) => (
              <tr key={i}>
                <td>{item.description}</td>
                <td>{item.qty}</td>
                <td>{item.unit_price}</td>
                <td style={{ fontWeight: 700 }}>{item.total}</td>
              </tr>
            ))}
            {!note.investment?.line_items?.length && (
              <tr>
                <td colSpan={4} style={{ color: "#94a3b8", textAlign: "center", padding: "24px" }}>
                  No confirmed line items yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableCard>
      {note.investment?.validity_note && (
        <p style={{ color: "#64748b", fontSize: "13px", marginTop: "10px", fontStyle: "italic" }}>
          {note.investment.validity_note}
        </p>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// C.4 — legacy (v1) flat-paragraph fallback, unchanged behaviour
// ---------------------------------------------------------------------------
function LegacySections({ sections, labels }) {
  return (
    <>
      {Object.entries(sections).map(([key, text]) => (
        <div key={key} style={{ marginBottom: "28px" }}>
          <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#2563eb", marginBottom: "12px" }}>
            {labels[key] || key}
          </h3>
          <div style={{ background: "#f8fafc", borderRadius: "14px", padding: "24px", border: "1px solid #e2e8f0" }}>
            <p style={{ color: "#334155", lineHeight: "1.8", fontSize: "15px" }}>{text}</p>
          </div>
        </div>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Small shared bits
// ---------------------------------------------------------------------------
function SectionHeading({ children }) {
  return (
    <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#2563eb", marginBottom: "12px", marginTop: "8px" }}>
      {children}
    </h3>
  );
}

function Prose({ title, text }) {
  return (
    <div style={{ marginBottom: "28px" }}>
      <SectionHeading>{title}</SectionHeading>
      <div style={{ background: "#f8fafc", borderRadius: "14px", padding: "24px", border: "1px solid #e2e8f0" }}>
        <p style={{ color: "#334155", lineHeight: "1.8", fontSize: "15px" }}>{text || "—"}</p>
      </div>
    </div>
  );
}

function TableCard({ children }) {
  return (
    <div style={{ background: "white", borderRadius: "14px", border: "1px solid #e2e8f0", overflow: "hidden", marginBottom: "28px" }}>
      {children}
    </div>
  );
}

function EmptyNote({ text }) {
  return (
    <div style={{ color: "#94a3b8", textAlign: "center", padding: "24px", marginBottom: "28px" }}>{text}</div>
  );
}

const menuStyle = { padding: "14px 16px", borderRadius: "14px", cursor: "pointer", marginBottom: "10px", fontWeight: "600", color: "#475569", fontSize: "15px" };
const menuActive = { padding: "14px 16px", borderRadius: "14px", background: "linear-gradient(135deg,#2563eb,#7c3aed)", color: "white", marginBottom: "10px", fontWeight: "700", fontSize: "15px" };
const successBanner = { background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "12px", padding: "14px 20px", marginBottom: "28px", display: "flex", alignItems: "center", gap: "10px" };
const pendingBanner = { background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", borderRadius: "12px", padding: "14px 20px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", fontWeight: 600 };
const retryBtn = { padding: "10px 20px", background: "#2563eb", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600" };
const nextBtn = { width: "100%", marginTop: "20px", padding: "16px", background: "linear-gradient(135deg,#2563eb,#7c3aed)", color: "white", border: "none", borderRadius: "14px", fontWeight: "700", fontSize: "16px", cursor: "pointer" };
