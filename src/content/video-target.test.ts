import { describe, expect, test } from "vitest";

import {
  detectXVideoMediaType,
  getDirectXMp4Url,
  getXVideoMediaId,
  parseXVideoVariants,
  resolveXVideoCandidate,
  selectBestXVideoVariant,
} from "./video-target";

const lowBitrateUrl =
  "https://video.twimg.com/ext_tw_video/1730942564943982592/pu/vid/avc1/320x690/low.mp4?tag=12";
const highBitrateUrl =
  "https://video.twimg.com/ext_tw_video/1730942564943982592/pu/vid/avc1/592x1280/high.mp4?tag=12";
const otherMediaUrl =
  "https://video.twimg.com/ext_tw_video/9999999999999999999/pu/vid/avc1/592x1280/other.mp4?tag=12";

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

describe("parseXVideoVariants", () => {
  test("extracts direct MP4 variants from X page state text", () => {
    expect(
      parseXVideoVariants(
        `{bitrate:632000,content_type:"video/mp4",url:"${lowBitrateUrl}"},` +
          `{bitrate:2176000,content_type:"video/mp4",url:"${highBitrateUrl}"}`,
      ),
    ).toEqual([
      { url: lowBitrateUrl, bitrate: 632000 },
      { url: highBitrateUrl, bitrate: 2176000 },
    ]);
  });

  test("extracts variants from JSON-shaped text with quoted keys and whitespace", () => {
    expect(
      parseXVideoVariants(
        `{"url": "${highBitrateUrl}", "content_type": "video/mp4", "bitrate": 2176000}`,
      ),
    ).toEqual([{ url: highBitrateUrl, bitrate: 2176000 }]);
  });

  test("extracts direct MP4 variants without bitrate", () => {
    expect(
      parseXVideoVariants(
        `{"content_type":"video/mp4","url":"https://video.twimg.com/tweet_video/example_id.mp4"}`,
      ),
    ).toEqual([{ url: "https://video.twimg.com/tweet_video/example_id.mp4" }]);
  });

  test("extracts variants when X escapes URL slashes", () => {
    expect(
      parseXVideoVariants(
        `{bitrate:2176000,content_type:"video/mp4",url:"${highBitrateUrl.replaceAll("/", "\\/")}"}`,
      ),
    ).toEqual([{ url: highBitrateUrl, bitrate: 2176000 }]);
  });
});

describe("selectBestXVideoVariant", () => {
  test("selects the highest bitrate direct MP4", () => {
    expect(
      selectBestXVideoVariant([
        { url: lowBitrateUrl, bitrate: 632000 },
        { url: highBitrateUrl, bitrate: 2176000 },
      ]),
    ).toEqual({ url: highBitrateUrl, bitrate: 2176000 });
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

describe("resolveXVideoCandidate", () => {
  test("uses a direct MP4 video source when present", () => {
    expect(resolveXVideoCandidate({ videoSrc: highBitrateUrl })).toEqual({
      videoUrl: highBitrateUrl,
      mediaType: "video",
    });
  });

  test("uses the highest bitrate MP4 matching the video media id", () => {
    expect(
      resolveXVideoCandidate({
        videoSrc:
          "https://video.twimg.com/ext_tw_video/1730942564943982592/pu/pl/video.m3u8?tag=12",
        posterUrl: "https://pbs.twimg.com/ext_tw_video_thumb/1730942564943982592/pu/img/thumb.jpg",
        sourceText:
          `{bitrate:632000,content_type:"video/mp4",url:"${lowBitrateUrl}"},` +
          `{bitrate:2176000,content_type:"video/mp4",url:"${highBitrateUrl}"},` +
          `{bitrate:3000000,content_type:"video/mp4",url:"${otherMediaUrl}"}`,
      }),
    ).toEqual({
      videoUrl: highBitrateUrl,
      mediaType: "video",
      bitrate: 2176000,
    });
  });
});
