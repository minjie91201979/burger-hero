/** file://（Electron 打包页）等非安全上下文中 randomUUID 可能不可用或抛错 */
export function randomProfileId(): string {
  try {
    const fn = globalThis.crypto?.randomUUID;
    if (typeof fn === 'function') {
      return fn.call(globalThis.crypto);
    }
  } catch {
    /* ignore */
  }
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}
