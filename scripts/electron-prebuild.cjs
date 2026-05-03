/**
 * 打包前尽量结束已运行的 Burger Hero，避免 electron-builder 无法删除
 * release\win-unpacked\Burger Hero.exe（Access is denied）。
 */
const { execFileSync } = require('node:child_process');

if (process.platform !== 'win32') {
  process.exit(0);
}

function tryKill(im) {
  try {
    execFileSync('taskkill', ['/F', '/IM', im, '/T'], { stdio: 'ignore' });
  } catch {
    /* 未运行或无权结束 */
  }
}

tryKill('Burger Hero.exe');
/* 便携版常见进程名（含版本号，按当前 package version 再试一次） */
try {
  const v = require('../package.json').version;
  tryKill(`Burger Hero ${v}.exe`);
} catch {
  /* ignore */
}
