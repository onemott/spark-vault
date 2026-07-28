import { useRef, useState, useEffect } from 'react';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { IdeasPanel } from '@/components/ideas/IdeasPanel';
import { EditorPanel } from '@/components/editor/EditorPanel';
import { TrashPanel } from '@/components/trash/TrashPanel';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { exportAllData } from '@/lib/importExport';

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
 * 三栏布局：左侧边栏 | 中间灵感列表 | 右侧编辑器/回收站
 */
export function AppLayout() {
  const searchInputRef = useRef<HTMLInputElement>(null);
  useKeyboardShortcuts(searchInputRef);

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
        <Sidebar />
        <IdeasPanel searchInputRef={searchInputRef} />
        <EditorPanel />
        <TrashPanel />
      </div>
    </div>
  );
}
