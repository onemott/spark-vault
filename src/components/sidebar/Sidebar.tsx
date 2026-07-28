import { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence, motion } from 'motion/react';
import {
  ChevronRight,
  ChevronDown,
  FolderPlus,
  FilePlus,
  FileText,
  Upload,
  Download,
  Sun,
  Moon,
  Monitor,
  Sparkles,
  Folder,
  Globe,
  BookOpen,
  Code,
  Lightbulb,
  Palette,
  Music,
  Camera,
  Heart,
  Star,
  Zap,
  Home,
  Briefcase,
  GraduationCap,
  Gamepad2,
  Plane,
  Coffee,
  ShoppingCart,
  Dumbbell,
  TreePine,
  Pencil,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import { db } from '@/lib/db';
import { useStore } from '@/lib/store';
import { useCategories, useProjects } from '@/hooks/useIdeas';
import { exportAllData, importAllData, getSnapshots, rollbackFromSnapshot } from '@/lib/importExport';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

// 图标映射
const ICON_MAP: Record<string, React.ComponentType<{ strokeWidth?: number; size?: number; className?: string }>> = {
  folder: Folder,
  globe: Globe,
  book: BookOpen,
  code: Code,
  lightbulb: Lightbulb,
  palette: Palette,
  music: Music,
  camera: Camera,
  heart: Heart,
  star: Star,
  zap: Zap,
  home: Home,
  briefcase: Briefcase,
  graduation: GraduationCap,
  gamepad: Gamepad2,
  plane: Plane,
  coffee: Coffee,
  shopping: ShoppingCart,
  dumbbell: Dumbbell,
  tree: TreePine,
};

const ICON_OPTIONS = Object.keys(ICON_MAP);

function getIconComponent(iconName: string) {
  return ICON_MAP[iconName] || Sparkles;
}

/**
 * 左侧边栏：分类折叠树 + 底部工具栏
 */
export function Sidebar() {
  const categories = useCategories();
  const selectedCategoryId = useStore((s) => s.selectedCategoryId);
  const selectedProjectId = useStore((s) => s.selectedProjectId);
  const setSelectedCategoryId = useStore((s) => s.setSelectedCategoryId);
  const setSelectedProjectId = useStore((s) => s.setSelectedProjectId);
  const updateCategory = useStore((s) => s.updateCategory);
  const deleteCategory = useStore((s) => s.deleteCategory);
  const updateProject = useStore((s) => s.updateProject);
  const deleteProject = useStore((s) => s.deleteProject);
  const openTrash = useStore((s) => s.openTrash);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);

  // 快照列表（用于回滚）
  const snapshots = useLiveQuery(() => getSnapshots(), []) ?? [];

  const handleRollback = async (snapshotId: number) => {
    await rollbackFromSnapshot(snapshotId);
  };

  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [showNewCategoryDialog, setShowNewCategoryDialog] = useState(false);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 编辑分类状态
  const [editingCategory, setEditingCategory] = useState<{ id: number; name: string; icon: string } | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editCategoryIcon, setEditCategoryIcon] = useState('folder');

  // 删除分类确认
  const [deletingCategory, setDeletingCategory] = useState<{ id: number; name: string; projectCount: number } | null>(null);

  // 编辑项目状态
  const [editingProject, setEditingProject] = useState<{ id: number; name: string; description: string } | null>(null);
  const [editProjectName, setEditProjectName] = useState('');
  const [editProjectDesc, setEditProjectDesc] = useState('');

  // 删除项目确认
  const [deletingProject, setDeletingProject] = useState<{ id: number; name: string; ideaCount: number } | null>(null);

  const toggleCategory = (id: number) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setSelectedCategoryId(id);
  };

  const handleSelectProject = (id: number) => {
    setSelectedProjectId(id);
  };

  // 新建分类
  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    const maxSort = categories.length > 0
      ? Math.max(...categories.map((c) => c.sortOrder))
      : 0;
    await db.categories.add({
      name: newCategoryName.trim(),
      icon: 'folder',
      sortOrder: maxSort + 1,
    });
    setNewCategoryName('');
    setShowNewCategoryDialog(false);
    toast.success('分类已创建');
  };

  // 新建项目
  const handleCreateProject = async () => {
    if (!newProjectName.trim() || !selectedCategoryId) return;
    await db.projects.add({
      categoryId: selectedCategoryId,
      name: newProjectName.trim(),
      description: newProjectDesc.trim(),
      createdAt: new Date(),
    });
    setNewProjectName('');
    setNewProjectDesc('');
    setShowNewProjectDialog(false);
    toast.success('项目已创建');
  };

  // 打开编辑分类对话框
  const handleOpenEditCategory = (cat: { id: number; name: string; icon: string }) => {
    setEditingCategory(cat);
    setEditCategoryName(cat.name);
    setEditCategoryIcon(cat.icon);
  };

  // 保存编辑分类
  const handleSaveEditCategory = async () => {
    if (!editingCategory || !editCategoryName.trim()) return;
    await updateCategory(editingCategory.id, {
      name: editCategoryName.trim(),
      icon: editCategoryIcon,
    });
    setEditingCategory(null);
    toast.success('分类已更新');
  };

  // 打开删除分类确认
  const handleOpenDeleteCategory = async (cat: { id: number; name: string }) => {
    const projectCount = await db.projects.where('categoryId').equals(cat.id).count();
    setDeletingCategory({ id: cat.id, name: cat.name, projectCount });
  };

  // 确认删除分类
  const handleConfirmDeleteCategory = async () => {
    if (!deletingCategory) return;
    await deleteCategory(deletingCategory.id);
    setDeletingCategory(null);
    toast.success('分类已删除');
  };

  // 打开编辑项目对话框
  const handleOpenEditProject = (proj: { id: number; name: string; description: string }) => {
    setEditingProject(proj);
    setEditProjectName(proj.name);
    setEditProjectDesc(proj.description);
  };

  // 保存编辑项目
  const handleSaveEditProject = async () => {
    if (!editingProject || !editProjectName.trim()) return;
    await updateProject(editingProject.id, {
      name: editProjectName.trim(),
      description: editProjectDesc.trim(),
    });
    setEditingProject(null);
    toast.success('项目已更新');
  };

  // 打开删除项目确认
  const handleOpenDeleteProject = async (proj: { id: number; name: string }) => {
    const ideaCount = await db.ideas.where('projectId').equals(proj.id).count();
    setDeletingProject({ id: proj.id, name: proj.name, ideaCount });
  };

  // 确认删除项目
  const handleConfirmDeleteProject = async () => {
    if (!deletingProject) return;
    await deleteProject(deletingProject.id);
    setDeletingProject(null);
    toast.success('项目已删除');
  };

  // 导入
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importAllData(file);
      e.target.value = '';
    }
  };

  // 主题循环
  const cycleTheme = () => {
    const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    setTheme(next);
  };

  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;

  return (
    <div className="w-[260px] shrink-0 border-r border-border bg-sidebar flex flex-col">
      {/* 顶部 logo */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Sparkles className="size-5 text-green-600" strokeWidth={1.5} />
        <span className="text-sm font-semibold">Spark Vault</span>
      </div>

      {/* 分类树 */}
      <ScrollArea className="flex-1">
        <div className="py-2">
          {categories.map((cat) => (
            <CategoryTreeItem
              key={cat.id}
              category={cat}
              isExpanded={expandedCategories.has(cat.id!)}
              isSelected={selectedCategoryId === cat.id}
              selectedProjectId={selectedProjectId}
              onToggle={() => toggleCategory(cat.id!)}
              onSelectProject={handleSelectProject}
              onEditCategory={handleOpenEditCategory}
              onDeleteCategory={handleOpenDeleteCategory}
              onEditProject={handleOpenEditProject}
              onDeleteProject={handleOpenDeleteProject}
            />
          ))}
        </div>
      </ScrollArea>

      {/* 底部工具栏 */}
      <div className="border-t border-border p-2 flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setShowNewCategoryDialog(true)}
          title="新建分类"
        >
          <FolderPlus strokeWidth={1.5} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            if (!selectedCategoryId) {
              toast.error('请先选择一个分类');
              return;
            }
            setShowNewProjectDialog(true);
          }}
          title="新建项目"
        >
          <FilePlus strokeWidth={1.5} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => fileInputRef.current?.click()}
          title="导入"
        >
          <Upload strokeWidth={1.5} />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleImport}
        />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={exportAllData}
          title="导出"
        >
          <Download strokeWidth={1.5} />
        </Button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={openTrash}
          title="回收站"
        >
          <Trash2 strokeWidth={1.5} />
        </Button>
        {snapshots.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                title="从快照回滚"
              >
                <RotateCcw strokeWidth={1.5} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {snapshots.map((snap) => (
                <DropdownMenuItem
                  key={snap.id}
                  onClick={() => handleRollback(snap.id!)}
                >
                  {new Date(snap.createdAt).toLocaleString()}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={cycleTheme}
          title={`主题: ${theme}`}
        >
          <ThemeIcon strokeWidth={1.5} />
        </Button>
      </div>

      {/* 新建分类对话框 */}
      <Dialog open={showNewCategoryDialog} onOpenChange={setShowNewCategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建分类</DialogTitle>
          </DialogHeader>
          <Input
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="分类名称"
            onKeyDown={(e) => e.key === 'Enter' && handleCreateCategory()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewCategoryDialog(false)}>
              取消
            </Button>
            <Button onClick={handleCreateCategory}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 新建项目对话框 */}
      <Dialog open={showNewProjectDialog} onOpenChange={setShowNewProjectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建项目</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="项目名称"
            />
            <Textarea
              value={newProjectDesc}
              onChange={(e) => setNewProjectDesc(e.target.value)}
              placeholder="项目描述（可选）"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewProjectDialog(false)}>
              取消
            </Button>
            <Button onClick={handleCreateProject}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑分类对话框 */}
      <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑分类</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Input
              value={editCategoryName}
              onChange={(e) => setEditCategoryName(e.target.value)}
              placeholder="分类名称"
              onKeyDown={(e) => e.key === 'Enter' && handleSaveEditCategory()}
            />
            <div className="flex flex-col gap-2">
              <span className="text-sm text-muted-foreground">选择图标</span>
              <div className="flex flex-wrap gap-1.5">
                {ICON_OPTIONS.map((iconName) => {
                  const Icon = ICON_MAP[iconName];
                  return (
                    <button
                      key={iconName}
                      className={`flex items-center justify-center size-8 rounded border transition-colors ${
                        editCategoryIcon === iconName
                          ? 'border-green-600 bg-green-600/10 text-green-600'
                          : 'border-border hover:bg-accent/50 text-muted-foreground'
                      }`}
                      onClick={() => setEditCategoryIcon(iconName)}
                      title={iconName}
                    >
                      <Icon className="size-4" strokeWidth={1.5} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCategory(null)}>
              取消
            </Button>
            <Button onClick={handleSaveEditCategory}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除分类确认对话框 */}
      <Dialog open={!!deletingCategory} onOpenChange={(open) => !open && setDeletingCategory(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除分类</DialogTitle>
            <DialogDescription>
              确定要删除分类「{deletingCategory?.name}」吗？
              {deletingCategory && deletingCategory.projectCount > 0 && (
                <>该分类下有 <kbd className="px-1.5 py-0.5 text-xs border border-border rounded bg-accent">{deletingCategory.projectCount}</kbd> 个项目及其所有灵感将一并删除。</>
              )}
              {deletingCategory && deletingCategory.projectCount === 0 && (
                <>该分类下暂无项目。</>
              )}
              该分类及下属项目和灵感将被移入回收站，可在回收站中恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingCategory(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleConfirmDeleteCategory}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑项目对话框 */}
      <Dialog open={!!editingProject} onOpenChange={(open) => !open && setEditingProject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑项目</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input
              value={editProjectName}
              onChange={(e) => setEditProjectName(e.target.value)}
              placeholder="项目名称"
              onKeyDown={(e) => e.key === 'Enter' && handleSaveEditProject()}
            />
            <Textarea
              value={editProjectDesc}
              onChange={(e) => setEditProjectDesc(e.target.value)}
              placeholder="项目描述（可选）"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProject(null)}>
              取消
            </Button>
            <Button onClick={handleSaveEditProject}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除项目确认对话框 */}
      <Dialog open={!!deletingProject} onOpenChange={(open) => !open && setDeletingProject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除项目</DialogTitle>
            <DialogDescription>
              确定要删除项目「{deletingProject?.name}」吗？
              {deletingProject && deletingProject.ideaCount > 0 && (
                <>该项目下有 <kbd className="px-1.5 py-0.5 text-xs border border-border rounded bg-accent">{deletingProject.ideaCount}</kbd> 条灵感将一并删除。</>
              )}
              {deletingProject && deletingProject.ideaCount === 0 && (
                <>该项目下暂无灵感。</>
              )}
              该项目及下属灵感将被移入回收站，可在回收站中恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingProject(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleConfirmDeleteProject}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 分类树节点
interface CategoryTreeItemProps {
  category: { id?: number; name: string; icon: string; sortOrder: number };
  isExpanded: boolean;
  isSelected: boolean;
  selectedProjectId: number | null;
  onToggle: () => void;
  onSelectProject: (id: number) => void;
  onEditCategory: (cat: { id: number; name: string; icon: string }) => void;
  onDeleteCategory: (cat: { id: number; name: string }) => void;
  onEditProject: (proj: { id: number; name: string; description: string }) => void;
  onDeleteProject: (proj: { id: number; name: string }) => void;
}

function CategoryTreeItem({
  category,
  isExpanded,
  isSelected,
  selectedProjectId,
  onToggle,
  onSelectProject,
  onEditCategory,
  onDeleteCategory,
  onEditProject,
  onDeleteProject,
}: CategoryTreeItemProps) {
  const projects = useProjects(isExpanded ? category.id! : null);
  const IconComponent = getIconComponent(category.icon);

  return (
    <div>
      <div className="group relative flex items-center">
        <button
          className={`flex-1 flex items-center gap-1.5 px-3 py-1.5 text-sm hover:bg-accent/50 transition-colors ${
            isSelected ? 'bg-accent' : ''
          }`}
          onClick={onToggle}
        >
          {isExpanded ? (
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
          ) : (
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
          )}
          <IconComponent className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
          <span className="truncate">{category.name}</span>
        </button>
        {/* hover 操作按钮 */}
        <div className="absolute right-1.5 hidden group-hover:flex items-center gap-0.5">
          <button
            className="flex items-center justify-center size-5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="编辑分类"
            onClick={(e) => {
              e.stopPropagation();
              onEditCategory({ id: category.id!, name: category.name, icon: category.icon });
            }}
          >
            <Pencil className="size-3" strokeWidth={1.5} />
          </button>
          <button
            className="flex items-center justify-center size-5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
            title="删除分类"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteCategory({ id: category.id!, name: category.name });
            }}
          >
            <Trash2 className="size-3" strokeWidth={1.5} />
          </button>
        </div>
      </div>
      <AnimatePresence initial={false}>
      {isExpanded && (
        <motion.div
          className="ml-4 overflow-hidden"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {projects.map((project) => (
            <div key={project.id} className="group/project relative flex items-center">
              <button
                className={`flex-1 flex items-center gap-1.5 px-3 py-1 text-sm hover:bg-accent/50 transition-colors ${
                  selectedProjectId === project.id ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                }`}
                onClick={() => onSelectProject(project.id!)}
              >
                <FileText className="size-3.5 shrink-0" strokeWidth={1.5} />
                <span className="truncate">{project.name}</span>
              </button>
              {/* hover 操作按钮 */}
              <div className="absolute right-1.5 hidden group-hover/project:flex items-center gap-0.5">
                <button
                  className="flex items-center justify-center size-5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  title="编辑项目"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditProject({ id: project.id!, name: project.name, description: project.description });
                  }}
                >
                  <Pencil className="size-3" strokeWidth={1.5} />
                </button>
                <button
                  className="flex items-center justify-center size-5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
                  title="删除项目"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteProject({ id: project.id!, name: project.name });
                  }}
                >
                  <Trash2 className="size-3" strokeWidth={1.5} />
                </button>
              </div>
            </div>
          ))}
          {projects.length === 0 && (
            <div className="px-3 py-1 text-xs text-muted-foreground/60">
              暂无项目
            </div>
          )}
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
