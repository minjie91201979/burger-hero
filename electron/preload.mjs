import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  loadStorageRoot: () => ipcRenderer.invoke('load-storage-root'),
  saveStorageRoot: (root) => ipcRenderer.invoke('save-storage-root', root),
});
