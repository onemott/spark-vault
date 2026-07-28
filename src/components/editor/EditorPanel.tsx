import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { X, Save, Trash2 } from 'lucide-react';
import { db } from '@/lib/db';
import { useStore } from '@/lib/store';
import { useIdea, useAllProjects } from '@/hooks/useIdeas';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';

/**
 * 右侧编辑器面板
 * - 新建模式：空表单
 * - 编辑模式：加载 idea 数据
 */
export function EditorPanel() {
  const isEditorOpen = useStore((s) => s.isEditorOpen);
  const editingIdeaId = useStore((s) => s.editingIdeaId);
  const closeEditor = useStore((s) => s.closeEditor);
  const selectedProjectId = useStore((s) => s.selectedProjectId);
  const initialEditorValues = useStore((s) => s.initialEditorValues);
  const setInitialEditorValues = useStore((s) => s.setInitialEditorValues);
  const markClean = useStore((s) => s.markClean);

  const idea = useIdea(editingIdeaId);
  const projects = useAllProjects();

  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [projectId, setProjectId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);

  // 检测是否有未保存更改（基于 store 中的初始值快照）
  const isDirty = useMemo(() => {
    if (!isEditorOpen || !initialEditorValues) return false;
    return (
      title !== initialEditorValues.title ||
      prompt !== initialEditorValues.prompt ||
      JSON.stringify(tags) !== JSON.stringify(initialEditorValues.tags) ||
      projectId !== initialEditorValues.projectId
    );
  }, [title, prompt, tags, projectId, isEditorOpen, initialEditorValues]);

  // 关闭请求处理：有未保存更改时弹确认
  const handleCloseRequest = useCallback(() => {
    if (isDirty) {
      setShowUnsavedDialog(true);
    } else {
      closeEditor();
    }
  }, [isDirty, closeEditor]);

  const handleDiscard = useCallback(() => {
    setShowUnsavedDialog(false);
    closeEditor();
  }, [closeEditor]);

  // 加载编辑数据（编辑器每次打开时重新初始化，避免残留上次输入）
  useEffect(() => {
    if (!isEditorOpen) return;
    if (editingIdeaId && idea) {
      setTitle(idea.title);
      setPrompt(idea.prompt);
      setTags(idea.tags);
      setProjectId(idea.projectId);
      setInitialEditorValues({ title: idea.title, prompt: idea.prompt, tags: [...idea.tags], projectId: idea.projectId });
    } else {
      setTitle('');
      setPrompt('');
      setTags([]);
      setProjectId(selectedProjectId);
      setInitialEditorValues({ title: '', prompt: '', tags: [], projectId: selectedProjectId });
    }
    setTagInput('');
    setShowUnsavedDialog(false);
  }, [isEditorOpen, editingIdeaId, idea, selectedProjectId, setInitialEditorValues]);

  // 标签输入处理
  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const tag = tagInput.trim();
      if (!tags.includes(tag)) {
        setTags([...tags, tag]);
      }
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  // 同步滚动
  const handleScroll = useCallback(() => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  // 高亮渲染：将 {{变量名}} 用 span 包裹
  const renderHighlighted = useCallback((text: string) => {
    const parts: React.ReactNode[] = [];
    const regex = /\{\{(\w+)\}\}/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      // 变量前的普通文本
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      // 变量高亮
      parts.push(
        <span key={`v-${match.index}`} className="prompt-var-highlight">
          {match[0]}
        </span>
      );
      lastIndex = regex.lastIndex;
    }

    // 剩余文本
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    // 末尾补空行占位，防止 pre 高度不够
    if (text.endsWith('\n')) {
      parts.push(' ');
    }

    return parts;
  }, []);

  // 保存
  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('请输入标题');
      return;
    }
    if (!projectId) {
      toast.error('请选择所属项目');
      return;
    }

    const now = new Date();

    if (editingIdeaId) {
      await db.ideas.update(editingIdeaId, {
        title: title.trim(),
        prompt,
        tags,
        projectId,
        updatedAt: now,
      });
      toast.success('灵感已更新');
    } else {
      await db.ideas.add({
        title: title.trim(),
        prompt,
        tags,
        projectId,
        createdAt: now,
        updatedAt: now,
      });
      toast.success('灵感已创建');
    }

    markClean();
    closeEditor();
  };

  // 删除
  const handleDelete = async () => {
    if (!editingIdeaId) return;
    setDeleteConfirmId(editingIdeaId);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    await db.ideas.update(deleteConfirmId, { deletedAt: new Date() });
    toast.success('灵感已移入回收站');
    setDeleteConfirmId(null);
    closeEditor();
  };

  // beforeunload 拦截：有未保存更改时阻止关闭
  useEffect(() => {
    if (!isEditorOpen || !isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isEditorOpen, isDirty]);

  // Ctrl+S 保存 + Esc 关闭
  useEffect(() => {
    if (!isEditorOpen) return;
    const handler = (e: KeyboardEvent) => {
      // Ctrl+S / Cmd+S 保存
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
        return;
      }
      // Esc 关闭
      if (e.key === 'Escape') {
        if (deleteConfirmId || showUnsavedDialog) return;
        e.preventDefault();
        handleCloseRequest();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isEditorOpen, deleteConfirmId, showUnsavedDialog, title, prompt, tags, projectId, editingIdeaId, isDirty, handleCloseRequest]);

  return (
    <>
    {/* 未保存确认对话框 */}
    <Dialog open={showUnsavedDialog} onOpenChange={(open) => { if (!open) setShowUnsavedDialog(false); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>未保存的更改</DialogTitle>
          <DialogDescription>有未保存的更改，是否放弃？</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowUnsavedDialog(false)}>
            继续编辑
          </Button>
          <Button variant="destructive" onClick={handleDiscard}>
            放弃
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* 删除确认对话框（放在 AnimatePresence 外部避免动画冲突） */}
    <Dialog open={!!deleteConfirmId} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>确认删除</DialogTitle>
          <DialogDescription>确认删除此灵感？它将移入回收站，可在回收站中恢复。</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
            取消
          </Button>
          <Button variant="destructive" onClick={confirmDelete}>
            删除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AnimatePresence>
    {isEditorOpen && (
    <motion.div
      className="w-[380px] shrink-0 border-l border-border bg-background flex flex-col"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-medium">
          {editingIdeaId ? '编辑灵感' : '新建灵感'}
        </h2>
        <Button variant="ghost" size="icon-sm" onClick={handleCloseRequest}>
          <X strokeWidth={1.5} />
        </Button>
      </div>

      {/* 表单 */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* 标题 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted-foreground">标题</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="灵感标题"
          />
        </div>

        {/* 提示词（高亮编辑器） */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted-foreground">
            提示词
            <span className="ml-1 text-xs text-muted-foreground/70">
              使用 {'{{变量名}}'} 创建变量
            </span>
          </label>
          <div className="prompt-editor-container">
            {/* 高亮层 */}
            <pre
              ref={highlightRef}
              className="prompt-editor-highlight"
              aria-hidden="true"
            >
              <code>{renderHighlighted(prompt)}</code>
            </pre>
            {/* 编辑层 */}
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onScroll={handleScroll}
              placeholder="输入提示词..."
              className="prompt-editor-textarea"
              spellCheck={false}
            />
          </div>
        </div>

        {/* 标签 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted-foreground">标签</label>
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            placeholder="输入标签后按 Enter"
          />
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="cursor-pointer gap-1"
                  onClick={() => removeTag(tag)}
                >
                  {tag}
                  <X className="size-3" strokeWidth={1.5} />
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* 所属项目 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted-foreground">所属项目</label>
          <Select
            items={projects.map((p) => ({ label: p.name, value: p.id!.toString() }))}
            value={projectId?.toString() ?? null}
            onValueChange={(v) => setProjectId(Number(v))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="选择项目" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id!.toString()}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 底部按钮 */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-border">
        <Button onClick={handleSave} className="flex-1">
          <Save strokeWidth={1.5} className="mr-1.5" />
          保存
        </Button>
        {editingIdeaId && (
          <Button variant="destructive" size="icon" onClick={handleDelete}>
            <Trash2 strokeWidth={1.5} />
          </Button>
        )}
      </div>
    </motion.div>
    )}
    </AnimatePresence>
    </>
  );
}
