import { useRef, useState, useEffect, lazy, Suspense } from 'react';
import { ChevronsRight, Sparkles } from 'lucide-react';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { IdeasPanel } from '@/components/ideas/IdeasPanel';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { toast } from 'sonner';

// 编辑器与回收站仅在打开时才渲染内容，故做代码分割，避免拖慢首次启动
const EditorPanel = lazy(() => import('@/components/editor/EditorPanel'));
const TrashPanel = lazy(() => import('@/components/trash/TrashPanel'));
// 游戏化面板（方向一/三/四/五）同样懒加载
const ForestPanel = lazy(() => import('@/components/game/ForestPanel').then((m) => ({ default: m.ForestPanel })));
const DrawDialog = lazy(() => import('@/components/game/DrawDialog').then((m) => ({ default: m.DrawDialog })));
const TasksDialog = lazy(() => import('@/components/game/TasksDialog').then((m) => ({ default: m.TasksDialog })));
const AchievementsDialog = lazy(() => import('@/components/game/AchievementsDialog').then((m) => ({ default: m.AchievementsDialog })));
const CollectionDialog = lazy(() => import('@/components/game/CollectionDialog').then((m) => ({ default: m.CollectionDialog })));
const PkDialog = lazy(() => import('@/components/game/PkDialog').then((m) => ({ default: m.PkDialog })));
const CardGeneratorDialog = lazy(() => import('@/components/cards/CardGeneratorDialog').then((m) => ({ default: m.CardGeneratorDialog })));
import { exportAllData } from '@/lib/importExport';
import { useStore, SIDEBAR_DEFAULT_WIDTH } from '@/lib/store';
import { initGameSystems, ACHIEVEMENTS } from '@/lib/game';

const LAST_BACKUP_KEY = 'spark-vault-last-backup';
const DISMISSED_KEY = 'spark-vault-backup-dismissed';
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;

function getLocalStorageItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setLocalStorageItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

/**
 * 三栏布局：左侧边栏 | 中间编辑器（记录灵感） | 右侧灵感列表 / 回收站
 * 编辑是核心功能，放在中间主区域；灵感列表在右侧浏览。
 */
export function AppLayout() {
  const searchInputRef = useRef<HTMLInputElement>(null);
  useKeyboardShortcuts(searchInputRef);

  const isSidebarCollapsed = useStore((s) => s.isSidebarCollapsed);
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const setSidebarWidth = useStore((s) => s.setSidebarWidth);

  const handleExpandSidebar = () => {
    setSidebarWidth(SIDEBAR_DEFAULT_WIDTH);
    toggleSidebar();
  };

  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const lastBackup = getLocalStorageItem(LAST_BACKUP_KEY);
    const dismissed = getLocalStorageItem(DISMISSED_KEY);
    const now = Date.now();

    // 仅按时间判断：超过 7 天未备份即提醒，不检查数据容量
    // 原因：IndexedDB 容量检查不准确（navigator.storage.estimate 包含整个 origin），
    // 且用户数据量通常不大，定期备份比容量阈值更可靠
    const needsBackup = !lastBackup || now - Number(lastBackup) > SEVEN_DAYS;
    const cooldownActive = dismissed && now - Number(dismissed) < ONE_DAY;

    if (needsBackup && !cooldownActive) {
      setShowBanner(true);
    }
  }, []);

  const handleBackup = async () => {
    await exportAllData();
    setLocalStorageItem(LAST_BACKUP_KEY, String(Date.now()));
    setShowBanner(false);
  };

  const handleDismiss = () => {
    setLocalStorageItem(DISMISSED_KEY, String(Date.now()));
    setShowBanner(false);
  };

  // 启动时初始化游戏系统：自动签到 + 存活成长同步 + 成就校验
  // 延迟执行，避免与首屏渲染、备份提醒争抢资源
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const newly = await initGameSystems();
      if (cancelled) return;
      for (const id of newly) {
        const def = ACHIEVEMENTS.find((a) => a.id === id);
        if (def) {
          toast(`${def.icon} 解锁成就：${def.name}`, { description: def.desc });
        }
      }
    }, 800);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {showBanner && (
        <div className="sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm animate-in fade-in slide-in-from-top-1 duration-300">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <span>距上次备份已超过 7 天，建议导出备份</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleBackup}
              className="rounded-md bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-500/30 transition-colors dark:text-amber-300"
            >
              立即备份
            </button>
            <button
              onClick={handleDismiss}
              className="rounded-md px-3 py-1 text-xs text-amber-600/70 hover:text-amber-600 transition-colors dark:text-amber-400/70 dark:hover:text-amber-400"
            >
              稍后提醒
            </button>
          </div>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        {isSidebarCollapsed && (
          <button
            onClick={handleExpandSidebar}
            className="shrink-0 w-9 flex flex-col items-center py-3 gap-2 border-r border-border bg-sidebar hover:bg-accent/50 transition-colors"
            title="展开侧边栏"
          >
            <ChevronsRight className="size-4 text-muted-foreground" strokeWidth={1.5} />
            <Sparkles className="size-3.5 text-green-600" strokeWidth={1.5} />
          </button>
        )}
        <Sidebar />
        {/* 编辑器居中为主面板；回收站始终在最右侧滑出 */}
        <Suspense fallback={null}>
          <EditorPanel />
        </Suspense>
        <IdeasPanel searchInputRef={searchInputRef} />
        <Suspense fallback={null}>
          <TrashPanel />
        </Suspense>
      </div>

      {/* 游戏化面板/对话框（懒加载，经 portal 渲染） */}
      <Suspense fallback={null}><ForestPanel /></Suspense>
      <Suspense fallback={null}><DrawDialog /></Suspense>
      <Suspense fallback={null}><TasksDialog /></Suspense>
      <Suspense fallback={null}><AchievementsDialog /></Suspense>
      <Suspense fallback={null}><CollectionDialog /></Suspense>
      <Suspense fallback={null}><PkDialog /></Suspense>
      <Suspense fallback={null}><CardGeneratorDialog /></Suspense>
    </div>
  );
}
