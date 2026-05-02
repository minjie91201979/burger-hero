export {};

declare global {
  interface Window {
    electronAPI?: {
      loadStorageRoot: () => Promise<unknown>;
      saveStorageRoot: (root: unknown) => Promise<void>;
    };
  }
}
