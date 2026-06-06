import { clearDirectoryHandle, getDirectoryHandle, saveDirectoryHandle } from "./file-system-db";
import type { UiMessages } from "./locale";

export type FolderState =
  | { kind: "missing" }
  | { kind: "ready"; name: string }
  | { kind: "permission-required"; name: string };

export type FolderCardElements = {
  card: HTMLElement;
  title: HTMLElement;
  description: HTMLElement;
  name: HTMLElement;
  action: HTMLButtonElement;
  clear: HTMLButtonElement;
};

export type ChooseFolderResult =
  | { ok: true; folderState: FolderState }
  | { ok: false; reason: "cancelled" | "permission-not-granted"; folderState: FolderState }
  | { ok: false; reason: "failed"; error: unknown; folderState: FolderState };

export async function getFolderState(): Promise<FolderState> {
  const directoryHandle = await getDirectoryHandle();

  if (!directoryHandle) {
    return { kind: "missing" };
  }

  const permission = await directoryHandle.queryPermission({ mode: "readwrite" });

  if (permission === "granted") {
    return { kind: "ready", name: directoryHandle.name };
  }

  return { kind: "permission-required", name: directoryHandle.name };
}

export async function chooseSaveFolder(): Promise<ChooseFolderResult> {
  try {
    const handle = await window.showDirectoryPicker({ mode: "readwrite" });
    const permission = await handle.requestPermission({ mode: "readwrite" });

    if (permission !== "granted") {
      return {
        ok: false,
        reason: "permission-not-granted",
        folderState: await getFolderState(),
      };
    }

    await saveDirectoryHandle(handle);

    return {
      ok: true,
      folderState: { kind: "ready", name: handle.name },
    };
  } catch (error) {
    const folderState = await getFolderState();

    if (error instanceof DOMException && error.name === "AbortError") {
      return { ok: false, reason: "cancelled", folderState };
    }

    return { ok: false, reason: "failed", error, folderState };
  }
}

export async function clearSaveFolder(): Promise<FolderState> {
  await clearDirectoryHandle();
  return { kind: "missing" };
}

export function applyTranslations(root: ParentNode, messages: UiMessages): void {
  for (const element of root.querySelectorAll<HTMLElement>("[data-i18n]")) {
    const key = element.dataset.i18n as keyof UiMessages;
    element.textContent = messages[key];
  }
}

export function renderFolderCard(
  elements: FolderCardElements,
  folderState: FolderState,
  messages: UiMessages,
): void {
  elements.card.dataset.state = folderState.kind;

  if (folderState.kind === "missing") {
    elements.title.textContent = messages.folderNotSelectedTitle;
    elements.description.textContent = messages.folderNotSelectedDescription;
    elements.name.textContent = "";
    elements.name.parentElement?.setAttribute("hidden", "");
    elements.action.textContent = messages.chooseFolder;
    elements.clear.textContent = messages.clearFolder;
    elements.clear.hidden = true;
    elements.clear.disabled = true;
    return;
  }

  elements.name.textContent = folderState.name;
  elements.name.parentElement?.removeAttribute("hidden");
  elements.action.textContent = messages.chooseAgain;
  elements.clear.textContent = messages.clearFolder;
  elements.clear.hidden = false;
  elements.clear.disabled = false;

  if (folderState.kind === "ready") {
    elements.title.textContent = messages.folderReadyTitle;
    elements.description.textContent = messages.folderReadyDescription;
    return;
  }

  elements.title.textContent = messages.folderPermissionTitle;
  elements.description.textContent = messages.folderPermissionDescription;
}
