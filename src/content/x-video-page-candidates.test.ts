import { describe, expect, test } from "vitest";

import {
  createXVideoPageCandidateStore,
  parseXVideoPageCandidateMessage,
} from "./x-video-page-candidates";

const videoUrl =
  "https://video.twimg.com/amplify_video/2072046031202562048/vid/avc1/1022x566/high.mp4?tag=28";
const posterUrl = "https://pbs.twimg.com/amplify_video_thumb/2072046031202562048/img/thumb.jpg";

describe("parseXVideoPageCandidateMessage", () => {
  test("normalizes valid page messages", () => {
    expect(
      parseXVideoPageCandidateMessage({
        source: "x-image-downloader-page",
        type: "X_VIDEO_API_CANDIDATES",
        delivery: "live",
        requestPath: "x.com/i/api/graphql/HomeTimeline",
        candidates: [
          {
            tweetId: "2072068448268775859",
            mediaId: "2072046031202562048",
            videoUrl,
            mediaType: "video",
            bitrate: 2176000,
          },
        ],
      }),
    ).toEqual({
      delivery: "live",
      requestPath: "x.com/i/api/graphql/HomeTimeline",
      candidates: [
        {
          tweetId: "2072068448268775859",
          mediaId: "2072046031202562048",
          videoUrl,
          mediaType: "video",
          bitrate: 2176000,
        },
      ],
    });
  });

  test("rejects malformed or forged page messages", () => {
    expect(parseXVideoPageCandidateMessage({})).toBeNull();
    expect(
      parseXVideoPageCandidateMessage({
        source: "x-image-downloader-page",
        type: "X_VIDEO_API_CANDIDATES",
        delivery: "live",
        candidates: [
          {
            mediaId: "2072046031202562048",
            videoUrl: "https://example.com/video.mp4",
            mediaType: "video",
          },
        ],
      }),
    ).toBeNull();
  });
});

describe("createXVideoPageCandidateStore", () => {
  test("resolves candidates by tweet and media id", () => {
    const store = createXVideoPageCandidateStore();
    const video = { poster: posterUrl } as HTMLVideoElement;

    store.cache([
      {
        tweetId: "2072068448268775859",
        mediaId: "2072046031202562048",
        videoUrl,
        mediaType: "video",
      },
    ]);

    expect(store.find(video, { tweetId: "2072068448268775859" })).toEqual({
      tweetId: "2072068448268775859",
      mediaId: "2072046031202562048",
      videoUrl,
      mediaType: "video",
    });
  });

  test("emits a missing-candidate log once per media key", () => {
    const store = createXVideoPageCandidateStore({
      getPageUrl: () => "https://x.com/home",
    });
    const video = { poster: posterUrl } as HTMLVideoElement;

    expect(store.markMissing(video, { tweetId: "2072068448268775859" })).toEqual({
      tweetId: "2072068448268775859",
      mediaId: "2072046031202562048",
      pageUrl: "https://x.com/home",
    });
    expect(store.markMissing(video, { tweetId: "2072068448268775859" })).toBeNull();
  });
});
