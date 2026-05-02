import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import Store from 'electron-store';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const store = new Store();

function migrateLegacyIfNeeded() {
  const existing = store.get('burgerRoot');
  if (existing) return;
  const legacy = store.get('save');
  if (!legacy) return;
  const id = randomUUID();
  const root = {
    version: 1,
    profiles: [
      {
        id,
        displayName: '已迁移存档',
        createdAt: new Date().toISOString(),
        save: legacy,
      },
    ],
    activeProfileId: id,
  };
  store.set('burgerRoot', root);
  store.delete('save');
}

function createWindow() {
  const isDev = !app.isPackaged;
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#0d0806',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // 打包后从 file:// 加载 ES 模块与 chunk；默认 webSecurity 易导致脚本/动态 import 失败白屏
      webSecurity: isDev,
    },
  });

  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('[burger-hero] did-fail-load', { code, desc, url });
  });

  if (isDev) {
    void win.loadURL('http://localhost:4200');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    // Angular application builder + SSR 产出 browser/index.csr.html，无 index.html
    const indexPath = path.join(
      app.getAppPath(),
      'dist',
      'burger-hero',
      'browser',
      'index.csr.html',
    );
    void win.loadFile(indexPath).catch((err) => {
      console.error('[burger-hero] loadFile failed', indexPath, err);
    });
  }
}

app.whenReady().then(() => {
  migrateLegacyIfNeeded();
  ipcMain.handle('load-storage-root', () => store.get('burgerRoot') ?? null);
  ipcMain.handle('save-storage-root', (_, root) => {
    try {
      const plain = JSON.parse(JSON.stringify(root));
      store.set('burgerRoot', plain);
    } catch (err) {
      console.error('[burger-hero] save-storage-root failed', err);
      throw err;
    }
  });
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
