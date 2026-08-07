import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, RotateCcw, Trash2, Folder, FileText, Lightbulb } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useTrashedCategories, useTrashedProjects, useTrashedIdeas } from '@/hooks/useIdeas';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

/**
 * 回收站面板 — 右侧滑出
 */
export function TrashPanel() {
  const isTrashOpen = useStore((s) => s.isTrashOpen);
  const closeTrash = useStore((s) => s.closeTrash);
  const restoreCategory = useStore((s) => s.restoreCategory);
  const restoreProject = useStore((s) => s.restoreProject);
  const restoreIdea = useStore((s) => s.restoreIdea);
  const permanentDeleteCategory = useStore((s) => s.permanentDeleteCategory);
  const permanentDeleteProject = useStore((s) => s.permanentDeleteProject);
  const permanentDeleteIdea = useStore((s) => s.permanentDeleteIdea);
  const emptyTrash = useStore((s) => s.emptyTrash);

  const trashedCategories = useTrashedCategories();
  const trashedProjects = useTrashedProjects();
  const trashedIdeas = useTrashedIdeas();

  const [confirmPermanent, setConfirmPermanent] = useState<{
    type: 'category' | 'project' | 'idea' | 'empty';
    id?: number;
    name: string;
  } | null>(null);

  const totalCount = trashedCategories.length + trashedProjects.length + trashedIdeas.length;

  const handleRestore = async (type: 'category' | 'project' | 'idea', id: number) => {
    if (type === 'category') {
      await restoreCategory(id);
      toast.success('分类已恢复');
    } else if (type === 'project') {
      await restoreProject(id);
      toast.success('项目已恢复');
    } else {
      await restoreIdea(id);
      toast.success('灵感已恢复');
    }
  };

  const handlePermanentDelete = async () => {
    if (!confirmPermanent) return;
    if (confirmPermanent.type === 'empty') {
      await emptyTrash();
      toast.success('回收站已清空');
    } else if (confirmPermanent.type === 'category') {
      await permanentDeleteCategory(confirmPermanent.id!);
      toast.success('分类已永久删除');
    } else if (confirmPermanent.type === 'project') {
      await permanentDeleteProject(confirmPermanent.id!);
      toast.success('项目已永久删除');
    } else {
      await permanentDeleteIdea(confirmPermanent.id!);
      toast.success('灵感已永久删除');
    }
    setConfirmPermanent(null);
  };

  const formatDate = (date?: Date) => {
    if (!date) return '未知';
    const d = new Date(date);
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      {/* 永久删除确认对话框 */}
      <Dialog open={!!confirmPermanent} onOpenChange={(open) => { if (!open) setConfirmPermanent(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmPermanent?.type === 'empty' ? '清空回收站' : '永久删除'}
            </DialogTitle>
            <DialogDescription>
              {confirmPermanent?.type === 'empty'
                ? '确定要清空回收站吗？所有已删除的数据将被永久移除，无法恢复。'
                : `确定要永久删除「${confirmPermanent?.name}」吗？此操作不可撤销。`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmPermanent(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handlePermanentDelete}>
              永久删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AnimatePresence>
        {isTrashOpen && (
          <motion.div
            className="w-[340px] shrink-0 border-l border-border bg-background flex flex-col"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {/* 头部 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="text-sm font-medium">回收站</h2>
              <Button variant="ghost" size="icon-sm" onClick={closeTrash}>
                <X strokeWidth={1.5} />
              </Button>
            </div>

            {/* 内容 */}
            <ScrollArea className="flex-1">
              <div className="py-2">
                {/* 已删分类 */}
                {trashedCategories.length > 0 && (
                  <TrashSection title="已删分类" count={trashedCategories.length} icon={<Folder className="size-3.5" strokeWidth={1.5} />}>
                    {trashedCategories.map((cat) => (
                      <TrashItem
                        key={cat.id}
                        name={cat.name}
                        deletedAt={cat.deletedAt}
                        formatDate={formatDate}
                        onRestore={() => handleRestore('category', cat.id!)}
                        onPermanentDelete={() => setConfirmPermanent({ type: 'category', id: cat.id, name: cat.name })}
                      />
                    ))}
                  </TrashSection>
                )}

                {/* 已删项目 */}
                {trashedProjects.length > 0 && (
                  <TrashSection title="已删项目" count={trashedProjects.length} icon={<FileText className="size-3.5" strokeWidth={1.5} />}>
                    {trashedProjects.map((proj) => (
                      <TrashItem
                        key={proj.id}
                        name={proj.name}
                        deletedAt={proj.deletedAt}
                        formatDate={formatDate}
                        onRestore={() => handleRestore('project', proj.id!)}
                        onPermanentDelete={() => setConfirmPermanent({ type: 'project', id: proj.id, name: proj.name })}
                      />
                    ))}
                  </TrashSection>
                )}

                {/* 已删灵感 */}
                {trashedIdeas.length > 0 && (
                  <TrashSection title="已删灵感" count={trashedIdeas.length} icon={<Lightbulb className="size-3.5" strokeWidth={1.5} />}>
                    {trashedIdeas.map((idea) => (
                      <TrashItem
                        key={idea.id}
                        name={idea.title ?? '未命名灵感'}
                        deletedAt={idea.deletedAt}
                        formatDate={formatDate}
                        onRestore={() => handleRestore('idea', idea.id!)}
                        onPermanentDelete={() => setConfirmPermanent({ type: 'idea', id: idea.id, name: idea.title ?? '未命名灵感' })}
                      />
                    ))}
                  </TrashSection>
                )}

                {totalCount === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Trash2 className="size-8 mb-2 opacity-30" strokeWidth={1} />
                    <p className="text-sm">回收站为空</p>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* 底部 */}
            {totalCount > 0 && (
              <div className="border-t border-border p-3">
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => setConfirmPermanent({ type: 'empty', name: '' })}
                >
                  <Trash2 strokeWidth={1.5} className="mr-1.5 size-4" />
                  清空回收站
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* 分区组件 */
function TrashSection({
  title,
  count,
  icon,
  children,
}: {
  title: string;
  count: number;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2">
      <div className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {icon}
        <span>{title}</span>
        <span className="ml-auto text-muted-foreground/60 normal-case">{count}</span>
      </div>
      {children}
    </div>
  );
}

/* 单条记录组件 */
function TrashItem({
  name,
  deletedAt,
  formatDate,
  onRestore,
  onPermanentDelete,
}: {
  name: string;
  deletedAt?: Date;
  formatDate: (d?: Date) => string;
  onRestore: () => void;
  onPermanentDelete: () => void;
}) {
  return (
    <div className="group flex items-center gap-2 px-4 py-1.5 hover:bg-accent/50 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{name}</p>
        <p className="text-xs text-muted-foreground">{formatDate(deletedAt)}</p>
      </div>
      <div className="hidden group-hover:flex items-center gap-0.5">
        <button
          className="flex items-center justify-center size-6 rounded hover:bg-green-500/10 text-muted-foreground hover:text-green-600 transition-colors"
          title="恢复"
          onClick={onRestore}
        >
          <RotateCcw className="size-3" strokeWidth={1.5} />
        </button>
        <button
          className="flex items-center justify-center size-6 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
          title="永久删除"
          onClick={onPermanentDelete}
        >
          <Trash2 className="size-3" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
