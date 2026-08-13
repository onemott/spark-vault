/**
 * 每日抽卡（方向一）：卡背翻转 + 稀有度展示 + 收藏到金库
 */
import { useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { Dices, Sparkles, BookmarkPlus, ChevronRight, Zap } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/store';
import { useDrawStatus } from '@/hooks/useGame';
import {
  drawFromPool,
  useDraw,
  collectSampleIdea,
  countVariables,
  RARITY_INFO,
  type DrawResult,
} from '@/lib/game';
import { RarityBadge } from './badges';

export function DrawDialog() {
  const isDrawOpen = useStore((s) => s.isDrawOpen);
  const closeDraw = useStore((s) => s.closeDraw);
  const draw = useDrawStatus();

  const [result, setResult] = useState<DrawResult | null>(null);
  const [showFront, setShowFront] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleDraw = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setResult(null);
    setShowFront(false);

    const ok = await useDraw();
    if (!ok) {
      setBusy(false);
      toast.error('今日抽卡次数已用完，明天再来吧');
      return;
    }

    const drawn = await drawFromPool();
    setResult(drawn);

    // 先展示卡背，再翻转
    await new Promise((r) => setTimeout(r, 350));
    setShowFront(true);

    if (drawn.rarity.level === 'SSR') {
      setTimeout(() => toast('✨ 传说级灵感！太稀有了！', { icon: '👑' }), 500);
    } else if (drawn.rarity.level === 'SR') {
      setTimeout(() => toast('紫色光芒闪烁，史诗级灵感！', { icon: '💜' }), 500);
    }
    setBusy(false);
  }, [busy]);

  const handleCollect = async () => {
    if (!result || result.kind !== 'sample' || busy) return;
    setBusy(true);
    const id = await collectSampleIdea(result);
    setBusy(false);
    toast.success('已收藏到你的灵感金库');
    // 收藏后跳转查看
    closeDraw();
    useStore.getState().setSelectedIdeaId(id);
    useStore.getState().openEditor(id);
  };

  const handleNext = () => {
    if (busy) return;
    if ((draw?.remaining ?? 0) <= 0) {
      toast.error('今日抽卡次数已用完，明天再来吧');
      return;
    }
    setResult(null);
    setShowFront(false);
    setTimeout(() => handleDraw(), 100);
  };

  const remaining = draw?.remaining ?? 0;
  const info = result ? RARITY_INFO[result.rarity.level] : null;

  return (
    <Dialog open={isDrawOpen} onOpenChange={(o) => { if (!o) closeDraw(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Dices className="size-5 text-green-600" strokeWidth={1.5} />
              <DialogTitle>每日抽卡</DialogTitle>
            </div>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Zap className="size-3 text-amber-500" strokeWidth={2} fill="currentColor" />
              今日剩余 {remaining} 次
            </span>
          </div>
          <DialogDescription>从你的灵感金库中抽一张，重遇被遗忘的灵感</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          {/* 卡片翻转区 */}
          <div className="relative w-full" style={{ height: 300, perspective: 1200 }}>
            <motion.div
              className="relative w-full h-full"
              animate={{ rotateY: showFront ? 180 : 0 }}
              transition={{ duration: 0.65, ease: 'easeInOut' }}
              style={{ transformStyle: 'preserve-3d' }}
            >
              {/* 卡背 */}
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl"
                style={{ backfaceVisibility: 'hidden', background: 'linear-gradient(135deg,#1e3a8a,#4c1d95)', boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}
              >
                <motion.span
                  className="text-6xl"
                  animate={{ scale: [1, 1.15, 1], rotate: [0, -8, 8, 0] }}
                  transition={{ repeat: Infinity, duration: 2.4 }}
                >
                  ✨
                </motion.span>
                <span className="text-sm font-medium text-white/80 tracking-widest">AI 咒语盲盒</span>
              </div>

              {/* 卡面 */}
              <div
                className="absolute inset-0 rounded-2xl border p-5 flex flex-col"
                style={{
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  background: 'linear-gradient(180deg,#ffffff 0%,#f8fafc 100%)',
                  borderColor: info?.border ?? '#e2e8f0',
                  boxShadow: info ? `0 0 28px ${info.color}55, 0 8px 30px rgba(0,0,0,0.12)` : '0 8px 30px rgba(0,0,0,0.12)',
                }}
              >
                {result && info ? (
                  <>
                    {/* SSR 光效 */}
                    {result.rarity.level === 'SSR' && (
                      <motion.div
                        className="pointer-events-none absolute inset-0 rounded-2xl"
                        style={{ background: 'radial-gradient(circle at 50% 20%, rgba(245,158,11,0.35), transparent 70%)' }}
                        animate={{ opacity: [0.4, 0.9, 0.4] }}
                        transition={{ repeat: Infinity, duration: 1.6 }}
                      />
                    )}
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold line-clamp-1 pr-2">{result.kind === 'idea' ? result.idea.title : result.title}</h3>
                      <RarityBadge level={result.rarity.level} score={result.rarity.score} />
                    </div>
                    <p className="mt-2 flex-1 overflow-hidden text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                      {result.kind === 'idea' ? result.idea.prompt : result.prompt}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span className="inline-flex flex-wrap gap-1">
                        {(result.kind === 'idea' ? result.idea.tags : result.tags).slice(0, 3).map((t) => (
                          <span key={t} className="rounded bg-muted px-1.5 py-0.5">{t}</span>
                        ))}
                      </span>
                      <span>
                        变量 ×{countVariables(result.kind === 'idea' ? result.idea.prompt : result.prompt)}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground/50 text-sm">
                    {showFront ? '…' : '点击下方按钮开始抽卡'}
                  </div>
                )}
              </div>
            </motion.div>

            {/* SSR/SR 呼吸光晕 */}
            {result && info && result.rarity.level !== 'N' && showFront && (
              <motion.div
                className="pointer-events-none absolute -inset-2 rounded-3xl"
                style={{ boxShadow: `0 0 30px ${info.color}` }}
                animate={{ opacity: [0.3, 0.7, 0.3] }}
                transition={{ repeat: Infinity, duration: 2 }}
              />
            )}
          </div>

          {/* 操作按钮 */}
          <div className="flex w-full items-center gap-2">
            {!result || !showFront ? (
              <Button className="flex-1" onClick={handleDraw} disabled={busy || remaining <= 0}>
                <Sparkles strokeWidth={1.5} className="mr-1.5" />
                {busy ? '抽卡中…' : remaining > 0 ? '开始抽卡' : '今日次数已用完'}
              </Button>
            ) : (
              <>
                {result.kind === 'sample' ? (
                  <Button className="flex-1" onClick={handleCollect} disabled={busy}>
                    <BookmarkPlus strokeWidth={1.5} className="mr-1.5" />
                    收藏到金库
                  </Button>
                ) : (
                  <div className="flex-1 rounded-md border border-border bg-muted/40 px-3 py-2 text-center text-xs text-muted-foreground">
                    这是你自己的灵感，已在我的金库中
                  </div>
                )}
                <Button variant="outline" onClick={handleNext} disabled={busy}>
                  下一张
                  <ChevronRight className="size-3.5 ml-1" strokeWidth={1.5} />
                </Button>
              </>
            )}
          </div>

          {remaining <= 0 && !result && (
            <p className="text-xs text-muted-foreground">
              明天再来吧～ 记录新灵感也会让你更有收获
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
