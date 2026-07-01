import { extractXVideoCandidatesFromApiJson } from "./x-video-page-parser";
import type { XVideoPageCandidate } from "./x-video-page-parser";

type XVideoCandidatesMessage = {
  source: "x-image-downloader-page";
  type: "X_VIDEO_API_CANDIDATES";
  delivery: "live" | "snapshot";
  requestPath?: string;
  candidates: XVideoPageCandidate[];
};

type XVideoCandidatesRequestMessage = {
  source: "x-image-downloader-content";
  type: "REQUEST_X_VIDEO_API_CANDIDATES";
};

const PAGE_MESSAGE_SOURCE = "x-image-downloader-page";
const CONTENT_MESSAGE_SOURCE = "x-image-downloader-content";
const MAX_CACHED_CANDIDATES = 500;
const OBSERVER_INSTALLED_KEY = Symbol.for("x-image-downloader.videoObserverInstalled");

const candidateCache = new Map<string, XVideoPageCandidate>();
const observerWindow = window as unknown as Window & { [key: symbol]: boolean | undefined };

if (!observerWindow[OBSERVER_INSTALLED_KEY]) {
  observerWindow[OBSERVER_INSTALLED_KEY] = true;
  installFetchObserver();
  installXhrObserver();
  installMessageObserver();
}

function installFetchObserver(): void {
  const originalFetch = window.fetch;

  window.fetch = async function observedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const response = await originalFetch.apply(this, [input, init]);
    const requestUrl = getRequestUrl(input);

    if (requestUrl) {
      inspectFetchResponse(requestUrl, response);
    }

    return response;
  };
}

function installXhrObserver(): void {
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  const requestUrlByXhr = new WeakMap<XMLHttpRequest, string>();

  XMLHttpRequest.prototype.open = function observedOpen(
    method: string,
    url: string | URL,
    ...rest: [boolean?, string?, string?]
  ): void {
    requestUrlByXhr.set(this, String(url));
    return Reflect.apply(originalOpen, this, [method, url, ...rest]) as void;
  };

  XMLHttpRequest.prototype.send = function observedSend(body?: Document | XMLHttpRequestBodyInit) {
    this.addEventListener("loadend", () => {
      const requestUrl = requestUrlByXhr.get(this);

      if (!requestUrl || !isCandidateApiUrl(requestUrl) || !isReadableXhrResponse(this)) {
        return;
      }

      inspectResponseText(requestUrl, this.responseText);
    });

    return originalSend.call(this, body);
  };
}

function installMessageObserver(): void {
  window.addEventListener("message", (event: MessageEvent<XVideoCandidatesRequestMessage>) => {
    if (event.source !== window || event.origin !== location.origin) {
      return;
    }

    if (
      !event.data ||
      event.data.source !== CONTENT_MESSAGE_SOURCE ||
      event.data.type !== "REQUEST_X_VIDEO_API_CANDIDATES"
    ) {
      return;
    }

    publishCandidates("snapshot", Array.from(candidateCache.values()));
  });
}

function inspectFetchResponse(requestUrl: string, response: Response): void {
  if (!isCandidateApiUrl(requestUrl) || !isJsonResponse(response)) {
    return;
  }

  void response
    .clone()
    .json()
    .then((json: unknown) => {
      publishCandidates("live", extractXVideoCandidatesFromApiJson(json), requestUrl);
    })
    .catch(() => {
      // Ignore non-JSON and transient clone failures; the page request must stay untouched.
    });
}

function inspectResponseText(requestUrl: string, responseText: string): void {
  if (!responseText.includes("video_info") && !responseText.includes("video.twimg.com")) {
    return;
  }

  try {
    const json = JSON.parse(stripJsonPrefix(responseText));
    publishCandidates("live", extractXVideoCandidatesFromApiJson(json), requestUrl);
  } catch {
    // Ignore non-JSON XHR payloads.
  }
}

function publishCandidates(
  delivery: XVideoCandidatesMessage["delivery"],
  candidates: readonly XVideoPageCandidate[],
  requestUrl?: string,
): void {
  if (candidates.length === 0) {
    return;
  }

  rememberCandidates(candidates);

  window.postMessage(
    {
      source: PAGE_MESSAGE_SOURCE,
      type: "X_VIDEO_API_CANDIDATES",
      delivery,
      requestPath: requestUrl ? getRequestPath(requestUrl) : undefined,
      candidates: [...candidates],
    } satisfies XVideoCandidatesMessage,
    location.origin,
  );
}

function rememberCandidates(candidates: readonly XVideoPageCandidate[]): void {
  for (const candidate of candidates) {
    const key = `${candidate.tweetId || ""}:${candidate.mediaId}:${candidate.videoUrl}`;

    if (candidateCache.has(key)) {
      candidateCache.delete(key);
    }

    candidateCache.set(key, candidate);
  }

  while (candidateCache.size > MAX_CACHED_CANDIDATES) {
    const oldestKey = candidateCache.keys().next().value as string | undefined;

    if (!oldestKey) {
      return;
    }

    candidateCache.delete(oldestKey);
  }
}

function getRequestUrl(input: RequestInfo | URL): string | null {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  if (input instanceof Request) {
    return input.url;
  }

  return null;
}

function isCandidateApiUrl(value: string): boolean {
  try {
    const url = new URL(value, location.href);

    if (!["x.com", "twitter.com", "api.x.com", "api.twitter.com"].includes(url.hostname)) {
      return false;
    }

    return (
      url.pathname.includes("/i/api/graphql/") ||
      url.pathname.includes("/graphql/") ||
      url.pathname.includes("/timeline")
    );
  } catch {
    return false;
  }
}

function isJsonResponse(response: Response): boolean {
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json") || contentType.includes("text/plain");
}

function isReadableXhrResponse(xhr: XMLHttpRequest): boolean {
  return (
    xhr.status >= 200 &&
    xhr.status < 300 &&
    (xhr.responseType === "" || xhr.responseType === "text")
  );
}

function getRequestPath(value: string): string | undefined {
  try {
    const url = new URL(value, location.href);
    return `${url.hostname}${url.pathname}`;
  } catch {
    return undefined;
  }
}

function stripJsonPrefix(value: string): string {
  return value.startsWith("for (;;);") ? value.slice("for (;;);".length) : value;
}
