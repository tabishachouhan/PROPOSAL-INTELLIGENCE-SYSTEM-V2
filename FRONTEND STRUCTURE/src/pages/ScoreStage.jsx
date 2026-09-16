import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { scoreProposal } from "../services/api";
import ProcessingState from "../components/ProcessingState";
export default function ScoreStage() {
  const navigate = useNavigate();
  const [score, setScore] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const opportunityId = localStorage.getItem("pis_opportunity_id");

  useEffect(() => {
    if (!opportunityId) { navigate("/new"); return; }
    loadScore();
  }, []);

  const loadScore = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await scoreProposal(opportunityId);
      setScore(data.score);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Failed to score proposal");
    }
    setLoading(false);
  };

  const getColor = (pct) => {
    if (pct >= 75) return "#16a34a";
    if (pct >= 60) return "#d97706";
    return "#dc2626";
  };

  const getBg = (pct) => {
    if (pct >= 75) return "#dcfce7";
    if (pct >= 60) return "#fef3c7";
    return "#fef2f2";
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#eef2ff", fontFamily: "Inter, sans-serif" }}>

      {/* SIDEBAR */}
      <div style={{ width: "240px", background: "white", borderRight: "1px solid #e2e8f0" }}>
        <div style={{ padding: "35px 25px" }}>
          <h1 style={{ color: "#2563eb", fontSize: "28px", fontWeight: "800" }}> Proposal<br />Intelligence</h1>
        </div>
        <div style={{ padding: "20px" }}>
          <div style={menu} onClick={() => navigate("/new")}> New Opportunity</div>
          <div style={menu} onClick={() => navigate("/questions")}> Questions</div>
          <div style={menu} onClick={() => navigate("/mapping")}> Competency Mapping</div>
          <div style={menu} onClick={() => navigate("/architecture")}> Architecture</div>
          <div style={menu} onClick={() => navigate("/approach")}> Approach Note</div>
          <div style={menuOn}>📈 Proposal Score</div>
          <div style={{ ...menu, marginTop: "40px", color: "#94a3b8" }} onClick={() => navigate("/dashboard")}>← Dashboard</div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, padding: "40px" }}>
        <div style={{ background: "white", borderRadius: "28px", padding: "40px", border: "1px solid #dbe4ff" }}>

          <h1 style={{ fontSize: "42px", color: "#0f172a", fontWeight: "800", marginBottom: "10px" }}>
            Proposal Score
          </h1>
          <p style={{ color: "#64748b", marginBottom: "30px" }}>
            AI evaluates your proposal across 6 dimensions
          </p>

          {/* LOADING */}
          {loading && (
            <div style={{ textAlign: "center", padding: "80px" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}></div>
              <p style={{ color: "#0f172a", fontSize: "20px", fontWeight: "700" }}>
                Evaluating proposal strength...
              </p>
              <p style={{ color: "#94a3b8", fontSize: "14px", marginTop: "8px" }}>
                Scoring your proposal across 6 dimensions
              </p>
            </div>
          )}

          {/* ERROR */}
          {error && !loading && (
            <div style={{ color: "red", padding: "20px", background: "#fef2f2", borderRadius: "12px", marginBottom: "20px" }}>
              <p style={{ fontWeight: "700", marginBottom: "10px" }}> {error}</p>
              <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "12px" }}>
                Make sure the approach note was written first.
              </p>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={() => navigate("/approach")}
                  style={{ padding: "10px 20px", background: "#7c3aed", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}
                >
                  ← Write Approach Note First
                </button>
                <button
                  onClick={loadScore}
                  style={{ padding: "10px 20px", background: "#2563eb", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* SCORE RESULTS */}
          {score && !loading && (
            <>
              {/* TOTAL SCORE CIRCLE */}
              <div style={{
                textAlign: "center", padding: "40px",
                background: getBg(score.total_score),
                borderRadius: "20px", marginBottom: "30px",
                border: `2px solid ${getColor(score.total_score)}`
              }}>
                <div style={{ fontSize: "88px", fontWeight: "900", color: getColor(score.total_score), lineHeight: 1 }}>
                  {score.total_score}
                </div>
                <div style={{ fontSize: "20px", color: "#64748b", marginBottom: "16px" }}>out of 100</div>
                <div style={{
                  display: "inline-block", padding: "10px 28px",
                  background: score.can_export ? "#16a34a" : "#dc2626",
                  color: "white", borderRadius: "30px",
                  fontWeight: "700", fontSize: "16px"
                }}>
                  {score.can_export ? "✅ Ready to Export" : "❌ Needs Improvement Before Export"}
                </div>
                {score.export_message && (
                  <p style={{ color: "#64748b", fontSize: "14px", marginTop: "12px" }}>
                    {score.export_message}
                  </p>
                )}
              </div>

              {/* SCORE BREAKDOWN */}
              <h3 style={{ fontSize: "22px", fontWeight: "700", color: "#0f172a", marginBottom: "16px" }}>
                Score Breakdown
              </h3>

              {score.breakdown && Object.entries(score.breakdown).map(([key, val]) => {
                const pct = Math.round((val.score / val.max) * 100);
                return (
                  <div key={key} style={{
                    background: "#f8fafc", borderRadius: "14px",
                    padding: "20px", marginBottom: "12px",
                    border: "1px solid #e2e8f0"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <span style={{ fontWeight: "700", color: "#0f172a", fontSize: "15px" }}>
                        {key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                      <span style={{ fontWeight: "800", color: getColor(pct), fontSize: "20px" }}>
                        {val.score}/{val.max}
                      </span>
                    </div>
                    <div style={{ height: "8px", background: "#e2e8f0", borderRadius: "10px", overflow: "hidden", marginBottom: "10px" }}>
                      <div style={{
                        height: "100%", width: `${pct}%`,
                        background: getColor(pct),
                        borderRadius: "10px",
                        transition: "width 1s ease"
                      }} />
                    </div>
                    <p style={{ color: "#64748b", fontSize: "13px" }}>{val.comment}</p>
                  </div>
                );
              })}

              {/* GAPS */}
              {score.gaps?.length > 0 && (
                <div style={{
                  background: "#fef3c7", borderRadius: "14px",
                  padding: "20px", marginTop: "20px",
                  border: "1px solid #fcd34d"
                }}>
                  <h4 style={{ color: "#92400e", fontWeight: "700", marginBottom: "12px", fontSize: "16px" }}>
                    ⚠️ Gaps to Fix Before Export
                  </h4>
                  {score.gaps.map((gap, i) => (
                    <div key={i} style={{
                      display: "flex", gap: "10px", alignItems: "flex-start",
                      padding: "6px 0", color: "#92400e", fontSize: "14px"
                    }}>
                      <span>•</span><span>{gap}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* ACTION BUTTONS */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "28px" }}>
                <button
                  onClick={() => navigate("/dashboard")}
                  style={{ padding: "16px", background: "#0f172a", color: "white", border: "none", borderRadius: "14px", fontWeight: "700", fontSize: "16px", cursor: "pointer" }}
                >
                  ← Back to Dashboard
                </button>
                <button
                  onClick={loadScore}
                  style={{ padding: "16px", background: "white", color: "#2563eb", border: "2px solid #2563eb", borderRadius: "14px", fontWeight: "700", fontSize: "16px", cursor: "pointer" }}
                >
                   Re-score Proposal
                </button>
              </div>

              {score.can_export && (
                <button
                  style={{ width: "100%", marginTop: "12px", padding: "16px", background: "linear-gradient(135deg,#16a34a,#15803d)", color: "white", border: "none", borderRadius: "14px", fontWeight: "700", fontSize: "16px", cursor: "pointer" }}
                  onClick={() => alert("Export feature coming soon! Your proposal score is " + score.total_score + "/100")}
                >
                   Export Proposal to PDF
                </button>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
}

const menu = { padding: "14px 16px", borderRadius: "14px", cursor: "pointer", marginBottom: "10px", fontWeight: "600", color: "#475569", fontSize: "15px" };
const menuOn = { padding: "14px 16px", borderRadius: "14px", background: "linear-gradient(135deg,#2563eb,#7c3aed)", color: "white", marginBottom: "10px", fontWeight: "700", fontSize: "15px" };
