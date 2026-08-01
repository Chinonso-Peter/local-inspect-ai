import type { ChatMessage } from "../types/chat";
import { sendChatMessage } from "./ollamaApi";

export interface ArchitectPreset {
  id: ArchitectPresetId;
  label: string;
  prompt: string;
}

export interface ArchitectBriefOptions {
  presetId?: ArchitectPresetId;
  roofType?: ArchitectRoofType;
  floors?: number;
  materialStyle?: ArchitectMaterialStyle;
  realisticHouseFocus?: boolean;
}

export type ArchitectPresetId =
  | "contemporary_house"
  | "courtyard_villa"
  | "townhouse"
  | "office_tower"
  | "library_pavilion"
  | "civic_museum"
  | "sanctuary";

export type ArchitectRoofType = "flat" | "gable" | "hip" | "shed" | "butterfly" | "pyramid";

export type ArchitectMaterialStyle =
  | "warm_masonry"
  | "glass_metal"
  | "brick"
  | "stone"
  | "wood"
  | "white_render";

export const ARCHITECT_ROOF_TYPES: Array<{ id: ArchitectRoofType; label: string; prompt: string }> = [
  { id: "flat", label: "Flat Roof", prompt: "Use a clean flat roof with parapet lines and crisp edges." },
  { id: "gable", label: "Gable Roof", prompt: "Use a realistic gable roof with proper pitch and eaves." },
  { id: "hip", label: "Hip Roof", prompt: "Use a hip roof with believable slope transitions and overhangs." },
  { id: "shed", label: "Shed Roof", prompt: "Use a contemporary shed roof with a strong directional slope." },
  { id: "butterfly", label: "Butterfly Roof", prompt: "Use a butterfly roof with a subtle center valley and modern lines." },
  { id: "pyramid", label: "Pyramid Roof", prompt: "Use a pyramid roof or compact hipped crown for a balanced form." },
];

export const ARCHITECT_MATERIAL_STYLES: Array<{ id: ArchitectMaterialStyle; label: string; prompt: string }> = [
  { id: "warm_masonry", label: "Warm Masonry", prompt: "Prioritize warm masonry, textured base materials, and restrained metal accents." },
  { id: "glass_metal", label: "Glass + Metal", prompt: "Prioritize glass, dark metal frames, and refined reflective facade surfaces." },
  { id: "brick", label: "Brick", prompt: "Prioritize brick facade rhythm, punched openings, and solid wall depth." },
  { id: "stone", label: "Stone", prompt: "Prioritize stone volumes, deep reveals, and a grounded civic-like material palette." },
  { id: "wood", label: "Wood", prompt: "Prioritize warm wood accents, natural cladding, and softer residential detailing." },
  { id: "white_render", label: "White Render", prompt: "Prioritize white render or light plaster with crisp shadow lines and clean modern edges." },
];

export const ARCHITECT_PRESETS: ArchitectPreset[] = [
  {
    id: "contemporary_house",
    label: "Contemporary House",
    prompt:
      "Create a detailed contemporary two-story house with a strong front entry, layered facade volumes, real roof geometry, generous glazing, porch or canopy elements, believable wall thickness, and polished architectural detailing suitable for a real residential concept.",
  },
  {
    id: "courtyard_villa",
    label: "Courtyard Villa",
    prompt:
      "Create a warm courtyard villa with masonry walls, shaded outdoor terraces, a recessed entry, careful window placement, low roof masses, balconies or overhangs, and refined material contrast that feels suitable for a real family residence.",
  },
  {
    id: "townhouse",
    label: "Townhouse Row",
    prompt:
      "Create a detailed urban townhouse with a narrow frontage, vertical proportions, stoop or porch entry, brick or stone facade articulation, repeated windows, bay or dormer elements, and a believable roofline for a real city residence.",
  },
  {
    id: "office_tower",
    label: "Office Tower",
    prompt:
      "Create a polished office tower with a podium, setback shaft, crown, curtain wall rhythm, mullions, mechanical top, and a refined entry plaza so the massing reads like a credible real-world commercial building.",
  },
  {
    id: "library_pavilion",
    label: "Library Pavilion",
    prompt:
      "Create a library pavilion with a generous canopy, glazed reading rooms, strong roof edges, column rhythm, warm material accents, and calm architectural proportions that feel inviting and well detailed.",
  },
  {
    id: "civic_museum",
    label: "Civic Museum",
    prompt:
      "Create a civic museum with layered stone volumes, a clear ceremonial entry, controlled glazing, deep reveals, parapets, shaded terraces, and a composed facade that reads as a serious public building.",
  },
  {
    id: "sanctuary",
    label: "Sanctuary",
    prompt:
      "Create a sanctuary or chapel with a prominent roof form, articulated entry, tall openings, textured masonry, a focal tower or spire, and a calm, dignified massing suitable for a real place of worship.",
  },
];

const ARCHITECT_3D_PROMPT = `
You are LocalInspect AI, an expert AI architect generator for procedural Three.js buildings.
Return ONLY valid JavaScript code inside a fenced \`\`\`javascript code block.

The code must:
- Use Three.js primitives such as THREE.BoxGeometry, THREE.CylinderGeometry, THREE.ConeGeometry, THREE.MeshStandardMaterial, lights, and camera setup.
- Be written as executable code that will run inside a function body with THREE, scene, and camera available in scope.
- Build a single building group or object and return it with \`return group;\` or an equivalent object return.
- Adapt the massing, roofline, and facade treatment to the requested building type (for example residential, civic, tower, pavilion, industrial, or religious).
- Make each result feel like a polished architectural concept, not a generic block.
- Build layered massing with at least three clearly differentiated parts when possible: base/podium, main body, and roof or crown.
- Include facade articulation such as window grids, mullions, recessed openings, columns, pilasters, balconies, canopies, roof edges, parapets, or trim.
- Use materials deliberately so masonry, glazing, metal, and roofing read as distinct surfaces.
- Add an entry sequence or visible front elevation so the building has a believable architectural face.
- If the prompt implies a real house, make it feel buildable: sensible proportions, real roof geometry, porch or canopy, windows, and restrained but credible detailing.
- Add any helpful lights to the provided scene and adjust the provided camera if needed.
- Never emit an anonymous function statement like \`function () {}\`. If you define a function, it must be named or assigned to a const.
- Prefer straight-line scene-building code with \`const group = new THREE.Group();\` and \`return group;\`.
- Avoid markdown outside the fenced code block.
- Avoid explanations, bullet points, or surrounding prose.

Design for the user's natural language description and create a visually coherent architectural concept model with polished building detail.
`.trim();

const MODEL_TIMEOUT_MS = 300_000;

export async function generate3DBuildingCode(
  prompt: string,
  options?: ArchitectBriefOptions,
): Promise<string> {
  // Ask Gemma for executable Three.js code, then sanitize it before the viewer runs it.
  const architectPrompt = buildArchitecturalRequestPrompt(prompt, options);
  const userMessage: ChatMessage = {
    id: crypto.randomUUID(),
    role: "user",
    content: architectPrompt,
    timestamp: Date.now(),
  };

  try {
    const result = await sendChatMessage({
      messages: [userMessage],
      onChunk: () => undefined,
      onError: () => undefined,
      systemPrompt: ARCHITECT_3D_PROMPT,
      timeoutMs: MODEL_TIMEOUT_MS,
    });

    const normalized = normalizeArchitectJavaScript(extractJavaScriptFromResponse(result.content));
    return normalized || buildFallbackArchitecturalCode(prompt);
  } catch (error) {
    console.warn("Architect model generation failed; using built-in fallback geometry.", error);
    return buildFallbackArchitecturalCode(prompt);
  }
}

export function buildFallbackArchitecturalCode(prompt: string): string {
  const normalizedPrompt = prompt.toLowerCase();
  const useGlass = /glass|transparent|entry|civic|museum|tower|office|library/i.test(prompt);
  const useMasonry = /masonry|stone|brick|concrete|house|villa|church|temple|suburban|religious/i.test(prompt);

  // The fallback is intentionally deterministic so the 3D viewer always has a valid scene graph to render.
  const shellColor = useGlass ? 0x1e3558 : useMasonry ? 0x5b4937 : 0x2e4058;
  const wingColor = useMasonry ? 0x8b5e3c : 0x6e5a46;
  const accentColor = useGlass ? 0xc8dcff : 0x88a8de;
  const glassColor = useGlass ? 0x7facd8 : 0x9bc4e1;
  const trimColor = 0x1f2937;

  const helpers = `
function createWindow(x, y, z, width, height) {
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.06, height + 0.06, 0.08),
    new THREE.MeshStandardMaterial({ color: ${trimColor}, roughness: 0.28, metalness: 0.15 })
  );
  frame.position.set(x, y, z);
  frame.castShadow = true;
  frame.receiveShadow = true;

  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, 0.04),
    new THREE.MeshStandardMaterial({ color: ${glassColor}, roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.86 })
  );
  glass.position.set(x, y, z + 0.04);
  glass.castShadow = true;
  glass.receiveShadow = true;

  const group = new THREE.Group();
  group.add(frame, glass);
  return group;
}

function createColumn(x, y, z, height) {
  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, height, 14),
    new THREE.MeshStandardMaterial({ color: 0x8a6d4f, roughness: 0.65, metalness: 0.05 })
  );
  column.position.set(x, y, z);
  column.castShadow = true;
  column.receiveShadow = true;
  return column;
}

function createBalcony(x, y, z, width, depth) {
  const balcony = new THREE.Group();

  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.12, depth),
    new THREE.MeshStandardMaterial({ color: 0x2a3444, roughness: 0.45, metalness: 0.12 })
  );
  slab.position.set(x, y, z);
  slab.castShadow = true;
  slab.receiveShadow = true;
  balcony.add(slab);

  const rail = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.55, 0.05),
    new THREE.MeshStandardMaterial({ color: 0xd5e3f7, roughness: 0.22, metalness: 0.22, transparent: true, opacity: 0.8 })
  );
  rail.position.set(x, y + 0.34, z + depth * 0.42);
  rail.castShadow = true;
  rail.receiveShadow = true;
  balcony.add(rail);

  return balcony;
}

function createRoofOverhang(width, depth, height, color) {
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({ color, roughness: 0.58, metalness: 0.08 })
  );
  roof.castShadow = true;
  roof.receiveShadow = true;
  return roof;
}
`;

  let variant = "civic";
  if (/(house|home|villa|residential|suburban|cottage|family)/.test(normalizedPrompt)) {
    variant = "residential";
  } else if (/(tower|skyscraper|office|high-rise|commercial|glass)/.test(normalizedPrompt)) {
    variant = "tower";
  } else if (/(pavilion|canopy|garden|gallery|market|exhibition|shed)/.test(normalizedPrompt)) {
    variant = "pavilion";
  } else if (/(warehouse|factory|industrial|distribution|loading)/.test(normalizedPrompt)) {
    variant = "industrial";
  } else if (/(church|temple|cathedral|religious|sanctuary)/.test(normalizedPrompt)) {
    variant = "religious";
  } else if (/(hospital|clinic|medical|health|care)/.test(normalizedPrompt)) {
    variant = "medical";
  }

  switch (variant) {
    case "residential":
      return `${helpers}
const group = new THREE.Group();

const foundation = new THREE.Mesh(
  new THREE.BoxGeometry(5.2, 0.3, 3.1),
  new THREE.MeshStandardMaterial({ color: ${wingColor}, roughness: 0.82, metalness: 0.04 })
);
foundation.position.set(0, 0.15, 0);
foundation.castShadow = true;
foundation.receiveShadow = true;
group.add(foundation);

const mainBody = new THREE.Mesh(
  new THREE.BoxGeometry(4.0, 2.55, 2.6),
  new THREE.MeshStandardMaterial({ color: ${shellColor}, roughness: 0.65, metalness: 0.08 })
);
mainBody.position.set(0, 1.47, 0);
mainBody.castShadow = true;
mainBody.receiveShadow = true;
group.add(mainBody);

const garage = new THREE.Mesh(
  new THREE.BoxGeometry(1.95, 1.9, 1.8),
  new THREE.MeshStandardMaterial({ color: ${wingColor}, roughness: 0.7, metalness: 0.05 })
);
garage.position.set(-2.1, 0.95, -0.35);
garage.castShadow = true;
garage.receiveShadow = true;
group.add(garage);

const roof = new THREE.Mesh(
  new THREE.ConeGeometry(1.65, 1.12, 4),
  new THREE.MeshStandardMaterial({ color: 0x2b2634, roughness: 0.62, metalness: 0.08 })
);
roof.position.set(0, 3.42, 0);
roof.rotation.y = Math.PI / 4;
roof.castShadow = true;
roof.receiveShadow = true;
group.add(roof);

const entry = new THREE.Mesh(
  new THREE.BoxGeometry(1.05, 1.55, 0.32),
  new THREE.MeshStandardMaterial({ color: ${accentColor}, roughness: 0.42, metalness: 0.12 })
);
entry.position.set(1.1, 0.82, 1.18);
entry.castShadow = true;
entry.receiveShadow = true;
group.add(entry);

const canopy = new THREE.Mesh(
  new THREE.BoxGeometry(1.7, 0.18, 1.0),
  new THREE.MeshStandardMaterial({ color: 0x28364e, roughness: 0.45, metalness: 0.1 })
);
canopy.position.set(1.1, 1.52, 0.7);
canopy.castShadow = true;
canopy.receiveShadow = true;
group.add(canopy);

const columnA = createColumn(0.35, 1.0, 0.65, 1.8);
group.add(columnA);
const columnB = createColumn(1.85, 1.0, 0.65, 1.8);
group.add(columnB);

group.add(createWindow(1.1, 1.42, 1.32, 0.78, 1.05));
group.add(createWindow(-1.05, 1.42, 1.32, 0.78, 1.05));
group.add(createWindow(-0.95, 1.42, -1.28, 0.82, 0.92));
group.add(createWindow(0.95, 1.42, -1.28, 0.82, 0.92));
group.add(createBalcony(0.05, 1.95, 1.12, 1.9, 0.55));

for (let index = 0; index < 4; index += 1) {
  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 2.55, 0.08),
    new THREE.MeshStandardMaterial({ color: 0xe8edf5, roughness: 0.35, metalness: 0.08 })
  );
  trim.position.set(-1.5 + index * 1.0, 1.47, 1.03);
  trim.castShadow = true;
  trim.receiveShadow = true;
  group.add(trim);
}

const dormerA = new THREE.Mesh(
  new THREE.BoxGeometry(0.85, 0.7, 0.16),
  new THREE.MeshStandardMaterial({ color: 0xf3f4ff, roughness: 0.32, metalness: 0.08 })
);
dormerA.position.set(-0.85, 2.35, 0.85);
dormerA.castShadow = true;
dormerA.receiveShadow = true;
group.add(dormerA);
group.add(createWindow(-0.85, 2.35, 0.94, 0.45, 0.4));

const dormerB = dormerA.clone();
dormerB.position.set(0.85, 2.35, 0.85);
group.add(dormerB);
group.add(createWindow(0.85, 2.35, 0.94, 0.45, 0.4));

const chimney = new THREE.Mesh(
  new THREE.BoxGeometry(0.18, 0.7, 0.18),
  new THREE.MeshStandardMaterial({ color: 0x4e3f2d, roughness: 0.6, metalness: 0.05 })
);
chimney.position.set(-1.35, 3.1, 0.25);
chimney.castShadow = true;
chimney.receiveShadow = true;
group.add(chimney);

const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
keyLight.position.set(6, 8, 6);
keyLight.castShadow = true;
group.add(keyLight);

const fillLight = new THREE.AmbientLight(0x9dc4ff, 0.42);
group.add(fillLight);

camera.position.set(8.2, 5.4, 8.2);
camera.lookAt(0, 1.8, 0);

return group;
`.trim();

    case "tower":
      return `
const group = new THREE.Group();

function addSetback(y, scaleX, scaleZ) {
  const setback = new THREE.Mesh(
    new THREE.BoxGeometry(scaleX, 0.7, scaleZ),
    new THREE.MeshStandardMaterial({ color: 0xf1f7ff, roughness: 0.45, metalness: 0.12 })
  );
  setback.position.set(0, y, 0);
  setback.castShadow = true;
  setback.receiveShadow = true;
  return setback;
}

const podium = new THREE.Mesh(
  new THREE.BoxGeometry(2.8, 1.2, 2.8),
  new THREE.MeshStandardMaterial({ color: ${shellColor}, roughness: 0.55, metalness: 0.1 })
);
podium.position.set(0, 0.6, 0);
podium.castShadow = true;
podium.receiveShadow = true;
group.add(podium);

const shaft = new THREE.Mesh(
  new THREE.BoxGeometry(1.9, 5.4, 1.9),
  new THREE.MeshStandardMaterial({ color: ${accentColor}, roughness: 0.38, metalness: 0.16 })
);
shaft.position.set(0, 3.3, 0);
shaft.castShadow = true;
shaft.receiveShadow = true;
group.add(shaft);

const crown = new THREE.Mesh(
  new THREE.CylinderGeometry(1.15, 1.45, 0.8, 24),
  new THREE.MeshStandardMaterial({ color: 0x101a2b, roughness: 0.45, metalness: 0.12 })
);
crown.position.set(0, 6.15, 0);
crown.castShadow = true;
crown.receiveShadow = true;
group.add(crown);

const crownSpire = new THREE.Mesh(
  new THREE.CylinderGeometry(0.16, 0.24, 0.7, 12),
  new THREE.MeshStandardMaterial({ color: 0xdce9ff, roughness: 0.35, metalness: 0.2 })
);
crownSpire.position.set(0, 6.62, 0);
crownSpire.castShadow = true;
crownSpire.receiveShadow = true;
group.add(crownSpire);

const setbackA = addSetback(2.8, 2.0, 2.0);
group.add(setbackA);
const setbackB = addSetback(4.3, 1.4, 1.4);
group.add(setbackB);

for (let index = 0; index < 6; index += 1) {
  const windowPanel = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.7, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.25, metalness: 0.2 })
  );
  windowPanel.position.set(index % 2 === 0 ? -0.7 : 0.7, 3.1 + index * 0.35, 1.0);
  windowPanel.castShadow = true;
  windowPanel.receiveShadow = true;
  group.add(windowPanel);
}

const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
keyLight.position.set(6, 9, 6);
keyLight.castShadow = true;
group.add(keyLight);

const fillLight = new THREE.AmbientLight(0x9dc4ff, 0.45);
group.add(fillLight);

camera.position.set(8.5, 5.8, 8.5);
camera.lookAt(0, 3.2, 0);

return group;
`.trim();

    case "pavilion":
      return `
const group = new THREE.Group();

const base = new THREE.Mesh(
  new THREE.BoxGeometry(5.0, 0.25, 3.2),
  new THREE.MeshStandardMaterial({ color: ${wingColor}, roughness: 0.8, metalness: 0.04 })
);
base.position.set(0, 0.12, 0);
base.castShadow = true;
base.receiveShadow = true;
group.add(base);

for (let index = 0; index < 4; index += 1) {
  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 2.2, 12),
    new THREE.MeshStandardMaterial({ color: 0x8a6d4f, roughness: 0.65, metalness: 0.05 })
  );
  column.position.set(-1.8 + index * 1.2, 1.1, -1.0);
  column.castShadow = true;
  column.receiveShadow = true;
  group.add(column);
}

const roof = new THREE.Mesh(
  new THREE.BoxGeometry(4.8, 0.2, 3.0),
  new THREE.MeshStandardMaterial({ color: 0x10263d, roughness: 0.5, metalness: 0.12 })
);
roof.position.set(0, 2.18, 0);
roof.castShadow = true;
roof.receiveShadow = true;
group.add(roof);

const roofEdge = new THREE.Mesh(
  new THREE.BoxGeometry(4.95, 0.08, 0.2),
  new THREE.MeshStandardMaterial({ color: 0x5d3c2d, roughness: 0.55, metalness: 0.08 })
);
roofEdge.position.set(0, 2.27, 1.45);
roofEdge.castShadow = true;
roofEdge.receiveShadow = true;
group.add(roofEdge);

const canopy = new THREE.Mesh(
  new THREE.BoxGeometry(3.4, 0.18, 1.8),
  new THREE.MeshStandardMaterial({ color: ${accentColor}, roughness: 0.3, metalness: 0.14 })
);
canopy.position.set(0, 1.95, 0.5);
canopy.castShadow = true;
canopy.receiveShadow = true;
group.add(canopy);

const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
keyLight.position.set(4, 6, 5);
keyLight.castShadow = true;
group.add(keyLight);

const fillLight = new THREE.AmbientLight(0x8fb8ff, 0.45);
group.add(fillLight);

camera.position.set(6.8, 4.4, 6.8);
camera.lookAt(0, 1.2, 0);

return group;
`.trim();

    case "industrial":
      return `
const group = new THREE.Group();

const shell = new THREE.Mesh(
  new THREE.BoxGeometry(6.0, 2.4, 3.2),
  new THREE.MeshStandardMaterial({ color: 0x485a66, roughness: 0.85, metalness: 0.08 })
);
shell.position.set(0, 1.2, 0);
shell.castShadow = true;
shell.receiveShadow = true;
group.add(shell);

const loadingBay = new THREE.Mesh(
  new THREE.BoxGeometry(1.8, 1.6, 0.35),
  new THREE.MeshStandardMaterial({ color: 0x20252d, roughness: 0.65, metalness: 0.1 })
);
loadingBay.position.set(0, 0.8, 1.75);
loadingBay.castShadow = true;
loadingBay.receiveShadow = true;
group.add(loadingBay);

const truss = new THREE.Mesh(
  new THREE.BoxGeometry(5.2, 0.2, 0.4),
  new THREE.MeshStandardMaterial({ color: 0x8892a0, roughness: 0.6, metalness: 0.12 })
);
truss.position.set(0, 2.7, 0);
truss.castShadow = true;
truss.receiveShadow = true;
group.add(truss);

const trussSupport = new THREE.Mesh(
  new THREE.BoxGeometry(0.15, 1.4, 0.15),
  new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.7, metalness: 0.08 })
);
trussSupport.position.set(0, 1.95, 0);
trussSupport.castShadow = true;
trussSupport.receiveShadow = true;
group.add(trussSupport);

for (let index = 0; index < 5; index += 1) {
  const window = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.8, 0.08),
    new THREE.MeshStandardMaterial({ color: 0xf6fbff, roughness: 0.2, metalness: 0.18 })
  );
  window.position.set(-2.1 + index * 0.9, 1.6, 1.65);
  window.castShadow = true;
  window.receiveShadow = true;
  group.add(window);
}

const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
keyLight.position.set(5, 7, 4);
keyLight.castShadow = true;
group.add(keyLight);

camera.position.set(8.5, 4.8, 8.5);
camera.lookAt(0, 1.2, 0);

return group;
`.trim();

    case "religious":
      return `
const group = new THREE.Group();

const nave = new THREE.Mesh(
  new THREE.BoxGeometry(3.6, 3.4, 2.4),
  new THREE.MeshStandardMaterial({ color: ${shellColor}, roughness: 0.7, metalness: 0.05 })
);
nave.position.set(0, 1.7, 0);
nave.castShadow = true;
nave.receiveShadow = true;
group.add(nave);

const apse = new THREE.Mesh(
  new THREE.BoxGeometry(2.0, 1.8, 1.2),
  new THREE.MeshStandardMaterial({ color: ${wingColor}, roughness: 0.72, metalness: 0.04 })
);
apse.position.set(0, 1.0, 1.5);
apse.castShadow = true;
apse.receiveShadow = true;
group.add(apse);

const roseWindow = new THREE.Mesh(
  new THREE.CylinderGeometry(0.55, 0.55, 0.16, 18),
  new THREE.MeshStandardMaterial({ color: 0xe8f0ff, roughness: 0.25, metalness: 0.16 })
);
roseWindow.position.set(0, 2.15, 1.25);
roseWindow.castShadow = true;
roseWindow.receiveShadow = true;
group.add(roseWindow);

const spire = new THREE.Mesh(
  new THREE.CylinderGeometry(0.18, 0.24, 2.1, 12),
  new THREE.MeshStandardMaterial({ color: 0x6e4e23, roughness: 0.6, metalness: 0.08 })
);
spire.position.set(0, 4.15, 0);
spire.castShadow = true;
spire.receiveShadow = true;
group.add(spire);

const keyLight = new THREE.DirectionalLight(0xffffff, 1.15);
keyLight.position.set(4, 8, 4);
keyLight.castShadow = true;
group.add(keyLight);

const fillLight = new THREE.AmbientLight(0xbfdfff, 0.45);
group.add(fillLight);

camera.position.set(7.5, 5.2, 7.5);
camera.lookAt(0, 1.8, 0);

return group;
`.trim();

    case "medical":
      return `
const group = new THREE.Group();

const mainWing = new THREE.Mesh(
  new THREE.BoxGeometry(4.8, 2.6, 2.2),
  new THREE.MeshStandardMaterial({ color: ${shellColor}, roughness: 0.6, metalness: 0.08 })
);
mainWing.position.set(0, 1.3, 0);
mainWing.castShadow = true;
mainWing.receiveShadow = true;
group.add(mainWing);

const entryCanopy = new THREE.Mesh(
  new THREE.BoxGeometry(1.8, 0.25, 1.3),
  new THREE.MeshStandardMaterial({ color: ${accentColor}, roughness: 0.35, metalness: 0.12 })
);
entryCanopy.position.set(0, 2.15, 1.3);
entryCanopy.castShadow = true;
entryCanopy.receiveShadow = true;
group.add(entryCanopy);

const entryFrame = new THREE.Mesh(
  new THREE.BoxGeometry(0.25, 1.15, 0.18),
  new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.25, metalness: 0.18 })
);
entryFrame.position.set(0, 1.3, 1.4);
entryFrame.castShadow = true;
entryFrame.receiveShadow = true;
group.add(entryFrame);

const sideWing = new THREE.Mesh(
  new THREE.BoxGeometry(1.7, 1.8, 1.6),
  new THREE.MeshStandardMaterial({ color: ${wingColor}, roughness: 0.7, metalness: 0.04 })
);
sideWing.position.set(-2.25, 0.9, 0);
sideWing.castShadow = true;
sideWing.receiveShadow = true;
group.add(sideWing);

const keyLight = new THREE.DirectionalLight(0xffffff, 1.3);
keyLight.position.set(6, 7.5, 5);
keyLight.castShadow = true;
group.add(keyLight);

const fillLight = new THREE.AmbientLight(0xb9d7ff, 0.45);
group.add(fillLight);

camera.position.set(8.2, 4.8, 8.2);
camera.lookAt(0, 1.4, 0);

return group;
`.trim();

    default:
      return `${helpers}
const group = new THREE.Group();

const base = new THREE.Mesh(
  new THREE.BoxGeometry(4.8, 0.28, 2.4),
  new THREE.MeshStandardMaterial({ color: ${wingColor}, roughness: 0.82, metalness: 0.04 })
);
base.position.set(0, 0.14, 0);
base.castShadow = true;
base.receiveShadow = true;
group.add(base);

const mainVolume = new THREE.Mesh(
  new THREE.BoxGeometry(4.2, 2.7, 2.0),
  new THREE.MeshStandardMaterial({ color: ${shellColor}, roughness: 0.66, metalness: 0.08 })
);
mainVolume.position.set(0, 1.35, 0);
mainVolume.castShadow = true;
mainVolume.receiveShadow = true;
group.add(mainVolume);

const leftWing = new THREE.Mesh(
  new THREE.BoxGeometry(1.12, 2.0, 1.1),
  new THREE.MeshStandardMaterial({ color: ${wingColor}, roughness: 0.7, metalness: 0.05 })
);
leftWing.position.set(-2.05, 1.0, -0.35);
leftWing.castShadow = true;
leftWing.receiveShadow = true;
group.add(leftWing);

const rightWing = leftWing.clone();
rightWing.position.set(2.0, 0.95, -0.35);
group.add(rightWing);

const entry = new THREE.Mesh(
  new THREE.BoxGeometry(1.15, 1.82, 0.38),
  new THREE.MeshStandardMaterial({ color: ${accentColor}, roughness: 0.45, metalness: 0.1 })
);
entry.position.set(0, 0.92, 1.15);
entry.castShadow = true;
entry.receiveShadow = true;
group.add(entry);

const roof = new THREE.Mesh(
  new THREE.BoxGeometry(5.2, 0.34, 2.95),
  new THREE.MeshStandardMaterial({ color: 0x101a2b, roughness: 0.8, metalness: 0.1 })
);
roof.position.set(0, 3.34, 0);
roof.castShadow = true;
roof.receiveShadow = true;
group.add(roof);

const canopy = new THREE.Mesh(
  new THREE.BoxGeometry(1.6, 0.2, 1.12),
  new THREE.MeshStandardMaterial({ color: 0xe7f0ff, roughness: 0.25, metalness: 0.2 })
);
canopy.position.set(0, 2.62, 1.26);
canopy.castShadow = true;
canopy.receiveShadow = true;
group.add(canopy);

const windowWall = createWindow(0, 1.45, 0.97, 3.2, 1.2);
group.add(windowWall);

group.add(createBalcony(0, 1.95, 1.03, 2.0, 0.55));

for (let index = 0; index < 6; index += 1) {
  const mullion = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 1.32, 0.05),
    new THREE.MeshStandardMaterial({ color: 0xd6deeb, roughness: 0.3, metalness: 0.08 })
  );
  mullion.position.set(-1.2 + index * 0.48, 1.44, 1.0);
  mullion.castShadow = true;
  mullion.receiveShadow = true;
  group.add(mullion);
}

const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
keyLight.position.set(6, 8, 6);
keyLight.castShadow = true;
group.add(keyLight);

const fillLight = new THREE.AmbientLight(0x8fb4ff, 0.55);
group.add(fillLight);

camera.position.set(8.2, 5.3, 8.2);
camera.lookAt(0, 1.7, 0);

return group;
`.trim();
  }
}

function extractJavaScriptFromResponse(response: string): string {
  const fencedMatch = response.match(/```(?:javascript|js)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  return response.trim();
}

export function normalizeArchitectJavaScript(source: string): string {
  const trimmed = source.trim();

  if (!trimmed) {
    return "";
  }

  // Convert model-generated function wrappers into an immediately runnable script.
  if (/^(async\s+)?function(\s|\()/i.test(trimmed)) {
    return `const __localinspect_build = ${trimmed};\nreturn __localinspect_build();`;
  }

  return trimmed;
}

export function buildArchitecturalRequestPrompt(
  prompt: string,
  options?: ArchitectBriefOptions,
): string {
  const cleanedPrompt = prompt.trim();
  const fallbackPrompt =
    ARCHITECT_PRESETS[0]?.prompt ??
    "Create a detailed contemporary house with layered facade volumes, a credible entry sequence, roof articulation, realistic windows, and polished architectural detail.";
  const selectedPresetPrompt = options?.presetId
    ? getArchitectPresetPrompt(options.presetId)
    : fallbackPrompt;
  const roofPrompt = options?.roofType
    ? ARCHITECT_ROOF_TYPES.find((roof) => roof.id === options.roofType)?.prompt
    : undefined;
  const materialPrompt = options?.materialStyle
    ? ARCHITECT_MATERIAL_STYLES.find((style) => style.id === options.materialStyle)?.prompt
    : undefined;
  const floors = typeof options?.floors === "number" && Number.isFinite(options.floors)
    ? Math.min(Math.max(Math.round(options.floors), 1), 12)
    : undefined;
  const floorsPrompt = floors ? `Target ${floors} floor${floors === 1 ? "" : "s"} with believable vertical proportions.` : undefined;
  const houseBiasPrompt = options?.realisticHouseFocus
    ? "Prioritize a realistic house-like result with codeable proportions, sensible window spacing, believable roof geometry, and avoid exaggerated fantasy shapes."
    : undefined;

  // The prompt combines the user brief with specific design constraints so the output stays renderable.
  return [
    selectedPresetPrompt,
    cleanedPrompt && cleanedPrompt !== selectedPresetPrompt ? cleanedPrompt : undefined,
    "",
    "Architectural quality requirements:",
    "- Create a polished, buildable-looking Three.js architectural concept.",
    "- Use layered massing instead of a plain rectangle.",
    "- Add believable facade depth, repeated openings, trims, and a clear front entry.",
    "- Include roof character, parapets, canopies, balconies, porches, or setbacks where appropriate.",
    "- Make materials read distinctly as masonry, glass, metal, or roof surfaces.",
    "- Prefer a design that an architect could plausibly reference as a concept massing study.",
    roofPrompt,
    materialPrompt,
    floorsPrompt,
    houseBiasPrompt,
    "- Return only executable JavaScript in a fenced code block.",
  ].filter(Boolean).join("\n");
}

export function getArchitectPresetPrompt(presetId: ArchitectPresetId): string {
  return ARCHITECT_PRESETS.find((preset) => preset.id === presetId)?.prompt ?? ARCHITECT_PRESETS[0].prompt;
}
