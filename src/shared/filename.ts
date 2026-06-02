export type ImageMetadata = {
  author: string;
  tweetId: string;
  originalName: string;
  ext: string;
};

export function buildFilenameBase(
  template: string,
  metadata: ImageMetadata,
  now = new Date(),
): string {
  const date = formatDate(now);
  const time = formatTime(now);
  const value = template
    .replaceAll("{author}", metadata.author)
    .replaceAll("{tweetId}", metadata.tweetId)
    .replaceAll("{date}", date)
    .replaceAll("{time}", time)
    .replaceAll("{originalName}", metadata.originalName);

  return sanitizeFilename(value) || "x_image";
}

export function withExtension(base: string, ext: string): string {
  return `${base}.${sanitizeExtension(ext)}`;
}

export function sanitizeFilename(value: string): string {
  return value
    .replace(/[<>:"/\\|?*\p{Cc}]/gu, "_")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim()
    .slice(0, 180);
}

export function sanitizeExtension(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalized === "jpeg") return "jpg";
  return normalized || "jpg";
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${hours}${minutes}${seconds}`;
}
