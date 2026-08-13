/**
 * 灵感图鉴（方向一）：按稀有度等级展示收集进度
 */
import { useMemo, useState } from 'react';
import { Library } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/store';
import { useAllLiveIdeas } from '@/hooks/useGame';
import { computeRarity, RARITY_INFO, type RarityLevel } from '@/lib/game';
import { RarityBadge } from './badges';

const TABS: (RarityLevel | 'all')[] = ['all', 'SSR', 'SR', 'R', 'N'];

export function CollectionDialog() {
  const isCollectionOpen = useStore((s) => s.isCollectionOpen);
  const closeCollection = useStore((s) => s.closeCollection);
  const setSelectedIdeaId = useStore((s) => s.setSelectedIdeaId);
  const openEditor = useStore((s) => s.openEditor);
  const ideas = useAllLiveIdeas();
  const [tab, setTab] = useState<RarityLevel | 'all'>('all');

  const rated = useMemo(
    () => ideas.map((idea) => ({ idea, rarity: computeRarity(idea) })),
    [ideas]
  );

  const counts: Record<RarityLevel, number> = { N: 0, R: 0, SR: 0, SSR: 0 };
  for (const { rarity } of rated) counts[rarity.level] += 1;

  const visible = tab === 'all' ? rated : rated.filter((r) => r.rarity.level === tab);
  const total = ideas.length;

  const openIdea = (ideaId: number) => {
    setSelectedIdeaId(ideaId);
    openEditor(ideaId);
    closeCollection();
  };

  return (
    <Dialog open={isCollectionOpen} onOpenChange={(o) => { if (!o) closeCollection(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Library className="size-5 text-purple-600" strokeWidth={1.5} />
            <DialogTitle>灵感图鉴</DialogTitle>
          </div>
          <DialogDescription>
            已收集 {total} 条灵感，点击可查看详情
          </DialogDescription>
        </DialogHeader>

        {/* 等级 Tab */}
        <div className="flex items-center gap-1.5">
          {TABS.map((t) => {
            const label = t === 'all' ? '全部' : `${t} · ${counts[t]}`;
            return (
              <Button
                key={t}
                size="sm"
                variant={tab === t ? 'default' : 'outline'}
                className="text-xs"
                onClick={() => setTab(t)}
              >
                {label}
              </Button>
            );
          })}
        </div>

        {/* 收集进度条 */}
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
          {(Object.keys(RARITY_INFO) as RarityLevel[]).map((lv) => (
            <div
              key={lv}
              style={{ width: `${total > 0 ? (counts[lv] / total) * 100 : 0}%`, backgroundColor: RARITY_INFO[lv].color }}
              title={`${lv} ${counts[lv]} 条`}
            />
          ))}
        </div>

        {/* 卡片网格 */}
        <div className="max-h-[50vh] overflow-y-auto pr-1">
          {visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {tab === 'all' ? '还没有灵感，记录一条开始收集吧' : `还没有 ${tab} 级灵感`}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {visible.map(({ idea, rarity }) => (
                <button
                  key={idea.id}
                  onClick={() => openIdea(idea.id!)}
                  className="group flex flex-col gap-1.5 rounded-lg border border-border p-3 text-left hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-sm font-medium truncate">{idea.title}</span>
                    <RarityBadge level={rarity.level} score={rarity.score} compact />
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{idea.prompt}</p>
                  {idea.tags.length > 0 && (
                    <p className="text-[10px] text-muted-foreground/70 truncate">
                      {idea.tags.join(' · ')}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
