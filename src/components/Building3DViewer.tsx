import { useEffect, useRef, useState } from "react";
import { Download, RotateCcw, RotateCw, Sparkles } from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  ARCHITECT_PRESETS,
  ARCHITECT_MATERIAL_STYLES,
  ARCHITECT_ROOF_TYPES,
  generate3DBuildingCode,
  getArchitectPresetPrompt,
  type ArchitectBriefOptions,
  type ArchitectMaterialStyle,
  type ArchitectPresetId,
  type ArchitectRoofType,
} from "../lib/architectEngine";

const DEFAULT_PRESET: ArchitectPresetId = "contemporary_house";

type BriefState = Required<Pick<ArchitectBriefOptions, "roofType" | "materialStyle" | "realisticHouseFocus">> & {
  floors: number;
};

function getPresetBriefDefaults(presetId: ArchitectPresetId): BriefState {
  switch (presetId) {
    case "office_tower":
      return { roofType: "flat", floors: 14, materialStyle: "glass_metal", realisticHouseFocus: false };
    case "library_pavilion":
      return { roofType: "shed", floors: 1, materialStyle: "wood", realisticHouseFocus: false };
    case "civic_museum":
      return { roofType: "flat", floors: 2, materialStyle: "stone", realisticHouseFocus: false };
    case "sanctuary":
      return { roofType: "gable", floors: 1, materialStyle: "stone", realisticHouseFocus: true };
    case "townhouse":
      return { roofType: "gable", floors: 4, materialStyle: "brick", realisticHouseFocus: true };
    case "courtyard_villa":
      return { roofType: "hip", floors: 2, materialStyle: "warm_masonry", realisticHouseFocus: true };
    case "contemporary_house":
    default:
      return { roofType: "gable", floors: 2, materialStyle: "warm_masonry", realisticHouseFocus: true };
  }
}

export default function Building3DViewer() {
  const [selectedPreset, setSelectedPreset] = useState<ArchitectPresetId>(DEFAULT_PRESET);
  const [brief, setBrief] = useState<BriefState>(getPresetBriefDefaults(DEFAULT_PRESET));
  const [prompt, setPrompt] = useState(getArchitectPresetPrompt(DEFAULT_PRESET));
  const [generatedCode, setGeneratedCode] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Ready to generate");
  const [errorMessage, setErrorMessage] = useState("");

  const hostRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const generatedLayerRef = useRef<THREE.Group | null>(null);
  const animationRef = useRef<number | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const isRotatingRef = useRef(false);
  const defaultCameraRef = useRef({ position: new THREE.Vector3(8, 6, 8), target: new THREE.Vector3(0, 1.5, 0) });

  useEffect(() => {
    isRotatingRef.current = isRotating;
  }, [isRotating]);

  useEffect(() => { 
    // One persistent scene keeps generated buildings snappy to swap in and out.
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#07111f");
    scene.fog = new THREE.Fog("#07111f", 18, 60);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.copy(defaultCameraRef.current.position);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setClearColor(0x07111f, 1);
    renderer.shadowMap.enabled = true;
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.copy(defaultCameraRef.current.target);
    controls.update();

    const ambient = new THREE.AmbientLight(0xffffff, 1.25);
    const sun = new THREE.DirectionalLight(0xdde8ff, 2.4);
    sun.position.set(10, 18, 12);
    sun.castShadow = true;
    scene.add(ambient, sun);

    const grid = new THREE.GridHelper(28, 28, 0x39567a, 0x203347);
    grid.position.y = 0;
    scene.add(grid);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.MeshStandardMaterial({ color: 0x081321, roughness: 1, metalness: 0 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.position.y = -0.01;
    scene.add(ground);

    const generatedLayer = new THREE.Group();
    scene.add(generatedLayer);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    controlsRef.current = controls;
    generatedLayerRef.current = generatedLayer;

    const resizeRenderer = () => {
      const width = host.clientWidth;
      const height = host.clientHeight || 540;
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
    };

    resizeRenderer();
    resizeObserverRef.current = new ResizeObserver(resizeRenderer);
    resizeObserverRef.current.observe(host);

    const tick = () => {
      animationRef.current = window.requestAnimationFrame(tick);
      controls.autoRotate = isRotatingRef.current;
      controls.autoRotateSpeed = 0.95;
      controls.update();
      renderer.render(scene, camera);
    };

    tick();

    return () => {
      if (animationRef.current !== null) {
        window.cancelAnimationFrame(animationRef.current);
      }

      resizeObserverRef.current?.disconnect();
      controls.dispose();
      scene.remove(generatedLayer);
      disposeSceneGraph(generatedLayer);
      renderer.dispose();
      host.removeChild(renderer.domElement);
      disposeSceneGraph(scene);
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      controlsRef.current = null;
      generatedLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!generatedCode || !sceneRef.current || !cameraRef.current) {
      return;
    }

    try {
      const generatedLayer = generatedLayerRef.current;
      if (!generatedLayer) {
        throw new Error("The 3D scene is not ready yet.");
      }

      // Evaluate the returned script against a scene proxy so the model can build objects safely.
      const scratchLayer = new THREE.Group();
      const built = executeGeneratedCode(generatedCode, createSceneProxy(sceneRef.current, scratchLayer), cameraRef.current);
      if (!built) {
        throw new Error("The generated code did not return a valid Three.js object.");
      }

      const centered = centerObject(normalizeGeneratedResult(built));
      scratchLayer.add(centered);

      clearGeneratedLayer(generatedLayer);
      while (scratchLayer.children.length > 0) {
        generatedLayer.add(scratchLayer.children[0]);
      }

      frameCameraToObject(cameraRef.current, controlsRef.current, centered);
      setStatusMessage("3D model rendered");
      setErrorMessage("");
    } catch (err: any) {
      const detail = typeof err === "string" ? err : err?.message || String(err);
      setErrorMessage(detail);
      setStatusMessage("Generation finished with errors");
    }
  }, [generatedCode]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setErrorMessage("");
    setStatusMessage("Generating architectural geometry");

    try {
      // Gemma returns renderable code here, not prose, so the viewport can instantiate the design immediately.
      const code = await generate3DBuildingCode(prompt, {
        presetId: selectedPreset,
        roofType: brief.roofType,
        floors: brief.floors,
        materialStyle: brief.materialStyle,
        realisticHouseFocus: brief.realisticHouseFocus,
      });
      setGeneratedCode(code);
    } catch (err: any) {
      const detail = typeof err === "string" ? err : err?.message || String(err);
      setErrorMessage(detail);
      setStatusMessage("Generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectPreset = (presetId: ArchitectPresetId) => {
    const nextBrief = getPresetBriefDefaults(presetId);
    setSelectedPreset(presetId);
    setBrief(nextBrief);
    setPrompt(getArchitectPresetPrompt(presetId));
    setStatusMessage("Preset loaded");
    setErrorMessage("");
  };

  const handleBriefChange = (updates: Partial<BriefState>) => {
    setBrief((current) => {
      return { ...current, ...updates };
    });
  };

  const handleRotateView = () => {
    setIsRotating((current) => {
      const next = !current;
      setStatusMessage(next ? "Auto-rotating" : generatedCode ? "3D model rendered" : "Ready to generate");
      return next;
    });
  };

  const handleResetCamera = () => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) {
      return;
    }

    camera.position.copy(defaultCameraRef.current.position);
    controls.target.copy(defaultCameraRef.current.target);
    controls.update();
    setIsRotating(false);
    setStatusMessage(generatedCode ? "3D model rendered" : "Camera reset");
  };

  const handleExportCode = async () => {
    if (!generatedCode) {
      return;
    }

    try {
      await navigator.clipboard.writeText(generatedCode);
      const blob = new Blob([generatedCode], { type: "text/javascript" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "localinspect-architect.js";
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setStatusMessage("Code copied and exported");
    } catch {
      setStatusMessage("Code export ready");
    }
  };

  return (
    <section className="mode-panel architect-panel">
      <div className="mode-panel-header">
        <div>
          <span className="eyebrow">
            <Sparkles size={14} />
            Procedural 3D mode
          </span>
          <h2>AI Architect 3D Generator</h2>
          <p>
            Describe a building in plain language and let Gemma draft a procedural Three.js model
            that you can inspect, rotate, and export inside the app.
          </p>
        </div>

        <div className={`status-pill ${errorMessage ? "status-danger" : isGenerating ? "status-warning" : "status-success"}`}>
          {errorMessage ? "Needs attention" : statusMessage}
        </div>
      </div>

      <div className="mode-grid architect-grid">
        <article className="preview-card architect-controls-card">
          <div className="section-header">
            <h2>Architect prompt</h2>
            <p>Pick a building type, then tune the roof, height, and material mood before generating.</p>
          </div>

          <div className="architect-field-grid">
            <label className="architect-field">
              <span className="architect-field-label">Building type</span>
              <select
                className="architect-select"
                value={selectedPreset}
                onChange={(event) => handleSelectPreset(event.target.value as ArchitectPresetId)}
                disabled={isGenerating}
              >
                {ARCHITECT_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="architect-field">
              <span className="architect-field-label">Roof form</span>
              <select
                className="architect-select"
                value={brief.roofType}
                onChange={(event) => handleBriefChange({ roofType: event.target.value as ArchitectRoofType })}
                disabled={isGenerating}
              >
                {ARCHITECT_ROOF_TYPES.map((roof) => (
                  <option key={roof.id} value={roof.id}>
                    {roof.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="architect-field">
              <span className="architect-field-label">Floor count</span>
              <select
                className="architect-select"
                value={String(brief.floors)}
                onChange={(event) => handleBriefChange({ floors: Number(event.target.value) })}
                disabled={isGenerating}
              >
                {Array.from({ length: 12 }, (_, index) => index + 1).map((floorCount) => (
                  <option key={floorCount} value={floorCount}>
                    {floorCount} floor{floorCount === 1 ? "" : "s"}
                  </option>
                ))}
              </select>
            </label>

            <label className="architect-field">
              <span className="architect-field-label">Material style</span>
              <select
                className="architect-select"
                value={brief.materialStyle}
                onChange={(event) => handleBriefChange({ materialStyle: event.target.value as ArchitectMaterialStyle })}
                disabled={isGenerating}
              >
                {ARCHITECT_MATERIAL_STYLES.map((style) => (
                  <option key={style.id} value={style.id}>
                    {style.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="architect-toggle">
            <input
              type="checkbox"
              checked={brief.realisticHouseFocus}
              onChange={(event) => handleBriefChange({ realisticHouseFocus: event.target.checked })}
              disabled={isGenerating}
            />
            <span>
              <strong>Realistic house focus</strong>
              <span className="architect-toggle-copy">
                Bias the generator toward buildable residential proportions, sensible roof geometry,
                and real-world facade detail.
              </span>
            </span>
          </label>

          <div className="architect-preset-grid" role="list" aria-label="Building type presets">
            {ARCHITECT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`architect-preset-chip ${selectedPreset === preset.id ? "active" : ""}`}
                onClick={() => handleSelectPreset(preset.id)}
                disabled={isGenerating}
                role="listitem"
              >
                <span className="architect-preset-label">{preset.label}</span>
                <span className="architect-preset-copy">Load a detailed starting prompt</span>
              </button>
            ))}
          </div>

          <textarea
            className="chat-composer architect-prompt"
            rows={8}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Example: a small library pavilion with a curved canopy, glass front, and stepped roof volumes..."
            disabled={isGenerating}
          />

          <div className="architect-button-row">
            <button className="action-button primary" onClick={() => void handleGenerate()} disabled={isGenerating}>
              <Sparkles size={16} />
              <span>{isGenerating ? "Generating..." : "Generate 3D Building"}</span>
            </button>
            <button className="action-button secondary" onClick={handleRotateView} disabled={!generatedCode}>
              <RotateCw size={16} />
              <span>Rotate View</span>
            </button>
            <button className="action-button secondary" onClick={handleResetCamera} disabled={!generatedCode}>
              <RotateCcw size={16} />
              <span>Reset Camera</span>
            </button>
            <button className="action-button secondary" onClick={() => void handleExportCode()} disabled={!generatedCode}>
              <Download size={16} />
              <span>Export Code</span>
            </button>
          </div>

          {errorMessage ? (
            <div className="error-callout architect-error">
              <strong>Model error</strong>
              <p>{errorMessage}</p>
            </div>
          ) : null}

          <div className="architect-code-card">
            <div className="section-header compact">
              <h2>Generated code</h2>
              <p>Executable Three.js procedural body returned by Gemma.</p>
            </div>
            <pre className="code-surface">{generatedCode || "Generated code will appear here after the model responds."}</pre>
          </div>
        </article>

        <article className="report-card architect-viewer-card">
          <div className="section-header">
            <h2>3D viewport</h2>
            <p>Drag to rotate, scroll to zoom, and inspect the procedural massing model.</p>
          </div>

          <div className="building-canvas-shell" ref={hostRef}>
            {!generatedCode ? (
              <div className="empty-state building-placeholder">
                <div className="empty-state-title">No building generated yet</div>
                <p>Your 3D structure will render here once you generate code from the description.</p>
              </div>
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}

function executeGeneratedCode(
  code: string,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
): unknown {
  // The evaluator exposes only THREE, scene, and camera to the generated snippet.
  const wrappedBody = `
"use strict";
${code}
if (typeof __localinspect_export !== "undefined") return __localinspect_export;
if (typeof group !== "undefined") return group;
if (typeof building !== "undefined") return building;
if (typeof model !== "undefined") return model;
if (typeof sceneObject !== "undefined") return sceneObject;
if (typeof root !== "undefined") return root;
if (typeof result !== "undefined") return result;
if (typeof scene !== "undefined" && scene && scene.isObject3D) return scene;
return undefined;
`;

  const factory = new Function(
    "THREE",
    "scene",
    "camera",
    wrappedBody,
  ) as (
    three: typeof THREE,
    sceneArg: THREE.Scene,
    cameraArg: THREE.PerspectiveCamera,
  ) => unknown;

  return factory(THREE, scene, camera);
}

function normalizeGeneratedResult(result: unknown): THREE.Object3D {
  if (result instanceof THREE.Object3D) {
    return result;
  }

  if (result && typeof result === "object") {
    const knownKeys = ["object", "group", "building", "model", "scene", "root", "mesh"];
    for (const key of knownKeys) {
      const maybeObject = (result as Record<string, unknown>)[key];
      if (maybeObject instanceof THREE.Object3D) {
        return maybeObject;
      }
    }

    for (const value of Object.values(result as Record<string, unknown>)) {
      if (value instanceof THREE.Object3D) {
        return value;
      }
    }
  }

  throw new Error("The generated code must return a THREE.Object3D or an object containing one.");
}

function centerObject(object: THREE.Object3D): THREE.Object3D {
  const bounds = new THREE.Box3().setFromObject(object);
  const center = new THREE.Vector3();
  bounds.getCenter(center);
  object.position.sub(center);
  object.position.y -= bounds.min.y;
  return object;
}

function frameCameraToObject(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls | null,
  object: THREE.Object3D,
) {
  const bounds = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  bounds.getSize(size);
  const maxDimension = Math.max(size.x, size.y, size.z, 1);
  const distance = maxDimension * 1.8;

  camera.position.set(distance, distance * 0.7, distance);
  camera.near = Math.max(0.01, distance / 100);
  camera.far = distance * 30;
  camera.updateProjectionMatrix();

  controls?.target.set(0, size.y * 0.35, 0);
  controls?.update();
}

function disposeSceneGraph(root: THREE.Object3D) {
  root.traverse((child: THREE.Object3D) => {
    disposeObject3D(child);
  });
}

function clearGeneratedLayer(layer: THREE.Group) {
  while (layer.children.length > 0) {
    const child = layer.children[0];
    layer.remove(child);
    disposeSceneGraph(child);
  }
}

function createSceneProxy(scene: THREE.Scene, layer: THREE.Group): THREE.Scene {
  return new Proxy(scene, {
    get(target, property, receiver) {
      if (property === "add") {
        // Route generated additions into the scratch layer so they can be centered before display.
        return (...objects: THREE.Object3D[]) => {
          objects.forEach((object) => layer.add(object));
        };
      }

      if (property === "remove") {
        return (...objects: THREE.Object3D[]) => {
          objects.forEach((object) => layer.remove(object));
        };
      }

      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
    set(target, property, value, receiver) {
      return Reflect.set(target, property, value, receiver);
    },
  }) as THREE.Scene;
}

function disposeObject3D(object: THREE.Object3D) {
  const mesh = object as THREE.Mesh;
  if (mesh.geometry) {
    mesh.geometry.dispose();
  }

  if (Array.isArray(mesh.material)) {
    mesh.material.forEach(disposeMaterial);
  } else if (mesh.material) {
    disposeMaterial(mesh.material);
  }
}

function disposeMaterial(material: THREE.Material) {
  const mat = material as THREE.MeshStandardMaterial;
  (Object.values(mat) as Array<unknown>).forEach((value) => {
    if (value instanceof THREE.Texture) {
      value.dispose();
    }
  });
  material.dispose();
}
