/**
 * 游戏系统数据 hooks（基于 dexie-react-hooks 的 live query）
 * 数据源：dailyState / energyAccount / achievements / pkMatches / ideas
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Idea, DailyState, EnergyAccount, Achievement, PkMatch } from '@/types';
import {
  todayKey,
  DAILY_FREE_DRAWS,
  SIGN_IN_BONUS_DRAW,
  DAILY_TASKS,
  getForestLevel,
  computeGrowthLevel,
  FOREST_LEVELS,
} from '@/lib/game';

/**
 * 注意：所有 hook 内的 liveQuery 必须是纯读操作（不能在其中创建行/写库），
 * 否则会触发 Dexie「Readwrite transaction in liveQuery context」报错。
 * 今日 dailyState / energyAccount 行由启动时的 initGameSystems() 创建。
 */

/** 今日每日状态（只读；启动后由 initGameSystems 创建） */
export function useDailyState(): DailyState | undefined {
  return useLiveQuery(async () => db.dailyState.get(todayKey()), []);
}

/** 能量账户（只读；启动后由 initGameSystems 创建） */
export function useEnergyAccount(): EnergyAccount | undefined {
  return useLiveQuery(async () => db.energyAccount.get(1), []);
}

/** 今日抽卡剩余次数 */
export function useDrawStatus(): { remaining: number; total: number; used: number; signedIn: boolean } | undefined {
  return useLiveQuery(async () => {
    const row = await db.dailyState.get(todayKey());
    const total = DAILY_FREE_DRAWS + (row?.signedIn ? SIGN_IN_BONUS_DRAW : 0);
    return {
      remaining: Math.max(0, total - (row?.drawsUsed ?? 0)),
      total,
      used: row?.drawsUsed ?? 0,
      signedIn: !!row?.signedIn,
    };
  }, []);
}

/** 全部成就记录（含未解锁的进度） */
export function useAchievements(): Achievement[] {
  return useLiveQuery(() => db.achievements.toArray(), []) ?? [];
}

/** 本地 PK 对局记录（倒序） */
export function usePkMatches(): PkMatch[] {
  return useLiveQuery(() => db.pkMatches.orderBy('createdAt').reverse().toArray(), []) ?? [];
}

/** 所有未删除灵感 */
export function useAllLiveIdeas(): Idea[] {
  return useLiveQuery(() => db.ideas.filter((i) => !i.deletedAt).toArray(), []) ?? [];
}

/** 今日已完成但尚未领取的任务 id 列表（用于红点提示） */
export function useClaimableTaskIds(): string[] {
  const daily = useDailyState();
  if (!daily) return [];
  return DAILY_TASKS.filter((t) => !daily.claimedRewards.includes(t.id) && t.isDone(daily)).map((t) => t.id);
}

/** 灵感森林统计：总成长值 / 森林等级 / 各成长阶段数量 */
export function useForestStats(): {
  totalGrowth: number;
  totalIdeas: number;
  forestLevel: number;
  forestLevelInfo: (typeof FOREST_LEVELS)[number];
  counts: Record<number, number>;
} {
  const ideas = useAllLiveIdeas();
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let totalGrowth = 0;
  for (const idea of ideas) {
    const g = idea.growthPoints ?? 0;
    totalGrowth += g;
    const lvl = idea.growthLevel ?? computeGrowthLevel(g);
    counts[lvl] = (counts[lvl] ?? 0) + 1;
  }
  const forestLevel = getForestLevel(totalGrowth);
  const forestLevelInfo = FOREST_LEVELS.find((f) => f.level === forestLevel) ?? FOREST_LEVELS[0];
  return { totalGrowth, totalIdeas: ideas.length, forestLevel, forestLevelInfo, counts };
}
