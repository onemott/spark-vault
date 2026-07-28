import { useRef } from 'react';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { IdeasPanel } from '@/components/ideas/IdeasPanel';
import { EditorPanel } from '@/components/editor/EditorPanel';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

/**
 * 三栏布局：左侧边栏 | 中间灵感列表 | 右侧编辑器
 */
export function AppLayout() {
  const searchInputRef = useRef<HTMLInputElement>(null);
  useKeyboardShortcuts(searchInputRef);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <IdeasPanel searchInputRef={searchInputRef} />
      <EditorPanel />
    </div>
  );
}
