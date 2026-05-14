import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

/** 部分 WebView / Chrome 在用户手势后可锁定横屏；失败则仍依赖 styles.scss 旋转 */
function tryLockLandscape(): void {
  const so = screen.orientation as { lock?: (orientation: string) => Promise<void> } | undefined;
  if (so?.lock) {
    void so.lock('landscape').catch(() => undefined);
  }
}

tryLockLandscape();
document.addEventListener(
  'touchstart',
  () => {
    tryLockLandscape();
  },
  { once: true, passive: true },
);

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
