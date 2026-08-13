/**
 * 侧栏「游乐场」入口：能量余额 + 六个游戏面板入口
 */
import { TreePine, Dices, ClipboardList, Trophy, Library, Swords, Zap } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useEnergyAccount, useDrawStatus, useClaimableTaskIds, useAchievements } from '@/hooks/useGame';

const ENTRIES = [
  { key: 'forest', label: '灵感森林', icon: TreePine, openKey: 'openForest' as const },
  { key: 'draw', label: '每日抽卡', icon: Dices, openKey: 'openDraw' as const },
  { key: 'tasks', label: '每日任务', icon: ClipboardList, openKey: 'openTasks' as const },
  { key: 'ach', label: '成就', icon: Trophy, openKey: 'openAchievements' as const },
  { key: 'collect', label: '灵感图鉴', icon: Library, openKey: 'openCollection' as const },
  { key: 'pk', label: '灵感PK', icon: Swords, openKey: 'openPk' as const },
];

export function GameHub() {
  const energy = useEnergyAccount();
  const draw = useDrawStatus();
  const claimable = useClaimableTaskIds();
  const achievements = useAchievements();
  const openForest = useStore((s) => s.openForest);
  const openDraw = useStore((s) => s.openDraw);
  const openTasks = useStore((s) => s.openTasks);
  const openAchievements = useStore((s) => s.openAchievements);
  const openCollection = useStore((s) => s.openCollection);
  const openPk = useStore((s) => s.openPk);

  const openActions: Record<string, () => void> = {
    openForest, openDraw, openTasks, openAchievements, openCollection, openPk,
  };

  const unlockedCount = achievements.filter((a) => a.unlockedAt).length;

  return (
    <div className="border-b border-border px-3 py-2.5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-muted-foreground/80">游乐场</span>
        <span
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400"
          title="灵感能量：完成任务/签到获得，用于浇灌灵感"
        >
          <Zap className="size-3" strokeWidth={2} fill="currentColor" />
          {energy?.balance ?? 0}
        </span>
      </div>
      <div className="grid grid-cols-6 gap-1">
        {ENTRIES.map((entry) => {
          const Icon = entry.icon;
          const showDot =
            (entry.key === 'draw' && (draw?.remaining ?? 0) > 0) ||
            (entry.key === 'tasks' && claimable.length > 0);
          return (
            <button
              key={entry.key}
              onClick={openActions[entry.openKey]}
              className="group relative flex flex-col items-center gap-0.5 rounded-md py-1.5 hover:bg-accent/60 transition-colors"
              title={`${entry.label}${showDot ? '（有新内容）' : ''}`}
            >
              <Icon className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" strokeWidth={1.5} />
              <span className="text-[9px] leading-none text-muted-foreground/80">{entry.label.slice(0, 4)}</span>
              {showDot && (
                <span className="absolute top-0.5 right-1.5 size-1.5 rounded-full bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.8)]" />
              )}
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground/60">
        已解锁成就 {unlockedCount} 个
      </p>
    </div>
  );
}
