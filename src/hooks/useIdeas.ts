import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import type { Idea } from '@/types';

/** 带有来源信息的灵感（全局搜索模式） */
export interface EnrichedIdea extends Idea {
  projectName: string;
  categoryName: string;
}

/**
 * 获取当前项目的所有灵感（带搜索和标签过滤）
 */
export function useFilteredIdeas(projectId: number | null, searchQuery: string, activeTags: string[]) {
  return useLiveQuery(async () => {
    if (!projectId) return [];
    let ideas = await db.ideas.where('projectId').equals(projectId).reverse().sortBy('createdAt');

    // 标签过滤
    if (activeTags.length > 0) {
      ideas = ideas.filter(idea => activeTags.some(tag => idea.tags.includes(tag)));
    }

    // 搜索过滤
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      ideas = ideas.filter(idea =>
        idea.title.toLowerCase().includes(q) ||
        idea.prompt.toLowerCase().includes(q) ||
        idea.tags.some(tag => tag.toLowerCase().includes(q))
      );
    }

    return ideas;
  }, [projectId, searchQuery, activeTags]) ?? [];
}

/**
 * 获取所有分类（按 sortOrder 排序）
 */
export function useCategories() {
  return useLiveQuery(() => db.categories.orderBy('sortOrder').toArray(), []) ?? [];
}

/**
 * 获取分类下的所有项目
 */
export function useProjects(categoryId: number | null) {
  return useLiveQuery(async () => {
    if (!categoryId) return [];
    return db.projects.where('categoryId').equals(categoryId).toArray();
  }, [categoryId]) ?? [];
}

/**
 * 获取单个灵感
 */
export function useIdea(ideaId: number | null) {
  return useLiveQuery(async () => {
    if (!ideaId) return undefined;
    return db.ideas.get(ideaId);
  }, [ideaId]);
}

/**
 * 获取所有项目（用于编辑器中选择）
 */
export function useAllProjects() {
  return useLiveQuery(() => db.projects.toArray(), []) ?? [];
}

/**
 * 全局搜索：跨所有项目搜索灵感，返回附带来源信息的結果
 */
export function useGlobalSearchIdeas(searchQuery: string, activeTags: string[]) {
  return useLiveQuery(async (): Promise<EnrichedIdea[]> => {
    // 构建 project/category 查找表
    const [allIdeas, allProjects, allCategories] = await Promise.all([
      db.ideas.reverse().sortBy('createdAt'),
      db.projects.toArray(),
      db.categories.toArray(),
    ]);

    const projectMap = new Map(allProjects.map((p) => [p.id!, p]));
    const categoryMap = new Map(allCategories.map((c) => [c.id!, c]));

    let results = allIdeas;

    // 标签过滤
    if (activeTags.length > 0) {
      results = results.filter((idea) => activeTags.some((tag) => idea.tags.includes(tag)));
    }

    // 搜索过滤
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      results = results.filter(
        (idea) =>
          idea.title.toLowerCase().includes(q) ||
          idea.prompt.toLowerCase().includes(q) ||
          idea.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    }

    // 附加来源信息
    return results
      .map((idea) => {
        const project = projectMap.get(idea.projectId);
        const category = project ? categoryMap.get(project.categoryId) : undefined;
        return {
          ...idea,
          projectName: project?.name ?? '未知项目',
          categoryName: category?.name ?? '未知分类',
        };
      })
      .filter((r) => r.projectName !== '未知项目'); // 过滤孤立数据
  }, [searchQuery, activeTags]) ?? [];
}
