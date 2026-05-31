type FileSystemPermissionMode = "read" | "readwrite";

type FileSystemHandlePermissionDescriptor = {
  mode?: FileSystemPermissionMode;
};

type DirectoryPickerOptions = {
  mode?: FileSystemPermissionMode;
  startIn?: WellKnownDirectory | FileSystemHandle;
};

type WellKnownDirectory =
  | "desktop"
  | "documents"
  | "downloads"
  | "music"
  | "pictures"
  | "videos";

interface Window {
  showDirectoryPicker(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;
}

interface FileSystemHandle {
  queryPermission(
    descriptor?: FileSystemHandlePermissionDescriptor,
  ): Promise<PermissionState>;
  requestPermission(
    descriptor?: FileSystemHandlePermissionDescriptor,
  ): Promise<PermissionState>;
}

