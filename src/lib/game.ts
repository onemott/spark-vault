/**
 * 游戏化核心逻辑（方向一/三/五）
 * 纯前端 + IndexedDB 实现：稀有度、成长值、能量、每日任务、签到、成就、抽卡、Elo PK、森林布局。
 * 所有写操作封装成独立函数，UI 层直接调用。
 */
import { db } from '@/lib/db';
import { Idea, DailyState, EnergyAccount, Achievement, PkMatch } from '@/types';
import { SAMPLE_PROMPTS } from '@/lib/samplePrompts';

/* ------------------------------------------------------------------ */
/* 日期工具                                                            */
/* ------------------------------------------------------------------ */

export function todayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dateKeyWithOffset(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return todayKey(d);
}

/* ------------------------------------------------------------------ */
/* 稀有度（方向一）                                                    */
/* ------------------------------------------------------------------ */

export type RarityLevel = 'N' | 'R' | 'SR' | 'SSR';

export const RARITY_INFO: Record<RarityLevel, { name: string; color: string; bg: string; border: string; glow: string }> = {
  N:   { name: '普通', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)',  border: '#94a3b8',  glow: 'none' },
  R:   { name: '稀有', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  border: '#3b82f6',  glow: '0 0 12px rgba(59,130,246,0.35)' },
  SR:  { name: '史诗', color: '#a855f7', bg: 'rgba(168,85,247,0.14)',  border: '#a855f7',  glow: '0 0 16px rgba(168,85,247,0.45)' },
  SSR: { name: '传说', color: '#f59e0b', bg: 'rgba(245,158,11,0.16)',  border: '#f59e0b',  glow: '0 0 22px rgba(245,158,11,0.6)' },
};

export function countVariables(prompt: string): number {
  const m = prompt.match(/\{\{(\w+)\}\}/g);
  return m ? m.length : 0;
}

/**
 * 稀有度评分算法：基础分 + 变量 + 长度 + 标签 + 结构 + 标题
 * N ≤20 / R 21-35 / SR 36-55 / SSR ≥56
 */
export function computeRarity(idea: Pick<Idea, 'prompt' | 'tags' | 'title'>): { score: number; level: RarityLevel } {
  let score = 10;
  score += countVariables(idea.prompt) * 8;
  score += Math.min(Math.floor(idea.prompt.length / 50) * 2, 10);
  score += Math.min((idea.tags ?? []).length * 3, 9);
  if (idea.prompt.split('\n').filter((l) => l.trim()).length >= 3) score += 5;
  if (idea.title && idea.title.trim().length > 0 && idea.prompt.slice(0, 30) !== idea.title) score += 3;

  let level: RarityLevel;
  if (score >= 56) level = 'SSR';
  else if (score >= 36) level = 'SR';
  else if (score >= 21) level = 'R';
  else level = 'N';
  return { score, level };
}

/* ------------------------------------------------------------------ */
/* 成长系统（方向三）                                                  */
/* ------------------------------------------------------------------ */

export const GROWTH_LEVELS = [
  { level: 1, name: '种子', icon: '🌰', min: 0 },
  { level: 2, name: '嫩芽', icon: '🌱', min: 20 },
  { level: 3, name: '幼苗', icon: '🌿', min: 60 },
  { level: 4, name: '大树', icon: '🌳', min: 150 },
  { level: 5, name: '古树', icon: '🌲', min: 350 },
] as const;

export type GrowthLevel = 1 | 2 | 3 | 4 | 5;

export function computeGrowthLevel(points: number): GrowthLevel {
  let lvl: GrowthLevel = 1;
  for (const g of GROWTH_LEVELS) {
    if (points >= g.min) lvl = g.level as GrowthLevel;
  }
  return lvl;
}

export function getGrowthInfo(level: number): { level: number; name: string; icon: string; min: number } {
  return GROWTH_LEVELS.find((g) => g.level === level) ?? GROWTH_LEVELS[0];
}

/** 新建灵感的成长默认值（20 分直接到嫩芽） */
export function newIdeaGrowthDefaults(createdAt: Date) {
  return { growthPoints: 20, growthLevel: 2 as GrowthLevel, growthUpdatedAt: createdAt, editCount: 0, copyCount: 0 };
}

/** 给单条灵感追加成长值并重算等级 */
async function addGrowth(ideaId: number, points: number): Promise<void> {
  const idea = await db.ideas.get(ideaId);
  if (!idea) return;
  const next = Math.max(0, (idea.growthPoints ?? 0) + points);
  await db.ideas.update(ideaId, {
    growthPoints: next,
    growthLevel: computeGrowthLevel(next),
  });
}

/** 记录「新建灵感」：+20 成长 + 计数 + 成就 */
export async function recordIdeaCreated(ideaId: number): Promise<void> {
  const idea = await db.ideas.get(ideaId);
  if (!idea) return;
  if (idea.growthPoints === undefined) {
    await db.ideas.update(ideaId, newIdeaGrowthDefaults(idea.createdAt));
  }
  await bumpDailyCount('ideasCreated');
  await checkAchievements();
}

/**
 * 记录「编辑灵感」：按增量给成长（带每日上限）
 * - 有效编辑（内容变化） +2/次，上限 +10/天
 * - 新增标签 +3/个，上限 +9/天
 * - 新增变量 +5/个，上限 +15/天
 */
export async function recordIdeaEdited(
  ideaId: number,
  diff: { promptChanged: boolean; newTags: number; newVars: number }
): Promise<void> {
  const idea = await db.ideas.get(ideaId);
  if (!idea) return;
  const row = await ensureDailyState();

  let growth = 0;
  const upd: Partial<DailyState> = {};
  if (diff.promptChanged && row.ideasEdited < 5) {
    growth += 2;
    upd.ideasEdited = row.ideasEdited + 1;
  }
  if (diff.newTags > 0) {
    const allowed = Math.max(0, 3 - row.tagsAdded);
    growth += Math.min(diff.newTags, allowed) * 3;
    upd.tagsAdded = row.tagsAdded + diff.newTags;
  }
  if (diff.newVars > 0) {
    const allowed = Math.max(0, 3 - row.varsAdded);
    growth += Math.min(diff.newVars, allowed) * 5;
    upd.varsAdded = row.varsAdded + diff.newVars;
  }

  if (Object.keys(upd).length > 0) await db.dailyState.update(row.date, upd);
  if (growth > 0) {
    const next = Math.max(0, (idea.growthPoints ?? 0) + growth);
    await db.ideas.update(ideaId, {
      growthPoints: next,
      growthLevel: computeGrowthLevel(next),
      editCount: (idea.editCount ?? 0) + (diff.promptChanged ? 1 : 0),
    });
  }
  await checkAchievements();
}

/** 记录「复制」：+10 成长，上限 +50/天；累计 copyCount 无上限 */
export async function recordCopy(ideaId: number): Promise<void> {
  const idea = await db.ideas.get(ideaId);
  if (!idea) return;
  const row = await ensureDailyState();
  await db.dailyState.update(row.date, { ideasCopied: row.ideasCopied + 1 });

  const base = { copyCount: (idea.copyCount ?? 0) + 1 };
  if (row.ideasCopied < 5) {
    const next = Math.max(0, (idea.growthPoints ?? 0) + 10);
    await db.ideas.update(ideaId, { ...base, growthPoints: next, growthLevel: computeGrowthLevel(next) });
  } else {
    await db.ideas.update(ideaId, base);
  }
  await checkAchievements();
}

/**
 * 启动/打开时增量同步「存活 +1/天」（时间的重量）。
 * 距离上次同步每过一个自然日，给灵感 +1 成长。
 */
export async function syncDailyGrowth(): Promise<void> {
  const ideas = await db.ideas.filter((i) => !i.deletedAt).toArray();
  const now = new Date();
  const DAY = 24 * 60 * 60 * 1000;
  for (const idea of ideas) {
    const base = idea.growthUpdatedAt ?? idea.createdAt;
    const baseTime = base instanceof Date ? base.getTime() : new Date(base as unknown as string).getTime();
    const elapsed = Math.floor((now.getTime() - baseTime) / DAY);
    if (elapsed > 0) {
      const next = Math.max(0, (idea.growthPoints ?? 0) + elapsed);
      await db.ideas.update(idea.id!, {
        growthPoints: next,
        growthLevel: computeGrowthLevel(next),
        growthUpdatedAt: now,
      });
    }
  }
}

/** 浇灌：消耗 10 能量，给单条灵感 +10 成长 */
export async function waterIdea(ideaId: number): Promise<boolean> {
  const ok = await spendEnergy(10);
  if (!ok) return false;
  await addGrowth(ideaId, 10);
  await checkAchievements();
  return true;
}

/** 春雨：消耗 100 能量，所有灵感 +5 成长 */
export async function springRain(): Promise<boolean> {
  const ok = await spendEnergy(100);
  if (!ok) return false;
  const ideas = await db.ideas.filter((i) => !i.deletedAt).toArray();
  for (const idea of ideas) {
    const next = Math.max(0, (idea.growthPoints ?? 0) + 5);
    await db.ideas.update(idea.id!, { growthPoints: next, growthLevel: computeGrowthLevel(next) });
  }
  await checkAchievements();
  return true;
}

/* ------------------------------------------------------------------ */
/* 每日状态                                                            */
/* ------------------------------------------------------------------ */

export async function ensureDailyState(): Promise<DailyState> {
  const key = todayKey();
  let row = await db.dailyState.get(key);
  if (!row) {
    const prev = await db.dailyState.get(dateKeyWithOffset(1));
    row = {
      date: key,
      signedIn: false,
      consecutiveDays: prev && prev.consecutiveDays > 0 ? prev.consecutiveDays : 0,
      drawsUsed: 0,
      ideasCreated: 0,
      ideasEdited: 0,
      tagsAdded: 0,
      varsAdded: 0,
      ideasCopied: 0,
      pkVotes: 0,
      claimedRewards: [],
    };
    await db.dailyState.add(row);
  }
  return row;
}

/** 递增今日某个计数（用于任务/上限统计） */
export async function bumpDailyCount(field: keyof Pick<DailyState, 'ideasCreated' | 'ideasEdited' | 'tagsAdded' | 'varsAdded' | 'ideasCopied' | 'pkVotes'>, amount = 1): Promise<void> {
  const row = await ensureDailyState();
  const patch: Partial<DailyState> = { [field]: (row[field] as number) + amount };
  await db.dailyState.update(row.date, patch);
}

/* ------------------------------------------------------------------ */
/* 签到（方向一/三）                                                   */
/* ------------------------------------------------------------------ */

/**
 * 每天打开应用自动签到：连续天数 + 签到奖励（+5 能量、+1 抽卡次数）。
 * 同一自然日只生效一次。
 */
export async function signInIfNeeded(): Promise<{ signedIn: boolean; consecutiveDays: number; bonusEnergy: number }> {
  const row = await ensureDailyState();
  if (row.signedIn) return { signedIn: true, consecutiveDays: row.consecutiveDays, bonusEnergy: 0 };

  const prev = await db.dailyState.get(dateKeyWithOffset(1));
  const consecutiveDays = prev && prev.signedIn ? (prev.consecutiveDays ?? 0) + 1 : 1;
  await db.dailyState.update(row.date, { signedIn: true, consecutiveDays });
  await addEnergy(5);
  await checkAchievements();
  return { signedIn: true, consecutiveDays, bonusEnergy: 5 };
}

/** 统计最近连续「每天都抽过卡」的天数（用于七日连抽成就） */
export async function getConsecutiveDrawDays(): Promise<number> {
  let streak = 0;
  for (let i = 0; i < 30; i++) {
    const row = await db.dailyState.get(dateKeyWithOffset(i));
    if (row && row.drawsUsed > 0) streak += 1;
    else break;
  }
  return streak;
}

/* ------------------------------------------------------------------ */
/* 能量账户                                                            */
/* ------------------------------------------------------------------ */

export async function getEnergyAccount(): Promise<EnergyAccount> {
  let acct = await db.energyAccount.get(1);
  if (!acct) {
    acct = { id: 1, balance: 0, totalEarned: 0, totalSpent: 0 };
    await db.energyAccount.add(acct);
  }
  return acct;
}

export async function addEnergy(amount: number): Promise<void> {
  const acct = await getEnergyAccount();
  await db.energyAccount.update(1, {
    balance: acct.balance + amount,
    totalEarned: acct.totalEarned + amount,
  });
}

export async function spendEnergy(amount: number): Promise<boolean> {
  const acct = await getEnergyAccount();
  if (acct.balance < amount) return false;
  await db.energyAccount.update(1, {
    balance: acct.balance - amount,
    totalSpent: acct.totalSpent + amount,
  });
  return true;
}

/* ------------------------------------------------------------------ */
/* 每日任务（方向三）                                                  */
/* ------------------------------------------------------------------ */

export interface DailyTaskDef {
  id: string;
  name: string;
  desc: string;
  reward: number;
  hidden?: boolean;
  isDone: (row: DailyState) => boolean;
}

export const DAILY_TASKS: DailyTaskDef[] = [
  { id: 'signin', name: '每日签到', desc: '打开应用即算签到', reward: 5, isDone: (r) => r.signedIn },
  { id: 'create', name: '记录新灵感', desc: '新建 1 条灵感', reward: 15, isDone: (r) => r.ideasCreated >= 1 },
  { id: 'edit', name: '打磨旧灵感', desc: '编辑任意一条已有灵感', reward: 10, isDone: (r) => r.ideasEdited >= 1 },
  { id: 'tag', name: '整理标签', desc: '给任意灵感添加 1 个标签', reward: 8, isDone: (r) => r.tagsAdded >= 1 },
  { id: 'copy', name: '复制使用', desc: '复制任意灵感的提示词', reward: 8, isDone: (r) => r.ideasCopied >= 1 },
  {
    id: 'combo',
    name: '三连击',
    desc: '同一天记录 + 编辑 + 复制',
    reward: 10,
    hidden: true,
    isDone: (r) => r.ideasCreated >= 1 && r.ideasEdited >= 1 && r.ideasCopied >= 1,
  },
];

/** 领取任务奖励：能量入账并标记已领取 */
export async function claimDailyReward(taskId: string): Promise<boolean> {
  const row = await ensureDailyState();
  const task = DAILY_TASKS.find((t) => t.id === taskId);
  if (!task || row.claimedRewards.includes(taskId) || !task.isDone(row)) return false;
  await db.dailyState.update(row.date, { claimedRewards: [...row.claimedRewards, taskId] });
  await addEnergy(task.reward);
  return true;
}

/** 是否有可领取的任务奖励（侧栏小红点） */
export async function hasClaimableRewards(): Promise<boolean> {
  const row = await ensureDailyState();
  return DAILY_TASKS.some((t) => !row.claimedRewards.includes(t.id) && t.isDone(row));
}

/* ------------------------------------------------------------------ */
/* 成就/徽章（方向一/三）                                              */
/* ------------------------------------------------------------------ */

interface AchievementCtx {
  ideaCount: number;
  ssrCount: number;
  distinctTags: number;
  totalVars: number;
  maxGrowth: number;
  maxLevel: number;
  treeCount: number;
  ancientCount: number;
  categoryCount: number;
  projectCount: number;
  consecutiveDays: number;
  drawStreak: number;
}

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  group: '成长' | '习惯' | '探索' | '收集';
  target: number;
  progress: (ctx: AchievementCtx) => number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'growth_seed', name: '第一颗种子', desc: '拥有第一条灵感', icon: '🌰', group: '成长', target: 1, progress: (c) => c.ideaCount },
  { id: 'growth_sprout', name: '萌芽', desc: '拥有第一条嫩芽灵感', icon: '🌱', group: '成长', target: 1, progress: (c) => (c.maxLevel >= 2 ? 1 : 0) },
  { id: 'growth_tree', name: '初见森林', desc: '拥有第一条大树灵感', icon: '🌳', group: '成长', target: 1, progress: (c) => (c.treeCount >= 1 ? 1 : 0) },
  { id: 'growth_ancient', name: '古树守护者', desc: '拥有第一条古树灵感', icon: '🌲', group: '成长', target: 1, progress: (c) => (c.ancientCount >= 1 ? 1 : 0) },
  { id: 'growth_small', name: '小森林', desc: '拥有 10 条灵感', icon: '🏞️', group: '成长', target: 10, progress: (c) => c.ideaCount },
  { id: 'growth_large', name: '大森林', desc: '拥有 50 条灵感', icon: '🌳🌳', group: '成长', target: 50, progress: (c) => c.ideaCount },
  { id: 'growth_ancient5', name: '古树群', desc: '拥有 5 条古树灵感', icon: '🏛️', group: '成长', target: 5, progress: (c) => c.ancientCount },
  { id: 'habit_week', name: '七日之约', desc: '连续 7 天签到', icon: '🔥', group: '习惯', target: 7, progress: (c) => c.consecutiveDays },
  { id: 'habit_month', name: '月度达人', desc: '连续 30 天签到', icon: '📅', group: '习惯', target: 30, progress: (c) => c.consecutiveDays },
  { id: 'habit_draw7', name: '七日连抽', desc: '连续 7 天每天都抽卡', icon: '🎴', group: '习惯', target: 7, progress: (c) => c.drawStreak },
  { id: 'explore_template', name: '模板大师', desc: '灵感中累计使用 50 个变量', icon: '🧩', group: '探索', target: 50, progress: (c) => c.totalVars },
  { id: 'explore_tags', name: '标签收藏家', desc: '使用过 30 种不同的标签', icon: '🏷️', group: '探索', target: 30, progress: (c) => c.distinctTags },
  { id: 'explore_category', name: '分类管理大师', desc: '创建 10 个分类', icon: '📂', group: '探索', target: 10, progress: (c) => c.categoryCount },
  { id: 'explore_project', name: '项目达人', desc: '创建 20 个项目', icon: '📁', group: '探索', target: 20, progress: (c) => c.projectCount },
  { id: 'collect_ssr', name: '第一个 SSR', desc: '获得第一条传说级灵感', icon: '✨', group: '收集', target: 1, progress: (c) => (c.ssrCount >= 1 ? 1 : 0) },
  { id: 'collect_ssr5', name: 'SSR 收藏家', desc: '收集 5 条传说级灵感', icon: '💎', group: '收集', target: 5, progress: (c) => c.ssrCount },
];

async function collectAchievementCtx(): Promise<AchievementCtx> {
  const ideas = await db.ideas.filter((i) => !i.deletedAt).toArray();
  const daily = await ensureDailyState();
  const cats = await db.categories.filter((c) => !c.deletedAt).toArray();
  const projects = await db.projects.filter((p) => !p.deletedAt).toArray();

  const tagSet = new Set<string>();
  let totalVars = 0;
  let maxGrowth = 0;
  let maxLevel = 1;
  let treeCount = 0;
  let ancientCount = 0;
  let ssrCount = 0;

  for (const idea of ideas) {
    for (const t of idea.tags ?? []) tagSet.add(t);
    totalVars += countVariables(idea.prompt);
    const g = idea.growthPoints ?? 0;
    if (g > maxGrowth) maxGrowth = g;
    const lvl = idea.growthLevel ?? computeGrowthLevel(g);
    if (lvl > maxLevel) maxLevel = lvl;
    if (lvl >= 4) treeCount += 1;
    if (lvl >= 5) ancientCount += 1;
    if (computeRarity(idea).level === 'SSR') ssrCount += 1;
  }

  const [drawStreak] = await Promise.all([getConsecutiveDrawDays()]);

  return {
    ideaCount: ideas.length,
    ssrCount,
    distinctTags: tagSet.size,
    totalVars,
    maxGrowth,
    maxLevel,
    treeCount,
    ancientCount,
    categoryCount: cats.length,
    projectCount: projects.length,
    consecutiveDays: daily.consecutiveDays,
    drawStreak,
  };
}

/**
 * 校验全部成就进度，返回本次新解锁的成就 id 列表。
 * 未解锁的成就也会记录进度（用于进度条展示）。
 */
export async function checkAchievements(): Promise<string[]> {
  const ctx = await collectAchievementCtx();
  const newly: string[] = [];

  for (const def of ACHIEVEMENTS) {
    const raw = def.progress(ctx);
    const progress = Math.max(0, Math.min(raw, def.target));
    const unlocked = raw >= def.target;
    const rec = await db.achievements.get(def.id);

    if (unlocked && !rec?.unlockedAt) {
      await db.achievements.put({ id: def.id, unlockedAt: new Date(), progress });
      newly.push(def.id);
    } else if (rec && rec.progress !== progress) {
      await db.achievements.update(def.id, { progress });
    } else if (!rec) {
      await db.achievements.put({ id: def.id, progress });
    }
  }

  return newly;
}

/* ------------------------------------------------------------------ */
/* 每日抽卡（方向一）                                                  */
/* ------------------------------------------------------------------ */

export const DAILY_FREE_DRAWS = 3;
export const SIGN_IN_BONUS_DRAW = 1;

export async function getDrawsRemaining(): Promise<{ remaining: number; total: number; used: number; signedIn: boolean }> {
  const row = await ensureDailyState();
  const total = DAILY_FREE_DRAWS + (row.signedIn ? SIGN_IN_BONUS_DRAW : 0);
  return { remaining: Math.max(0, total - row.drawsUsed), total, used: row.drawsUsed, signedIn: row.signedIn };
}

/** 消耗一次抽卡次数；次数不足返回 false */
export async function useDraw(): Promise<boolean> {
  const { remaining } = await getDrawsRemaining();
  if (remaining <= 0) return false;
  const row = await ensureDailyState();
  await db.dailyState.update(row.date, { drawsUsed: row.drawsUsed + 1 });
  return true;
}

export interface DrawnIdea {
  kind: 'idea';
  idea: Idea;
  rarity: { score: number; level: RarityLevel };
}
export interface DrawnSample {
  kind: 'sample';
  title: string;
  prompt: string;
  tags: string[];
  rarity: { score: number; level: RarityLevel };
}
export type DrawResult = DrawnIdea | DrawnSample;

/**
 * 从个人灵感库加权随机抽一张（稀有度越低权重越高）。
 * 卡池为空时回退到内置示例灵感。
 */
export async function drawFromPool(): Promise<DrawResult> {
  const ideas = await db.ideas.filter((i) => !i.deletedAt).toArray();

  if (ideas.length === 0) {
    const sample = SAMPLE_PROMPTS[Math.floor(Math.random() * SAMPLE_PROMPTS.length)];
    const rarity = computeRarity({ prompt: sample.prompt, tags: sample.tags, title: sample.title });
    return { kind: 'sample', title: sample.title, prompt: sample.prompt, tags: sample.tags, rarity };
  }

  const weights = ideas.map((idea) => {
    const level = computeRarity(idea).level;
    switch (level) {
      case 'SSR': return 1;
      case 'SR': return 4;
      case 'R': return 10;
      default: return 20;
    }
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let rand = Math.random() * total;
  let idx = ideas.length - 1;
  for (let i = 0; i < ideas.length; i++) {
    rand -= weights[i];
    if (rand <= 0) { idx = i; break; }
  }
  const idea = ideas[idx];
  return { kind: 'idea', idea, rarity: computeRarity(idea) };
}

/** 把抽到的示例灵感收藏到金库（新建为未分配灵感） */
export async function collectSampleIdea(drawn: DrawnSample): Promise<number> {
  const now = new Date();
  const id = await db.ideas.add({
    projectId: null,
    title: drawn.title,
    prompt: drawn.prompt,
    tags: drawn.tags,
    createdAt: now,
    updatedAt: now,
    isFavorite: false,
    ...newIdeaGrowthDefaults(now),
    eloRating: 1000,
    pkWins: 0,
    pkLosses: 0,
    pkMatches: 0,
  });
  await bumpDailyCount('ideasCreated');
  await checkAchievements();
  return id;
}

/* ------------------------------------------------------------------ */
/* 本地 PK / Elo 战力（方向五）                                        */
/* ------------------------------------------------------------------ */

export function expectedScore(a: number, b: number): number {
  return 1 / (1 + Math.pow(10, (b - a) / 400));
}

/** Elo 战力变化：K=32（新手，<20 场）/ K=16（稳定） */
export function eloChange(rating: number, opponent: number, result: 1 | 0.5 | 0, matches: number): number {
  const k = matches < 20 ? 32 : 16;
  return Math.round(k * (result - expectedScore(rating, opponent)));
}

export const TIERS = [
  { min: 2200, name: '王者', icon: '👑👑', color: '#f59e0b' },
  { min: 2000, name: '大师', icon: '👑', color: '#a855f7' },
  { min: 1800, name: '钻石', icon: '💎', color: '#3b82f6' },
  { min: 1600, name: '铂金', icon: '💠', color: '#67e8f9' },
  { min: 1400, name: '黄金', icon: '🟡', color: '#eab308' },
  { min: 1200, name: '白银', icon: '⚪', color: '#cbd5e1' },
  { min: 0, name: '青铜', icon: '🟤', color: '#a16207' },
];

export function getTier(rating: number): { min: number; name: string; icon: string; color: string } {
  return TIERS.find((t) => rating >= t.min) ?? TIERS[TIERS.length - 1];
}

export type PkVote = 'a' | 'b' | 'tie';

/** 投出一票：更新双方 Elo 战力并记录 PK 对局 */
export async function votePk(ideaA: Idea, ideaB: Idea, result: PkVote): Promise<PkMatch> {
  const a = ideaA.eloRating ?? 1000;
  const b = ideaB.eloRating ?? 1000;
  const aMatches = ideaA.pkMatches ?? 0;
  const bMatches = ideaB.pkMatches ?? 0;

  const aResult = result === 'a' ? 1 : result === 'tie' ? 0.5 : 0;
  const bResult = result === 'b' ? 1 : result === 'tie' ? 0.5 : 0;
  const aChange = eloChange(a, b, aResult, aMatches);
  const bChange = eloChange(b, a, bResult, bMatches);

  const aWins = result === 'a' ? 1 : 0;
  const bWins = result === 'b' ? 1 : 0;

  await db.ideas.update(ideaA.id!, {
    eloRating: a + aChange,
    pkMatches: aMatches + 1,
    pkWins: (ideaA.pkWins ?? 0) + aWins,
    pkLosses: (ideaA.pkLosses ?? 0) + (result === 'b' ? 1 : 0),
  });
  await db.ideas.update(ideaB.id!, {
    eloRating: b + bChange,
    pkMatches: bMatches + 1,
    pkWins: (ideaB.pkWins ?? 0) + bWins,
    pkLosses: (ideaB.pkLosses ?? 0) + (result === 'a' ? 1 : 0),
  });

  const match: PkMatch = {
    ideaAId: ideaA.id!,
    ideaBId: ideaB.id!,
    winnerId: result === 'a' ? ideaA.id! : result === 'b' ? ideaB.id! : null,
    aRatingBefore: a,
    bRatingBefore: b,
    aChange,
    bChange,
    createdAt: new Date(),
  };
  const id = await db.pkMatches.add(match);
  await bumpDailyCount('pkVotes');
  return { ...match, id };
}

/** 随机挑选一对（尽量不同的）灵感用于 PK；不足 2 条返回 null */
export async function getPkPair(): Promise<[Idea, Idea] | null> {
  const ideas = await db.ideas.filter((i) => !i.deletedAt).toArray();
  if (ideas.length < 2) return null;
  const aIdx = Math.floor(Math.random() * ideas.length);
  let bIdx = Math.floor(Math.random() * (ideas.length - 1));
  if (bIdx >= aIdx) bIdx += 1;
  return [ideas[aIdx], ideas[bIdx]];
}

/* ------------------------------------------------------------------ */
/* 灵感森林（方向三）                                                  */
/* ------------------------------------------------------------------ */

export const FOREST_LEVELS = [
  { level: 1, name: '荒原', bg: 'linear-gradient(180deg,#d9c9a5 0%,#c9b180 100%)' },
  { level: 2, name: '草地', bg: 'linear-gradient(180deg,#b7e0a5 0%,#8fce7c 100%)' },
  { level: 3, name: '树林', bg: 'linear-gradient(180deg,#8fd09a 0%,#5aa86e 100%)' },
  { level: 4, name: '森林', bg: 'linear-gradient(180deg,#6fbf8f 0%,#2f8f57 100%)' },
  { level: 5, name: '秘境森林', bg: 'linear-gradient(180deg,#5aa8d8 0%,#2f6f9f 100%)' },
];

export function getForestLevel(totalGrowth: number): number {
  if (totalGrowth >= 5000) return 5;
  if (totalGrowth >= 2000) return 4;
  if (totalGrowth >= 500) return 3;
  if (totalGrowth >= 100) return 2;
  return 1;
}

function hashId(id: number): number {
  let h = (id * 2654435761) >>> 0;
  h = (h ^ (h >> 16)) >>> 0;
  return h;
}

export interface ForestTree {
  ideaId: number;
  x: number;      // 0-100 (%)
  y: number;      // 0-100 (%)
  size: number;   // px
  level: GrowthLevel;
}

/**
 * 森林布局：高等级树靠后（偏上、更大），低等级靠前；位置由灵感 id 确定性伪随机决定。
 */
export function generateForestLayout(ideas: Idea[]): ForestTree[] {
  const buckets: Record<number, Idea[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  for (const idea of ideas) {
    const lvl = idea.growthLevel ?? computeGrowthLevel(idea.growthPoints ?? 0);
    (buckets[lvl] ?? (buckets[lvl] = [])).push(idea);
  }
  const yBias: Record<number, number> = { 5: 0.14, 4: 0.24, 3: 0.44, 2: 0.64, 1: 0.8 };
  const sizeMap: Record<number, number> = { 1: 22, 2: 30, 3: 40, 4: 54, 5: 72 };

  const trees: ForestTree[] = [];
  for (let lvl = 5; lvl >= 1; lvl--) {
    for (const idea of buckets[lvl]) {
      const seed = hashId(idea.id!);
      const x = 8 + (seed % 84);
      const y = yBias[lvl] + (((seed >> 8) % 100) / 100 - 0.5) * 0.26;
      trees.push({
        ideaId: idea.id!,
        x,
        y: Math.max(0.04, Math.min(0.96, y)),
        size: sizeMap[lvl],
        level: lvl as GrowthLevel,
      });
    }
  }
  return trees;
}

/* ------------------------------------------------------------------ */
/* 启动初始化                                                          */
/* ------------------------------------------------------------------ */

/** 应用启动时同步一次全部游戏系统：签到 + 存活成长 + 成就校验 */
export async function initGameSystems(): Promise<string[]> {
  try {
    await signInIfNeeded();
    await syncDailyGrowth();
    return await checkAchievements();
  } catch (e) {
    console.warn('[SparkVault] 游戏系统初始化失败:', e);
    return [];
  }
}

export type { Achievement, PkMatch };
