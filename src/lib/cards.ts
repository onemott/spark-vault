/**
 * 灵感卡片美学（方向四）
 * 模板均为「配置 + 内联样式」，颜色全部用 hex/rgb，避免 oklch 影响截图库解析。
 * 导出使用 html-to-image（foreignObject 方案，兼容现代 CSS 颜色与渐变）。
 */
import { toPng } from 'html-to-image';
import type { CSSProperties } from 'react';

export interface CardTemplate {
  id: string;
  name: string;
  category: '简约' | '渐变';
  background: {
    type: 'solid' | 'gradient';
    color?: string;
    gradient?: { direction: string; colors: string[] };
  };
  titleColor: string;
  bodyColor: string;
  tagBg: string;
  tagColor: string;
  accentColor: string;
  align: 'left' | 'center';
  /** 卡片底板（可选，承载内容的半透明块） */
  cardBg?: string;
}

export const CARD_TEMPLATES: CardTemplate[] = [
  {
    id: 'minimal-white', name: '极简白', category: '简约',
    background: { type: 'solid', color: '#ffffff' },
    titleColor: '#111827', bodyColor: '#4b5563', tagBg: '#f3f4f6', tagColor: '#111827', accentColor: '#9ca3af',
    align: 'left',
  },
  {
    id: 'midnight-black', name: '午夜黑', category: '简约',
    background: { type: 'solid', color: '#0b0f1a' },
    titleColor: '#f9fafb', bodyColor: '#cbd5e1', tagBg: 'rgba(255,255,255,0.10)', tagColor: '#e5e7eb', accentColor: '#6b7280',
    align: 'left',
  },
  {
    id: 'rice-paper', name: '米黄纸', category: '简约',
    background: { type: 'solid', color: '#faf6ec' },
    titleColor: '#3f2d1d', bodyColor: '#6b5847', tagBg: '#eee5d3', tagColor: '#4a3728', accentColor: '#b0a48a',
    align: 'left',
  },
  {
    id: 'cream', name: '奶油', category: '简约',
    background: { type: 'solid', color: '#fff7ea' },
    titleColor: '#7c4a1d', bodyColor: '#8a6b4a', tagBg: '#fde8cd', tagColor: '#7c4a1d', accentColor: '#e0a866',
    align: 'left',
  },
  {
    id: 'sunset', name: '日落橙紫', category: '渐变',
    background: { type: 'gradient', gradient: { direction: '135deg', colors: ['#ff9a5a', '#7b2ff7'] } },
    titleColor: '#ffffff', bodyColor: 'rgba(255,255,255,0.92)', tagBg: 'rgba(255,255,255,0.20)', tagColor: '#ffffff', accentColor: 'rgba(255,255,255,0.72)',
    align: 'center',
  },
  {
    id: 'mint', name: '薄荷绿', category: '渐变',
    background: { type: 'gradient', gradient: { direction: '135deg', colors: ['#d4f7e8', '#7ce0c0'] } },
    titleColor: '#0d4f3a', bodyColor: '#17614a', tagBg: 'rgba(13,79,58,0.10)', tagColor: '#0d4f3a', accentColor: '#2b8a66',
    align: 'center',
  },
  {
    id: 'cosmic', name: '宇宙蓝', category: '渐变',
    background: { type: 'gradient', gradient: { direction: '135deg', colors: ['#0f2027', '#203a43', '#2c5364'] } },
    titleColor: '#e0f7ff', bodyColor: '#b0d4e0', tagBg: 'rgba(224,247,255,0.12)', tagColor: '#d0f0fa', accentColor: '#8fb8cc',
    align: 'center',
  },
  {
    id: 'sakura', name: '樱花粉', category: '渐变',
    background: { type: 'gradient', gradient: { direction: '135deg', colors: ['#ffe0ef', '#ffb3d1'] } },
    titleColor: '#8a2f5c', bodyColor: '#a34576', tagBg: 'rgba(138,47,92,0.10)', tagColor: '#8a2f5c', accentColor: '#c26a95',
    align: 'center',
  },
];

export interface CardSize {
  id: string;
  name: string;
  width: number;
  height: number;
}

export const CARD_SIZES: CardSize[] = [
  { id: 'square', name: '正方形 1:1', width: 1080, height: 1080 },
  { id: 'portrait', name: '小红书竖图 3:4', width: 1080, height: 1440 },
  { id: 'landscape', name: '横图 16:9', width: 1280, height: 720 },
  { id: 'story', name: '手机壁纸 9:16', width: 720, height: 1280 },
];

/** 用户可调整的自定义项（MVP 简化版） */
export interface CardCustomize {
  fontFamily: string;
  borderRadius: number;   // px
  padding: number;        // px
  showTags: boolean;
  showDate: boolean;
  showWatermark: boolean;
}

export const FONT_OPTIONS: { name: string; value: string }[] = [
  { name: '系统默认', value: "'PingFang SC','Microsoft YaHei','Helvetica Neue',Arial,sans-serif" },
  { name: '衬线（宋体感）', value: "'Songti SC','SimSun','STSong',Georgia,serif" },
  { name: '圆润（黑体）', value: "'PingFang SC','Microsoft YaHei','Hiragino Sans GB',sans-serif" },
  { name: '等宽（代码感）', value: "'JetBrains Mono','Fira Code',Consolas,'Courier New',monospace" },
];

export const DEFAULT_CUSTOMIZE: CardCustomize = {
  fontFamily: FONT_OPTIONS[0].value,
  borderRadius: 16,
  padding: 56,
  showTags: true,
  showDate: true,
  showWatermark: true,
};

/** 由模板 + 自定义项生成卡片的背景样式对象 */
export function buildCardBackground(template: CardTemplate): CSSProperties {
  if (template.background.type === 'gradient' && template.background.gradient) {
    const { direction, colors } = template.background.gradient;
    return { background: `linear-gradient(${direction}, ${colors.join(', ')})` };
  }
  return { backgroundColor: template.background.color ?? '#ffffff' };
}

/**
 * 把卡片 DOM 节点导出为高清 PNG（pixelRatio 2）
 */
export async function exportCardNode(node: HTMLElement): Promise<string | null> {
  try {
    await document.fonts.ready;
    return await toPng(node, {
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      cacheBust: true,
    });
  } catch (e) {
    console.error('[SparkVault] 卡片导出失败:', e);
    return null;
  }
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}
