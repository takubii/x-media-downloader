import type { DebugLogEntry, DebugLogLevel, DebugLogSource, RuntimeMessage } from "./messages";

const DEBUG_LOG_STORAGE_KEY = "debugLogs";
const MAX_DEBUG_LOGS = 200;

export function createDebugLogEntry(
  source: DebugLogSource,
  level: DebugLogLevel,
  message: string,
  details?: unknown,
): DebugLogEntry {
  return {
    timestamp: new Date().toISOString(),
    source,
    level,
    message,
    details: stringifyDetails(details),
  };
}

export function writeDebugConsole(entry: DebugLogEntry): void {
  const text = `[x-image-downloader] [${entry.source}] ${entry.message}`;
  const details = entry.details ? JSON.parse(entry.details) : undefined;

  if (entry.level === "error") {
    console.error(text, details);
    return;
  }

  if (entry.level === "warn") {
    console.warn(text, details);
    return;
  }

  if (entry.level === "info") {
    console.info(text, details);
    return;
  }

  console.debug(text, details);
}

export async function sendDebugLog(
  source: DebugLogSource,
  level: DebugLogLevel,
  message: string,
  details?: unknown,
): Promise<void> {
  const entry = createDebugLogEntry(source, level, message, details);
  writeDebugConsole(entry);

  if (source === "background") {
    await appendDebugLog(entry);
    return;
  }

  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    return;
  }

  try {
    await chrome.runtime.sendMessage({
      type: "DEBUG_LOG",
      entry,
    } satisfies RuntimeMessage);
  } catch {
    // The log is already written to the local console. Dropping debug transport
    // errors avoids masking the actual extension behavior being investigated.
  }
}

export async function appendDebugLog(entry: DebugLogEntry): Promise<void> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    return;
  }

  const result = await chrome.storage.local.get(DEBUG_LOG_STORAGE_KEY);
  const current = Array.isArray(result[DEBUG_LOG_STORAGE_KEY])
    ? (result[DEBUG_LOG_STORAGE_KEY] as DebugLogEntry[])
    : [];
  const next = [...current, entry].slice(-MAX_DEBUG_LOGS);
  await chrome.storage.local.set({ [DEBUG_LOG_STORAGE_KEY]: next });
}

export async function readDebugLogs(): Promise<DebugLogEntry[]> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    return [];
  }

  const result = await chrome.storage.local.get(DEBUG_LOG_STORAGE_KEY);
  return Array.isArray(result[DEBUG_LOG_STORAGE_KEY])
    ? (result[DEBUG_LOG_STORAGE_KEY] as DebugLogEntry[])
    : [];
}

export async function clearDebugLogs(): Promise<void> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    return;
  }

  await chrome.storage.local.remove(DEBUG_LOG_STORAGE_KEY);
}

function stringifyDetails(details: unknown): string | undefined {
  if (details === undefined) {
    return undefined;
  }

  if (details instanceof Error) {
    return JSON.stringify({
      name: details.name,
      message: details.message,
      stack: details.stack,
    });
  }

  try {
    return JSON.stringify(details);
  } catch {
    return JSON.stringify(String(details));
  }
}
