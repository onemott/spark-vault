import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ICON_OPTIONS, ICON_MAP } from './icons';

/**
 * 侧边栏的各类模态对话框（新建/编辑分类、新建/编辑项目、删除确认）。
 * 与 Sidebar 分离并懒加载，使 @base-ui/react（Dialog 依赖）不在首次启动时加载。
 * 仅在任一对话框打开时才被挂载渲染。
 */
export interface SidebarDialogsProps {
  // 新建分类
  showNewCategoryDialog: boolean;
  setShowNewCategoryDialog: (v: boolean) => void;
  newCategoryName: string;
  setNewCategoryName: (v: string) => void;
  handleCreateCategory: () => void;
  // 新建项目
  showNewProjectDialog: boolean;
  setShowNewProjectDialog: (v: boolean) => void;
  newProjectName: string;
  setNewProjectName: (v: string) => void;
  newProjectDesc: string;
  setNewProjectDesc: (v: string) => void;
  handleCreateProject: () => void;
  // 编辑分类
  editingCategory: { id: number; name: string; icon: string } | null;
  setEditingCategory: (v: { id: number; name: string; icon: string } | null) => void;
  editCategoryName: string;
  setEditCategoryName: (v: string) => void;
  editCategoryIcon: string;
  setEditCategoryIcon: (v: string) => void;
  handleSaveEditCategory: () => void;
  // 删除分类
  deletingCategory: { id: number; name: string; projectCount: number } | null;
  setDeletingCategory: (v: { id: number; name: string; projectCount: number } | null) => void;
  handleConfirmDeleteCategory: () => void;
  // 编辑项目
  editingProject: { id: number; name: string; description: string } | null;
  setEditingProject: (v: { id: number; name: string; description: string } | null) => void;
  editProjectName: string;
  setEditProjectName: (v: string) => void;
  editProjectDesc: string;
  setEditProjectDesc: (v: string) => void;
  handleSaveEditProject: () => void;
  // 删除项目
  deletingProject: { id: number; name: string; ideaCount: number } | null;
  setDeletingProject: (v: { id: number; name: string; ideaCount: number } | null) => void;
  handleConfirmDeleteProject: () => void;
}

export function SidebarDialogs(props: SidebarDialogsProps) {
  return (
    <>
      {/* 新建分类对话框 */}
      <Dialog open={props.showNewCategoryDialog} onOpenChange={props.setShowNewCategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建分类</DialogTitle>
          </DialogHeader>
          <Input
            value={props.newCategoryName}
            onChange={(e) => props.setNewCategoryName(e.target.value)}
            placeholder="分类名称"
            onKeyDown={(e) => e.key === 'Enter' && props.handleCreateCategory()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => props.setShowNewCategoryDialog(false)}>
              取消
            </Button>
            <Button onClick={props.handleCreateCategory}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 新建项目对话框 */}
      <Dialog open={props.showNewProjectDialog} onOpenChange={props.setShowNewProjectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建项目</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input
              value={props.newProjectName}
              onChange={(e) => props.setNewProjectName(e.target.value)}
              placeholder="项目名称"
            />
            <Textarea
              value={props.newProjectDesc}
              onChange={(e) => props.setNewProjectDesc(e.target.value)}
              placeholder="项目描述（可选）"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => props.setShowNewProjectDialog(false)}>
              取消
            </Button>
            <Button onClick={props.handleCreateProject}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑分类对话框 */}
      <Dialog open={!!props.editingCategory} onOpenChange={(open) => !open && props.setEditingCategory(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑分类</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Input
              value={props.editCategoryName}
              onChange={(e) => props.setEditCategoryName(e.target.value)}
              placeholder="分类名称"
              onKeyDown={(e) => e.key === 'Enter' && props.handleSaveEditCategory()}
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
                        props.editCategoryIcon === iconName
                          ? 'border-green-600 bg-green-600/10 text-green-600'
                          : 'border-border hover:bg-accent/50 text-muted-foreground'
                      }`}
                      onClick={() => props.setEditCategoryIcon(iconName)}
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
            <Button variant="outline" onClick={() => props.setEditingCategory(null)}>
              取消
            </Button>
            <Button onClick={props.handleSaveEditCategory}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除分类确认对话框 */}
      <Dialog open={!!props.deletingCategory} onOpenChange={(open) => !open && props.setDeletingCategory(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除分类</DialogTitle>
            <DialogDescription>
              确定要删除分类「{props.deletingCategory?.name}」吗？
              {props.deletingCategory && props.deletingCategory.projectCount > 0 && (
                <>该分类下有 <kbd className="px-1.5 py-0.5 text-xs border border-border rounded bg-accent">{props.deletingCategory.projectCount}</kbd> 个项目及其所有灵感将一并删除。</>
              )}
              {props.deletingCategory && props.deletingCategory.projectCount === 0 && (
                <>该分类下暂无项目。</>
              )}
              该分类及下属项目和灵感将被移入回收站，可在回收站中恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => props.setDeletingCategory(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={props.handleConfirmDeleteCategory}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑项目对话框 */}
      <Dialog open={!!props.editingProject} onOpenChange={(open) => !open && props.setEditingProject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑项目</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input
              value={props.editProjectName}
              onChange={(e) => props.setEditProjectName(e.target.value)}
              placeholder="项目名称"
              onKeyDown={(e) => e.key === 'Enter' && props.handleSaveEditProject()}
            />
            <Textarea
              value={props.editProjectDesc}
              onChange={(e) => props.setEditProjectDesc(e.target.value)}
              placeholder="项目描述（可选）"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => props.setEditingProject(null)}>
              取消
            </Button>
            <Button onClick={props.handleSaveEditProject}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除项目确认对话框 */}
      <Dialog open={!!props.deletingProject} onOpenChange={(open) => !open && props.setDeletingProject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除项目</DialogTitle>
            <DialogDescription>
              确定要删除项目「{props.deletingProject?.name}」吗？
              {props.deletingProject && props.deletingProject.ideaCount > 0 && (
                <>该项目下有 <kbd className="px-1.5 py-0.5 text-xs border border-border rounded bg-accent">{props.deletingProject.ideaCount}</kbd> 条灵感将一并删除。</>
              )}
              {props.deletingProject && props.deletingProject.ideaCount === 0 && (
                <>该项目下暂无灵感。</>
              )}
              该项目及下属灵感将被移入回收站，可在回收站中恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => props.setDeletingProject(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={props.handleConfirmDeleteProject}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default SidebarDialogs;
