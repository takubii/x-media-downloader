import type { ImageMetadata } from "./filename";
import type { SaveImagePayload } from "./messages";

export function toOriginalImageUrl(imageUrl: string): string {
  const url = new URL(imageUrl);

  if (url.hostname !== "pbs.twimg.com") {
    return imageUrl;
  }

  url.searchParams.set("name", "orig");
  return url.toString();
}

export function getImageMetadata(payload: SaveImagePayload): ImageMetadata {
  const url = new URL(payload.imageUrl);
  const originalName = getOriginalName(url);
  const ext = getImageExtension(url);

  return {
    author: payload.author || "unknown",
    tweetId: payload.tweetId || "unknown",
    originalName,
    ext,
  };
}

export function getImageKey(imageUrl: string): string {
  const url = new URL(imageUrl);
  url.searchParams.delete("name");
  return url.toString();
}

function getOriginalName(url: URL): string {
  const pathName = url.pathname.split("/").filter(Boolean).at(-1);
  return pathName || "image";
}

function getImageExtension(url: URL): string {
  const format = url.searchParams.get("format");
  if (format) return format;

  const lastPathPart = url.pathname.split("/").at(-1) || "";
  const extension = lastPathPart.match(/\.([a-zA-Z0-9]+)$/)?.[1];
  return extension || "jpg";
}

