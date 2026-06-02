import { describe, expect, test } from "vitest";

import { buildFilenameBase, sanitizeExtension, sanitizeFilename, withExtension } from "./filename";

describe("buildFilenameBase", () => {
  test("replaces supported template variables with sanitized values", () => {
    const filename = buildFilenameBase(
      "{author}_{tweetId}_{date}_{time}_{originalName}",
      {
        author: "alice/bob",
        tweetId: "12345",
        originalName: "photo:one",
        ext: "jpg",
      },
      new Date("2026-06-02T03:04:05"),
    );

    expect(filename).toBe("alice_bob_12345_20260602_030405_photo_one");
  });

  test("falls back when the sanitized template is empty", () => {
    const filename = buildFilenameBase(
      " ... ",
      {
        author: "alice",
        tweetId: "12345",
        originalName: "photo",
        ext: "jpg",
      },
      new Date("2026-06-02T03:04:05"),
    );

    expect(filename).toBe("x_image");
  });
});

describe("sanitizeFilename", () => {
  test("removes invalid filename characters and trailing spaces or dots", () => {
    expect(sanitizeFilename(' bad<name>:"/\\|?*.jpg. ')).toBe("bad_name________.jpg");
  });
});

describe("withExtension", () => {
  test("normalizes the extension when joining it to the base filename", () => {
    expect(withExtension("photo", "JPEG")).toBe("photo.jpg");
  });
});

describe("sanitizeExtension", () => {
  test("keeps only alphanumeric extension characters", () => {
    expect(sanitizeExtension("jp*g")).toBe("jpg");
  });
});
