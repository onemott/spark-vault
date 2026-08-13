/**
 * 本地 PK（方向五）：两两比较自己的灵感，用 Elo 算法排出战力榜
 */
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Swords, RefreshCw, Trophy } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/store';
import { useAllLiveIdeas, useDailyState, usePkMatches } from '@/hooks/useGame';
import { getPkPair, votePk, getTier, computeRarity, type PkVote } from '@/lib/game';
import { RarityBadge } from './badges';
import type { Idea } from '@/types';

export function PkDialog() {
  const isPkOpen = useStore((s) => s.isPkOpen);
  const closePk = useStore((s) => s.closePk);
  const setSelectedIdeaId = useStore((s) => s.setSelectedIdeaId);
  const openEditor = useStore((s) => s.openEditor);
  const ideas = useAllLiveIdeas();
  const daily = useDailyState();
  const pkMatches = usePkMatches();

  const [pair, setPair] = useState<[Idea, Idea] | null>(null);
  const [phase, setPhase] = useState<'voting' | 'result'>('voting');
  const [lastVote, setLastVote] = useState<{ result: PkVote; aChange: number; bChange: number } | null>(null);
  const [combo, setCombo] = useState(0);

  const loadPair = useCallback(async () => {
    const p = await getPkPair();
    setPair(p);
    setPhase('voting');
    setLastVote(null);
  }, []);

  useEffect(() => {
    if (isPkOpen) loadPair();
  }, [isPkOpen, loadPair]);

  const handleVote = async (result: PkVote) => {
    if (!pair || phase !== 'voting') return;
    const [a, b] = pair;
    const match = await votePk(a, b, result);
    setLastVote({ result, aChange: match.aChange, bChange: match.bChange });
    setPhase('result');
    setCombo((c) => c + 1);
    setTimeout(loadPair, 1300);
  };

  const handleSkip = () => {
    setCombo(0);
    loadPair();
  };

  const openIdea = (ideaId: number) => {
    setSelectedIdeaId(ideaId);
    openEditor(ideaId);
    closePk();
  };

  const leaderboard = [...ideas].sort((x, y) => (y.eloRating ?? 1000) - (x.eloRating ?? 1000)).slice(0, 10);

  return (
    <Dialog open={isPkOpen} onOpenChange={(o) => { if (!o) closePk(); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Swords className="size-5 text-orange-500" strokeWidth={1.5} />
              <DialogTitle>灵感对战</DialogTitle>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              {combo > 0 && <span className="font-semibold text-orange-500">连击 ×{combo}</span>}
              <span>今日已投 {daily?.pkVotes ?? 0} · 累计 {pkMatches.length} 场</span>
            </span>
          </div>
          <DialogDescription>两条灵感放一起，你选哪个更有用？</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 min-w-0">
          {!pair ? (
            <div className="py-10 text-center">
              <Swords className="mx-auto size-10 text-muted-foreground/40" strokeWidth={1.5} />
              <p className="mt-3 text-sm text-muted-foreground">
                至少需要 2 条灵感才能开始 PK，先去记录几条吧
              </p>
            </div>
          ) : (
            <>
              {/* 对战区 */}
              <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2 pt-2">
                {[0, 1].map((idx) => {
                  const idea = pair[idx];
                  const isA = idx === 0;
                  const change = isA ? lastVote?.aChange : lastVote?.bChange;
                  const won = phase === 'result' && lastVote && (lastVote.result === 'a' ? isA : lastVote.result === 'b' ? !isA : null);
                  const tier = getTier(idea.eloRating ?? 1000);
                  return (
                    <motion.div
                      key={idea.id}
                      className="relative min-w-0 cursor-pointer rounded-xl border transition-colors hover:bg-accent/40 overflow-hidden flex flex-col"
                      style={{ borderColor: won === true ? '#22c55e' : won === false ? '#ef4444' : 'var(--border)' }}
                      animate={{ scale: phase === 'result' && won === true ? 1.03 : 1, opacity: phase === 'result' && won === false ? 0.5 : 1 }}
                      transition={{ duration: 0.2 }}
                      onClick={() => phase === 'voting' && handleVote(isA ? 'a' : 'b')}
                    >
                      <div className="flex flex-col gap-2 p-3 flex-1 min-h-0">
                        <div className="flex items-center justify-between gap-1 min-w-0">
                          <span className="text-sm font-medium truncate">{idea.title}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0">{tier.icon} {tier.name}</span>
                        </div>
                        <p className="flex-1 text-xs leading-relaxed text-muted-foreground line-clamp-5 min-h-0 break-words">{idea.prompt}</p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground shrink-0">
                          <RarityBadge level={computeRarity(idea).level} compact />
                          <span className="inline-flex items-center gap-1 font-medium" style={{ color: tier.color }}>
                            ⚔️ {idea.eloRating ?? 1000}
                          </span>
                        </div>
                      </div>
                      {phase === 'result' && change !== undefined && (
                        <motion.span
                          className="absolute -top-2 right-2 rounded-full px-2 py-0.5 text-xs font-bold text-white shadow-md z-10"
                          style={{ backgroundColor: change >= 0 ? '#22c55e' : '#ef4444' }}
                          initial={{ y: 8, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: 0.1 }}
                        >
                          {change >= 0 ? `+${change}` : change}
                        </motion.span>
                      )}
                    </motion.div>
                  );
                })}
                <div className="flex flex-col items-center justify-center">
                  <span className="rounded-full border border-border bg-muted px-2 py-1 text-xs font-bold text-muted-foreground">VS</span>
                </div>
              </div>

              {/* 操作区 */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleSkip} disabled={phase !== 'voting'}>
                  <RefreshCw className="size-3.5 mr-1" strokeWidth={1.5} />
                  换一组
                </Button>
                <div className="flex-1 text-center text-xs text-muted-foreground">
                  {phase === 'voting' ? '👆 点卡片投票：选你更有用的那条' : '已更新战力，即将切换下一组…'}
                </div>
              </div>
            </>
          )}

          {/* 战力榜 */}
          {leaderboard.length > 0 && (
            <div className="rounded-lg border border-border">
              <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
                <Trophy className="size-3.5 text-amber-500" strokeWidth={1.5} />
                <span className="text-xs font-semibold">我的灵感战力榜</span>
              </div>
              <div className="max-h-44 overflow-y-auto">
                {leaderboard.map((idea, i) => {
                  const tier = getTier(idea.eloRating ?? 1000);
                  return (
                    <button
                      key={idea.id}
                      onClick={() => openIdea(idea.id!)}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent/50 transition-colors"
                    >
                      <span className={`w-5 shrink-0 text-center font-bold ${i < 3 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{idea.title}</span>
                      <span className="shrink-0" style={{ color: tier.color }}>{tier.icon}</span>
                      <span className="w-12 shrink-0 text-right font-medium">{idea.eloRating ?? 1000}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
