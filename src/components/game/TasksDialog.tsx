/**
 * 每日任务（方向三）：签到 + 每日任务 + 能量领取
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { ClipboardList, Zap, Flame, Check, Gift } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/store';
import { useDailyState, useEnergyAccount } from '@/hooks/useGame';
import { DAILY_TASKS, claimDailyReward, signInIfNeeded } from '@/lib/game';

export function TasksDialog() {
  const isTasksOpen = useStore((s) => s.isTasksOpen);
  const closeTasks = useStore((s) => s.closeTasks);
  const daily = useDailyState();
  const energy = useEnergyAccount();
  const [busy, setBusy] = useState<string | null>(null);

  const handleClaim = async (taskId: string) => {
    setBusy(taskId);
    const ok = await claimDailyReward(taskId);
    setBusy(null);
    if (ok) toast.success('任务奖励已领取，能量 +' + (DAILY_TASKS.find((t) => t.id === taskId)?.reward ?? 0));
  };

  const handleSignIn = async () => {
    setBusy('signin');
    const res = await signInIfNeeded();
    setBusy(null);
    if (res.bonusEnergy > 0) toast.success(`签到成功！连续 ${res.consecutiveDays} 天，能量 +${res.bonusEnergy}`);
  };

  return (
    <Dialog open={isTasksOpen} onOpenChange={(o) => { if (!o) closeTasks(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ClipboardList className="size-5 text-green-600" strokeWidth={1.5} />
            <DialogTitle>每日任务</DialogTitle>
          </div>
          <DialogDescription>
            完成任务获取灵感能量，能量可用来浇灌灵感
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium">
            <Zap className="size-4 text-amber-500" strokeWidth={2} fill="currentColor" />
            能量余额 {energy?.balance ?? 0}
          </span>
          <span className="text-xs text-muted-foreground">累计获得 {energy?.totalEarned ?? 0}</span>
        </div>

        {/* 签到卡 */}
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Flame className={`size-5 ${(daily?.signedIn) ? 'text-orange-500' : 'text-muted-foreground'}`} strokeWidth={1.5} />
            <div>
              <p className="text-sm font-medium">每日签到</p>
              <p className="text-xs text-muted-foreground">已连续签到 {daily?.consecutiveDays ?? 0} 天</p>
            </div>
          </div>
          {daily?.signedIn ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
              <Check className="size-3.5" strokeWidth={2} /> 已签到
            </span>
          ) : (
            <Button size="sm" onClick={handleSignIn} disabled={busy === 'signin'}>
              {busy === 'signin' ? '签到中…' : '去签到 (+5⚡)'}
            </Button>
          )}
        </div>

        {/* 任务列表 */}
        <div className="flex flex-col gap-2 max-h-[40vh] overflow-y-auto pr-1">
          {DAILY_TASKS.filter((t) => !t.hidden || (daily && t.isDone(daily))).map((task) => {
            const done = daily ? task.isDone(daily) : false;
            const claimed = daily ? daily.claimedRewards.includes(task.id) : false;
            return (
              <div
                key={task.id}
                className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 ${done ? 'border-green-500/40 bg-green-500/5' : 'border-border'}`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{task.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{task.desc}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="inline-flex items-center gap-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                    <Zap className="size-3" strokeWidth={2} />+{task.reward}
                  </span>
                  {claimed ? (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Gift className="size-3.5" strokeWidth={1.5} /> 已领取
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant={done ? 'default' : 'outline'}
                      disabled={!done || busy === task.id}
                      onClick={() => handleClaim(task.id)}
                    >
                      {busy === task.id ? '领取中…' : done ? '领取' : '未完成'}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
