import type { ImageMetadata } from "./filename";
import type { SaveVideoPayload } from "./messages";

export function getVideoMetadata(payload: SaveVideoPayload): ImageMetadata {
  const url = new URL(payload.videoUrl);

  return {
    author: payload.author || "unknown",
    tweetId: payload.tweetId || "unknown",
    originalName: getOriginalName(url),
    ext: "mp4",
  };
}

export function getVideoKey(videoUrl: string): string {
  const url = new URL(videoUrl);
  url.search = "";
  url.hash = "";
  return url.toString();
}

function getOriginalName(url: URL): string {
  const pathName = url.pathname.split("/").filter(Boolean).at(-1) || "video";
  return pathName.replace(/\.[a-zA-Z0-9]+$/, "") || "video";
}
