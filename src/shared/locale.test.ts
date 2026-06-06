import { describe, expect, test } from "vitest";

import { normalizeLanguageSetting, resolveLocale } from "./locale";

describe("resolveLocale", () => {
  test("resolves auto to Japanese for Japanese browser languages", () => {
    expect(resolveLocale("auto", "ja-JP")).toBe("ja");
    expect(resolveLocale("auto", "JA")).toBe("ja");
  });

  test("resolves auto to English for non-Japanese browser languages", () => {
    expect(resolveLocale("auto", "en-US")).toBe("en");
    expect(resolveLocale("auto", undefined)).toBe("en");
  });

  test("uses explicit settings before browser language", () => {
    expect(resolveLocale("ja", "en-US")).toBe("ja");
    expect(resolveLocale("en", "ja-JP")).toBe("en");
  });
});

describe("normalizeLanguageSetting", () => {
  test("keeps supported language settings", () => {
    expect(normalizeLanguageSetting("auto")).toBe("auto");
    expect(normalizeLanguageSetting("ja")).toBe("ja");
    expect(normalizeLanguageSetting("en")).toBe("en");
  });

  test("falls back to auto for unknown values", () => {
    expect(normalizeLanguageSetting("fr")).toBe("auto");
    expect(normalizeLanguageSetting(undefined)).toBe("auto");
  });
});
