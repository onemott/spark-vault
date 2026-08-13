/**
 * 成就徽章（方向一/三）：成长/习惯/探索/收集 四类成就墙
 */
import { Trophy } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useStore } from '@/lib/store';
import { useAchievements } from '@/hooks/useGame';
import { ACHIEVEMENTS } from '@/lib/game';

const GROUPS = ['成长', '习惯', '探索', '收集'] as const;

export function AchievementsDialog() {
  const isAchievementsOpen = useStore((s) => s.isAchievementsOpen);
  const closeAchievements = useStore((s) => s.closeAchievements);
  const records = useAchievements();
  const recordMap = new Map(records.map((r) => [r.id, r]));

  const unlockedCount = records.filter((r) => r.unlockedAt).length;

  return (
    <Dialog open={isAchievementsOpen} onOpenChange={(o) => { if (!o) closeAchievements(); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Trophy className="size-5 text-amber-500" strokeWidth={1.5} />
            <DialogTitle>成就徽章</DialogTitle>
          </div>
          <DialogDescription>
            已解锁 {unlockedCount} / {ACHIEVEMENTS.length} 个徽章
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto pr-1">
          {GROUPS.map((group) => {
            const defs = ACHIEVEMENTS.filter((a) => a.group === group);
            return (
              <div key={group}>
                <h3 className="mb-2 text-xs font-semibold text-muted-foreground">{group}</h3>
                <div className="grid grid-cols-2 gap-2">
                  {defs.map((def) => {
                    const rec = recordMap.get(def.id);
                    const unlocked = !!rec?.unlockedAt;
                    const progress = Math.min(rec?.progress ?? 0, def.target);
                    const pct = def.target > 0 ? Math.round((progress / def.target) * 100) : 0;
                    return (
                      <div
                        key={def.id}
                        className={`rounded-lg border p-3 transition-colors ${
                          unlocked ? 'border-amber-500/40 bg-amber-500/5' : 'border-border bg-muted/20'
                        }`}
                        title={def.desc}
                      >
                        <div className="flex items-start gap-2">
                          <span className={`text-xl leading-none ${unlocked ? '' : 'grayscale opacity-50'}`}>{def.icon}</span>
                          <div className="min-w-0">
                            <p className={`text-sm font-medium truncate ${unlocked ? 'text-amber-700 dark:text-amber-400' : 'text-foreground'}`}>
                              {def.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground line-clamp-2">{def.desc}</p>
                          </div>
                        </div>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full ${unlocked ? 'bg-amber-500' : 'bg-muted-foreground/40'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {unlocked
                            ? `已解锁${rec?.unlockedAt ? ` · ${new Date(rec.unlockedAt).toLocaleDateString()}` : ''}`
                            : `进度 ${progress}/${def.target}`}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
