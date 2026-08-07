import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { X, Save, Trash2 } from 'lucide-react';
import { db } from '@/lib/db';
import { useStore } from '@/lib/store';
import { useIdea, useAllProjects, UNASSIGNED_PROJECT_ID } from '@/hooks/useIdeas';
import { extractTagsFromPrompt } from '@/lib/utils';
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

/** 编辑器的内容上下文：标识表单当前承载的是「编辑某条灵感」还是「新建」 */
type EditorContext = {
  kind: 'idea' | 'new';
  ideaId: number | null;
  projectId: number | null;
  categoryId: number | null;
};

/** 根据 projectId 反查其所属分类 id（用于识别「新建」上下文是否因切项目而变化） */
function getCategoryId(projectId: number | null, projects: { id?: number; categoryId: number }[]): number | null {
  if (projectId == null) return null;
  const proj = projects.find((p) => p.id === projectId);
  return proj?.categoryId ?? null;
}

export function EditorPanel() {
  const isEditorOpen = useStore((s) => s.isEditorOpen);
  const editingIdeaId = useStore((s) => s.editingIdeaId);
  const closeEditor = useStore((s) => s.closeEditor);
  const setEditingIdeaId = useStore((s) => s.setEditingIdeaId);
  const selectedProjectId = useStore((s) => s.selectedProjectId);
  const setSelectedProjectId = useStore((s) => s.setSelectedProjectId);
  const selectedCategoryId = useStore((s) => s.selectedCategoryId);
  const setSelectedCategoryId = useStore((s) => s.setSelectedCategoryId);
  const setSelectedIdeaId = useStore((s) => s.setSelectedIdeaId);
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

  // 当前编辑器承载的内容上下文（用于区分「新建」与「编辑」，避免切项目/切灵感时误判）
  const [context, setContext] = useState<EditorContext>({ kind: 'new', ideaId: null, projectId: null, categoryId: null });

  // 上一次「成功加载/保存」后的表单值快照，用于在切换上下文前判断是否有未保存修改
  const lastCleanSnapshot = useRef({ title: '', prompt: '', tags: [] as string[], projectId: null as number | null });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);

  // 检测当前表单相对「上次成功加载/保存」是否有未保存更改
  const hasUnsavedChanges = useCallback((): boolean => {
    const s = lastCleanSnapshot.current;
    return (
      title !== s.title ||
      prompt !== s.prompt ||
      JSON.stringify(tags) !== JSON.stringify(s.tags) ||
      projectId !== s.projectId
    );
  }, [title, prompt, tags, projectId]);

  // 关闭请求处理：有未保存更改时弹确认
  const handleCloseRequest = useCallback(() => {
    if (hasUnsavedChanges()) {
      setShowUnsavedDialog(true);
    } else {
      closeEditor();
    }
  }, [hasUnsavedChanges, closeEditor]);

  // 将表单内容加载为指定上下文（新建或编辑某条灵感），并记录干净快照
  const loadIntoEditor = useCallback((
    ctx: EditorContext,
    values: { title: string; prompt: string; tags: string[]; projectId: number }
  ) => {
    setContext(ctx);
    setTitle(values.title);
    setPrompt(values.prompt);
    setTags([...values.tags]);
    setProjectId(values.projectId);
    lastCleanSnapshot.current = { ...values, tags: [...values.tags] };
    setTagInput('');
    setShowUnsavedDialog(false);
  }, []);

  // 暂存被拦截的「目标上下文」，待用户选择放弃后应用
  const pendingLoadRef = useRef<{ ctx: EditorContext; values: { title: string; prompt: string; tags: string[]; projectId: number } } | null>(null);

  // 用户选择「放弃」：若有待切换目标则加载它，否则直接关闭编辑器
  const handleDiscard = useCallback(() => {
    setShowUnsavedDialog(false);
    if (pendingLoadRef.current) {
      const { ctx, values } = pendingLoadRef.current;
      pendingLoadRef.current = null;
      loadIntoEditor(ctx, values);
      return;
    }
    closeEditor();
  }, [closeEditor, loadIntoEditor]);

  // 用户选择「继续编辑」：撤销已发生的导航，回到当前编辑器的上下文
  const handleKeepEditing = useCallback(() => {
    pendingLoadRef.current = null;
    setShowUnsavedDialog(false);
    if (context.kind === 'idea') {
      setEditingIdeaId(context.ideaId);
      setSelectedIdeaId(context.ideaId);
    } else {
      setEditingIdeaId(null);
      setSelectedIdeaId(null);
    }
    setSelectedProjectId(context.projectId);
    setSelectedCategoryId(context.categoryId);
  }, [context, setEditingIdeaId, setSelectedIdeaId, setSelectedProjectId, setSelectedCategoryId]);

  // 加载编辑数据（编辑器每次打开时重新初始化，避免残留上次输入）
  // 关键：仅当「内容上下文」真正发生变化时才重置；若只是切换项目/灵感/新建，
  // 且当前有未保存修改，则先走确认流程，避免静默丢失。
  useEffect(() => {
    if (!isEditorOpen) return;

    // 计算目标上下文
    let targetCtx: EditorContext;
    let values: { title: string; prompt: string; tags: string[]; projectId: number };

    if (editingIdeaId && idea) {
      targetCtx = { kind: 'idea', ideaId: editingIdeaId, projectId: idea.projectId ?? null, categoryId: getCategoryId(idea.projectId ?? null, projects) };
      values = {
        title: idea.title ?? '',
        prompt: idea.prompt,
        tags: [...idea.tags],
        projectId: idea.projectId ?? UNASSIGNED_PROJECT_ID,
      };
    } else if (editingIdeaId) {
      // 正在编辑但 idea 尚未加载完成（live query 异步）：本次不重置，等加载完成
      return;
    } else {
      targetCtx = { kind: 'new', ideaId: null, projectId: selectedProjectId, categoryId: selectedCategoryId };
      values = { title: '', prompt: '', tags: [], projectId: selectedProjectId ?? UNASSIGNED_PROJECT_ID };
    }

    // 上下文无变化（例如仅滚动/重渲染）则跳过
    if (context.kind === targetCtx.kind && context.ideaId === targetCtx.ideaId && context.projectId === targetCtx.projectId && context.categoryId === targetCtx.categoryId) {
      return;
    }

    // 有未保存修改且上下文要切换：暂存目标，走确认对话框
    if (hasUnsavedChanges()) {
      pendingLoadRef.current = { ctx: targetCtx, values };
      setShowUnsavedDialog(true);
      return;
    }

    loadIntoEditor(targetCtx, values);
  }, [isEditorOpen, editingIdeaId, idea, selectedProjectId, selectedCategoryId, projects, context, loadIntoEditor, hasUnsavedChanges]);

  // 标签输入处理
  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 中文输入法（IME）选词确认也触发 Enter，需跳过，避免把未确认的拼音/候选误当标签
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const tag = tagInput.trim();
      // 大小写不敏感去重：`AI` 与 `ai` 视作同一标签
      if (!tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
        setTags([...tags, tag]);
      }
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t.toLowerCase() !== tag.toLowerCase()));
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
    // 标题可选：为空时用提示词截断作为默认标题，保证列表/导出可正常展示
    const fallbackTitle = prompt.trim().replace(/\s+/g, ' ').slice(0, 30) || '未命名灵感';
    const finalTitle = title.trim() || fallbackTitle;

    // 标签可选：留空时从提示词自动生成
    const finalTags = tags.length > 0 ? tags : extractTagsFromPrompt(prompt);

    // 所属项目可选：null 表示未分配
    const finalProjectId = projectId === UNASSIGNED_PROJECT_ID ? null : projectId;

    const now = new Date();

    if (editingIdeaId) {
      await db.ideas.update(editingIdeaId, {
        title: finalTitle,
        prompt,
        tags: finalTags,
        projectId: finalProjectId,
        updatedAt: now,
      });
      toast.success('灵感已更新');
    } else {
      await db.ideas.add({
        title: finalTitle,
        prompt,
        tags: finalTags,
        projectId: finalProjectId,
        createdAt: now,
        updatedAt: now,
      });
      toast.success('灵感已创建');
    }

    markClean();
    lastCleanSnapshot.current = { title: finalTitle, prompt, tags: [...finalTags], projectId: finalProjectId ?? UNASSIGNED_PROJECT_ID };
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
    if (!isEditorOpen || !hasUnsavedChanges()) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isEditorOpen, hasUnsavedChanges]);

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
  }, [isEditorOpen, deleteConfirmId, showUnsavedDialog, title, prompt, tags, projectId, editingIdeaId, hasUnsavedChanges, handleCloseRequest]);

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
          <Button variant="outline" onClick={handleKeepEditing}>
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
          <label className="text-sm text-muted-foreground">
            标题
            <span className="ml-1 text-xs text-muted-foreground/70">（可选）</span>
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="灵感标题（可选，留空用提示词）"
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

        {/* 标签（可选） */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted-foreground">
            标签
            <span className="ml-1 text-xs text-muted-foreground/70">（可选，留空自动生成）</span>
          </label>
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

        {/* 所属项目（可选） */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted-foreground">
            所属项目
            <span className="ml-1 text-xs text-muted-foreground/70">（可选）</span>
          </label>
          <Select
            items={[
              ...projects.map((p) => ({ label: p.name, value: p.id!.toString() })),
              { label: '未分配', value: String(UNASSIGNED_PROJECT_ID) },
            ]}
            value={projectId?.toString() ?? String(UNASSIGNED_PROJECT_ID)}
            onValueChange={(v) => setProjectId(Number(v))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="选择项目" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={String(UNASSIGNED_PROJECT_ID)}>未分配</SelectItem>
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
