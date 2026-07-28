import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface VariableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: string;
}

/**
 * 变量填空对话框
 * 解析 prompt 中的 {{变量名}}，显示输入框，替换后复制到剪贴板
 */
export function VariableDialog({ open, onOpenChange, prompt }: VariableDialogProps) {
  // 解析所有变量名
  const variables = useMemo(() => {
    const matches = prompt.match(/\{\{(\w+)\}\}/g);
    if (!matches) return [];
    return [...new Set(matches.map(m => m.slice(2, -2)))];
  }, [prompt]);

  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    variables.forEach(v => { init[v] = ''; });
    return init;
  });

  const handleConfirm = () => {
    let result = prompt;
    for (const [key, value] of Object.entries(values)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, value || `[${key}]`);
    }
    navigator.clipboard.writeText(result);
    toast.success('已复制到剪贴板');
    onOpenChange(false);
    // 重置
    const reset: Record<string, string> = {};
    variables.forEach(v => { reset[v] = ''; });
    setValues(reset);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>填充变量</DialogTitle>
          <DialogDescription>
            提示词中包含变量，请填写以下值：
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {variables.map((v) => (
            <div key={v} className="flex flex-col gap-1.5">
              <label className="text-sm text-muted-foreground font-medium">
                {v}
              </label>
              <Input
                value={values[v] || ''}
                onChange={(e) => setValues(prev => ({ ...prev, [v]: e.target.value }))}
                placeholder={`输入 ${v}`}
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleConfirm}>
            复制
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
