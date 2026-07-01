import { describe, expect, test } from "vitest";

import { extractXVideoCandidatesFromApiJson } from "./x-video-page-parser";

const lowBitrateUrl =
  "https://video.twimg.com/amplify_video/2072046031202562048/vid/avc1/486x270/low.mp4?tag=28";
const highBitrateUrl =
  "https://video.twimg.com/amplify_video/2072046031202562048/vid/avc1/1022x566/high.mp4?tag=28";
const otherMediaUrl =
  "https://video.twimg.com/amplify_video/9999999999999999999/vid/avc1/1022x566/other.mp4?tag=28";

describe("extractXVideoCandidatesFromApiJson", () => {
  test("extracts the best MP4 variant from a GraphQL tweet response", () => {
    expect(
      extractXVideoCandidatesFromApiJson({
        data: {
          tweetResult: {
            result: {
              rest_id: "2072068448268775859",
              legacy: {
                id_str: "2072068448268775859",
                full_text: "video tweet",
                entities: {
                  media: [
                    createMedia({
                      id: "2072046031202562048",
                      type: "video",
                      variants: [
                        {
                          content_type: "application/x-mpegURL",
                          url: "https://video.twimg.com/amplify_video/2072046031202562048/pl/video.m3u8",
                        },
                        { bitrate: 256000, content_type: "video/mp4", url: lowBitrateUrl },
                        { bitrate: 2176000, content_type: "video/mp4", url: highBitrateUrl },
                      ],
                    }),
                    createMedia({
                      id: "9999999999999999999",
                      type: "video",
                      variants: [
                        { bitrate: 832000, content_type: "video/mp4", url: otherMediaUrl },
                      ],
                    }),
                  ],
                },
              },
            },
          },
        },
      }),
    ).toEqual([
      {
        tweetId: "2072068448268775859",
        mediaId: "2072046031202562048",
        videoUrl: highBitrateUrl,
        mediaType: "video",
        bitrate: 2176000,
      },
      {
        tweetId: "2072068448268775859",
        mediaId: "9999999999999999999",
        videoUrl: otherMediaUrl,
        mediaType: "video",
        bitrate: 832000,
      },
    ]);
  });

  test("detects animated GIF media from X API type", () => {
    expect(
      extractXVideoCandidatesFromApiJson({
        legacy: {
          id_str: "2072068448268775860",
          entities: {
            media: [
              createMedia({
                id: "gif_id",
                type: "animated_gif",
                variants: [
                  {
                    content_type: "video/mp4",
                    url: "https://video.twimg.com/tweet_video/gif_id.mp4",
                  },
                ],
              }),
            ],
          },
        },
      }),
    ).toEqual([
      {
        tweetId: "2072068448268775860",
        mediaId: "gif_id",
        videoUrl: "https://video.twimg.com/tweet_video/gif_id.mp4",
        mediaType: "gif",
      },
    ]);
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
