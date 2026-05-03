/**
 * 减小 Windows 产物体积：移除 Chromium 许可证 HTML（安装/便携包内不参与运行）。
 */
import fs from 'node:fs/promises';
import path from 'node:path';

export default async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;
  const licenseHtml = path.join(context.appOutDir, 'LICENSES.chromium.html');
  try {
    await fs.rm(licenseHtml, { force: true });
  } catch {
    /* ignore */
  }
}
