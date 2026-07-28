import { create } from 'zustand';
import { db } from './db';

type ThemeMode = 'light' | 'dark' | 'system';

const THEME_KEY = 'spark-vault-theme';

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

  // 主题
  theme: ThemeMode;

  // Actions
  setSelectedCategoryId: (id: number | null) => void;
  setSelectedProjectId: (id: number | null) => void;
  setSelectedIdeaId: (id: number | null) => void;
  setSearchQuery: (q: string) => void;
  setActiveTags: (tags: string[]) => void;
  toggleTag: (tag: string) => void;
  openEditor: (ideaId?: number) => void;
  closeEditor: () => void;
  setTheme: (theme: ThemeMode) => void;

  // 分类/项目 CRUD
  updateCategory: (id: number, data: { name?: string; icon?: string }) => Promise<void>;
  deleteCategory: (id: number) => Promise<void>;
  updateProject: (id: number, data: { name?: string; description?: string }) => Promise<void>;
  deleteProject: (id: number) => Promise<void>;
}

export const useStore = create<AppState>((set) => ({
  // 选中状态
  selectedCategoryId: null,
  selectedProjectId: null,
  selectedIdeaId: null,

  // 搜索与筛选
  searchQuery: '',
  activeTags: [],
  isGlobalSearch: false,

  // UI 状态
  isEditorOpen: false,
  editingIdeaId: null,

  // 主题：从 localStorage 初始化
  theme: readStoredTheme(),

  // Actions
  setSelectedCategoryId: (id) => set({ selectedCategoryId: id }),
  setSelectedProjectId: (id) => set({ selectedProjectId: id, isGlobalSearch: id === null }),
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
    }),

  setTheme: (theme) => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // 忽略
    }
    applyTheme(theme);
    set({ theme });
  },

  // 分类/项目 CRUD
  updateCategory: async (id, data) => {
    await db.categories.update(id, data);
  },

  deleteCategory: async (id) => {
    // 级联删除：分类 -> 项目 -> 灵感
    const projects = await db.projects.where('categoryId').equals(id).toArray();
    const projectIds = projects.map((p) => p.id!);
    if (projectIds.length > 0) {
      await db.ideas.where('projectId').anyOf(projectIds).delete();
    }
    await db.projects.where('categoryId').equals(id).delete();
    await db.categories.delete(id);
    // 清除选中状态
    set((state) => ({
      selectedCategoryId: state.selectedCategoryId === id ? null : state.selectedCategoryId,
      selectedProjectId: state.selectedProjectId && projectIds.includes(state.selectedProjectId) ? null : state.selectedProjectId,
    }));
  },

  updateProject: async (id, data) => {
    await db.projects.update(id, data);
  },

  deleteProject: async (id) => {
    // 级联删除：项目 -> 灵感
    await db.ideas.where('projectId').equals(id).delete();
    await db.projects.delete(id);
    // 清除选中状态
    set((state) => ({
      selectedProjectId: state.selectedProjectId === id ? null : state.selectedProjectId,
    }));
  },
}));

// 应用初始主题（在模块加载时执行一次）
applyTheme(useStore.getState().theme);
