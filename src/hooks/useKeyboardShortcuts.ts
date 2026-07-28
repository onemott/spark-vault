import { useEffect, type RefObject } from 'react';
import { useStore } from '@/lib/store';

/**
 * 全局快捷键：
 * - Ctrl+N → 新建灵感
 * - Ctrl+F → 聚焦搜索框
 */
export function useKeyboardShortcuts(searchInputRef: RefObject<HTMLInputElement | null>) {
  const openEditor = useStore((s) => s.openEditor);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+N 或 Cmd+N → 新建灵感
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        openEditor();
      }

      // Ctrl+F 或 Cmd+F → 聚焦搜索框
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openEditor, searchInputRef]);
}
