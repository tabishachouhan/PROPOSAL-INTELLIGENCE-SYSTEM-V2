import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  writeApproachNote,
  recommendModules,
  buildArchitecture,
  downloadApproachNotePpt,
} from "../services/api";

export default function ApproachStage() {
  const navigate = useNavigate();
  const [sections, setSections] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const opportunityId = localStorage.getItem("pis_opportunity_id");
  const clientName = localStorage.getItem("pis_client_name") || "Proposal";

  const SECTION_LABELS = {
    context_and_challenge: " Context & Challenge",
    programme_philosophy:  " Programme Philosophy",
    learning_journey:      " Learning Journey",
    faculty_bench:         " Faculty Bench",
    evaluation_approach:   " Evaluation Approach",
    analogous_engagements: " Analogous Engagements",
    commercial_terms:      " Commercial Terms"
  };

  useEffect(() => {
    if (!opportunityId) { navigate("/new"); return; }
    runFullPipeline();
  }, []);

  const runFullPipeline = async () => {
    setLoading(true);
    setError("");

    try {
      // Step 1 — Recommend modules (runs even if already done)
      setLoadingStep("Step 1/3 — Recommending modules...");
      try {
        await recommendModules(opportunityId);
      } catch (e) {
        console.log("Modules already done or error:", e.message);
      }

      // Step 2 — Build architecture
      setLoadingStep("Step 2/3 — Building programme architecture...");
      try {
        await buildArchitecture(opportunityId);
      } catch (e) {
        console.log("Architecture already done or error:", e.message);
      }

      // Step 3 — Write approach note
      setLoadingStep("Step 3/3 — Writing approach note...");
      const data = await writeApproachNote(opportunityId);

      const s = data.approach_note?.sections || data.sections;
      if (!s) throw new Error("No sections returned");
      setSections(s);

    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Failed to write approach note");
    }

    setLoading(false);
    setLoadingStep("");
  };

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
          <h1 style={{ color: "#2563eb", fontSize: "28px", fontWeight: "800" }}> Proposal<br />Intelligence</h1>
        </div>
        <div style={{ padding: "20px" }}>
          <div style={menuStyle} onClick={() => navigate("/new")}> New Opportunity</div>
          <div style={menuStyle} onClick={() => navigate("/questions")}> Questions</div>
          <div style={menuStyle} onClick={() => navigate("/mapping")}> Competency Mapping</div>
          <div style={menuStyle} onClick={() => navigate("/architecture")}> Architecture</div>
          <div style={menuActive}> Approach Note</div>
          <div style={menuStyle} onClick={() => navigate("/score")}> Proposal Score</div>
          <div style={{ ...menuStyle, marginTop: "40px", color: "#94a3b8" }} onClick={() => navigate("/dashboard")}>← Dashboard</div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, padding: "40px" }}>
        <div style={{ background: "white", borderRadius: "28px", padding: "40px", border: "1px solid #dbe4ff" }}>

          {/* HEADER + DOWNLOAD PPT BUTTON */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <h1 style={{ fontSize: "42px", color: "#0f172a", fontWeight: "800", marginBottom: "10px" }}>Approach Note</h1>
              <p style={{ color: "#64748b", marginBottom: "30px" }}>A 7-section professional proposal document</p>
            </div>

            {sections && !loading && (
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
            <div style={{ color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", padding: "10px 16px", marginBottom: "20px", fontSize: "14px" }}>
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
              <p style={{ color: "#94a3b8", fontSize: "14px" }}>
                Running full pipeline — this takes 20-30 seconds
              </p>
              <div style={{ display: "flex", justifyContent: "center", gap: "12px", marginTop: "30px" }}>
                {["Modules", "Architecture", "Approach Note"].map((step, i) => (
                  <div key={i} style={{
                    padding: "8px 16px", borderRadius: "20px",
                    background: loadingStep.includes(`${i + 1}/3`) ? "#2563eb" : "#e2e8f0",
                    color: loadingStep.includes(`${i + 1}/3`) ? "white" : "#94a3b8",
                    fontSize: "13px", fontWeight: "600"
                  }}>
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
              <button
                onClick={runFullPipeline}
                style={{ padding: "10px 20px", background: "#2563eb", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}
              >
                Try Again
              </button>
            </div>
          )}

          {/* SECTIONS */}
          {sections && !loading && (
            <>
              <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "12px", padding: "14px 20px", marginBottom: "28px", display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "20px" }}>✅</span>
                <span style={{ fontWeight: "600", color: "#166534" }}>Approach note written successfully!</span>
              </div>

              {Object.entries(sections).map(([key, text]) => (
                <div key={key} style={{ marginBottom: "28px" }}>
                  <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#2563eb", marginBottom: "12px" }}>
                    {SECTION_LABELS[key] || key}
                  </h3>
                  <div style={{ background: "#f8fafc", borderRadius: "14px", padding: "24px", border: "1px solid #e2e8f0" }}>
                    <p style={{ color: "#334155", lineHeight: "1.8", fontSize: "15px" }}>{text}</p>
                  </div>
                </div>
              ))}

              <button
                onClick={() => navigate("/score")}
                style={{ width: "100%", marginTop: "20px", padding: "16px", background: "linear-gradient(135deg,#2563eb,#7c3aed)", color: "white", border: "none", borderRadius: "14px", fontWeight: "700", fontSize: "16px", cursor: "pointer" }}
              >
                Next → Score Proposal 📊
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

const menuStyle = { padding: "14px 16px", borderRadius: "14px", cursor: "pointer", marginBottom: "10px", fontWeight: "600", color: "#475569", fontSize: "15px" };
const menuActive = { padding: "14px 16px", borderRadius: "14px", background: "linear-gradient(135deg,#2563eb,#7c3aed)", color: "white", marginBottom: "10px", fontWeight: "700", fontSize: "15px" };