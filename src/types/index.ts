export interface Category {
  id?: number;
  name: string;
  icon: string;       // lucide icon name, e.g. "folder", "globe"
  sortOrder: number;
  deletedAt?: Date;
}

export interface Project {
  id?: number;
  categoryId: number;
  name: string;
  description: string;
  createdAt: Date;
  deletedAt?: Date;
}

export interface Idea {
  id?: number;
  projectId: number | null;  // null 表示未分配
  title?: string;          // 可选：为空时用提示词截断作为展示标题
  prompt: string;          // 可含变量占位符
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  isFavorite?: boolean;
  deletedAt?: Date;

  // 养成系统（方向三）
  growthPoints?: number;        // 当前成长值
  growthLevel?: 1 | 2 | 3 | 4 | 5; // 成长等级（缓存，避免每次计算）
  growthUpdatedAt?: Date;       // 上次同步「存活 +1/天」的时间
  editCount?: number;           // 累计有效编辑次数
  copyCount?: number;           // 累计被复制次数

  // 本地 PK（方向五）
  eloRating?: number;           // Elo 战力值
  pkWins?: number;              // 累计胜场
  pkLosses?: number;            // 累计负场
  pkMatches?: number;           // 累计 PK 场次
}

/** 每日状态（主键为 YYYY-MM-DD 字符串），同时服务每日任务与每日上限 */
export interface DailyState {
  date: string;                 // YYYY-MM-DD
  signedIn: boolean;            // 今日是否已签到
  consecutiveDays: number;      // 截至当日连续签到天数
  drawsUsed: number;            // 今日已用抽卡次数
  ideasCreated: number;         // 今日新建灵感数
  ideasEdited: number;          // 今日有效编辑次数
  tagsAdded: number;            // 今日新增标签数
  varsAdded: number;            // 今日新增变量数
  ideasCopied: number;          // 今日复制灵感数
  pkVotes: number;              // 今日 PK 投票数
  claimedRewards: string[];     // 已领取的任务 ID 列表
}

/** 灵感能量账户（单行，id 固定为 1） */
export interface EnergyAccount {
  id: number;
  balance: number;              // 当前能量余额
  totalEarned: number;          // 累计获得
  totalSpent: number;           // 累计消耗
}

/** 成就/徽章记录 */
export interface Achievement {
  id: string;                   // 成就 ID
  unlockedAt?: Date;            // 解锁时间
  progress: number;             // 当前进度
}

/** 本地 PK 对战记录 */
export interface PkMatch {
  id?: number;
  ideaAId: number;
  ideaBId: number;
  winnerId: number | null;      // null = 平局
  aRatingBefore: number;
  bRatingBefore: number;
  aChange: number;
  bChange: number;
  createdAt: Date;
}

export interface Snapshot {
  id?: number;
  createdAt: Date;
  data: string;
}
