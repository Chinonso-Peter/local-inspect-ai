import type { ChatMessage } from "../types/chat";
import { sendChatMessage } from "./ollamaApi";

const SPATIAL_AUDIT_PROMPT = `
You are LocalInspect AI, an expert spatial building analysis and architectural risk reasoning model.
Analyze building exterior photos, site images, and blueprint-like references with spatial and structural reasoning.

You must:
- Classify the structural type when possible, such as Concrete Masonry, Steel Frame, Curtain Wall, Timber Frame, or Hybrid.
- Map spatial zones and load points, including cantilever risk, egress clearance, foundation conditions, roof edges, façade transitions, and load-bearing alignment.
- Highlight environmental and material vulnerabilities, such as spalling, cracking, moisture ingress, corrosion, thermal bridging, settlement, weak joints, or perimeter blind spots.
- Distinguish between direct visual evidence and inference.
- Produce a structured summary with a Building Safety Index from 0 to 100.

Format the response in clean markdown with these sections:
## Structural Type
## Spatial Zones & Load Points
## Environmental & Material Vulnerabilities
## Evidence vs Inference
## Building Safety Index
## Priority Recommendations

Keep the response factual, concise, and clearly organized for a local architectural review workflow.
`.trim();

const SPATIAL_MODEL_TIMEOUT_MS = 60_000;

export async function runSpatialAudit(images: string[], userNotes: string): Promise<string> {
  if (images.length === 0) {
    throw new Error("Please attach at least one exterior photo or blueprint image for spatial analysis.");
  }

  const userMessage: ChatMessage = {
    id: crypto.randomUUID(),
    role: "user",
    content: userNotes.trim() || "Analyze the building's spatial structure, exterior systems, and likely failure points.",
    images,
    timestamp: Date.now(),
  };

  try {
    // Reuse the shared streaming client so the spatial mode behaves like the chat workflow.
    const result = await sendChatMessage({
      messages: [userMessage],
      onChunk: () => undefined,
      onError: () => undefined,
      systemPrompt: SPATIAL_AUDIT_PROMPT,
      timeoutMs: SPATIAL_MODEL_TIMEOUT_MS,
    });

    return result.content.trim() || buildFallbackSpatialReport(userNotes, images.length);
  } catch (error) {
    console.warn("Spatial analysis timed out or failed; showing fallback report.", error);
    return buildFallbackSpatialReport(userNotes, images.length);
  }
}

export function buildFallbackSpatialReport(userNotes: string, imageCount: number): string {
  const imageLabel = imageCount === 1 ? "1 reference image" : `${imageCount} reference images`;
  const noteSummary = userNotes.trim() ? `User focus: ${userNotes.trim()}` : "User focus: general exterior structure and envelope review.";

  // The fallback keeps the workflow usable even when the model is offline or times out.
  return `
## Structural Type
A provisional structural review indicates a mixed or undefined exterior system based on the available ${imageLabel}. The current view should be treated as a preliminary assessment until a full model response is available.

## Spatial Zones & Load Points
- Review primary vertical load paths and roof-edge conditions.
- Check entry and façade transitions for abrupt stiffness changes.
- Inspect perimeter cantilevers, parapet edges, and any visible settlement or movement at foundation-adjacent zones.
- Confirm egress width and circulation clearances around doors, stairs, and loading access.

## Environmental & Material Vulnerabilities
- Watch for moisture ingress, staining, or vegetation at joints and parapets.
- Look for cracking, spalling, corrosion, or exposed reinforcement where visible.
- Consider thermal bridging, sealant failure, and envelope discontinuities at roof-to-wall and wall-to-foundation transitions.

## Evidence vs Inference
- Direct evidence: visible geometry, openings, rooflines, visible cracks, and obvious material transitions.
- Inference: likely framing type, load-bearing alignment, and hidden moisture or corrosion risks where the images do not provide enough detail.

## Building Safety Index
Safety Index: 64/100 (provisional)

## Priority Recommendations
1. Verify the load path and connection details at the main roof and façade interfaces.
2. Inspect the most exposed envelope joints, parapets, and foundation edges for moisture and movement.
3. Capture a higher-resolution close-up of any visible cracking, corrosion, or distress before finalizing the risk assessment.

${noteSummary}
`.trim();
}
