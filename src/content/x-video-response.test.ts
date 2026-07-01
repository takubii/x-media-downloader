import { describe, expect, test } from "vitest";

import { normalizeXVideoPageCandidate } from "./x-video-response";

const highBitrateUrl =
  "https://video.twimg.com/amplify_video/2072046031202562048/vid/avc1/1022x566/high.mp4?tag=28";

describe("normalizeXVideoPageCandidate", () => {
  test("accepts sanitized X MP4 candidates", () => {
    expect(
      normalizeXVideoPageCandidate({
        tweetId: "2072068448268775859",
        mediaId: "2072046031202562048",
        videoUrl: highBitrateUrl,
        mediaType: "video",
        bitrate: 2176000,
      }),
    ).toEqual({
      tweetId: "2072068448268775859",
      mediaId: "2072046031202562048",
      videoUrl: highBitrateUrl,
      mediaType: "video",
      bitrate: 2176000,
    });
  });

  test("rejects forged candidates from non-X hosts", () => {
    expect(
      normalizeXVideoPageCandidate({
        tweetId: "2072068448268775859",
        mediaId: "2072046031202562048",
        videoUrl: "https://example.com/video.mp4",
        mediaType: "video",
      }),
    ).toBeNull();
  });

  test("rejects candidates whose URL media id does not match the payload media id", () => {
    expect(
      normalizeXVideoPageCandidate({
        tweetId: "2072068448268775859",
        mediaId: "9999999999999999999",
        videoUrl: highBitrateUrl,
        mediaType: "video",
      }),
    ).toBeNull();
  });

  test("rejects invalid media type and tweet id values", () => {
    expect(
      normalizeXVideoPageCandidate({
        tweetId: "not-a-tweet-id",
        mediaId: "2072046031202562048",
        videoUrl: highBitrateUrl,
        mediaType: "video",
      }),
    ).toBeNull();
    expect(
      normalizeXVideoPageCandidate({
        mediaId: "2072046031202562048",
        videoUrl: highBitrateUrl,
        mediaType: "image",
      }),
    ).toBeNull();
  });
});
