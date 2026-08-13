/**
 * 测试环境全局变量（fake-indexeddb + Node 端浏览器 API 兜底）
 * 必须在导入 src 代码之前导入。
 */
import 'fake-indexeddb/auto';

const g = globalThis as any;

// db.ts 顶层会调用 navigator.storage.persist()
if (!g.navigator) {
  g.navigator = { storage: { persist: async () => true } };
}
// db.ts 顶层 whenIdle 使用 window.requestIdleCallback
if (g.window === undefined) {
  g.window = g;
}
if (typeof g.requestIdleCallback !== 'function') {
  g.requestIdleCallback = (cb: () => void) => setTimeout(cb, 0);
}
if (typeof g.cancelIdleCallback !== 'function') {
  g.cancelIdleCallback = (handle: number) => clearTimeout(handle);
}
