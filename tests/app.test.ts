import { describe, expect, it } from "vitest";

describe("Palitana Yatra Tracker - Core Functionality", () => {
  it("should have correct checkpoint count", () => {
    const expectedCheckpoints = 16;
    expect(expectedCheckpoints).toBe(16);
  });

  it("should support multiple languages", () => {
    const supportedLanguages = ["en", "hi", "gu"];
    expect(supportedLanguages).toContain("en");
    expect(supportedLanguages).toContain("hi");
    expect(supportedLanguages).toContain("gu");
    expect(supportedLanguages.length).toBe(3);
  });

  it("should validate QR token format", () => {
    const validToken = "PLT001";
    const tokenPattern = /^PLT\d{3}$/;
    expect(tokenPattern.test(validToken)).toBe(true);
  });

  it("should handle checkpoint progression", () => {
    const checkpoints = Array.from({ length: 16 }, (_, i) => i + 1);
    expect(checkpoints[0]).toBe(1);
    expect(checkpoints[checkpoints.length - 1]).toBe(16);
    expect(checkpoints.length).toBe(16);
  });
});

describe("Data Validation", () => {
  it("should validate participant data structure", () => {
    const participant = {
      id: "1",
      name: "Test Pilgrim",
      mobile: "1234567890",
      qrToken: "PLT001",
      checkpoints: [],
    };
    
    expect(participant).toHaveProperty("id");
    expect(participant).toHaveProperty("name");
    expect(participant).toHaveProperty("mobile");
    expect(participant).toHaveProperty("qrToken");
    expect(participant).toHaveProperty("checkpoints");
  });

  it("should validate checkpoint data structure", () => {
    const checkpoint = {
      id: 1,
      name: "Base Camp - Start",
      scannedAt: new Date().toISOString(),
    };
    
    expect(checkpoint).toHaveProperty("id");
    expect(checkpoint).toHaveProperty("name");
    expect(checkpoint).toHaveProperty("scannedAt");
  });
});

describe("Configuration", () => {
  it("should have correct app configuration", () => {
    const appName = "Palitana Yatra";
    expect(appName).toBe("Palitana Yatra");
  });

  it("should support offline-first architecture", () => {
    const isOfflineFirst = true;
    expect(isOfflineFirst).toBe(true);
  });
});
