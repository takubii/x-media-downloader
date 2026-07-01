import { describe, expect, test } from "vitest";

import {
  detectXVideoMediaType,
  getDirectXMp4Url,
  getXVideoKey,
  getXVideoMediaId,
  resolveXVideoCandidate,
} from "./video-target";

const highBitrateUrl =
  "https://video.twimg.com/ext_tw_video/1730942564943982592/pu/vid/avc1/592x1280/high.mp4?tag=12";

describe("getDirectXMp4Url", () => {
  test("accepts direct video.twimg.com MP4 URLs", () => {
    expect(getDirectXMp4Url(highBitrateUrl)).toBe(highBitrateUrl);
  });

  test("rejects HLS playlist URLs", () => {
    expect(
      getDirectXMp4Url(
        "https://video.twimg.com/ext_tw_video/1730942564943982592/pu/pl/video.m3u8?tag=12",
      ),
    ).toBeNull();
  });

  test("rejects non-X video hosts", () => {
    expect(getDirectXMp4Url("https://example.com/video.mp4")).toBeNull();
  });
});

describe("getXVideoMediaId", () => {
  test("extracts media ids from video, poster, and tweet video URLs", () => {
    expect(getXVideoMediaId(highBitrateUrl)).toBe("1730942564943982592");
    expect(
      getXVideoMediaId(
        "https://pbs.twimg.com/ext_tw_video_thumb/1730942564943982592/pu/img/thumb.jpg",
      ),
    ).toBe("1730942564943982592");
    expect(
      getXVideoMediaId(
        "https://pbs.twimg.com/amplify_video_thumb/1730942564943982592/img/thumb.jpg",
      ),
    ).toBe("1730942564943982592");
    expect(getXVideoMediaId("https://video.twimg.com/tweet_video/example_id.mp4")).toBe(
      "example_id",
    );
  });
});

describe("detectXVideoMediaType", () => {
  test("prefers X API media type when available", () => {
    expect(detectXVideoMediaType({ apiMediaType: "animated_gif", videoUrl: highBitrateUrl })).toBe(
      "gif",
    );
    expect(detectXVideoMediaType({ apiMediaType: "video", videoUrl: highBitrateUrl })).toBe(
      "video",
    );
  });

  test("falls back to tweet_video URL detection for GIF-style media", () => {
    expect(
      detectXVideoMediaType({
        videoUrl: "https://video.twimg.com/tweet_video/example_id.mp4",
      }),
    ).toBe("gif");
  });
});

describe("getXVideoKey", () => {
  test("removes query and hash from video URLs", () => {
    expect(getXVideoKey(`${highBitrateUrl}#fragment`)).toBe(
      "https://video.twimg.com/ext_tw_video/1730942564943982592/pu/vid/avc1/592x1280/high.mp4",
    );
  });
});

describe("resolveXVideoCandidate", () => {
  test("uses a direct MP4 video source when present", () => {
    expect(resolveXVideoCandidate({ videoSrc: highBitrateUrl })).toEqual({
      videoUrl: highBitrateUrl,
      mediaType: "video",
    });
  });

  test("returns null for non-direct video sources", () => {
    expect(
      resolveXVideoCandidate({
        videoSrc:
          "https://video.twimg.com/ext_tw_video/1730942564943982592/pu/pl/video.m3u8?tag=12",
      }),
    ).toBeNull();
  });
});
