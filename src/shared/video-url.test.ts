import { describe, expect, test } from "vitest";

import {
  getVideoKey,
  getVideoMetadata,
  isValidSaveVideoPayload,
  isXVideoMp4Url,
} from "./video-url";

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

  test("uses GIF extension for GIF-style media", () => {
    expect(
      getVideoMetadata({
        videoUrl: "https://video.twimg.com/tweet_video/example_id.mp4",
        pageUrl: "https://x.com/example/status/1730942564943982592",
        mediaType: "gif",
      }).ext,
    ).toBe("gif");
  });
});

describe("getVideoKey", () => {
  test("removes query and hash from video URLs", () => {
    expect(getVideoKey("https://video.twimg.com/tweet_video/example_id.mp4?tag=12#media")).toBe(
      "https://video.twimg.com/tweet_video/example_id.mp4",
    );
  });
});

describe("isXVideoMp4Url", () => {
  test("accepts HTTPS MP4 URLs on video.twimg.com", () => {
    expect(isXVideoMp4Url("https://video.twimg.com/tweet_video/example_id.mp4?tag=12")).toBe(true);
  });

  test("rejects non-MP4, non-HTTPS, and non-X video hosts", () => {
    expect(isXVideoMp4Url("https://video.twimg.com/tweet_video/example_id.m3u8")).toBe(false);
    expect(isXVideoMp4Url("http://video.twimg.com/tweet_video/example_id.mp4")).toBe(false);
    expect(isXVideoMp4Url("https://example.com/video.mp4")).toBe(false);
  });
});

describe("isValidSaveVideoPayload", () => {
  test("accepts video and GIF payloads backed by X MP4 URLs", () => {
    expect(
      isValidSaveVideoPayload({
        videoUrl: "https://video.twimg.com/tweet_video/example_id.mp4?tag=12",
        pageUrl: "https://x.com/example/status/1730942564943982592",
        mediaType: "gif",
      }),
    ).toBe(true);
  });

  test("rejects unsupported media URLs", () => {
    expect(
      isValidSaveVideoPayload({
        videoUrl: "https://example.com/video.mp4",
        pageUrl: "https://x.com/example/status/1730942564943982592",
        mediaType: "video",
      }),
    ).toBe(false);
  });
});
