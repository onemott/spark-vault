import { useState } from 'react';
import { toast } from 'sonner';
import { VariableDialog } from './VariableDialog';

interface CopyButtonProps {
  prompt: string;
}

/**
 * 一键复制按钮（kbd 键帽风格）
 * 无变量直接复制，有变量弹出填空对话框
 */
export function CopyButton({ prompt }: CopyButtonProps) {
  const [showVariableDialog, setShowVariableDialog] = useState(false);

  // 检查是否有变量
  const hasVariables = /\{\{(\w+)\}\}/.test(prompt);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasVariables) {
      setShowVariableDialog(true);
    } else {
      navigator.clipboard.writeText(prompt);
      toast.success('已复制到剪贴板');
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
      {hasVariables && (
        <VariableDialog
          open={showVariableDialog}
          onOpenChange={setShowVariableDialog}
          prompt={prompt}
        />
      )}
    </>
  );
}
