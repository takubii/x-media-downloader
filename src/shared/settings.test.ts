import { describe, expect, test } from "vitest";

import { normalizeSettings } from "./settings";

describe("normalizeSettings", () => {
  test("uses auto as the default language setting", () => {
    expect(normalizeSettings({}).language).toBe("auto");
  });

  test("keeps supported language settings", () => {
    expect(normalizeSettings({ language: "ja" }).language).toBe("ja");
    expect(normalizeSettings({ language: "en" }).language).toBe("en");
  });

  test("falls back to auto for unknown language settings", () => {
    expect(normalizeSettings({ language: "fr" }).language).toBe("auto");
  });
});
