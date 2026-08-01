import { describe, expect, it } from "vitest";
import { resolveRequestTimeoutMs } from "./ollamaApi";

describe("resolveRequestTimeoutMs", () => {
  it("uses a generous default when no timeout is provided", () => {
    expect(resolveRequestTimeoutMs()).toBe(300_000);
  });

  it("prefers an explicit timeout override", () => {
    expect(resolveRequestTimeoutMs(45_000)).toBe(45_000);
  });

  it("uses the configured environment override when present", () => {
    expect(resolveRequestTimeoutMs(undefined, 180_000)).toBe(180_000);
  });
});
