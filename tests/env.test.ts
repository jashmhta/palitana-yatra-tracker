import { describe, expect, it } from "vitest";

describe("Environment Configuration", () => {
  it("should have NODE_ENV set", () => {
    expect(process.env.NODE_ENV).toBeDefined();
    expect(typeof process.env.NODE_ENV).toBe("string");
  });

  it("should have valid NODE_ENV value", () => {
    const validValues = ["development", "production", "test"];
    expect(validValues).toContain(process.env.NODE_ENV);
  });
});
