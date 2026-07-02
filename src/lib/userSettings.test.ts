import { describe, it, expect, beforeEach } from "vitest";
import { getUserSettings, saveUserSettings, defaultSettings } from "./userSettings";

describe("userSettings", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns defaults when nothing is stored", () => {
    expect(getUserSettings()).toEqual(defaultSettings);
  });

  it("returns stored settings merged over defaults", () => {
    localStorage.setItem("genuinecro_settings", JSON.stringify({ defaultDevice: "both" }));
    expect(getUserSettings()).toEqual({ ...defaultSettings, defaultDevice: "both" });
  });

  it("returns defaults when storage is malformed", () => {
    localStorage.setItem("genuinecro_settings", "not json");
    expect(getUserSettings()).toEqual(defaultSettings);
  });

  it("persists settings to localStorage", () => {
    const custom = { ...defaultSettings, weeklyDigest: true };
    saveUserSettings(custom);
    expect(JSON.parse(localStorage.getItem("genuinecro_settings")!)).toEqual(custom);
  });
});
