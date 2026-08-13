/**
 * 灵感森林（方向三）：把灵感按成长阶段渲染成一片可视化森林
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { TreePine, Droplets, CloudRain, Sprout, MapPin, Zap } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/store';
import { useForestStats, useAllLiveIdeas, useEnergyAccount } from '@/hooks/useGame';
import { generateForestLayout, waterIdea, springRain, getGrowthInfo } from '@/lib/game';
import { growthEmoji } from './badges';

const THEME_KEY = 'spark-vault-forest-theme';
const THEMES: Record<string, { name: string; bg: string }> = {
  level: { name: '自动', bg: '' }, // 跟随森林等级
  sakura: { name: '🌸 樱花', bg: 'linear-gradient(180deg,#ffd9e8 0%,#ffb3d1 100%)' },
  starry: { name: '✨ 星空', bg: 'linear-gradient(180deg,#0b1026 0%,#1b2350 100%)' },
  snow: { name: '❄️ 雪景', bg: 'linear-gradient(180deg,#eef5fb 0%,#cfe3f0 100%)' },
};

function readTheme(): string {
  try {
    return localStorage.getItem(THEME_KEY) ?? 'level';
  } catch {
    return 'level';
  }
}

export function ForestPanel() {
  const isForestOpen = useStore((s) => s.isForestOpen);
  const closeForest = useStore((s) => s.closeForest);
  const setSelectedIdeaId = useStore((s) => s.setSelectedIdeaId);
  const openEditor = useStore((s) => s.openEditor);

  const ideas = useAllLiveIdeas();
  const stats = useForestStats();
  const energy = useEnergyAccount();
  const [theme, setTheme] = useState<string>(readTheme);

  const trees = generateForestLayout(ideas);
  const bg =
    theme === 'level'
      ? stats.forestLevelInfo.bg
      : THEMES[theme]?.bg ?? stats.forestLevelInfo.bg;

  const handleOpenIdea = (ideaId: number) => {
    setSelectedIdeaId(ideaId);
    openEditor(ideaId);
    closeForest();
  };

  const handleWater = async (ideaId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await waterIdea(ideaId);
    if (ok) {
      toast.success('💧 浇灌成功，成长值 +10');
    } else {
      toast.error('能量不足，完成任务可获得能量');
    }
  };

  const handleSpringRain = async () => {
    const ok = await springRain();
    if (ok) {
      toast.success('🌧️ 春雨润物，所有灵感成长值 +5');
    } else {
      toast.error('需要 100 能量才能使用春雨');
    }
  };

  return (
    <Sheet open={isForestOpen} onOpenChange={(o) => { if (!o) closeForest(); }}>
      <SheetContent className="w-[720px] max-w-[94vw] sm:max-w-[720px] p-0 gap-0">
        <SheetHeader className="border-b border-border">
          <div className="flex items-center gap-2">
            <TreePine className="size-5 text-green-600" strokeWidth={1.5} />
            <SheetTitle>我的灵感森林</SheetTitle>
          </div>
          <SheetDescription>
            双击树木可浇灌（消耗 10 能量），点击进入灵感详情
          </SheetDescription>
        </SheetHeader>

        {/* 统计栏 */}
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span title="总灵感数">{ideas.length} 棵</span>
            <span title="总成长值" className="inline-flex items-center gap-0.5">
              <Zap className="size-3" strokeWidth={1.5} /> {stats.totalGrowth}
            </span>
            <span className="inline-flex items-center gap-0.5">
              <Droplets className="size-3 text-amber-500" strokeWidth={1.5} /> {energy?.balance ?? 0}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {Object.entries(THEMES).map(([key, t]) => (
              <button
                key={key}
                onClick={() => {
                  setTheme(key);
                  try { localStorage.setItem(THEME_KEY, key); } catch { /* ignore */ }
                }}
                className={`rounded-full px-2 py-0.5 text-[10px] border transition-colors ${
                  theme === key ? 'border-green-500 bg-green-500/10 text-green-700 dark:text-green-400' : 'border-border text-muted-foreground hover:bg-accent'
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>

        {/* 森林画布 */}
        <div className="flex-1 min-h-0 overflow-hidden relative" style={{ background: bg }}>
          {ideas.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-8">
              <Sprout className="size-12 text-white/80 drop-shadow" strokeWidth={1.5} />
              <p className="text-sm font-medium text-white drop-shadow">森林还是一片荒原</p>
              <p className="text-xs text-white/80 drop-shadow">记录一条灵感，种下你的第一颗种子吧</p>
              <Button
                size="sm"
                onClick={() => {
                  closeForest();
                  openEditor();
                }}
              >
                新建灵感
              </Button>
            </div>
          ) : (
            <AnimatePresence>
              {trees.map((tree) => {
                const idea = ideas.find((i) => i.id === tree.ideaId);
                if (!idea) return null;
                const info = getGrowthInfo(tree.level);
                const icon = growthEmoji(tree.level);
                return (
                  <motion.button
                    key={tree.ideaId}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: (tree.x % 10) * 0.03 }}
                    className="group absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${tree.x}%`, top: `${tree.y * 100}%` }}
                    onClick={() => handleOpenIdea(tree.ideaId)}
                    onDoubleClick={(e) => handleWater(tree.ideaId, e)}
                    title={`${idea.title}\n${info.name} · 成长值 ${idea.growthPoints ?? 0}（双击浇灌）`}
                  >
                    <span
                      className="leading-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)] transition-transform group-hover:scale-125"
                      style={{ fontSize: tree.size, filter: tree.level >= 5 ? 'drop-shadow(0 0 8px rgba(255,220,120,0.9))' : undefined }}
                    >
                      {icon}
                    </span>
                    {/* 悬停提示：标题 + 成长值 */}
                    <span className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full hidden group-hover:block whitespace-nowrap rounded bg-black/75 px-1.5 py-0.5 text-[10px] text-white">
                      {idea.title}
                    </span>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        {/* 底部操作 */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-0.5">
              <MapPin className="size-3" strokeWidth={1.5} />
              {stats.forestLevelInfo.name} Lv.{stats.forestLevel}
            </span>
            <span className="hidden sm:inline text-muted-foreground/70">
              {Object.entries(stats.counts).map(([lvl, n]) => (
                <span key={lvl} className="mr-1.5">
                  {growthEmoji(Number(lvl))}×{n}
                </span>
              ))}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={handleSpringRain} title="消耗 100 能量，所有灵感成长值 +5">
            <CloudRain className="size-3.5 mr-1.5" strokeWidth={1.5} />
            春雨 (100⚡)
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
