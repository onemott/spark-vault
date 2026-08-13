import { useState, lazy, Suspense } from 'react';
import { toast } from 'sonner';
import { recordCopy } from '@/lib/game';

// 变量填空对话框依赖 @base-ui/react（Dialog），懒加载避免拖慢首屏
const VariableDialog = lazy(() =>
  import('./VariableDialog').then((m) => ({ default: m.VariableDialog }))
);

interface CopyButtonProps {
  prompt: string;
  /** 灵感 id：提供后复制行为会记录成长值与每日任务进度 */
  ideaId?: number;
}

/**
 * 一键复制按钮（kbd 键帽风格）
 * 无变量直接复制，有变量弹出填空对话框
 */
export function CopyButton({ prompt, ideaId }: CopyButtonProps) {
  const [showVariableDialog, setShowVariableDialog] = useState(false);

  // 检查是否有变量
  const hasVariables = /\{\{(\w+)\}\}/.test(prompt);

  // 复制成功后记录：+10 成长值（每日上限 50）、每日任务「复制使用」进度
  const handleCopied = () => {
    if (ideaId != null) {
      recordCopy(ideaId);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasVariables) {
      setShowVariableDialog(true);
    } else {
      navigator.clipboard.writeText(prompt);
      toast.success('已复制到剪贴板');
      handleCopied();
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="inline-flex items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-mono shadow-sm hover:bg-accent transition-colors"
        title="复制提示词"
      >
        复制
      </button>
      {/* 仅在打开时才挂载并懒加载，使 @base-ui 不进首屏（无退出动画） */}
      {showVariableDialog && (
        <Suspense fallback={null}>
          <VariableDialog
            open
            onOpenChange={setShowVariableDialog}
            prompt={prompt}
            onCopied={handleCopied}
          />
        </Suspense>
      )}
    </>
  );
}
