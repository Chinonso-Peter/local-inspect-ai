import { describe, expect, it } from "vitest";
import {
  ARCHITECT_PRESETS,
  buildArchitecturalRequestPrompt,
  buildFallbackArchitecturalCode,
  getArchitectPresetPrompt,
  normalizeArchitectJavaScript,
} from "./architectEngine";

describe("architect engine fallback", () => {
  it("returns a deterministic fallback script when model output is unavailable", () => {
    const fallback = buildFallbackArchitecturalCode("Generate a contemporary civic building");

    expect(fallback).toContain("const group = new THREE.Group();");
    expect(fallback).toContain("return group;");
    expect(fallback).toContain("createBalcony(");
    expect(fallback).toContain("new THREE.BoxGeometry(4.8, 0.28, 2.4)");
  });

  it("adapts the massing for a residential prompt", () => {
    const fallback = buildFallbackArchitecturalCode("Create a cozy suburban house with a pitched roof, porch, and dormer windows");

    expect(fallback).toContain("createWindow(");
    expect(fallback).toContain("new THREE.ConeGeometry(1.65, 1.12, 4)");
    expect(fallback).toContain("new THREE.BoxGeometry(1.05, 1.55, 0.32)");
    expect(fallback).toContain("createBalcony(");
  });

  it("returns a richer default fallback for a detailed architectural prompt", () => {
    const fallback = buildFallbackArchitecturalCode("Generate a detailed contemporary house with layered facade volumes, glazed entry, and a modern roof.");

    expect(fallback).toContain("createWindow(");
    expect(fallback).toContain("function createWindow(");
    expect(fallback).toContain("return group;");
    expect(fallback).toContain("new THREE.MeshStandardMaterial({ color: 0x");
    expect(fallback).toContain("createBalcony(");
    expect(fallback).toContain("new THREE.BoxGeometry(5.2, 0.3, 3.1)");
  });

  it("adapts the massing for a tower prompt", () => {
    const fallback = buildFallbackArchitecturalCode("Design a soaring glass office tower with a crown and setbacks");

    expect(fallback).toContain("new THREE.CylinderGeometry(1.15, 1.45, 0.8, 24)");
    expect(fallback).toContain("function addSetback");
  });

  it("preserves direct JavaScript snippets without wrapping them", () => {
    const normalized = normalizeArchitectJavaScript("const group = new THREE.Group();\nreturn group;");

    expect(normalized).toContain("const group = new THREE.Group();");
    expect(normalized).toContain("return group;");
  });

  it("injects architectural quality guidance into the model prompt", () => {
    const prompt = buildArchitecturalRequestPrompt("A small modern house");

    expect(prompt).toContain("A small modern house");
    expect(prompt).toContain("layered massing");
    expect(prompt).toContain("clear front entry");
    expect(prompt).toContain("concept massing study");
  });

  it("applies structured roof, floor, and material guidance", () => {
    const prompt = buildArchitecturalRequestPrompt("A compact family house", {
      presetId: "contemporary_house",
      roofType: "gable",
      floors: 3,
      materialStyle: "wood",
      realisticHouseFocus: true,
    });

    expect(prompt).toContain("Use a realistic gable roof");
    expect(prompt).toContain("Target 3 floors");
    expect(prompt).toContain("Prioritize warm wood accents");
    expect(prompt).toContain("realistic house-like result");
  });

  it("exposes seven detailed building presets", () => {
    expect(ARCHITECT_PRESETS).toHaveLength(7);
    expect(getArchitectPresetPrompt("contemporary_house")).toContain("two-story house");
    expect(getArchitectPresetPrompt("office_tower")).toContain("office tower");
    expect(getArchitectPresetPrompt("sanctuary")).toContain("sanctuary or chapel");
  });
});
