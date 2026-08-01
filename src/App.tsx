import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Camera, ShieldCheck, Sparkles } from "lucide-react";
import AuditChatSession from "./components/AuditChatSession";
import Building3DViewer from "./components/Building3DViewer";
import SpatialAnalysisPanel from "./components/SpatialAnalysisPanel";
import "./App.css";

type AppMode = "audit" | "spatial" | "architect";

export default function App() {
  const [mode, setMode] = useState<AppMode>("audit");
  const [selectedImagePath, setSelectedImagePath] = useState<string | null>(null);
  const [activeImagePath, setActiveImagePath] = useState<string | null>(null);
  const [sessionKey, setSessionKey] = useState(0);

  const handleSelectImage = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp"] }],
    });

    if (selected && typeof selected === "string") {
      setSelectedImagePath(selected);
    }
  };

  const handleStartSession = () => {
    if (!selectedImagePath) {
      return;
    }

    setActiveImagePath(selectedImagePath);
    setSessionKey((current) => current + 1);
  };

  const statusLabel =
    // The header status mirrors the active workflow so the user always knows what context is live.
    mode === "audit"
      ? activeImagePath
        ? "Interactive audit session live"
        : selectedImagePath
          ? "Ready to start"
          : "Waiting for a photo"
      : mode === "spatial"
        ? "Spatial analysis workspace"
        : "Architect generator ready";

  const statusTone =
    mode === "audit"
      ? activeImagePath
        ? "success"
        : selectedImagePath
          ? "warning"
          : "neutral"
      : "success";

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <Sparkles size={14} />
            Offline architectural intelligence
          </span>
          <h1>LocalInspect AI</h1>
          <p>
            A local-first security, spatial, and design suite powered by Gemma through Ollama.
            Switch modes to audit hazards, inspect structural geometry, or generate procedural 3D
            building concepts.
          </p>
        </div>

        <div className={`status-pill status-${statusTone}`}>
          <ShieldCheck size={16} />
          <span>{statusLabel}</span>
        </div>
      </section>

      <nav className="mode-switcher" aria-label="Operational modes">
        <button
          className={`mode-tab ${mode === "audit" ? "active" : ""}`}
          onClick={() => setMode("audit")}
        >
          <span>🔍</span>
          <span>Physical Security &amp; Hazard Audit</span>
        </button>
        <button
          className={`mode-tab ${mode === "spatial" ? "active" : ""}`}
          onClick={() => setMode("spatial")}
        >
          <span>📐</span>
          <span>Spatial &amp; Structural Inspector</span>
        </button>
        <button
          className={`mode-tab ${mode === "architect" ? "active" : ""}`}
          onClick={() => setMode("architect")}
        >
          <span>🏗️</span>
          <span>AI 3D Architect Generator</span>
        </button>
      </nav>

      {mode === "audit" ? (
        <>
          <section className="control-panel">
            <div className="control-stack">
              <button className="action-button secondary" onClick={handleSelectImage}>
                <Camera size={16} />
                <span>Select Facility Photo</span>
              </button>

              <button
                className="action-button primary"
                onClick={handleStartSession}
                disabled={!selectedImagePath}
              >
                <span>Launch Audit Chat</span>
              </button>
            </div>

            <div className="file-card">
              <div className="file-card-label">Selected asset</div>
              <div className="file-card-value">{selectedImagePath || "No image selected yet"}</div>
            </div>
          </section>

          {!activeImagePath ? (
            <section className="preview-card intro-card">
              <div className="section-header">
                <h2>What this session supports</h2>
                <p>One thread for the scan, the discussion, and the verification photos.</p>
              </div>

              <div className="checklist">
                <div className="checklist-item">
                  <span className="check-dot security" />
                  <div>
                    <strong>Ask follow-up questions</strong>
                    <p>Talk through remediation options, procurement ideas, and practical next steps.</p>
                  </div>
                </div>
                <div className="checklist-item">
                  <span className="check-dot safety" />
                  <div>
                    <strong>Attach new photos</strong>
                    <p>Drop in remediation images and have the latest visual evidence stay in context.</p>
                  </div>
                </div>
                <div className="checklist-item">
                  <span className="check-dot action" />
                  <div>
                    <strong>Verify fixes in real time</strong>
                    <p>Keep the model focused on the original scan, the remediation plan, and what changed.</p>
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <AuditChatSession key={sessionKey} imagePath={activeImagePath} />
          )}
        </>
      ) : mode === "spatial" ? (
        <SpatialAnalysisPanel />
      ) : (
        <Building3DViewer />
      )}
    </main>
  );
}
