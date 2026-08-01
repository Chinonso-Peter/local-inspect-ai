import { describe, expect, it } from "vitest";
import { buildFallbackSpatialReport } from "./spatialAnalysis";

describe("spatial fallback report", () => {
  it("returns a structured fallback report for timeout or unavailable model responses", () => {
    const report = buildFallbackSpatialReport("Assess exterior structure and likely load points.", 2);

    expect(report).toContain("## Structural Type");
    expect(report).toContain("## Spatial Zones & Load Points");
    expect(report).toContain("## Building Safety Index");
    expect(report).toContain("Safety Index");
    expect(report).toContain("2 reference image");
  });
});
