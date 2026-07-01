import { beforeEach, describe, expect, test, vi } from "vitest";

import type { RuntimeMessage } from "../shared/messages";
import type { Settings } from "../shared/settings";

const dbMocks = vi.hoisted(() => ({
  getDirectoryHandle: vi.fn<() => Promise<FileSystemDirectoryHandle | null>>(),
  getSavedFileRecord: vi.fn<() => Promise<{ filename: string; imageKey: string } | null>>(),
  saveSavedFileRecord: vi.fn<() => Promise<void>>(),
}));

vi.mock("../shared/file-system-db", () => dbMocks);
vi.mock("../shared/debug-log", () => ({
  sendDebugLog: vi.fn<() => Promise<void>>(),
}));

type MessageListener = (
  message: RuntimeMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) => boolean;

let messageListener: MessageListener | undefined;

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  messageListener = undefined;
  vi.stubGlobal("chrome", {
    runtime: {
      onMessage: {
        addListener: vi.fn<(listener: MessageListener) => void>((listener: MessageListener) => {
          messageListener = listener;
        }),
      },
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async () => new Response(new Blob(["video"], { type: "video/mp4" }))),
  );
});

describe("offscreen video saving", () => {
  test("saves video messages to the video folder", async () => {
    const writtenFiles: WrittenFile[] = [];
    dbMocks.getDirectoryHandle.mockResolvedValue(createDirectoryHandle(writtenFiles));
    dbMocks.getSavedFileRecord.mockResolvedValue(null);
    const listener = await loadOffscreenListener();

    const response = await sendMessage(listener, {
      type: "SAVE_VIDEO_OFFSCREEN",
      target: "offscreen",
      settings: createSettings(),
      payload: {
        videoUrl:
          "https://video.twimg.com/ext_tw_video/1730942564943982592/pu/vid/avc1/592x1280/high.mp4?tag=12",
        pageUrl: "https://x.com/example/status/1730942564943982592",
        mediaType: "video",
        author: "example",
        tweetId: "1730942564943982592",
      },
    });

    expect(response).toEqual({
      ok: true,
      filename: "example_1730942564943982592_high.mp4",
    });
    expect(dbMocks.getDirectoryHandle).toHaveBeenCalledWith("video");
    expect(writtenFiles).toMatchObject([
      {
        filename: "example_1730942564943982592_high.mp4",
        blobType: "video/mp4",
      },
    ]);
    expect(dbMocks.saveSavedFileRecord).toHaveBeenCalledWith(
      {
        filename: "example_1730942564943982592_high.mp4",
        imageKey:
          "https://video.twimg.com/ext_tw_video/1730942564943982592/pu/vid/avc1/592x1280/high.mp4",
      },
      "video",
    );
  });

  test("skips duplicate GIF-style media without fetching", async () => {
    dbMocks.getDirectoryHandle.mockResolvedValue(
      createDirectoryHandle([], { existingFilenames: ["example_1730942564943982592_clip.gif"] }),
    );
    const listener = await loadOffscreenListener();

    const response = await sendMessage(listener, {
      type: "SAVE_VIDEO_OFFSCREEN",
      target: "offscreen",
      settings: createSettings({ duplicateBehavior: "skip" }),
      payload: {
        videoUrl: "https://video.twimg.com/tweet_video/clip.mp4?tag=12",
        pageUrl: "https://x.com/example/status/1730942564943982592",
        mediaType: "gif",
        author: "example",
        tweetId: "1730942564943982592",
      },
    });

    expect(response).toEqual({
      ok: true,
      filename: "example_1730942564943982592_clip.gif",
      skipped: true,
    });
    expect(dbMocks.getDirectoryHandle).toHaveBeenCalledWith("gif");
    expect(fetch).not.toHaveBeenCalled();
    expect(dbMocks.saveSavedFileRecord).not.toHaveBeenCalled();
  });

  test("saves GIF-style media to the GIF folder with a .gif filename", async () => {
    const writtenFiles: WrittenFile[] = [];
    dbMocks.getDirectoryHandle.mockResolvedValue(createDirectoryHandle(writtenFiles));
    dbMocks.getSavedFileRecord.mockResolvedValue(null);
    const listener = await loadOffscreenListener();

    const response = await sendMessage(listener, {
      type: "SAVE_VIDEO_OFFSCREEN",
      target: "offscreen",
      settings: createSettings(),
      payload: {
        videoUrl: "https://video.twimg.com/tweet_video/clip.mp4?tag=12",
        pageUrl: "https://x.com/example/status/1730942564943982592",
        mediaType: "gif",
        author: "example",
        tweetId: "1730942564943982592",
      },
    });

    expect(response).toEqual({
      ok: true,
      filename: "example_1730942564943982592_clip.gif",
    });
    expect(dbMocks.getDirectoryHandle).toHaveBeenCalledWith("gif");
    expect(writtenFiles).toMatchObject([
      {
        filename: "example_1730942564943982592_clip.gif",
        blobType: "video/mp4",
      },
    ]);
    expect(dbMocks.saveSavedFileRecord).toHaveBeenCalledWith(
      {
        filename: "example_1730942564943982592_clip.gif",
        imageKey: "https://video.twimg.com/tweet_video/clip.mp4",
      },
      "gif",
    );
  });
});

function createSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    language: "en",
    filenameTemplate: "{author}_{tweetId}_{originalName}",
    duplicateBehavior: "overwrite",
    preferOriginalImage: true,
    ...overrides,
  };
}

async function loadOffscreenListener(): Promise<MessageListener> {
  await import("./offscreen");

  if (!messageListener) {
    throw new Error("Offscreen listener was not registered.");
  }

  return messageListener;
}

async function sendMessage(listener: MessageListener, message: RuntimeMessage): Promise<unknown> {
  return new Promise((resolve) => {
    expect(listener(message, {} as chrome.runtime.MessageSender, resolve)).toBe(true);
  });
}

type WrittenFile = {
  filename: string;
  blobType: string;
};

function createDirectoryHandle(
  writtenFiles: WrittenFile[],
  options: { existingFilenames?: string[] } = {},
): FileSystemDirectoryHandle {
  const existingFilenames = new Set(options.existingFilenames || []);

  return {
    queryPermission: vi.fn<() => Promise<PermissionState>>(async () => "granted"),
    requestPermission: vi.fn<() => Promise<PermissionState>>(async () => "granted"),
    getFileHandle: vi.fn<
      (filename: string, handleOptions?: { create?: boolean }) => Promise<FileSystemFileHandle>
    >(async (filename: string, handleOptions?: { create?: boolean }) => {
      if (!handleOptions?.create && !existingFilenames.has(filename)) {
        throw new DOMException("Not found", "NotFoundError");
      }

      return {
        createWritable: vi.fn<() => Promise<FileSystemWritableFileStream>>(async () => {
          return {
            write: vi.fn<(chunk: FileSystemWriteChunkType) => Promise<void>>(async (chunk) => {
              const blob = chunk as Blob;
              writtenFiles.push({ filename, blobType: blob.type });
            }),
            close: vi.fn<() => Promise<void>>(async () => {}),
          } as unknown as FileSystemWritableFileStream;
        }),
      } as unknown as FileSystemFileHandle;
    }),
  } as unknown as FileSystemDirectoryHandle;
}
