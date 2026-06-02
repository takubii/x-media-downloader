import { describe, expect, test } from "vitest";

import { getImageKey, getImageMetadata, toOriginalImageUrl } from "./image-url";

describe("toOriginalImageUrl", () => {
  test("requests original quality for X media images", () => {
    const url = toOriginalImageUrl("https://pbs.twimg.com/media/example?format=jpg&name=small");

    expect(url).toBe("https://pbs.twimg.com/media/example?format=jpg&name=orig");
  });

  test("leaves non-X media URLs unchanged", () => {
    const url = "https://example.com/image.jpg";

    expect(toOriginalImageUrl(url)).toBe(url);
  });
});

describe("getImageMetadata", () => {
  test("extracts filename metadata from the image payload", () => {
    const metadata = getImageMetadata({
      imageUrl: "https://pbs.twimg.com/media/example?format=png&name=small",
      pageUrl: "https://x.com/alice/status/12345",
      author: "alice",
      tweetId: "12345",
    });

    expect(metadata).toEqual({
      author: "alice",
      tweetId: "12345",
      originalName: "example",
      ext: "png",
    });
  });

  test("uses stable fallback metadata when author and tweet ID are missing", () => {
    const metadata = getImageMetadata({
      imageUrl: "https://pbs.twimg.com/media/example.jpg",
      pageUrl: "https://x.com/home",
    });

    expect(metadata).toEqual({
      author: "unknown",
      tweetId: "unknown",
      originalName: "example.jpg",
      ext: "jpg",
    });
  });
});

describe("getImageKey", () => {
  test("normalizes image variants to the same key", () => {
    expect(getImageKey("https://pbs.twimg.com/media/example?format=jpg&name=small")).toBe(
      "https://pbs.twimg.com/media/example?format=jpg",
    );
  });
});
