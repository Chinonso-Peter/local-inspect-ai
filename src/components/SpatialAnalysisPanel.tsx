import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import ReactMarkdown from "react-markdown";
import { open } from "@tauri-apps/plugin-dialog";
import { AlertTriangle, Building2, FileSearch, Images, ScanEye, Upload } from "lucide-react";
import { readImagePathAsBase64 } from "../lib/ollamaApi";
import { runSpatialAudit } from "../lib/spatialAnalysis";

interface SelectedAsset {
  name: string;
  path?: string;
  base64?: string;
}

export default function SpatialAnalysisPanel() {
  const [selectedAssets, setSelectedAssets] = useState<SelectedAsset[]>([]);
  const [notes, setNotes] = useState(
    "Assess exterior structure, material quality, likely load points, and any spatial or envelope-related vulnerabilities.",
  );
  const [report, setReport] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSelectImages = async () => {
    const selected = await open({
      multiple: true,
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg"] }],
    });

    const nextPaths = normalizeSelection(selected);
    if (nextPaths.length === 0) {
      return;
    }

    setSelectedAssets(nextPaths.map((path) => ({ path, name: path.split(/[\\/]/).pop() || path })));
    setErrorMessage("");
    setReport("");
  };

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = "";

    if (files.length === 0) {
      return;
    }

    setSelectedAssets(
      await Promise.all(
        files.map(async (file) => ({
          name: file.name,
          base64: await fileToBase64(file),
        })),
      ),
    );
    setErrorMessage("");
    setReport("");
  };

  const handleAnalyze = async () => {
    if (selectedAssets.length === 0) {
      setErrorMessage("Please select one or more building photos or blueprint images first.");
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage("");
    setReport("");

    try {
      const base64Images = await Promise.all(
        selectedAssets.map((asset) => asset.base64 ?? readImagePathAsBase64(asset.path || "")),
      );
      const result = await runSpatialAudit(base64Images, notes);
      setReport(result);
    } catch (err: any) {
      const detail = typeof err === "string" ? err : err?.message || String(err);
      setErrorMessage(detail);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <section className="mode-panel spatial-panel">
      <div className="mode-panel-header">
        <div>
          <span className="eyebrow">
            <ScanEye size={14} />
            Spatial reasoning mode
          </span>
          <h2>Spatial Building Analysis</h2>
          <p>
            Evaluate exterior photos and blueprint references for structural layout, material
            systems, load points, envelope weaknesses, and safety risk.
          </p>
        </div>

        <div className={`status-pill ${isAnalyzing ? "status-warning" : report ? "status-success" : "status-neutral"}`}>
          {isAnalyzing ? "Analyzing spatial context" : report ? "Spatial report ready" : "Idle"}
        </div>
      </div>

      <div className="mode-grid">
        <article className="preview-card">
          <div className="section-header">
            <h2>Reference assets</h2>
            <p>Photos, elevations, scans, or blueprint snippets.</p>
          </div>

          <div className="spatial-actions">
            <button className="action-button secondary" onClick={handleSelectImages} disabled={isAnalyzing}>
              <Images size={16} />
              <span>Select Building Images</span>
            </button>

            <button
              className="action-button secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={isAnalyzing}
            >
              <Upload size={16} />
              <span>Attach Files</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.svg,image/svg+xml"
              multiple
              hidden
              onChange={handleFileSelect}
            />
          </div>

          <div className="selected-asset-list">
            {selectedAssets.length > 0 ? (
              selectedAssets.map((asset) => (
                <div className="selected-asset" key={`${asset.path}-${asset.name}`}>
                  <Building2 size={16} />
                  <div>
                    <strong>{asset.name}</strong>
                    <span>{asset.path || "Uploaded file"}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <div className="empty-state-title">No spatial references selected</div>
                <p>Add exterior photos, site images, or blueprint screenshots to start.</p>
              </div>
            )}
          </div>

          <label className="field-label" htmlFor="spatial-notes">
            User notes
          </label>
          <textarea
            id="spatial-notes"
            className="chat-composer spatial-notes"
            rows={7}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Add context like building age, suspected issues, scope of inspection, or known weak points..."
            disabled={isAnalyzing}
          />

          <div className="spatial-footer">
            <button
              className="action-button primary"
              onClick={() => void handleAnalyze()}
              disabled={isAnalyzing || selectedAssets.length === 0}
            >
              <FileSearch size={16} />
              <span>{isAnalyzing ? "Running analysis..." : "Run Spatial Audit"}</span>
            </button>
          </div>

          {errorMessage ? (
            <div className="error-callout spatial-error">
              <strong>
                <AlertTriangle size={16} />
                Analysis failed
              </strong>
              <p>{errorMessage}</p>
            </div>
          ) : null}
        </article>

        <article className="report-card spatial-report-card">
          <div className="section-header">
            <h2>Spatial report</h2>
            <p>Structural type, load points, vulnerabilities, and safety index.</p>
          </div>

          <div className="report-surface spatial-report-surface">
            {report ? (
              <ReactMarkdown
                components={{
                  h1: ({ children }) => <h1>{children}</h1>,
                  h2: ({ children }) => <h2>{children}</h2>,
                  h3: ({ children }) => <h3>{children}</h3>,
                  p: ({ children }) => <p>{children}</p>,
                  ul: ({ children }) => <ul>{children}</ul>,
                  ol: ({ children }) => <ol>{children}</ol>,
                  li: ({ children }) => <li>{children}</li>,
                  strong: ({ children }) => <strong>{children}</strong>,
                  blockquote: ({ children }) => <blockquote>{children}</blockquote>,
                  code: ({ children }) => <code>{children}</code>,
                }}
              >
                {report}
              </ReactMarkdown>
            ) : (
              <div className="empty-state">
                <div className="empty-state-title">No spatial analysis yet</div>
                <p>The report will appear here once the model inspects the building references.</p>
              </div>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}

function normalizeSelection(selection: string | string[] | null): string[] {
  if (!selection) {
    return [];
  }

  return Array.isArray(selection) ? selection : [selection];
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.includes(",") ? result.split(",").pop() ?? "" : result);
    };
    reader.onerror = () => reject(new Error(`Unable to read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}
