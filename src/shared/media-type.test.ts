import { describe, expect, test } from "vitest";

import { DEFAULT_MEDIA_TYPE, normalizeMediaType } from "./media-type";

describe("normalizeMediaType", () => {
  test("uses image as the default media type", () => {
    expect(DEFAULT_MEDIA_TYPE).toBe("image");
    expect(normalizeMediaType(undefined)).toBe("image");
    expect(normalizeMediaType("unknown")).toBe("image");
  });

  test("keeps supported media types", () => {
    expect(normalizeMediaType("image")).toBe("image");
    expect(normalizeMediaType("video")).toBe("video");
    expect(normalizeMediaType("gif")).toBe("gif");
  });
});
