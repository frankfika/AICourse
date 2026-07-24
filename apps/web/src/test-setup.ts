/**
 * Vitest 测试 setup — 引入 @testing-library/jest-dom matchers
 *
 * 包括 matchers:
 *   - toBeInTheDocument
 *   - toHaveTextContent
 *   - toBeVisible
 *   - toHaveClass
 *   - 等等
 *
 * 2026-07-24 P1-8 错误页补全: jsdom 25 默认 url=about:blank 时 localStorage
 * 会 throw SecurityError, zustand 5 persist middleware 拿到 undefined storage
 * 后 setState 走 setItem 路径报「storage.setItem is not a function」。
 * 这里给 localStorage / sessionStorage 装 in-memory stub, 让 zustand persist
 * 正常工作。
 */
import '@testing-library/jest-dom/vitest';

// ───── jsdom localStorage / sessionStorage stub ─────
const makeStorage = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      store = {};
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };
};

const installStorage = () => {
  const stub = makeStorage();
  try {
    Object.defineProperty(window, 'localStorage', {
      value: stub,
      writable: true,
      configurable: true,
    });
  } catch {
    // jsdom 25 在 url=about:blank 时 localStorage 已经是只读 getter
    // 强制覆盖: 先 delete 再赋值
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).localStorage;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).localStorage = stub;
  }
  try {
    Object.defineProperty(window, 'sessionStorage', {
      value: stub,
      writable: true,
      configurable: true,
    });
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).sessionStorage;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).sessionStorage = stub;
  }
};
installStorage();

// 每个 test 前重置 storage
import { beforeEach } from 'vitest';
beforeEach(() => {
  window.history.replaceState({}, '', '/');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window.localStorage as any)?.clear?.();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window.sessionStorage as any)?.clear?.();
});
