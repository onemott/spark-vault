/**
 * 游戏化展示小部件：稀有度角标 / 成长标签
 * 供灵感列表、编辑器、抽卡、图鉴等复用
 */
import { RARITY_INFO, GROWTH_LEVELS, type RarityLevel, getGrowthInfo } from '@/lib/game';

/** 稀有度角标（卡片角落用，紧凑） */
export function RarityBadge({ level, score, compact }: { level: RarityLevel; score?: number; compact?: boolean }) {
  const info = RARITY_INFO[level];
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded font-semibold ${compact ? 'px-1 text-[9px] leading-4' : 'px-1.5 py-0.5 text-[11px]'}`}
      style={{
        color: info.color,
        backgroundColor: info.bg,
        border: `1px solid ${info.color}55`,
        boxShadow: info.glow !== 'none' ? info.glow : undefined,
        letterSpacing: '0.04em',
      }}
      title={score !== undefined ? `${info.name} · 评分 ${score}` : info.name}
    >
      {level}
      {!compact && score !== undefined && <span style={{ opacity: 0.75 }}>{score}</span>}
    </span>
  );
}

/** 稀有度纯色圆点（列表行内用） */
export function RarityDot({ level }: { level: RarityLevel }) {
  const info = RARITY_INFO[level];
  return (
    <span
      className="inline-block size-2 rounded-full shrink-0"
      style={{ backgroundColor: info.color, boxShadow: `0 0 4px ${info.color}` }}
      title={`${info.name} · ${level}`}
    />
  );
}

/** 成长阶段标签（emoji + 名称） */
export function GrowthTag({ level, points, compact }: { level: number; points?: number; compact?: boolean }) {
  const info = getGrowthInfo(level);
  return (
    <span
      className={`inline-flex items-center gap-1 text-muted-foreground ${compact ? 'text-[10px]' : 'text-xs'}`}
      title={points !== undefined ? `${info.name} · 成长值 ${points}` : info.name}
    >
      <span className="text-sm leading-none">{info.icon}</span>
      {!compact && <span>{info.name}</span>}
    </span>
  );
}

/** 成长值 → 等级快速查表（供列表角标） */
export function growthEmoji(level: number): string {
  return GROWTH_LEVELS.find((g) => g.level === level)?.icon ?? '🌰';
}
