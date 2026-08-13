import { create } from 'zustand';
import { db } from './db';
import { UNASSIGNED_PROJECT_ID } from '@/hooks/useIdeas';

type ThemeMode = 'light' | 'dark' | 'system';

const THEME_KEY = 'spark-vault-theme';
const SELECTION_KEY = 'spark-vault-selection';
const SIDEBAR_WIDTH_KEY = 'spark-vault-sidebar-width';
const SIDEBAR_COLLAPSED_KEY = 'spark-vault-sidebar-collapsed';
const IDEAS_WIDTH_KEY = 'spark-vault-ideas-width';
const IDEAS_COLLAPSED_KEY = 'spark-vault-ideas-collapsed';

// 侧边栏宽度范围
// SIDEBAR_MIN_WIDTH：正常使用时的最小宽度（拖拽会停在这附近）
// SIDEBAR_COLLAPSE_THRESHOLD：拖拽低于此宽度时自动折叠（比 MIN 小，留出「窄栏」空间）
export const SIDEBAR_MIN_WIDTH = 180;
export const SIDEBAR_MAX_WIDTH = 480;
export const SIDEBAR_DEFAULT_WIDTH = 260;
export const SIDEBAR_COLLAPSE_THRESHOLD = 120;

// 右栏（灵感列表）宽度范围
export const IDEAS_MIN_WIDTH = 260;
export const IDEAS_MAX_WIDTH = 520;
export const IDEAS_DEFAULT_WIDTH = 380;

function readStoredSidebarWidth(): number {
  try {
    const v = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
    if (Number.isFinite(v) && v > 0) {
      // 持久化的宽度至少是最小可见宽度（避免之前存了过窄的值）
      return Math.max(SIDEBAR_MIN_WIDTH, v);
    }
  } catch {
    // ignore
  }
  return SIDEBAR_DEFAULT_WIDTH;
}

function readStoredSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function readStoredIdeasWidth(): number {
  try {
    const v = Number(localStorage.getItem(IDEAS_WIDTH_KEY));
    if (Number.isFinite(v) && v > 0) return v;
  } catch {
    // ignore
  }
  return IDEAS_DEFAULT_WIDTH;
}

function readStoredIdeasCollapsed(): boolean {
  try {
    return localStorage.getItem(IDEAS_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function readStoredTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    // localStorage 不可用时忽略
  }
  return 'system';
}

/**
 * 从 localStorage 读取上次选中的位置
 * 返回 { categoryId, projectId }，都可能为 null
 * projectId 可能为 -1（未分配哨兵值），这里原样返回，由上层 UI 解释
 */
function readStoredSelection(): { categoryId: number | null; projectId: number | null } {
  try {
    const raw = localStorage.getItem(SELECTION_KEY);
    if (!raw) return { categoryId: null, projectId: null };
    const parsed = JSON.parse(raw);
    return {
      categoryId: typeof parsed.categoryId === 'number' ? parsed.categoryId : null,
      projectId: typeof parsed.projectId === 'number' ? parsed.projectId : null,
    };
  } catch {
    return { categoryId: null, projectId: null };
  }
}

function writeStoredSelection(categoryId: number | null, projectId: number | null): void {
  try {
    localStorage.setItem(
      SELECTION_KEY,
      JSON.stringify({ categoryId, projectId })
    );
  } catch {
    // ignore
  }
}

/**
 * 根据当前 theme 值应用 dark class 到 <html> 元素。
 * system 模式下监听系统偏好变化。
 */
export function applyTheme(theme: ThemeMode): void {
  const root = document.documentElement;

  // 清除之前的 system 模式监听器
  if (applyTheme._systemMql && applyTheme._systemHandler) {
    applyTheme._systemMql.removeEventListener('change', applyTheme._systemHandler);
  }
  applyTheme._systemMql = null;
  applyTheme._systemHandler = null;

  if (theme === 'dark') {
    root.classList.add('dark');
  } else if (theme === 'light') {
    root.classList.remove('dark');
  } else {
    // system：跟随系统偏好
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      root.classList.toggle('dark', e.matches);
    };
    // 立即应用一次
    root.classList.toggle('dark', mql.matches);
    mql.addEventListener('change', handler);
    applyTheme._systemMql = mql;
    applyTheme._systemHandler = handler;
  }
}

// 用于存储 system 模式的 MediaQueryList 引用，以便清理
applyTheme._systemMql = null as MediaQueryList | null;
applyTheme._systemHandler = null as ((e: MediaQueryListEvent) => void) | null;

interface EditorInitialValues {
  title: string;
  prompt: string;
  tags: string[];
  projectId: number | null;
}

interface AppState {
  // 选中状态
  selectedCategoryId: number | null;
  selectedProjectId: number | null;
  selectedIdeaId: number | null;

  // 搜索与筛选
  searchQuery: string;
  activeTags: string[];
  isGlobalSearch: boolean;

  // UI 状态
  isEditorOpen: boolean;
  editingIdeaId: number | null; // null 表示新建

  // 回收站 UI
  isTrashOpen: boolean;

  // 游戏化面板 UI（方向一/三/五）
  isForestOpen: boolean;
  isDrawOpen: boolean;
  isTasksOpen: boolean;
  isAchievementsOpen: boolean;
  isCollectionOpen: boolean;
  isPkOpen: boolean;
  isCardOpen: boolean;
  cardIdeaId: number | null;

  // 编辑器初始值快照（用于 isDirty 计算）
  initialEditorValues: EditorInitialValues | null;

  // 主题
  theme: ThemeMode;

  // 侧边栏 UI 状态
  sidebarWidth: number;
  isSidebarCollapsed: boolean;

  // 右栏（灵感列表）UI 状态
  ideasWidth: number;
  isIdeasCollapsed: boolean;

  // Actions
  setSelectedCategoryId: (id: number | null) => void;
  setSelectedProjectId: (id: number | null) => void;
  setSelectedIdeaId: (id: number | null) => void;
  setSearchQuery: (q: string) => void;
  setActiveTags: (tags: string[]) => void;
  toggleTag: (tag: string) => void;
  openEditor: (ideaId?: number) => void;
  closeEditor: () => void;
  setEditingIdeaId: (id: number | null) => void;
  setInitialEditorValues: (values: EditorInitialValues) => void;
  markClean: () => void;
  setTheme: (theme: ThemeMode) => void;
  setSidebarWidth: (width: number) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // 右栏（灵感列表）UI actions
  setIdeasWidth: (width: number) => void;
  toggleIdeas: () => void;
  setIdeasCollapsed: (collapsed: boolean) => void;

  // 回收站 UI actions
  openTrash: () => void;
  closeTrash: () => void;

  // 游戏化面板 UI actions（方向一/三/五）
  openForest: () => void;
  closeForest: () => void;
  openDraw: () => void;
  closeDraw: () => void;
  openTasks: () => void;
  closeTasks: () => void;
  openAchievements: () => void;
  closeAchievements: () => void;
  openCollection: () => void;
  closeCollection: () => void;
  openPk: () => void;
  closePk: () => void;
  openCard: (ideaId?: number) => void;
  closeCard: () => void;

  // 分类/项目 CRUD
  updateCategory: (id: number, data: { name?: string; icon?: string }) => Promise<void>;
  deleteCategory: (id: number) => Promise<void>;
  updateProject: (id: number, data: { name?: string; description?: string }) => Promise<void>;
  deleteProject: (id: number) => Promise<void>;

  // 恢复
  restoreCategory: (id: number) => Promise<void>;
  restoreProject: (id: number) => Promise<void>;
  restoreIdea: (id: number) => Promise<void>;

  // 永久删除
  permanentDeleteCategory: (id: number) => Promise<void>;
  permanentDeleteProject: (id: number) => Promise<void>;
  permanentDeleteIdea: (id: number) => Promise<void>;

  // 清空回收站
  emptyTrash: () => Promise<void>;
}

export const useStore = create<AppState>((set, get) => {
  // 从 localStorage 恢复上次选中的位置（首次访问无记忆时，默认显示「未分配」，避免空白）
  const stored = readStoredSelection();
  const initialProjectId = stored.projectId ?? UNASSIGNED_PROJECT_ID;
  const initialCategoryId = stored.categoryId ?? null;

  return {
    // 选中状态
    selectedCategoryId: initialCategoryId,
    selectedProjectId: initialProjectId,
    selectedIdeaId: null,

    // 搜索与筛选
    searchQuery: '',
    activeTags: [],
    isGlobalSearch: initialProjectId === null,

    // UI 状态
    isEditorOpen: false,
    editingIdeaId: null,

    // 回收站 UI
    isTrashOpen: false,

    // 游戏化面板 UI（方向一/三/五）
    isForestOpen: false,
    isDrawOpen: false,
    isTasksOpen: false,
    isAchievementsOpen: false,
    isCollectionOpen: false,
    isPkOpen: false,
    isCardOpen: false,
    cardIdeaId: null,

    // 编辑器初始值快照
    initialEditorValues: null,

    // 主题：从 localStorage 初始化
    theme: readStoredTheme(),

    // 侧边栏 UI 状态：从 localStorage 初始化
    sidebarWidth: readStoredSidebarWidth(),
    isSidebarCollapsed: readStoredSidebarCollapsed(),

    // 右栏（灵感列表）UI 状态：从 localStorage 初始化
    ideasWidth: readStoredIdeasWidth(),
    isIdeasCollapsed: readStoredIdeasCollapsed(),

    // Actions
    setSelectedCategoryId: (id) => {
      set({ selectedCategoryId: id });
      writeStoredSelection(id, get().selectedProjectId);
    },
    setSelectedProjectId: (id) => {
      set({ selectedProjectId: id, isGlobalSearch: id === null });
      writeStoredSelection(get().selectedCategoryId, id);
    },
    setSelectedIdeaId: (id) => set({ selectedIdeaId: id }),

  setSearchQuery: (q) => set({ searchQuery: q }),

  setActiveTags: (tags) => set({ activeTags: tags }),

  toggleTag: (tag) =>
    set((state) => ({
      activeTags: state.activeTags.includes(tag)
        ? state.activeTags.filter((t) => t !== tag)
        : [...state.activeTags, tag],
    })),

  openEditor: (ideaId) =>
    set({
      isEditorOpen: true,
      editingIdeaId: ideaId !== undefined ? ideaId : null,
    }),

  closeEditor: () =>
    set({
      isEditorOpen: false,
      editingIdeaId: null,
      initialEditorValues: null,
    }),

  setEditingIdeaId: (id) => set({ editingIdeaId: id }),

  setInitialEditorValues: (values) =>
    set({ initialEditorValues: values }),

  markClean: () =>
    set((state) => ({
      initialEditorValues: state.initialEditorValues
        ? { ...state.initialEditorValues }
        : null,
    })),

  // 回收站 UI actions
  openTrash: () => set({ isTrashOpen: true }),
  closeTrash: () => set({ isTrashOpen: false }),

  // 游戏化面板 UI actions（方向一/三/五）
  openForest: () => set({ isForestOpen: true }),
  closeForest: () => set({ isForestOpen: false }),
  openDraw: () => set({ isDrawOpen: true }),
  closeDraw: () => set({ isDrawOpen: false }),
  openTasks: () => set({ isTasksOpen: true }),
  closeTasks: () => set({ isTasksOpen: false }),
  openAchievements: () => set({ isAchievementsOpen: true }),
  closeAchievements: () => set({ isAchievementsOpen: false }),
  openCollection: () => set({ isCollectionOpen: true }),
  closeCollection: () => set({ isCollectionOpen: false }),
  openPk: () => set({ isPkOpen: true }),
  closePk: () => set({ isPkOpen: false }),
  openCard: (ideaId) => set({ isCardOpen: true, cardIdeaId: ideaId !== undefined ? ideaId : null }),
  closeCard: () => set({ isCardOpen: false, cardIdeaId: null }),

  setTheme: (theme) => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // 忽略
    }
    applyTheme(theme);
    set({ theme });
  },

  setSidebarWidth: (width) => {
    // 拖拽时允许低于 SIDEBAR_MIN_WIDTH（以便触发自动折叠），
    // 但最小为 0、最大为 SIDEBAR_MAX_WIDTH
    const clamped = Math.min(SIDEBAR_MAX_WIDTH, Math.max(0, width));
    try {
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(clamped));
    } catch {
      // ignore
    }
    set({ sidebarWidth: clamped });
  },

  toggleSidebar: () => {
    set((state) => {
      const collapsed = !state.isSidebarCollapsed;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
      } catch {
        // ignore
      }
      return { isSidebarCollapsed: collapsed };
    });
  },

  setSidebarCollapsed: (collapsed) => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch {
      // ignore
    }
    set({ isSidebarCollapsed: collapsed });
  },

  // 右栏（灵感列表）UI actions
  setIdeasWidth: (width) => {
    const clamped = Math.min(IDEAS_MAX_WIDTH, Math.max(IDEAS_MIN_WIDTH, width));
    try {
      localStorage.setItem(IDEAS_WIDTH_KEY, String(clamped));
    } catch {
      // ignore
    }
    set({ ideasWidth: clamped });
  },

  toggleIdeas: () => {
    set((state) => {
      const collapsed = !state.isIdeasCollapsed;
      try {
        localStorage.setItem(IDEAS_COLLAPSED_KEY, collapsed ? '1' : '0');
      } catch {
        // ignore
      }
      return { isIdeasCollapsed: collapsed };
    });
  },

  setIdeasCollapsed: (collapsed) => {
    try {
      localStorage.setItem(IDEAS_COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch {
      // ignore
    }
    set({ isIdeasCollapsed: collapsed });
  },

  // 分类/项目 CRUD
  updateCategory: async (id, data) => {
    await db.categories.update(id, data);
  },

  deleteCategory: async (id) => {
    const now = new Date();
    const projects = await db.projects.where('categoryId').equals(id).toArray();
    const projectIds = projects.map((p) => p.id!);
    if (projectIds.length > 0) {
      await db.ideas.where('projectId').anyOf(projectIds).modify((i) => { i.deletedAt = now; });
    }
    await db.projects.where('categoryId').equals(id).modify((p) => { p.deletedAt = now; });
    await db.categories.update(id, { deletedAt: now });
    set((state) => ({
      selectedCategoryId: state.selectedCategoryId === id ? null : state.selectedCategoryId,
      selectedProjectId: state.selectedProjectId && projectIds.includes(state.selectedProjectId) ? null : state.selectedProjectId,
    }));
  },

  updateProject: async (id, data) => {
    await db.projects.update(id, data);
  },

  deleteProject: async (id) => {
    const now = new Date();
    await db.ideas.where('projectId').equals(id).modify((i) => { i.deletedAt = now; });
    await db.projects.update(id, { deletedAt: now });
    set((state) => ({
      selectedProjectId: state.selectedProjectId === id ? null : state.selectedProjectId,
    }));
  },

  // 恢复
  restoreCategory: async (id) => {
    const now = undefined;
    const projects = await db.projects.where('categoryId').equals(id).toArray();
    const projectIds = projects.map((p) => p.id!);
    if (projectIds.length > 0) {
      await db.ideas.where('projectId').anyOf(projectIds).modify((i) => { i.deletedAt = now; });
    }
    await db.projects.where('categoryId').equals(id).modify((p) => { p.deletedAt = now; });
    await db.categories.update(id, { deletedAt: now });
  },

  restoreProject: async (id) => {
    await db.ideas.where('projectId').equals(id).modify((i) => { i.deletedAt = undefined; });
    await db.projects.update(id, { deletedAt: undefined });
  },

  restoreIdea: async (id) => {
    await db.ideas.update(id, { deletedAt: undefined });
  },

  // 永久删除
  permanentDeleteCategory: async (id) => {
    const projects = await db.projects.where('categoryId').equals(id).toArray();
    const projectIds = projects.map((p) => p.id!);
    if (projectIds.length > 0) {
      await db.ideas.where('projectId').anyOf(projectIds).delete();
    }
    await db.projects.where('categoryId').equals(id).delete();
    await db.categories.delete(id);
  },

  permanentDeleteProject: async (id) => {
    await db.ideas.where('projectId').equals(id).delete();
    await db.projects.delete(id);
  },

  permanentDeleteIdea: async (id) => {
    await db.ideas.delete(id);
  },

  // 清空回收站
  emptyTrash: async () => {
    const allCats = await db.categories.toArray();
    const deletedCategories = allCats.filter(c => c.deletedAt);
    for (const cat of deletedCategories) {
      const projects = await db.projects.where('categoryId').equals(cat.id!).toArray();
      const projectIds = projects.map((p) => p.id!);
      if (projectIds.length > 0) {
        await db.ideas.where('projectId').anyOf(projectIds).delete();
      }
      await db.projects.where('categoryId').equals(cat.id!).delete();
    }
    await db.categories.bulkDelete(deletedCategories.map(c => c.id!));
    // 清理剩余已删项目和灵感
    const allProjs = await db.projects.toArray();
    const deletedProjects = allProjs.filter(p => p.deletedAt);
    for (const proj of deletedProjects) {
      await db.ideas.where('projectId').equals(proj.id!).delete();
    }
    await db.projects.bulkDelete(deletedProjects.map(p => p.id!));
    const allIdeas = await db.ideas.toArray();
    const deletedIdeas = allIdeas.filter(i => i.deletedAt);
    await db.ideas.bulkDelete(deletedIdeas.map(i => i.id!));
  },
};
});

// 应用初始主题（在模块加载时执行一次）
applyTheme(useStore.getState().theme);
