type ImageSaveState = "idle" | "saving" | "saved" | "skipped" | "failed";

export type ImageSaveStateStore = {
  get: (imageKey: string) => ImageSaveState;
  isSaving: (imageKey: string) => boolean;
  set: (imageKey: string, state: ImageSaveState) => void;
};

export function createImageSaveStateStore(): ImageSaveStateStore {
  const states = new Map<string, ImageSaveState>();

  return {
    get: (imageKey) => states.get(imageKey) || "idle",
    isSaving: (imageKey) => states.get(imageKey) === "saving",
    set: (imageKey, state) => {
      if (state === "idle") {
        states.delete(imageKey);
        return;
      }

      states.set(imageKey, state);
    },
  };
}
