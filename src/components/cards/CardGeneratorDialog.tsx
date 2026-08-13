/**
 * 卡片生成器（方向四）：模板 + 尺寸 + 自定义 + PNG 导出
 * 卡片 DOM 全部使用内联样式（hex/rgb），保证 html-to-image 兼容。
 */
import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { Image, Download, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/store';
import { useIdea } from '@/hooks/useIdeas';
import {
  CARD_TEMPLATES,
  CARD_SIZES,
  FONT_OPTIONS,
  DEFAULT_CUSTOMIZE,
  buildCardBackground,
  exportCardNode,
  downloadDataUrl,
  type CardCustomize,
} from '@/lib/cards';
import type { CSSProperties } from 'react';

const PREVIEW_MAX_W = 600;
const PREVIEW_MAX_H = 420;

export function CardGeneratorDialog() {
  const isCardOpen = useStore((s) => s.isCardOpen);
  const cardIdeaId = useStore((s) => s.cardIdeaId);
  const closeCard = useStore((s) => s.closeCard);
  const idea = useIdea(cardIdeaId);

  const [templateIdx, setTemplateIdx] = useState(0);
  const [sizeId, setSizeId] = useState('portrait');
  const [customize, setCustomize] = useState<CardCustomize>({ ...DEFAULT_CUSTOMIZE });
  const [bgOverride, setBgOverride] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const captureRef = useRef<HTMLDivElement>(null);

  const template = CARD_TEMPLATES[templateIdx];
  const size = CARD_SIZES.find((s) => s.id === sizeId) ?? CARD_SIZES[0];

  const cardStyle: CSSProperties = {
    width: size.width,
    height: size.height,
    ...(bgOverride ? { backgroundColor: bgOverride } : buildCardBackground(template)),
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    padding: customize.padding,
    fontFamily: customize.fontFamily,
    color: template.titleColor,
    position: 'relative',
    overflow: 'hidden',
  };

  const scale = Math.min(PREVIEW_MAX_W / size.width, PREVIEW_MAX_H / size.height, 1);

  const title = idea?.title ?? '未命名灵感';
  const prompt = idea?.prompt ?? '';
  const tags = idea?.tags ?? [];
  const createdAt = idea?.createdAt;

  const handleExport = async () => {
    if (!captureRef.current) return;
    setExporting(true);
    const dataUrl = await exportCardNode(captureRef.current);
    setExporting(false);
    if (dataUrl) {
      downloadDataUrl(dataUrl, `spark-vault-card-${title.replace(/[\\/:*?"<>|]/g, '_')}.png`);
      toast.success('卡片图片已导出');
    } else {
      toast.error('导出失败，请重试');
    }
  };

  const cardContent = (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        ...(template.cardBg
          ? {
              backgroundColor: template.cardBg,
              borderRadius: customize.borderRadius,
              padding: Math.max(24, customize.padding * 0.7),
            }
          : {}),
      }}
    >
      <div
        style={{
          fontSize: Math.round(size.width / 19),
          fontWeight: 700,
          color: template.titleColor,
          marginBottom: Math.round(size.width / 45),
          lineHeight: 1.3,
          textAlign: template.align,
        }}
      >
        {title}
      </div>
      <div
        style={{
          flex: 1,
          fontSize: Math.round(size.width / 36),
          lineHeight: 1.7,
          color: template.bodyColor,
          whiteSpace: 'pre-wrap',
          overflow: 'hidden',
          textAlign: template.align,
          wordBreak: 'break-word',
        }}
      >
        {prompt || '（空的灵感卡片）'}
      </div>
      {customize.showTags && tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: Math.round(size.width / 80), marginTop: Math.round(size.width / 45) }}>
          {tags.slice(0, 6).map((t) => (
            <span
              key={t}
              style={{
                backgroundColor: template.tagBg,
                color: template.tagColor,
                borderRadius: 999,
                padding: `${Math.round(size.width / 130)}px ${Math.round(size.width / 55)}px`,
                fontSize: Math.round(size.width / 42),
              }}
            >
              {t}
            </span>
          ))}
        </div>
      )}
      {(customize.showDate || customize.showWatermark) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: Math.round(size.width / 45),
            fontSize: Math.round(size.width / 48),
            color: template.accentColor,
          }}
        >
          <span>{customize.showDate && createdAt ? new Date(createdAt).toLocaleDateString() : ''}</span>
          <span>{customize.showWatermark ? '✨ 灵感来自 Spark Vault' : ''}</span>
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={isCardOpen} onOpenChange={(o) => { if (!o) closeCard(); }}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Image className="size-5 text-pink-500" strokeWidth={1.5} />
            <DialogTitle>生成灵感卡片</DialogTitle>
          </div>
          <DialogDescription>一键把灵感做成精美图片，保存到本地或分享到社交平台</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-[1.2fr_1fr]">
          {/* 预览区 */}
          <div className="flex flex-col gap-3">
            <div className="relative overflow-hidden rounded-lg border border-border bg-muted/30" style={{ height: PREVIEW_MAX_H }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${template.id}-${size.id}`}
                  className="absolute left-1/2 top-1/2"
                  style={{ width: size.width * scale, height: size.height * scale }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, x: '-50%', y: '-50%' }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                    <div ref={captureRef} style={cardStyle}>
                      {cardContent}
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
            <Button onClick={handleExport} disabled={exporting}>
              {exporting ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Download className="size-4 mr-1.5" strokeWidth={1.5} />}
              {exporting ? '导出中…' : '保存图片 (PNG)'}
            </Button>
          </div>

          {/* 配置区 */}
          <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-1">
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">模板</p>
              <div className="grid grid-cols-4 gap-1.5">
                {CARD_TEMPLATES.map((t, i) => (
                  <button
                    key={t.id}
                    onClick={() => { setTemplateIdx(i); setBgOverride(null); }}
                    className={`flex flex-col items-center gap-1 rounded-md border p-1.5 transition-colors ${
                      templateIdx === i ? 'border-pink-500 bg-pink-500/10' : 'border-border hover:bg-accent'
                    }`}
                    title={t.name}
                  >
                    <span
                      className="h-6 w-full rounded-sm border border-black/10"
                      style={buildCardBackground(t)}
                    />
                    <span className="text-[10px] text-muted-foreground">{t.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">尺寸</p>
              <div className="flex flex-wrap gap-1.5">
                {CARD_SIZES.map((s) => (
                  <Button
                    key={s.id}
                    size="sm"
                    variant={sizeId === s.id ? 'default' : 'outline'}
                    className="text-xs"
                    onClick={() => setSizeId(s.id)}
                  >
                    {s.name}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">字体</p>
              <select
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                value={customize.fontFamily}
                onChange={(e) => setCustomize((c) => ({ ...c, fontFamily: e.target.value }))}
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f.name} value={f.value}>{f.name}</option>
                ))}
              </select>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">自定义背景色</p>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="h-8 w-12 cursor-pointer rounded border border-border"
                  value={bgOverride ?? '#ffffff'}
                  onChange={(e) => setBgOverride(e.target.value)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setBgOverride(null)}
                  className="text-xs"
                >
                  恢复模板背景
                </Button>
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">圆角：{customize.borderRadius}px</p>
              <input
                type="range"
                min={0}
                max={48}
                value={customize.borderRadius}
                onChange={(e) => setCustomize((c) => ({ ...c, borderRadius: Number(e.target.value) }))}
                className="w-full"
              />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">内边距：{customize.padding}px</p>
              <input
                type="range"
                min={24}
                max={96}
                value={customize.padding}
                onChange={(e) => setCustomize((c) => ({ ...c, padding: Number(e.target.value) }))}
                className="w-full"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              {([
                ['showTags', '显示标签'],
                ['showDate', '显示日期'],
                ['showWatermark', '显示水印'],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center justify-between text-sm">
                  <span>{label}</span>
                  <input
                    type="checkbox"
                    checked={customize[key]}
                    onChange={(e) => setCustomize((c) => ({ ...c, [key]: e.target.checked }))}
                    className="size-4 accent-pink-500"
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
