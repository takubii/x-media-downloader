import { describe, expect, test, vi } from "vitest";

import { findBestVideoCandidate, parseXVideoApiConfig, resolveXVideoFromApi } from "./x-video-api";

const lowBitrateUrl =
  "https://video.twimg.com/amplify_video/2072046031202562048/vid/avc1/486x270/low.mp4?tag=28";
const highBitrateUrl =
  "https://video.twimg.com/amplify_video/2072046031202562048/vid/avc1/1022x566/high.mp4?tag=28";
const otherMediaUrl =
  "https://video.twimg.com/amplify_video/9999999999999999999/vid/avc1/1022x566/other.mp4?tag=28";

describe("parseXVideoApiConfig", () => {
  test("extracts the public bearer token and TweetResultByRestId metadata", () => {
    expect(
      parseXVideoApiConfig(
        'authorization:"Bearer AAAAAAAAAAAAAAAAAAAAAA",e.exports={queryId:"abc123",' +
          'operationName:"TweetResultByRestId",operationType:"query",' +
          'metadata:{featureSwitches:["feature_a","feature_b"],fieldToggles:["field_a"]}}',
      ),
    ).toEqual({
      bearerToken: "Bearer AAAAAAAAAAAAAAAAAAAAAA",
      queryId: "abc123",
      featureNames: ["feature_a", "feature_b"],
      fieldToggleNames: ["field_a"],
    });
  });
});

describe("findBestVideoCandidate", () => {
  test("selects the highest bitrate MP4 variant matching the requested media id", () => {
    expect(
      findBestVideoCandidate(
        {
          data: {
            tweetResult: {
              result: {
                legacy: {
                  entities: {
                    media: [
                      createMedia({
                        id: "9999999999999999999",
                        type: "video",
                        variants: [
                          { bitrate: 2176000, content_type: "video/mp4", url: otherMediaUrl },
                        ],
                      }),
                      createMedia({
                        id: "2072046031202562048",
                        type: "video",
                        variants: [
                          {
                            bitrate: undefined,
                            content_type: "application/x-mpegURL",
                            url: "https://video.twimg.com/amplify_video/2072046031202562048/pl/video.m3u8",
                          },
                          { bitrate: 256000, content_type: "video/mp4", url: lowBitrateUrl },
                          { bitrate: 2176000, content_type: "video/mp4", url: highBitrateUrl },
                        ],
                      }),
                    ],
                  },
                },
              },
            },
          },
        },
        "2072046031202562048",
      ),
    ).toEqual({
      videoUrl: highBitrateUrl,
      mediaType: "video",
      bitrate: 2176000,
    });
  });
});

describe("resolveXVideoFromApi", () => {
  test("fetches the current X GraphQL metadata and resolves a matching video", async () => {
    const requestHeaders: Array<{ url: string; headers: HeadersInit | undefined }> = [];
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      requestHeaders.push({ url, headers: init?.headers });

      if (url === "https://abs.twimg.com/responsive-web/client-web/main.123.js") {
        return new Response(
          'authorization:"Bearer AAAAAAAAAAAAAAAAAAAAAA",e.exports={queryId:"abc123",' +
            'operationName:"TweetResultByRestId",operationType:"query",' +
            'metadata:{featureSwitches:["feature_a"],fieldToggles:["field_a"]}}',
        );
      }

      if (url === "https://api.x.com/1.1/guest/activate.json") {
        return Response.json({ guest_token: "guest-token" });
      }

      if (url.startsWith("https://x.com/i/api/graphql/abc123/TweetResultByRestId?")) {
        return Response.json({
          data: {
            tweetResult: {
              result: {
                legacy: {
                  entities: {
                    media: [
                      createMedia({
                        id: "2072046031202562048",
                        type: "video",
                        variants: [
                          { bitrate: 256000, content_type: "video/mp4", url: lowBitrateUrl },
                          { bitrate: 2176000, content_type: "video/mp4", url: highBitrateUrl },
                        ],
                      }),
                    ],
                  },
                },
              },
            },
          },
        });
      }

      return new Response("", { status: 404 });
    });

    await expect(
      resolveXVideoFromApi(
        {
          tweetId: "2072068448268775859",
          mediaId: "2072046031202562048",
          pageUrl: "https://x.com/camisa8BRASIL/status/2072068448268775859",
          mainBundleUrls: ["https://abs.twimg.com/responsive-web/client-web/main.123.js"],
        },
        fetchMock,
      ),
    ).resolves.toEqual({
      ok: true,
      candidate: {
        videoUrl: highBitrateUrl,
        mediaType: "video",
        bitrate: 2176000,
      },
    });

    expect(requestHeaders).toEqual(
      expect.arrayContaining([
        {
          url: "https://api.x.com/1.1/guest/activate.json",
          headers: expect.objectContaining({
            authorization: "Bearer AAAAAAAAAAAAAAAAAAAAAA",
          }),
        },
        {
          url: expect.stringMatching(
            /^https:\/\/x\.com\/i\/api\/graphql\/abc123\/TweetResultByRestId\?/,
          ),
          headers: expect.objectContaining({
            authorization: "Bearer AAAAAAAAAAAAAAAAAAAAAA",
            "x-guest-token": "guest-token",
          }),
        },
      ]),
    );
  });
});

function createMedia(input: {
  id: string;
  type: "video" | "animated_gif";
  variants: Array<{
    content_type: string;
    url: string;
    bitrate?: number;
  }>;
}): unknown {
  return {
    id_str: input.id,
    media_key: `13_${input.id}`,
    type: input.type,
    media_url_https: `https://pbs.twimg.com/amplify_video_thumb/${input.id}/img/thumb.jpg`,
    video_info: {
      variants: input.variants,
    },
  };
}
