import type { CapacitorConfig } from '@capacitor/cli';

/**
 * 将 `ng build` 产物同步到原生工程，用 Android Studio 生成 APK / AAB。
 * @see https://capacitorjs.com/docs/getting-started
 */
const config: CapacitorConfig = {
  appId: 'com.burgerhero.app',
  appName: 'BurgerHero',
  webDir: 'dist/burger-hero/browser',
  server: {
    androidScheme: 'https',
  },
};

export default config;
