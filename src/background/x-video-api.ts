import type { ResolveXVideoPayload, ResolveXVideoResponse } from "../shared/messages";

type XVideoApiConfig = {
  bearerToken: string;
  queryId: string;
  featureNames: string[];
  fieldToggleNames: string[];
};

type XVideoVariant = {
  url: string;
  bitrate?: number;
};

type XVideoCandidate = {
  videoUrl: string;
  mediaType: "video" | "gif";
  bitrate?: number;
};

type FetchLike = typeof fetch;

const MAIN_BUNDLE_PATTERN = /\/responsive-web\/client-web\/main\.[^"']+\.js/;
const TWEET_RESULT_OPERATION_NAME = "TweetResultByRestId";
const GUEST_ACTIVATE_URLS = [
  "https://api.x.com/1.1/guest/activate.json",
  "https://api.twitter.com/1.1/guest/activate.json",
];
const VIDEO_HOST = "video.twimg.com";
const VIDEO_MP4_EXTENSION = ".mp4";

let cachedConfigKey: string | null = null;
let cachedConfig: XVideoApiConfig | null = null;
let cachedGuestTokenKey: string | null = null;
let cachedGuestToken: string | null = null;

export async function resolveXVideoFromApi(
  payload: ResolveXVideoPayload,
  fetchImpl: FetchLike = fetch,
): Promise<ResolveXVideoResponse> {
  const config = await getXVideoApiConfig(payload.mainBundleUrls, fetchImpl);
  const signedInResponse = await fetchTweetResult(config, payload.tweetId, fetchImpl);
  const signedInCandidate = await getVideoCandidateFromResponse(signedInResponse, payload.mediaId);

  if (signedInCandidate) {
    return {
      ok: true,
      candidate: signedInCandidate,
    };
  }

  const guestToken = await getGuestToken(config.bearerToken, fetchImpl);
  const guestResponse = await fetchTweetResult(config, payload.tweetId, fetchImpl, guestToken);
  const guestCandidate = await getVideoCandidateFromResponse(guestResponse, payload.mediaId);

  if (!guestResponse.ok) {
    return {
      ok: false,
      error: `X video API request failed: ${guestResponse.status}`,
    };
  }

  if (!guestCandidate) {
    return {
      ok: false,
      error: "X video API response did not include a matching MP4 variant.",
    };
  }

  return {
    ok: true,
    candidate: guestCandidate,
  };
}

function fetchTweetResult(
  config: XVideoApiConfig,
  tweetId: string,
  fetchImpl: FetchLike,
  guestToken?: string,
): Promise<Response> {
  return fetchImpl(buildTweetResultUrl(config, tweetId), {
    method: "GET",
    credentials: "include",
    headers: {
      accept: "*/*",
      authorization: config.bearerToken,
      ...(guestToken ? { "x-guest-token": guestToken } : {}),
      "x-twitter-active-user": "yes",
      "x-twitter-client-language": "ja",
    },
  });
}

async function getVideoCandidateFromResponse(
  response: Response,
  mediaId?: string,
): Promise<XVideoCandidate | null> {
  if (!response.ok) {
    return null;
  }

  try {
    return findBestVideoCandidate(await response.json(), mediaId);
  } catch {
    return null;
  }
}

export function parseXVideoApiConfig(bundleText: string): XVideoApiConfig | null {
  const bearerToken = bundleText.match(/Bearer [A-Za-z0-9%._-]+/)?.[0];
  const operationIndex = bundleText.indexOf(`operationName:"${TWEET_RESULT_OPERATION_NAME}"`);

  if (!bearerToken || operationIndex < 0) {
    return null;
  }

  const operationSlice = bundleText.slice(Math.max(0, operationIndex - 200), operationIndex + 8000);
  const queryId = operationSlice.match(/queryId:"([^"]+)"/)?.[1];

  if (!queryId) {
    return null;
  }

  return {
    bearerToken,
    queryId,
    featureNames: parseQuotedList(operationSlice.match(/featureSwitches:\[([^\]]*)\]/)?.[1] || ""),
    fieldToggleNames: parseQuotedList(operationSlice.match(/fieldToggles:\[([^\]]*)\]/)?.[1] || ""),
  };
}

export function findBestVideoCandidate(
  responseJson: unknown,
  expectedMediaId?: string,
): XVideoCandidate | null {
  const candidates: XVideoCandidate[] = [];

  walkRecords(responseJson, (record) => {
    const variants = getBestMp4Variant(record.video_info);

    if (!variants) {
      return;
    }

    const mediaId = getMediaIdFromRecord(record);

    if (expectedMediaId && mediaId !== expectedMediaId) {
      return;
    }

    candidates.push({
      videoUrl: variants.url,
      mediaType: detectMediaType({
        apiMediaType: getStringValue(record.type),
        videoUrl: variants.url,
      }),
      bitrate: variants.bitrate,
    });
  });

  return candidates[0] || null;
}

function buildTweetResultUrl(config: XVideoApiConfig, tweetId: string): string {
  const variables = {
    tweetId,
    includePromotedContent: true,
    withCommunity: true,
    withVoice: true,
  };
  const params = new URLSearchParams({
    variables: JSON.stringify(variables),
    features: JSON.stringify(toEnabledMap(config.featureNames)),
    fieldToggles: JSON.stringify(toEnabledMap(config.fieldToggleNames)),
  });

  return `https://x.com/i/api/graphql/${config.queryId}/${TWEET_RESULT_OPERATION_NAME}?${params}`;
}

async function getXVideoApiConfig(
  mainBundleUrls: readonly string[],
  fetchImpl: FetchLike,
): Promise<XVideoApiConfig> {
  const candidateUrls = await getMainBundleCandidateUrls(mainBundleUrls, fetchImpl);
  const cacheKey = candidateUrls.join("\n");

  if (cachedConfig && cachedConfigKey === cacheKey) {
    return cachedConfig;
  }

  for (const url of candidateUrls) {
    const response = await fetchImpl(url);

    if (!response.ok) {
      continue;
    }

    const config = parseXVideoApiConfig(await response.text());

    if (config) {
      cachedConfigKey = cacheKey;
      cachedConfig = config;
      return config;
    }
  }

  throw new Error("Could not discover X video API metadata.");
}

async function getMainBundleCandidateUrls(
  mainBundleUrls: readonly string[],
  fetchImpl: FetchLike,
): Promise<string[]> {
  const normalizedUrls = mainBundleUrls
    .map((url) => normalizeMainBundleUrl(url))
    .filter((url): url is string => Boolean(url));

  if (normalizedUrls.length > 0) {
    return Array.from(new Set(normalizedUrls));
  }

  const response = await fetchImpl("https://x.com/");
  const html = response.ok ? await response.text() : "";
  const path = html.match(MAIN_BUNDLE_PATTERN)?.[0];

  return path ? [`https://abs.twimg.com${path}`] : [];
}

function normalizeMainBundleUrl(value: string): string | null {
  try {
    const url = new URL(value, "https://x.com");

    if (url.hostname !== "abs.twimg.com" || !MAIN_BUNDLE_PATTERN.test(url.pathname)) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

async function getGuestToken(bearerToken: string, fetchImpl: FetchLike): Promise<string> {
  if (cachedGuestToken && cachedGuestTokenKey === bearerToken) {
    return cachedGuestToken;
  }

  const failures: string[] = [];

  for (const url of GUEST_ACTIVATE_URLS) {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        accept: "*/*",
        authorization: bearerToken,
        "content-type": "application/json",
        "x-twitter-active-user": "yes",
        "x-twitter-client-language": "ja",
      },
    });

    if (!response.ok) {
      failures.push(`${new URL(url).host}: ${response.status}`);
      continue;
    }

    const json = (await response.json()) as { guest_token?: unknown };
    const guestToken = typeof json.guest_token === "string" ? json.guest_token : "";

    if (!guestToken) {
      failures.push(`${new URL(url).host}: missing token`);
      continue;
    }

    cachedGuestTokenKey = bearerToken;
    cachedGuestToken = guestToken;
    return guestToken;
  }

  throw new Error(`X guest token request failed: ${failures.join(", ")}`);
}

function getBestMp4Variant(videoInfo: unknown): XVideoVariant | null {
  if (!isRecord(videoInfo) || !Array.isArray(videoInfo.variants)) {
    return null;
  }

  const variants = videoInfo.variants
    .map((variant) => parseMp4Variant(variant))
    .filter((variant): variant is XVideoVariant => Boolean(variant))
    .sort((left, right) => (right.bitrate || 0) - (left.bitrate || 0));

  return variants[0] || null;
}

function parseMp4Variant(value: unknown): XVideoVariant | null {
  if (!isRecord(value) || value.content_type !== "video/mp4") {
    return null;
  }

  const url = getDirectMp4Url(getStringValue(value.url) || "");

  if (!url) {
    return null;
  }

  return {
    url,
    bitrate: typeof value.bitrate === "number" ? value.bitrate : undefined,
  };
}

function getDirectMp4Url(value: string): string | null {
  try {
    const url = new URL(value.replaceAll("\\/", "/").replaceAll("&amp;", "&"));

    if (url.hostname !== VIDEO_HOST || !url.pathname.endsWith(VIDEO_MP4_EXTENSION)) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function getMediaIdFromRecord(record: Record<string, unknown>): string | null {
  const idString = getStringValue(record.id_str);

  if (idString) {
    return idString;
  }

  const mediaUrl = getStringValue(record.media_url_https);

  if (mediaUrl) {
    return getXVideoMediaId(mediaUrl);
  }

  const variants = isRecord(record.video_info) ? record.video_info.variants : undefined;

  if (Array.isArray(variants)) {
    for (const variant of variants) {
      if (isRecord(variant)) {
        const mediaId = getXVideoMediaId(getStringValue(variant.url) || "");

        if (mediaId) {
          return mediaId;
        }
      }
    }
  }

  return null;
}

function getXVideoMediaId(value: string): string | null {
  try {
    const url = new URL(value.replaceAll("\\/", "/").replaceAll("&amp;", "&"));

    if (url.hostname !== VIDEO_HOST && url.hostname !== "pbs.twimg.com") {
      return null;
    }

    return (
      url.pathname.match(
        /\/(?:ext_tw_video|amplify_video|tweet_video_thumb|ext_tw_video_thumb|amplify_video_thumb)\/([^/]+)/,
      )?.[1] ||
      url.pathname.match(/\/tweet_video\/([^/.]+)/)?.[1] ||
      null
    );
  } catch {
    return null;
  }
}

function detectMediaType(input: { apiMediaType?: string; videoUrl: string }): "video" | "gif" {
  if (input.apiMediaType === "animated_gif") {
    return "gif";
  }

  if (input.apiMediaType === "video") {
    return "video";
  }

  return input.videoUrl.includes("/tweet_video/") ? "gif" : "video";
}

function walkRecords(value: unknown, callback: (record: Record<string, unknown>) => void): void {
  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      walkRecords(item, callback);
    }
    return;
  }

  const record = value as Record<string, unknown>;
  callback(record);

  for (const child of Object.values(record)) {
    walkRecords(child, callback);
  }
}

function parseQuotedList(source: string): string[] {
  return Array.from(source.matchAll(/"([^"]+)"/g)).map((match) => match[1]);
}

function toEnabledMap(values: readonly string[]): Record<string, true> {
  return Object.fromEntries(values.map((value) => [value, true]));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getStringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
