import { describe, expect, test } from "vitest";

import { getVideoKey, getVideoMetadata } from "./video-url";

describe("getVideoMetadata", () => {
  test("builds filename metadata for MP4-backed X videos", () => {
    expect(
      getVideoMetadata({
        videoUrl:
          "https://video.twimg.com/ext_tw_video/1730942564943982592/pu/vid/avc1/592x1280/high.mp4?tag=12",
        pageUrl: "https://x.com/example/status/1730942564943982592",
        mediaType: "video",
        author: "example",
        tweetId: "1730942564943982592",
      }),
    ).toEqual({
      author: "example",
      tweetId: "1730942564943982592",
      originalName: "high",
      ext: "mp4",
    });
  });

  test("uses MP4 extension for GIF-style media", () => {
    expect(
      getVideoMetadata({
        videoUrl: "https://video.twimg.com/tweet_video/example_id.mp4",
        pageUrl: "https://x.com/example/status/1730942564943982592",
        mediaType: "gif",
      }).ext,
    ).toBe("mp4");
  });
});

describe("getVideoKey", () => {
  test("removes query and hash from video URLs", () => {
    expect(getVideoKey("https://video.twimg.com/tweet_video/example_id.mp4?tag=12#media")).toBe(
      "https://video.twimg.com/tweet_video/example_id.mp4",
    );
  });
});
